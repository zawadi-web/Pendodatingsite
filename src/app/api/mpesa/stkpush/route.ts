import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSystemConfig } from '@/lib/config';

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
    let { phoneNumber, phone, amount, planType, accountReference, transactionDesc } = body;

    const targetPhone = phoneNumber || phone;

    if (!targetPhone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Standardize phone number to Safaricom 2547XXXXXXXX or 2541XXXXXXXX format
    // Strip leading '+' or '0'
    let cleanPhone = targetPhone.replace(/\D/g, '');
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

    // Parse coins from accountReference (e.g. ws_COINS_starter_50) or body
    let coinsToCredit = 0;
    const ref = accountReference || '';
    if (ref.startsWith('ws_COINS_')) {
      const parts = ref.split('_');
      coinsToCredit = parseInt(parts[3]) || parseInt(parts[2]) || 0;
    }

    // If a planType is provided, create a subscription-encoded checkout ID
    // This allows the simulate-callback to activate the subscription on success
    let checkoutRequestID: string;
    if (planType && ['WEEKLY', 'MONTHLY', 'YEARLY'].includes(planType)) {
      checkoutRequestID = `ws_SUB_${planType}_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    } else if (coinsToCredit > 0) {
      checkoutRequestID = `ws_COINS_${coinsToCredit}_${Math.random().toString(36).substring(2, 8)}_${Date.now().toString(36)}`;
    } else {
      checkoutRequestID = generateMockCheckoutID();
    }

    // Check if Daraja API credentials are in environment variables or database
    const sysConfig = await getSystemConfig();
    const consumerKey = sysConfig.mpesaConsumerKey || process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = sysConfig.mpesaConsumerSecret || process.env.MPESA_CONSUMER_SECRET;
    const passkey = sysConfig.mpesaPasskey || process.env.MPESA_PASSKEY;
    const shortcode = sysConfig.mpesaShortCode || process.env.MPESA_SHORTCODE || '174379'; // default sandbox paybill
    const callbackUrl = sysConfig.mpesaCallbackUrl || process.env.MPESA_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mpesa/callback`; // public URL for safaricom callbacks

    // Dynamic check for Paybill vs Buy Goods Till
    const tillNumber = process.env.MPESA_TILL_NUMBER || '';
    const isTill = tillNumber.length > 0;
    const transactionType = isTill ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
    const partyB = isTill ? tillNumber : shortcode;

    let finalAccountRef = accountReference || (planType ? `PendoPremium${planType}` : 'PendoPlatform');
    if (shortcode === '506900') {
      finalAccountRef = '0026005020010444';
    }
    const finalTransDesc = transactionDesc || 'Pendo Platform Payment';

    // Append secure webhook token to CallBackURL
    const webhookSecret = process.env.MPESA_WEBHOOK_SECRET || passkey || 'fallback_secret';
    const finalCallbackUrl = callbackUrl.includes('?')
      ? `${callbackUrl}&token=${webhookSecret}`
      : `${callbackUrl}?token=${webhookSecret}`;

    // Select live vs sandbox base URL dynamically
    const mpesaEnv = process.env.MPESA_ENV || 'sandbox';
    const isProd = mpesaEnv === 'production';
    const mpesaBaseUrl = isProd
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    // Metadata to store in receiptNumber temporarily
    let pendingMetadata = '';
    if (planType && ['WEEKLY', 'MONTHLY', 'YEARLY'].includes(planType)) {
      pendingMetadata = `PENDING_SUB_${planType}`;
    } else if (coinsToCredit > 0) {
      pendingMetadata = `PENDING_COINS_${coinsToCredit}`;
    }

    // Create payment in PENDING status
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: finalAmount,
        phoneNumber: cleanPhone,
        checkoutRequestID,
        status: 'PENDING',
        receiptNumber: pendingMetadata || null,
      },
    });

    // Create CoinPurchase log in PENDING status
    if (coinsToCredit > 0) {
      await prisma.coinPurchase.create({
        data: {
          userId,
          coins: coinsToCredit,
          amount: finalAmount,
          checkoutRequestID,
          status: 'PENDING',
        }
      });
    }

    if (consumerKey && consumerSecret && passkey && callbackUrl) {
      // Real or Sandbox Daraja API STK Push
      try {
        // 1. Get OAuth Access Token
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const tokenRes = await fetch(`${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
          throw new Error('Failed to generate M-Pesa access token');
        }

        // 2. Generate EAT Password and Timestamp (Safaricom requires timezone-aligned EAT YYYYMMDDHHmmss)
        const formatter = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Africa/Nairobi',
        });
        const parts = formatter.formatToParts(new Date());
        const partMap: Record<string, string> = {};
        parts.forEach(p => { partMap[p.type] = p.value; });
        const timestamp = `${partMap.year}${partMap.month}${partMap.day}${partMap.hour}${partMap.minute}${partMap.second}`;

        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

        // 3. Initiate STK Push
        const stkRes = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: transactionType,
            Amount: finalAmount,
            PartyA: cleanPhone,
            PartyB: partyB,
            PhoneNumber: cleanPhone,
            CallBackURL: finalCallbackUrl,
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

          // Sync CoinPurchase checkout ID with Safaricom's real checkout ID
          if (coinsToCredit > 0) {
            await prisma.coinPurchase.update({
              where: { checkoutRequestID },
              data: { checkoutRequestID: stkData.CheckoutRequestID },
            });
          }

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
