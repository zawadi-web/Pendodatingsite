import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json(
        { error: 'Missing Google credential' },
        { status: 400 }
      );
    }

    // 1. Verify the ID token with Google's tokeninfo API
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!googleRes.ok) {
      const errorText = await googleRes.text();
      console.error('Google token verification failed:', errorText);
      return NextResponse.json(
        { error: 'Invalid Google sign-in token' },
        { status: 401 }
      );
    }

    const payload = await googleRes.json();

    // 2. Verify audience matches our Client ID
    const expectedClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in environment variables');
      return NextResponse.json(
        { error: 'Google configuration error' },
        { status: 500 }
      );
    }

    if (payload.aud !== expectedClientId) {
      console.error(`Google token audience mismatch. Expected: ${expectedClientId}, Got: ${payload.aud}`);
      return NextResponse.json(
        { error: 'Invalid token origin' },
        { status: 401 }
      );
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!googleId || !email) {
      return NextResponse.json(
        { error: 'Incomplete profile data from Google' },
        { status: 400 }
      );
    }

    // Find or create user with Google OAuth
    let user = await prisma.user.findUnique({
      where: { googleId },
      include: { profile: true },
    });

    if (!user) {
      // Check if user exists with this email
      user = await prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      if (user) {
        // Link Google account to existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            googleEmail: email,
          },
          include: { profile: true },
        });
      } else {
        // Create new user with Google OAuth
        user = await prisma.user.create({
          data: {
            email,
            googleId,
            googleEmail: email,
            passwordHash: null, // No password for OAuth users
            profile: {
              create: {
                name: name || 'New User',
                dob: new Date(),
                gender: 'OTHER',
                preference: 'BOTH',
                interests: '',
                photos: picture ? JSON.stringify([picture]) : JSON.stringify([]),
              },
            },
            wallet: {
              create: {
                balance: 0.0,
                coins: 0,
              }
            },
            chatRestriction: {
              create: {
                warningsCount: 0,
                isBanned: false,
              }
            }
          },
          include: { profile: true },
        });
      }
    }

    // Generate JWT token
    const token = generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      '7d'
    );

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.profile?.name,
      },
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
    console.error('Google callback error:', error);
    return NextResponse.json(
      { error: 'Google authentication failed' },
      { status: 500 }
    );
  }
}
