import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSystemConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = await getSystemConfig();
    
    // Check if user is admin to decide if we should expose keys
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    let isAdmin = false;
    if (token) {
      const decoded = verifyToken(token.value) as any;
      if (decoded && decoded.role === 'ADMIN') {
        isAdmin = true;
      }
    }

    // Sanitize sensitive info for public/non-admin requests
    if (!isAdmin) {
      config.mpesaConsumerKey = null;
      config.mpesaConsumerSecret = null;
      config.mpesaPasskey = null;
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Fetch system config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
    }

    const body = await request.json();
    const configData = body.config || body; // Handle both direct object and nested { config: {...} }

    const {
      saccoName,
      saccoAccount,
      paymentInstructions,
      mpesaEnabled,
      profileUnlockCost,
      mediaUnlockCost,
      premiumWeeklyPrice,
      premiumMonthlyPrice,
      premiumYearlyPrice,
      coinPrice10,
      coinPrice50,
      coinPrice100,
      commissionFeePct,
      mpesaConsumerKey,
      mpesaConsumerSecret,
      mpesaPasskey,
      mpesaShortCode,
    } = configData;

    const updatedConfig = await prisma.systemConfig.upsert({
      where: { id: 'default' },
      update: {
        saccoAccName: saccoName !== undefined ? saccoName : undefined,
        saccoAccNo: saccoAccount !== undefined ? saccoAccount : undefined,
        saccoInstructions: paymentInstructions !== undefined ? paymentInstructions : undefined,
        saccoEnabled: mpesaEnabled !== undefined ? mpesaEnabled : undefined,
        profileUnlockFee: profileUnlockCost !== undefined ? parseFloat(profileUnlockCost) : undefined,
        mediaUnlockFee: mediaUnlockCost !== undefined ? parseFloat(mediaUnlockCost) : undefined,
        weeklySubPrice: premiumWeeklyPrice !== undefined ? parseFloat(premiumWeeklyPrice) : undefined,
        monthlySubPrice: premiumMonthlyPrice !== undefined ? parseFloat(premiumMonthlyPrice) : undefined,
        yearlySubPrice: premiumYearlyPrice !== undefined ? parseFloat(premiumYearlyPrice) : undefined,
        coinPrice10: coinPrice10 !== undefined ? parseFloat(coinPrice10) : undefined,
        coinPrice50: coinPrice50 !== undefined ? parseFloat(coinPrice50) : undefined,
        coinPrice100: coinPrice100 !== undefined ? parseFloat(coinPrice100) : undefined,
        commissionFeePct: commissionFeePct !== undefined ? parseFloat(commissionFeePct) : undefined,
        mpesaConsumerKey: mpesaConsumerKey !== undefined ? mpesaConsumerKey : undefined,
        mpesaConsumerSecret: mpesaConsumerSecret !== undefined ? mpesaConsumerSecret : undefined,
        mpesaPasskey: mpesaPasskey !== undefined ? mpesaPasskey : undefined,
        mpesaShortCode: mpesaShortCode !== undefined ? mpesaShortCode : undefined,
      },
      create: {
        id: 'default',
        saccoAccName: saccoName || "Pendo SACCO Account",
        saccoAccNo: saccoAccount || "174379",
        saccoInstructions: paymentInstructions || "1. Go to Lipa na M-Pesa...",
        saccoEnabled: mpesaEnabled !== undefined ? mpesaEnabled : true,
        profileUnlockFee: parseFloat(profileUnlockCost) || 200.0,
        mediaUnlockFee: parseFloat(mediaUnlockCost) || 100.0,
        weeklySubPrice: parseFloat(premiumWeeklyPrice) || 1000.0,
        monthlySubPrice: parseFloat(premiumMonthlyPrice) || 2500.0,
        yearlySubPrice: parseFloat(premiumYearlyPrice) || 5000.0,
        coinPrice10: parseFloat(coinPrice10) || 100.0,
        coinPrice50: parseFloat(coinPrice50) || 450.0,
        coinPrice100: parseFloat(coinPrice100) || 800.0,
        commissionFeePct: parseFloat(commissionFeePct) || 10.0,
        mpesaConsumerKey: mpesaConsumerKey || "",
        mpesaConsumerSecret: mpesaConsumerSecret || "",
        mpesaPasskey: mpesaPasskey || "",
        mpesaShortCode: mpesaShortCode || "",
      },
    });

    return NextResponse.json({ message: 'Configuration updated successfully', config: updatedConfig });
  } catch (error: any) {
    console.error('Update system config error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
