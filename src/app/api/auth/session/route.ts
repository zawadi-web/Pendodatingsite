import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('auth_token');

    if (!tokenCookie) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const decoded = verifyToken(tokenCookie.value) as any;

    if (!decoded || !decoded.id) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Fetch user — READ ONLY. Do NOT do a write (update lastActiveAt) on
    // every single session check; that creates unnecessary DB churn and
    // wastes storage. lastActiveAt is updated only on explicit actions
    // (e.g. swipes, messages) instead.
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isSuspended: true,
        profile: true,
      },
    });

    if (!user || user.isSuspended) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  response.cookies.delete('auth_token');
  return response;
}
