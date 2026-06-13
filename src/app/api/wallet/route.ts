import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { getOrCreateWallet, createWalletTransaction } from '@/lib/wallet';
import { getSystemConfig } from '@/lib/config';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const wallet = await getOrCreateWallet(decoded.id);

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch premium status
    const profile = await prisma.profile.findUnique({
      where: { userId: decoded.id },
      select: { isPremium: true, premiumUntil: true }
    });

    return NextResponse.json({
      wallet: {
        balance: wallet.balance,
        coins: wallet.coins,
      },
      transactions,
      isPremium: profile?.isPremium || false,
      premiumUntil: profile?.premiumUntil || null,
    });
  } catch (error) {
    console.error('Fetch wallet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, coinAmount, paymentMethod } = body; // action: 'BUY_COINS' or 'DEPOSIT'

    const config = await getSystemConfig();

    if (action === 'BUY_COINS') {
      let price = 0;
      if (coinAmount === 10) price = config.coinPrice10;
      else if (coinAmount === 50) price = config.coinPrice50;
      else if (coinAmount === 100) price = config.coinPrice100;
      else return NextResponse.json({ error: 'Invalid coin amount package' }, { status: 400 });

      if (paymentMethod === 'WALLET') {
        try {
          // Deduct from wallet balance and grant coins
          await createWalletTransaction(
            decoded.id,
            -price,
            coinAmount,
            'DEDUCTION',
            `Purchased ${coinAmount} Coins bundle using Wallet balance`
          );
          
          return NextResponse.json({ success: true, message: `Successfully purchased ${coinAmount} coins!` });
        } catch (err: any) {
          return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
        }
      } else if (paymentMethod === 'MPESA') {
        // Here we initiate an M-Pesa STK push for the coin bundle
        // We will create a pending CoinPurchase log
        const checkoutRequestID = 'ws_CP_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        
        await prisma.coinPurchase.create({
          data: {
            userId: decoded.id,
            coins: coinAmount,
            amount: price,
            checkoutRequestID,
            status: 'PENDING',
          }
        });

        // We also create a Payment log to keep all STK push logs unified
        // We will detect coin purchases inside callback/simulate-callback to auto-grant coins!
        await prisma.payment.create({
          data: {
            userId: decoded.id,
            amount: price,
            phoneNumber: decoded.phone || '254700000000', // fallback phone
            checkoutRequestID,
            status: 'PENDING',
          }
        });

        return NextResponse.json({
          success: true,
          mpesaRequired: true,
          checkoutRequestID,
          amount: price,
          message: `Please complete M-Pesa STK Push payment of KES ${price}.`,
        });
      }
    } else if (action === 'DEPOSIT') {
      const { amount, phoneNumber } = body;
      const depositAmount = parseFloat(amount);
      if (!depositAmount || depositAmount <= 0) {
        return NextResponse.json({ error: 'Invalid deposit amount' }, { status: 400 });
      }

      const checkoutRequestID = 'ws_DP_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      
      await prisma.payment.create({
        data: {
          userId: decoded.id,
          amount: depositAmount,
          phoneNumber: phoneNumber || '254700000000',
          checkoutRequestID,
          status: 'PENDING',
        }
      });

      return NextResponse.json({
        success: true,
        mpesaRequired: true,
        checkoutRequestID,
        amount: depositAmount,
        message: `Please complete M-Pesa STK Push payment of KES ${depositAmount} to deposit into your Wallet.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Wallet operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
