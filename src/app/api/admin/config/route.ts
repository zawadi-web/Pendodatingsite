import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSystemConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = await getSystemConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Fetch system config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      saccoAccName,
      saccoAccNo,
      saccoInstructions,
      saccoEnabled,
      profileUnlockFee,
      mediaUnlockFee,
      weeklySubPrice,
      monthlySubPrice,
      yearlySubPrice,
      coinPrice10,
      coinPrice50,
      coinPrice100,
      commissionFeePct,
    } = body;

    const updatedConfig = await prisma.systemConfig.upsert({
      where: { id: 'default' },
      update: {
        saccoAccName,
        saccoAccNo,
        saccoInstructions,
        saccoEnabled,
        profileUnlockFee: parseFloat(profileUnlockFee),
        mediaUnlockFee: parseFloat(mediaUnlockFee),
        weeklySubPrice: parseFloat(weeklySubPrice),
        monthlySubPrice: parseFloat(monthlySubPrice),
        yearlySubPrice: parseFloat(yearlySubPrice),
        coinPrice10: parseFloat(coinPrice10),
        coinPrice50: parseFloat(coinPrice50),
        coinPrice100: parseFloat(coinPrice100),
        commissionFeePct: parseFloat(commissionFeePct),
      },
      create: {
        id: 'default',
        saccoAccName,
        saccoAccNo,
        saccoInstructions,
        saccoEnabled,
        profileUnlockFee: parseFloat(profileUnlockFee) || 200.0,
        mediaUnlockFee: parseFloat(mediaUnlockFee) || 100.0,
        weeklySubPrice: parseFloat(weeklySubPrice) || 1000.0,
        monthlySubPrice: parseFloat(monthlySubPrice) || 2500.0,
        yearlySubPrice: parseFloat(yearlySubPrice) || 5000.0,
        coinPrice10: parseFloat(coinPrice10) || 100.0,
        coinPrice50: parseFloat(coinPrice50) || 450.0,
        coinPrice100: parseFloat(coinPrice100) || 800.0,
        commissionFeePct: parseFloat(commissionFeePct) || 10.0,
      },
    });

    return NextResponse.json({ message: 'Configuration updated successfully', config: updatedConfig });
  } catch (error: any) {
    console.error('Update system config error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
