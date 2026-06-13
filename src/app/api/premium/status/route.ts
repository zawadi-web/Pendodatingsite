import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const subscription = await prisma.subscription.findFirst({
      where: { userId: decoded.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const profile = await prisma.profile.findUnique({
      where: { userId: decoded.id },
      select: { isPremium: true, premiumUntil: true },
    });

    return NextResponse.json({
      subscription,
      isPremium: profile?.isPremium ?? false,
      premiumUntil: profile?.premiumUntil ?? null,
    });
  } catch (error) {
    console.error('Premium status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
