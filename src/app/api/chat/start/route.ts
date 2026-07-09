import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// POST /api/chat/start — Creates or retrieves a conversation between two users (no match required)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;
    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    if (targetUserId === currentUserId) {
      return NextResponse.json({ error: 'You cannot chat with yourself' }, { status: 400 });
    }

    // Check if target user exists and is not suspended
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    });

    if (!targetUser || !targetUser.profile || targetUser.isSuspended) {
      return NextResponse.json({ error: 'User not found or unavailable' }, { status: 404 });
    }

    // Check for blocks (either direction)
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      },
    });

    if (block) {
      return NextResponse.json({ error: 'Cannot start a conversation with this user' }, { status: 403 });
    }

    // Find existing Match/conversation between the two users (regardless of order)
    let match = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: currentUserId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: currentUserId },
        ],
      },
    });

    // If no existing match/conversation, create one now
    if (!match) {
      // Ensure consistent ordering so @@unique([user1Id, user2Id]) doesn't conflict
      const [user1Id, user2Id] = [currentUserId, targetUserId].sort();
      match = await prisma.match.create({
        data: { user1Id, user2Id },
      });
    }

    return NextResponse.json({
      matchId: match.id,
      otherUser: {
        id: targetUser.id,
        name: targetUser.profile.name,
        photos: targetUser.profile.photos,
        isVerified: targetUser.profile.isVerified,
        isPremium: targetUser.profile.isPremium,
        lastActiveAt: targetUser.lastActiveAt,
      },
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
