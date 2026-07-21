import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { createWalletTransaction } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: 'Paystack secret not set' }, { status: 500 });
    }

    const bodyText = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    // Verify Paystack HMAC SHA512 signature
    if (!signature) {
      return NextResponse.json({ error: 'Missing x-paystack-signature header' }, { status: 400 });
    }

    const hash = crypto
      .createHmac('sha512', paystackSecret)
      .update(bodyText)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid Paystack webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === 'charge.success') {
      const txData = event.data;
      const reference = txData.reference;
      const metadata = txData.metadata || {};
      const userId = metadata.userId;
      const planType = metadata.planType;
      const coinsToCredit = parseInt(metadata.coinsToCredit || '0');
      const paystackReceipt = reference || txData.id?.toString();

      if (userId) {
        // Idempotent check
        const payment = await prisma.payment.findFirst({
          where: { checkoutRequestID: reference },
        });

        if (!payment || payment.status !== 'COMPLETED') {
          // Mark COMPLETED
          if (payment) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'COMPLETED', receiptNumber: paystackReceipt },
            });
          } else {
            await prisma.payment.create({
              data: {
                userId,
                amount: txData.amount / 100,
                phoneNumber: metadata.userPhone || 'Paystack',
                checkoutRequestID: reference,
                receiptNumber: paystackReceipt,
                status: 'COMPLETED',
              },
            });
          }

          // Handle Premium Subscription
          if (planType && ['WEEKLY', 'MONTHLY', 'YEARLY'].includes(planType)) {
            let durationDays = 30;
            if (planType === 'WEEKLY') durationDays = 7;
            if (planType === 'YEARLY') durationDays = 365;

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + durationDays);

            await prisma.subscription.updateMany({
              where: { userId, status: 'ACTIVE' },
              data: { status: 'EXPIRED' },
            });

            await prisma.subscription.create({
              data: {
                userId,
                planType,
                price: txData.amount / 100,
                status: 'ACTIVE',
                expiresAt,
              },
            });

            await prisma.profile.update({
              where: { userId },
              data: { isPremium: true, premiumUntil: expiresAt },
            });
          }

          // Handle Coins Purchase
          if (coinsToCredit > 0) {
            await createWalletTransaction(
              userId,
              0,
              coinsToCredit,
              'DEPOSIT',
              `Purchased ${coinsToCredit} coins via Paystack M-Pesa/Card`
            );

            await prisma.coinPurchase.updateMany({
              where: { checkoutRequestID: reference },
              data: { status: 'COMPLETED' },
            });
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Paystack webhook error:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}
