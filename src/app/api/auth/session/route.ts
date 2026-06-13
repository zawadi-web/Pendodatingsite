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

    // Optionally fetch fresh user data and profile
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { profile: true },
    });

    if (!user || user.isSuspended) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
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
  // Logout route
  const response = NextResponse.json({ message: 'Logged out successfully' });
  
  response.cookies.delete('auth_token');
  
  return response;
}
