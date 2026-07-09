import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Always return success even if the user doesn't exist — prevents email enumeration
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (user) {
      // Invalidate any previous unused tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${appUrl}/reset-password?token=${token}`;

      try {
        await sendPasswordResetEmail(email, resetLink, user.profile?.name);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Still return success — we don't want to leak info about email failures
      }
    }

    return NextResponse.json({
      message: 'If an account with that email exists, you will receive a password reset link shortly.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
