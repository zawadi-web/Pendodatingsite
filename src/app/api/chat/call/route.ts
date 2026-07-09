import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkPremiumStatus } from '@/lib/premium';
import { getOrCreateWallet, createWalletTransaction } from '@/lib/wallet';

/**
 * POST /api/chat/call
 * Handles coin deduction for call initialization and ongoing per-minute billing.
 * Also enforces profile unlock verification before calls can be placed.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;
    const body = await request.json();
    const { matchId, callType, isOngoing } = body;

    if (!matchId || !callType) {
      return NextResponse.json({ error: 'matchId and callType are required' }, { status: 400 });
    }

    if (callType !== 'voice' && callType !== 'video') {
      return NextResponse.json({ error: 'Invalid call type' }, { status: 400 });
    }

    // 1. Verify match membership
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (match.user1Id !== currentUserId && match.user2Id !== currentUserId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const otherUserId = match.user1Id === currentUserId ? match.user2Id : match.user1Id;

    // 2. Check if user is premium
    const isPremiumUser = await checkPremiumStatus(currentUserId);

    // 3. Enforce Profile Unlock Check (cannot start or continue call if profile is locked)
    const isUnlocked = await prisma.profileUnlock.findUnique({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId: otherUserId,
        },
      },
    });

    if (!isPremiumUser && !isUnlocked) {
      return NextResponse.json({
        error: 'You must unlock this profile before calling.',
        requiresUnlock: true,
      }, { status: 403 });
    }

    // Premium users make calls for free
    if (isPremiumUser) {
      return NextResponse.json({ success: true, message: 'Call authorized (Free for Premium)' });
    }

    // 4. Deduct coins for non-premium users
    const cost = callType === 'video' ? 10 : 5;
    const wallet = await getOrCreateWallet(currentUserId);

    if (wallet.coins < cost) {
      return NextResponse.json({
        error: `Insufficient coins. You need ${cost} coins to ${isOngoing ? 'continue' : 'start'} the ${callType} call.`,
        insufficientCoins: true,
      }, { status: 402 });
    }

    const transactionType = 'DEDUCTION';
    const description = isOngoing
      ? `Ongoing ${callType} call charge — ${cost} coins/min`
      : `Starting ${callType} call charge — ${cost} coins/min`;

    // Deduct coins
    await createWalletTransaction(
      currentUserId,
      0.0,
      -cost,
      transactionType,
      description
    );

    const updatedWallet = await getOrCreateWallet(currentUserId);

    return NextResponse.json({
      success: true,
      message: 'Coins deducted successfully',
      coinsRemaining: updatedWallet.coins,
    });
  } catch (error: any) {
    console.error('Call coin charge error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
