import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const rawUrl = process.env.DATABASE_URL || '';
  const urlInfo = {
    length: rawUrl.length,
    prefix: rawUrl ? rawUrl.substring(0, 15) : 'not defined',
    containsCredentials: rawUrl.includes('@'),
  };

  const paystackInfo = {
    secretKeyExists: !!process.env.PAYSTACK_SECRET_KEY,
    secretKeyPrefix: process.env.PAYSTACK_SECRET_KEY ? process.env.PAYSTACK_SECRET_KEY.substring(0, 7) : 'none',
    publicKeyExists: !!process.env.PAYSTACK_PUBLIC_KEY,
    publicKeyPrefix: process.env.PAYSTACK_PUBLIC_KEY ? process.env.PAYSTACK_PUBLIC_KEY.substring(0, 7) : 'none',
    keysFound: Object.keys(process.env).filter(k => k.startsWith('PAYSTACK')),
  };

  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      success: true,
      urlInfo,
      paystackInfo,
      userCount,
      message: 'Successfully connected to database!',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      urlInfo,
      paystackInfo,
      error: error.message || String(error),
      stack: error.stack,
    }, { status: 500 });
  }
}
