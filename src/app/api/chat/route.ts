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
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;

    // Get list of users blocked by current user or who blocked the current user
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: currentUserId },
          { blockedId: currentUserId }
        ]
      },
      select: { blockerId: true, blockedId: true }
    });
    
    const blockedUserIds = new Set(
      blocks.map(b => b.blockerId === currentUserId ? b.blockedId : b.blockerId)
    );

    // Fetch all matches for the current user
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId },
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Populate matches with other user details, filtering out blocks
    const activeConversations = [];

    for (const match of matches) {
      const otherUserId = match.user1Id === currentUserId ? match.user2Id : match.user1Id;
      
      // Skip if blocked
      if (blockedUserIds.has(otherUserId)) continue;

      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        include: { profile: true },
      });

      if (otherUser && otherUser.profile && !otherUser.isSuspended) {
        // Calculate unread messages count
        const unreadCount = await prisma.message.count({
          where: {
            matchId: match.id,
            senderId: otherUserId,
            isRead: false,
          },
        });

        activeConversations.push({
          matchId: match.id,
          lastMessage: match.messages[0] || null,
          unreadCount,
          otherUser: {
            id: otherUser.id,
            email: otherUser.email,
            name: otherUser.profile.name,
            photos: otherUser.profile.photos,
            isVerified: otherUser.profile.isVerified,
            isPremium: otherUser.profile.isPremium,
          },
        });
      }
    }

    // Sort by last message timestamp (or creation date) descending
    activeConversations.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ conversations: activeConversations });
  } catch (error) {
    console.error('Fetch chats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
