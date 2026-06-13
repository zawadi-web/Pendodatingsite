import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users with profiles, wallets, active subs, and warnings
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        wallet: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1
        },
        chatRestriction: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Fetch admin users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      targetUserId,
      isVerified,
      isSuspended,
      walletBalance,
      walletCoins,
      isPremium,
      premiumUntil,
      warningsCount,
      isBanned,
    } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    // Build update payloads
    const userUpdate: any = {};
    const profileUpdate: any = {};
    const walletUpdate: any = {};
    const chatRestrictionUpdate: any = {};

    if (isSuspended !== undefined) userUpdate.isSuspended = isSuspended;
    if (isVerified !== undefined) profileUpdate.isVerified = isVerified;
    if (isPremium !== undefined) profileUpdate.isPremium = isPremium;
    
    if (premiumUntil !== undefined) {
      profileUpdate.premiumUntil = premiumUntil ? new Date(premiumUntil) : null;
    }

    if (walletBalance !== undefined) walletUpdate.balance = parseFloat(walletBalance);
    if (walletCoins !== undefined) walletUpdate.coins = parseInt(walletCoins);

    if (warningsCount !== undefined) chatRestrictionUpdate.warningsCount = parseInt(warningsCount);
    if (isBanned !== undefined) chatRestrictionUpdate.isBanned = isBanned;

    // Execute updates in transaction
    await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: targetUserId }, data: userUpdate });
      }
      if (Object.keys(profileUpdate).length > 0) {
        await tx.profile.update({ where: { userId: targetUserId }, data: profileUpdate });
      }
      if (Object.keys(walletUpdate).length > 0) {
        await tx.wallet.upsert({
          where: { userId: targetUserId },
          update: walletUpdate,
          create: { userId: targetUserId, ...walletUpdate }
        });
      }
      if (Object.keys(chatRestrictionUpdate).length > 0) {
        await tx.chatRestriction.upsert({
          where: { userId: targetUserId },
          update: chatRestrictionUpdate,
          create: { userId: targetUserId, ...chatRestrictionUpdate }
        });
      }
    });

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Update user admin error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
