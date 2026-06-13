import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, dob, gender, preference } = body;

    if (!email || !password || !name || !dob || !gender || !preference) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create the user and their associated profile, wallet, and chat restrictions
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            name,
            dob: new Date(dob),
            gender,
            preference,
            interests: '',
            photos: '[]',
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
    });

    // Generate session token
    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role });

    // In a real production app, you might set this as an HTTP-only cookie
    // For our API, we'll return it for the frontend to manage (or set cookie headers directly)
    const response = NextResponse.json({
      message: 'User registered successfully',
      user: { id: newUser.id, email: newUser.email },
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
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
