import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createWalletTransaction } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('M-Pesa callback received body:', JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    const payment = await prisma.payment.findUnique({
      where: { checkoutRequestID: CheckoutRequestID },
    });

    if (!payment) {
      console.error(`Payment not found for checkoutRequestID: ${CheckoutRequestID}`);
      return NextResponse.json({ message: 'Payment record not found' }, { status: 404 });
    }

    if (ResultCode === 0) {
      // Success! Extract receipt metadata
      let receiptNumber = '';
      const items = CallbackMetadata?.Item || [];
      const receiptItem = items.find((item: any) => item.Name === 'MpesaReceiptNumber');
      if (receiptItem) {
        receiptNumber = receiptItem.Value;
      }

      const purchaseType = payment.receiptNumber || '';

      // 1. Update Payment status to SUCCESS
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          receiptNumber,
        },
      });

      // 2. Identify target purchase type
      // Check A: Coin Purchase
      const coinPurchase = await prisma.coinPurchase.findUnique({
        where: { checkoutRequestID: CheckoutRequestID },
      });

      if (coinPurchase || purchaseType.startsWith('PENDING_COINS_') || CheckoutRequestID.startsWith('ws_COINS_')) {
        let coins = 0;
        if (coinPurchase) {
          coins = coinPurchase.coins;
        } else if (purchaseType.startsWith('PENDING_COINS_')) {
          coins = parseInt(purchaseType.split('_')[2]) || 0;
        } else {
          coins = parseInt(CheckoutRequestID.split('_')[1]) || 0;
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
          0.0,
          coins,
          'DEPOSIT',
          `Credited ${coins} coins via M-Pesa (${receiptNumber})`,
          'SUCCESS',
          CheckoutRequestID
        );

        console.log(`Coins successfully credited for user ${payment.userId}.`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // Check B: Subscription upgrade
      if (purchaseType.startsWith('PENDING_SUB_') || CheckoutRequestID.startsWith('ws_SUB_')) {
        let planType = 'MONTHLY';
        if (purchaseType.startsWith('PENDING_SUB_')) {
          planType = purchaseType.split('_')[2] || 'MONTHLY';
        } else {
          const parts = CheckoutRequestID.split('_');
          planType = parts[2] || 'MONTHLY';
        }

        let durationDays = 30;
        if (planType === 'WEEKLY') durationDays = 7;
        else if (planType === 'YEARLY') durationDays = 365;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        await prisma.subscription.updateMany({
          where: { userId: payment.userId, status: 'ACTIVE' },
          data: { status: 'EXPIRED' }
        });

        await prisma.subscription.create({
          data: {
            userId: payment.userId,
            planType,
            price: payment.amount,
            status: 'ACTIVE',
            expiresAt,
          }
        });

        await prisma.profile.update({
          where: { userId: payment.userId },
          data: {
            isPremium: true,
            premiumUntil: expiresAt
          }
        });

        await createWalletTransaction(
          payment.userId,
          0.0,
          0,
          'DEPOSIT',
          `Upgraded to Pendo Premium ${planType} plan via M-Pesa (${receiptNumber})`,
          'SUCCESS',
          CheckoutRequestID
        );

        console.log(`Subscription successfully upgraded to Premium ${planType} for user ${payment.userId}.`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // Check D: Profile Unlock (starts with `ws_UP_`)
      if (CheckoutRequestID.startsWith('ws_UP_')) {
        const parts = CheckoutRequestID.split('_');
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
          `Unlocked profile via M-Pesa (${receiptNumber})`,
          'SUCCESS',
          CheckoutRequestID
        );

        console.log(`Profile unlocked successfully via M-Pesa callback for user ${payment.userId}.`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // Check E: Media Unlock (starts with `ws_UM_`)
      if (CheckoutRequestID.startsWith('ws_UM_')) {
        const parts = CheckoutRequestID.split('_');
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
          `Unlocked media index ${mediaIndex} via M-Pesa (${receiptNumber})`,
          'SUCCESS',
          CheckoutRequestID
        );

        console.log(`Media item unlocked successfully via M-Pesa callback for user ${payment.userId}.`);
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // Check C: Direct Wallet Deposit
      await createWalletTransaction(
        payment.userId,
        payment.amount,
        0,
        'DEPOSIT',
        `Deposited KES ${payment.amount} to Wallet via M-Pesa (${receiptNumber})`,
        'SUCCESS',
        CheckoutRequestID
      );

      console.log(`Deposit of KES ${payment.amount} credited for user ${payment.userId}.`);
    } else {
      // Payment failed or cancelled
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
        },
      });

      const coinPurchase = await prisma.coinPurchase.findUnique({
        where: { checkoutRequestID: CheckoutRequestID },
      });
      if (coinPurchase) {
        await prisma.coinPurchase.update({
          where: { id: coinPurchase.id },
          data: { status: 'FAILED' }
        });
      }

      console.log(`Payment failed for user ${payment.userId}. Description: ${ResultDesc}`);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback handling error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
