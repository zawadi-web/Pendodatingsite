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
      return NextResponse.json({ error: 'You cannot unlock your own profile' }, { status: 400 });
    }

    // Check target exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Already unlocked?
    const alreadyUnlocked = await prisma.profileUnlock.findUnique({
      where: { userId_targetUserId: { userId: decoded.id, targetUserId } }
    });

    if (alreadyUnlocked) {
      return NextResponse.json({ success: true, message: 'Profile already unlocked!' });
    }

    const config = await getSystemConfig();
    // Fee in KES — we treat 1 KES = 1 coin unit for simplicity
    const fee = config.profileUnlockFee; // = 200

    // Get wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId: decoded.id } });
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found. Please contact support.' }, { status: 400 });
    }

    // Use coins if available, otherwise check KES balance
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
              type: 'PROFILE_UNLOCK',
              description: `Unlocked profile of ${targetUser.profile?.name || targetUser.email}`,
              status: 'SUCCESS',
            }
          });
          await tx.profileUnlock.create({
            data: { userId: decoded.id, targetUserId }
          });
        });

        return NextResponse.json({ success: true, message: 'Profile unlocked successfully!' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
      }
    } else if (wallet.balance >= fee) {
      // Deduct from KES balance
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
              type: 'PROFILE_UNLOCK',
              description: `Unlocked profile of ${targetUser.profile?.name || targetUser.email}`,
              status: 'SUCCESS',
            }
          });
          await tx.profileUnlock.create({
            data: { userId: decoded.id, targetUserId }
          });
        });

        return NextResponse.json({ success: true, message: 'Profile unlocked successfully!' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: `Insufficient coins. You need ${fee} coins to unlock this profile. Top up your wallet.`,
        required: fee,
        current: wallet.coins,
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Unlock profile error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
