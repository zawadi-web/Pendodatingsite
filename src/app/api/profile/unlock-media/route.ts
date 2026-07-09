import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { getSystemConfig } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target user ID' }, { status: 400 });
    }

    if (decoded.id === targetUserId) {
      return NextResponse.json({ error: 'You cannot unlock your own media' }, { status: 400 });
    }

    // Check target exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Already unlocked? (use mediaIndex = 0 to represent "all media" unlock)
    const alreadyUnlocked = await prisma.mediaUnlock.findFirst({
      where: { userId: decoded.id, targetUserId }
    });

    if (alreadyUnlocked) {
      return NextResponse.json({ success: true, message: 'Media already unlocked!' });
    }

    const config = await getSystemConfig();
    const fee = config.mediaUnlockFee; // = 100

    // Get wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId: decoded.id } });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found. Please contact support.' }, { status: 400 });
    }

    if (wallet.coins >= fee) {
      // Deduct coins
      try {
        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.wallet.updateMany({
            where: { userId: decoded.id, coins: { gte: fee } },
            data: { coins: { decrement: fee } },
          });

          if (updateResult.count === 0) {
            throw new Error('Insufficient coins.');
          }

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              amount: -fee,
              coins: -fee,
              type: 'MEDIA_UNLOCK',
              description: `Unlocked media gallery of ${targetUser.profile?.name || targetUser.email}`,
              status: 'SUCCESS',
            }
          });
          // Record as mediaIndex 0 = full gallery unlock
          await tx.mediaUnlock.create({
            data: { userId: decoded.id, targetUserId, mediaIndex: 0 }
          });
        });

        return NextResponse.json({ success: true, message: 'Media gallery unlocked successfully!' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
      }
    } else if (wallet.balance >= fee) {
      try {
        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.wallet.updateMany({
            where: { userId: decoded.id, balance: { gte: fee } },
            data: { balance: { decrement: fee } },
          });

          if (updateResult.count === 0) {
            throw new Error('Insufficient wallet balance.');
          }

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              amount: -fee,
              coins: 0,
              type: 'MEDIA_UNLOCK',
              description: `Unlocked media gallery of ${targetUser.profile?.name || targetUser.email}`,
              status: 'SUCCESS',
            }
          });
          await tx.mediaUnlock.create({
            data: { userId: decoded.id, targetUserId, mediaIndex: 0 }
          });
        });

        return NextResponse.json({ success: true, message: 'Media gallery unlocked successfully!' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: `Insufficient coins. You need ${fee} coins to unlock this media. Top up your wallet.`,
        required: fee,
        current: wallet.coins,
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Unlock media error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
