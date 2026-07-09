import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const rawUrl = process.env.DATABASE_URL || '';
  const urlInfo = {
    length: rawUrl.length,
    prefix: rawUrl ? rawUrl.substring(0, 15) : 'not defined',
    containsCredentials: rawUrl.includes('@'),
  };

  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      success: true,
      urlInfo,
      userCount,
      message: 'Successfully connected to database!',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      urlInfo,
      error: error.message || String(error),
      stack: error.stack,
    }, { status: 500 });
  }
}
