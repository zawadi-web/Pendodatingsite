import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // 1. IP-Based Rate Limiting (max 5 registrations per minute)
    const ip = getClientIp(request);
    const limitResult = rateLimit(ip, 5, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    const { email, password, name, dob, gender, preference, interests, prompts } = body ?? {};

    // 2. Server-side validation and cleaning
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof name !== 'string' ||
      typeof dob !== 'string' ||
      typeof gender !== 'string' ||
      typeof preference !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    // Clean inputs
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || cleanEmail.length > 255 || !emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    // Validate password (8 to 100 chars)
    if (password.length < 8 || password.length > 100) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    // Validate name (2 to 50 chars, safe characters only to prevent XSS/injection)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (cleanName.length < 2 || cleanName.length > 50 || !nameRegex.test(cleanName)) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    // Validate DOB (must be at least 18 and at most 120 years old)
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }
    
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    const hundredTwentyYearsAgo = new Date();
    hundredTwentyYearsAgo.setFullYear(hundredTwentyYearsAgo.getFullYear() - 120);

    if (birthDate > eighteenYearsAgo || birthDate < hundredTwentyYearsAgo) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    // Validate gender and preference options
    const validGenders = ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'];
    const validPreferences = ['MALE', 'FEMALE', 'BOTH'];

    if (!validGenders.includes(gender) || !validPreferences.includes(preference)) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    // 4. Hash the password
    const passwordHash = await hashPassword(password);

    // 5. Create user + profile + wallet in one transaction
    const newUser = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        profile: {
          create: {
            name: cleanName,
            dob: birthDate,
            gender,
            preference,
            interests: typeof interests === 'string' ? interests : (Array.isArray(interests) ? interests.join(',') : ''),
            prompts: prompts ? (Array.isArray(prompts) ? JSON.stringify(prompts) : prompts) : null,
            photos: '[]',
          },
        },
        wallet: {
          create: {
            balance: 0.0,
            coins: 0,
          },
        },
      },
      select: { id: true, email: true, role: true },
    });

    // Generate session token
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    const response = NextResponse.json({
      message: 'Account created successfully',
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
  } catch (error: any) {
    console.error('Registration error:', error);
    // Prisma unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
