import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createWalletTransaction } from '@/lib/wallet';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pendodatingsite-qe2d.vercel.app';

  if (!reference) {
    return NextResponse.redirect(`${appUrl}/wallet?error=No+reference+provided`);
  }

  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.redirect(`${appUrl}/wallet?error=Paystack+not+configured`);
    }

    // Verify transaction status with Paystack REST API
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.status || verifyData.data.status !== 'success') {
      console.error('Paystack verification failed:', verifyData);
      return NextResponse.redirect(`${appUrl}/wallet?error=Payment+verification+failed`);
    }

    const txData = verifyData.data;
    const metadata = txData.metadata || {};
    const userId = metadata.userId;
    const planType = metadata.planType;
    const coinsToCredit = parseInt(metadata.coinsToCredit || '0');
    const paystackReceipt = txData.reference || txData.id?.toString();

    if (!userId) {
      console.error('Missing userId in Paystack transaction metadata');
      return NextResponse.redirect(`${appUrl}/wallet?payment=success`);
    }

    // 1. Process payment idempotently in database
    const payment = await prisma.payment.findFirst({
      where: { checkoutRequestID: reference },
    });

    if (payment && payment.status === 'COMPLETED') {
      // Already processed!
      const redirectPage = planType ? 'premium' : 'wallet';
      return NextResponse.redirect(`${appUrl}/${redirectPage}?payment=already_processed`);
    }

    // Mark Payment as COMPLETED
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          receiptNumber: paystackReceipt,
        },
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

    // 2. Handle Subscription Activation
    if (planType && ['WEEKLY', 'MONTHLY', 'YEARLY'].includes(planType)) {
      let durationDays = 30;
      if (planType === 'WEEKLY') durationDays = 7;
      if (planType === 'YEARLY') durationDays = 365;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      // Deactivate existing active subscriptions
      await prisma.subscription.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      // Create new active subscription
      await prisma.subscription.create({
        data: {
          userId,
          planType,
          price: txData.amount / 100,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      // Update User profile premium status
      await prisma.profile.update({
        where: { userId },
        data: {
          isPremium: true,
          premiumUntil: expiresAt,
        },
      });

      return NextResponse.redirect(`${appUrl}/premium?payment=success`);
    }

    // 3. Handle Coin Purchases
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

      return NextResponse.redirect(`${appUrl}/wallet?payment=success`);
    }

    return NextResponse.redirect(`${appUrl}/wallet?payment=success`);

  } catch (error) {
    console.error('Paystack callback error:', error);
    return NextResponse.redirect(`${appUrl}/wallet?error=Internal+server+error`);
  }
}
