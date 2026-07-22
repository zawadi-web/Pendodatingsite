import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = decoded.id;
    const body = await request.json();
    const { amount, planType, coinsToCredit, email } = body;

    const finalAmount = parseFloat(amount);
    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    // Get user details for Paystack customer email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: 'Paystack is not configured on the server.' }, { status: 500 });
    }

    const customerEmail = user.email || email || `${userId}@pendo.app`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pendodatingsite-hdix-five.vercel.app';
    const callbackUrl = `${appUrl}/api/paystack/callback`;

    // Paystack amounts are in cents/sub-units (1 KES = 100 cents)
    const paystackAmountInCents = Math.round(finalAmount * 100);

    // Call Paystack Transaction Initialize API
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: paystackAmountInCents,
        currency: 'KES',
        callback_url: callbackUrl,
        channels: ['mobile_money', 'card'],
        metadata: {
          userId,
          planType: planType || null,
          coinsToCredit: coinsToCredit ? parseInt(coinsToCredit) : 0,
          userPhone: user.phone || null,
          userName: user.profile?.name || 'Pendo User',
          custom_fields: [
            {
              display_name: 'Platform',
              variable_name: 'platform',
              value: 'Pendo Dating',
            },
            {
              display_name: 'Item',
              variable_name: 'item',
              value: planType ? `Premium ${planType}` : `${coinsToCredit || 0} Coins`,
            }
          ]
        }
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('Paystack initialization error:', paystackData);
      return NextResponse.json({ error: paystackData.message || 'Failed to initialize Paystack payment.' }, { status: 400 });
    }

    const { authorization_url, reference } = paystackData.data;

    // Create PENDING Payment record in database
    let pendingMetadata = '';
    if (planType) {
      pendingMetadata = `PAYSTACK_SUB_${planType}`;
    } else if (coinsToCredit) {
      pendingMetadata = `PAYSTACK_COINS_${coinsToCredit}`;
    }

    await prisma.payment.create({
      data: {
        userId,
        amount: finalAmount,
        phoneNumber: user.phone || '0700000000',
        checkoutRequestID: reference,
        status: 'PENDING',
        receiptNumber: pendingMetadata || null,
      }
    });

    if (coinsToCredit) {
      await prisma.coinPurchase.create({
        data: {
          userId,
          coins: parseInt(coinsToCredit),
          amount: finalAmount,
          checkoutRequestID: reference,
          status: 'PENDING',
        }
      });
    }

    return NextResponse.json({
      success: true,
      authorization_url,
      reference,
    });

  } catch (error: any) {
    console.error('Paystack initialize error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
