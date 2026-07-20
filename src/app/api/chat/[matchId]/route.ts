import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkPremiumStatus } from '@/lib/premium';
import { getOrCreateWallet, createWalletTransaction } from '@/lib/wallet';

// Contact bypass detection regex (phone numbers, email, wa.me, telegram, instagram, urls)
const CONTACT_REGEX = /(?:(?:\+?254|0)[71]\d{8})|(?:\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)|(?:t\.me\/[A-Za-z0-9_]{5,})|(?:\b(?:wa\.me|instagram\.com|ig:|tg:|whatsapp:|telegram:)\S+)|(?:https?:\/\/\S+)/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;

    // Fetch the match and verify membership
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (match.user1Id !== currentUserId && match.user2Id !== currentUserId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Mark messages from other user as delivered (they opened the chat)
    await prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: currentUserId },
        isDelivered: false,
      },
      data: { isDelivered: true },
    });

    // Mark messages from other user as read (they are viewing the chat)
    await prisma.message.updateMany({
      where: {
        matchId,
        senderId: { not: currentUserId },
        isRead: false,
      },
      data: { isRead: true },
    });

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch other user profile for title info
    const otherUserId = match.user1Id === currentUserId ? match.user2Id : match.user1Id;
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      include: { profile: true },
    });

    // Check if target profile is unlocked by current user
    const isUnlocked = await prisma.profileUnlock.findUnique({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId: otherUserId
        }
      }
    });

    const isPremiumUser = await checkPremiumStatus(currentUserId);
    const requiresUnlock = !isPremiumUser && !isUnlocked;

    return NextResponse.json({
      // If the profile is locked, don't expose any message content — security hardening
      messages: requiresUnlock ? [] : messages,
      requiresUnlock,
      otherUser: {
        id: otherUser?.id,
        name: otherUser?.profile?.name,
        // Only expose photos if unlocked or premium
        photos: requiresUnlock ? null : otherUser?.profile?.photos,
        isVerified: otherUser?.profile?.isVerified,
        isPremium: otherUser?.profile?.isPremium,
        lastActiveAt: otherUser?.lastActiveAt,
        phone: isPremiumUser ? otherUser?.phone : null,
        instagram: isPremiumUser ? otherUser?.profile?.instagram : null,
        facebook: isPremiumUser ? otherUser?.profile?.facebook : null,
        telegram: isPremiumUser ? otherUser?.profile?.telegram : null,
      },
    });
  } catch (error) {
    console.error('Fetch conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;
    const body = await request.json();
    const { content, imagePath } = body;

    if (!content && !imagePath) {
      return NextResponse.json({ error: 'Cannot send empty message' }, { status: 400 });
    }

    // 1. Verify membership
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

    // 2. Enforce Chat Restriction checks (banned users cannot chat)
    let restriction = await prisma.chatRestriction.findUnique({
      where: { userId: currentUserId }
    });
    if (!restriction) {
      restriction = await prisma.chatRestriction.create({
        data: { userId: currentUserId }
      });
    }

    if (restriction.isBanned) {
      return NextResponse.json({ error: 'You are permanently banned from chatting due to safety violations.' }, { status: 403 });
    }

    const isPremiumUser = await checkPremiumStatus(currentUserId);

    // 3. Scan for contact sharing bypass attempts
    if (!isPremiumUser && content && CONTACT_REGEX.test(content)) {
      const newWarningsCount = restriction.warningsCount + 1;
      const shouldBan = newWarningsCount >= 3;

      await prisma.chatRestriction.update({
        where: { userId: currentUserId },
        data: {
          warningsCount: newWarningsCount,
          isBanned: shouldBan,
          lastWarningAt: new Date()
        }
      });

      return NextResponse.json({
        error: 'Direct contact sharing is not allowed.',
        bypassViolation: true,
        warningsCount: newWarningsCount,
        isBanned: shouldBan
      }, { status: 400 });
    }

    // 4. Enforce Profile Unlock block (must unlock target profile to chat)
    const isUnlocked = await prisma.profileUnlock.findUnique({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId: otherUserId
        }
      }
    });

    if (!isPremiumUser && !isUnlocked) {
      return NextResponse.json({
        error: 'Profile must be unlocked before starting chat.',
        requiresUnlock: true
      }, { status: 403 });
    }

    // 5. Coin charging for non-Premium users
    if (!isPremiumUser) {
      const wallet = await getOrCreateWallet(currentUserId);
      if (wallet.coins < 1) {
        return NextResponse.json({
          error: 'Insufficient coins. Each message consumes 1 coin.',
          insufficientCoins: true
        }, { status: 402 });
      }

      // Deduct 1 coin
      await createWalletTransaction(
        currentUserId,
        0.0,
        -1,
        'DEDUCTION',
        'Consumed 1 coin sending message'
      );
    }

    // 6. Handle Auto-Greeting for first message
    const msgCount = await prisma.message.count({
      where: { matchId }
    });

    if (msgCount === 0) {
      // Find other user's first name
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        include: { profile: true }
      });
      const firstName = otherUser?.profile?.name?.split(' ')[0] || 'there';

      // Create introductory greeting from the current user
      await prisma.message.create({
        data: {
          matchId,
          senderId: currentUserId,
          content: `Hey ${firstName} 👋`,
        }
      });
    }

    // 7. Create the actual message
    const message = await prisma.message.create({
      data: {
        matchId,
        senderId: currentUserId,
        content: content || '',
        imagePath: imagePath || null,
      },
    });

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
