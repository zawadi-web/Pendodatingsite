import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createWalletTransaction } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    // Block simulator callback in production
    if (process.env.NODE_ENV === 'production') {
      console.warn('Blocked simulated M-Pesa callback in production environment.');
      return NextResponse.json({ error: 'Payment simulation is disabled in production.' }, { status: 403 });
    }

    const body = await request.json();
    const { checkoutRequestID, status } = body;

    if (!checkoutRequestID) {
      return NextResponse.json({ error: 'checkoutRequestID is required' }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { checkoutRequestID },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    if (status === 'SUCCESS') {
      const mockReceipt = 'MPESA' + Math.random().toString(36).substring(2, 9).toUpperCase();

      const purchaseType = payment.receiptNumber || '';

      // 1. Update Payment status to SUCCESS
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          receiptNumber: mockReceipt,
        },
      });

      // 2. Identify target purchase type
      // Check A: Coin Purchase
      const coinPurchase = await prisma.coinPurchase.findUnique({
        where: { checkoutRequestID },
      });

      if (coinPurchase || purchaseType.startsWith('PENDING_COINS_') || checkoutRequestID.startsWith('ws_COINS_')) {
        let coins = 0;
        if (coinPurchase) {
          coins = coinPurchase.coins;
        } else if (purchaseType.startsWith('PENDING_COINS_')) {
          coins = parseInt(purchaseType.split('_')[2]) || 0;
        } else {
          coins = parseInt(checkoutRequestID.split('_')[1]) || 0;
        }

        if (coinPurchase) {
          await prisma.coinPurchase.update({
            where: { id: coinPurchase.id },
            data: { status: 'SUCCESS' },
          });
        }

        // Add coins to wallet
        await createWalletTransaction(
          payment.userId,
          0.0, // No balance increase, this was coin purchase
          coins,
          'DEPOSIT',
          `Credited ${coins} coins via M-Pesa (${mockReceipt})`,
          'SUCCESS',
          checkoutRequestID
        );

        return NextResponse.json({
          message: `M-Pesa payment successful! ${coins} coins credited to wallet.`,
          payment: updatedPayment,
        });
      }

      // Check B: Subscription upgrade (e.g. prefix `ws_SUB_` or matching price)
      if (purchaseType.startsWith('PENDING_SUB_') || checkoutRequestID.startsWith('ws_SUB_')) {
        let planType = 'MONTHLY';
        if (purchaseType.startsWith('PENDING_SUB_')) {
          planType = purchaseType.split('_')[2] || 'MONTHLY';
        } else {
          const parts = checkoutRequestID.split('_');
          planType = parts[2] || 'MONTHLY';
        }

        let durationDays = 30;
        if (planType === 'WEEKLY') durationDays = 7;
        else if (planType === 'YEARLY') durationDays = 365;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        // Deactivate existing subs
        await prisma.subscription.updateMany({
          where: { userId: payment.userId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' }
        });

        // Create subscription
        await prisma.subscription.create({
          data: {
            userId: payment.userId,
            planType,
            price: payment.amount,
            status: 'ACTIVE',
            expiresAt,
          }
        });

        // Upgrade profile
        await prisma.profile.update({
          where: { userId: payment.userId },
          data: {
            isPremium: true,
            premiumUntil: expiresAt
          }
        });

        // Add transaction log
        await createWalletTransaction(
          payment.userId,
          0.0,
          0,
          'DEPOSIT',
          `Upgraded to Pendo Premium ${planType} plan via M-Pesa (${mockReceipt})`,
          'SUCCESS',
          checkoutRequestID
        );

        return NextResponse.json({
          message: `Subscription successfully upgraded to Premium ${planType}!`,
          payment: updatedPayment,
        });
      }

      // Check D: Profile Unlock (starts with `ws_UP_`)
      if (checkoutRequestID.startsWith('ws_UP_')) {
        const parts = checkoutRequestID.split('_');
        const targetUserId = parts[2];

        // Create the ProfileUnlock record
        await prisma.profileUnlock.upsert({
          where: {
            userId_targetUserId: {
              userId: payment.userId,
              targetUserId,
            }
          },
          update: {},
          create: {
            userId: payment.userId,
            targetUserId,
          }
        });

        // Add transaction log
        await createWalletTransaction(
          payment.userId,
          0.0,
          0,
          'DEDUCTION',
          `Unlocked profile via M-Pesa (${mockReceipt})`,
          'SUCCESS',
          checkoutRequestID
        );

        return NextResponse.json({
          message: 'Profile successfully unlocked!',
          payment: updatedPayment,
        });
      }

      // Check E: Media Unlock (starts with `ws_UM_`)
      if (checkoutRequestID.startsWith('ws_UM_')) {
        const parts = checkoutRequestID.split('_');
        const targetUserId = parts[2];
        const mediaIndex = parseInt(parts[3]);

        // Create the MediaUnlock record
        await prisma.mediaUnlock.upsert({
          where: {
            userId_targetUserId_mediaIndex: {
              userId: payment.userId,
              targetUserId,
              mediaIndex,
            }
          },
          update: {},
          create: {
            userId: payment.userId,
            targetUserId,
            mediaIndex,
          }
        });

        // Add transaction log
        await createWalletTransaction(
          payment.userId,
          0.0,
          0,
          'DEDUCTION',
          `Unlocked media index ${mediaIndex} via M-Pesa (${mockReceipt})`,
          'SUCCESS',
          checkoutRequestID
        );

        return NextResponse.json({
          message: 'Media item successfully unlocked!',
          payment: updatedPayment,
        });
      }

      // Check C: Direct Wallet Deposit (starts with `ws_DP_` or default)
      // Deposit money into wallet balance
      await createWalletTransaction(
        payment.userId,
        payment.amount, // Balance increase
        0,
        'DEPOSIT',
        `Deposited KES ${payment.amount} to Wallet via M-Pesa (${mockReceipt})`,
        'SUCCESS',
        checkoutRequestID
      );

      return NextResponse.json({
        message: `KES ${payment.amount} successfully deposited to Wallet!`,
        payment: updatedPayment,
      });

    } else {
      // Payment marked as failed
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
        },
      });

      // Also mark coin purchase as failed if exists
      const coinPurchase = await prisma.coinPurchase.findUnique({
        where: { checkoutRequestID },
      });
      if (coinPurchase) {
        await prisma.coinPurchase.update({
          where: { id: coinPurchase.id },
          data: { status: 'FAILED' }
        });
      }

      return NextResponse.json({
        message: 'Payment simulation marked as failed.',
        payment: updatedPayment,
      });
    }
  } catch (error) {
    console.error('M-Pesa simulation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
