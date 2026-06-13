import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { createWalletTransaction, getOrCreateWallet } from '@/lib/wallet';
import { getSystemConfig } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { planType, payMethod, phoneNumber } = body; // planType: 'WEEKLY' | 'MONTHLY' | 'YEARLY'

    if (!planType || (planType !== 'WEEKLY' && planType !== 'MONTHLY' && planType !== 'YEARLY')) {
      return NextResponse.json({ error: 'Invalid plan type selected' }, { status: 400 });
    }

    const config = await getSystemConfig();
    let price = config.monthlySubPrice;
    let durationDays = 30;

    if (planType === 'WEEKLY') {
      price = config.weeklySubPrice;
      durationDays = 7;
    } else if (planType === 'YEARLY') {
      price = config.yearlySubPrice;
      durationDays = 365;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    if (payMethod === 'WALLET') {
      try {
        const wallet = await getOrCreateWallet(decoded.id);
        if (wallet.balance < price) {
          return NextResponse.json({ error: `Insufficient wallet balance. Price: KES ${price}.` }, { status: 400 });
        }

        // Deduct from wallet
        await createWalletTransaction(
          decoded.id,
          -price,
          0,
          'DEDUCTION',
          `Subscribed to Pendo Premium ${planType} plan`
        );

        // Deactivate existing subs
        await prisma.subscription.updateMany({
          where: { userId: decoded.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED' }
        });

        // Record active sub
        await prisma.subscription.create({
          data: {
            userId: decoded.id,
            planType,
            price,
            status: 'ACTIVE',
            expiresAt,
          }
        });

        // Upgrade profile
        await prisma.profile.update({
          where: { userId: decoded.id },
          data: {
            isPremium: true,
            premiumUntil: expiresAt,
          }
        });

        return NextResponse.json({ success: true, message: `Subscribed successfully to Premium ${planType}!` });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
      }
    } else if (payMethod === 'MPESA') {
      const checkoutRequestID = `ws_SUB_${planType}_${Math.random().toString(36).substring(2, 10)}`;

      await prisma.payment.create({
        data: {
          userId: decoded.id,
          amount: price,
          phoneNumber: phoneNumber || decoded.phone || '254700000000',
          checkoutRequestID,
          status: 'PENDING',
        }
      });

      return NextResponse.json({
        success: true,
        mpesaRequired: true,
        checkoutRequestID,
        amount: price,
        message: `Please complete M-Pesa STK Push payment of KES ${price} to activate Premium ${planType}.`,
      });
    }

    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
  } catch (error) {
    console.error('Subscription purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
