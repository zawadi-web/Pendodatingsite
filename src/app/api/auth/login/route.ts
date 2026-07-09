import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // 1. IP-Based Rate Limiting (max 10 requests per minute)
    const ip = getClientIp(request);
    const limitResult = rateLimit(ip, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError.message, 'Content-Type:', request.headers.get('content-type'));
      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 400 });
    }

    const { email, password } = body ?? {};

    // 2. Server-side validation and cleaning
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Simple robust email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !password || !emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 400 });
    }

    // 3. Find user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
    }

    if (user.isSuspended) {
      return NextResponse.json({ error: 'Your account has been suspended' }, { status: 403 });
    }

    // Check if the user is registered via Google OAuth without a password
    if (!user.passwordHash) {
      return NextResponse.json({
        error: 'This account is set up with Google Sign-In. Please log in using the "Continue with Google" button.'
      }, { status: 400 });
    }

    // 4. Account Lockout Check
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return NextResponse.json({
        error: 'Too many failed login attempts. Your account has been temporarily locked. Please try again later.'
      }, { status: 423 });
    }

    // 5. Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newAttempts >= 5;
      const lockoutUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockoutUntil,
        },
      });

      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
    }

    // 6. Successful Login: reset attempts and lockout counters
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
    }

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    const response = NextResponse.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
