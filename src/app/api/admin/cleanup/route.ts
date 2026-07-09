import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 1. Authorize the request
    // Check for Vercel Cron authorization header or manual admin session cookie
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      // Fallback: Check if request is triggered manually by an authenticated admin
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token');
      if (token) {
        const decoded = verifyToken(token.value) as any;
        if (decoded && decoded.role === 'ADMIN') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Perform Cleanups
    const prisma = (await import('@/lib/db')).default;
    const results: Record<string, any> = {};

    // A. Delete messages older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const prunedMessages = await prisma.message.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });
    results.prunedMessagesCount = prunedMessages.count;

    // B. Delete swipe passes (isLike = false) older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const prunedPasses = await prisma.like.deleteMany({
      where: {
        isLike: false,
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    results.prunedPassesCount = prunedPasses.count;

    // C. Delete expired password reset tokens
    const prunedResetTokens = await prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    results.prunedResetTokensCount = prunedResetTokens.count;

    console.log('[Cleanup Job] Database pruned successfully:', results);
    return NextResponse.json({ success: true, message: 'Database cleanup completed successfully.', results });
  } catch (error: any) {
    console.error('[Cleanup Job] Database cleanup failed:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
