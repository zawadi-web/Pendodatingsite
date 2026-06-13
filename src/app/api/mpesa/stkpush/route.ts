import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// Simple helper to generate unique checkout request ID for simulator
function generateMockCheckoutID() {
  return 'ws_CO_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = decoded.id;
    const body = await request.json();
    let { phoneNumber, amount, planType, accountReference, transactionDesc } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Standardize phone number to Safaricom 2547XXXXXXXX or 2541XXXXXXXX format
    // Strip leading '+' or '0'
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      cleanPhone = '254' + cleanPhone;
    }

    if (cleanPhone.length !== 12 || !cleanPhone.startsWith('254')) {
      return NextResponse.json({ error: 'Invalid Kenyan phone number. Format should be 07XXXXXXXX or 2547XXXXXXXX' }, { status: 400 });
    }

    // Default premium price is 100 KES
    const finalAmount = parseFloat(amount) || 100.0;

    // If a planType is provided, create a subscription-encoded checkout ID
    // This allows the simulate-callback to activate the subscription on success
    let checkoutRequestID: string;
    if (planType && ['WEEKLY', 'MONTHLY', 'YEARLY'].includes(planType)) {
      checkoutRequestID = `ws_SUB_${planType}_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    } else {
      checkoutRequestID = generateMockCheckoutID();
    }

    const finalAccountRef = accountReference || (planType ? `PendoPremium${planType}` : 'PendoPlatform');
    const finalTransDesc = transactionDesc || 'Pendo Platform Payment';

    // Check if Daraja API credentials are in environment variables
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const passkey = process.env.MPESA_PASSKEY;
    const shortcode = process.env.MPESA_SHORTCODE || '174379'; // default sandbox paybill
    const callbackUrl = process.env.MPESA_CALLBACK_URL; // public URL for safaricom callbacks

    const checkoutRequestID = generateMockCheckoutID();

    // Create payment in PENDING status
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: finalAmount,
        phoneNumber: cleanPhone,
        checkoutRequestID,
        status: 'PENDING',
      },
    });

    if (consumerKey && consumerSecret && passkey && callbackUrl) {
      // Real or Sandbox Daraja API STK Push
      try {
        // 1. Get OAuth Access Token
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
          headers: { Authorization: `Basic ${auth}` },
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
          throw new Error('Failed to generate M-Pesa access token');
        }

        // 2. Generate Password
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); // YYYYMMDDHHmmss
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

        // 3. Initiate STK Push
        const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: finalAmount,
            PartyA: cleanPhone,
            PartyB: shortcode,
            PhoneNumber: cleanPhone,
            CallBackURL: callbackUrl,
            AccountReference: finalAccountRef,
            TransactionDesc: finalTransDesc,
          }),
        });

        const stkData = await stkRes.json();

        if (stkData.ResponseCode === '0') {
          // Update the payment record with Safaricom's real checkout ID
          await prisma.payment.update({
            where: { id: payment.id },
            data: { checkoutRequestID: stkData.CheckoutRequestID },
          });

          return NextResponse.json({
            message: 'STK Push initiated successfully',
            checkoutRequestID: stkData.CheckoutRequestID,
            simulated: false,
          });
        } else {
          throw new Error(stkData.ResponseDescription || 'STK Push request rejected');
        }
      } catch (err: any) {
        console.error('Real Daraja M-Pesa error, falling back to simulator:', err);
        // Fall through to simulated mode if sandbox integration fails
      }
    }

    // Simulated STK Push (Perfect for local development / testing without active Daraja Setup)
    return NextResponse.json({
      message: 'Simulated STK Push initiated successfully. Please click confirm payment.',
      checkoutRequestID,
      simulated: true,
      phoneNumber: cleanPhone,
    });
  } catch (error) {
    console.error('M-Pesa STK Push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
