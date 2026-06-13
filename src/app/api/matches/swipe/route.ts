import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;
    const body = await request.json();
    const { targetUserId, action } = body; // action is 'LIKE' or 'PASS'

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isLike = action === 'LIKE';

    // Record the swipe
    await prisma.like.create({
      data: {
        fromId: currentUserId,
        toId: targetUserId,
        isLike,
      },
    });

    let isMatch = false;

    // If it's a LIKE, check if the other person also liked the current user
    if (isLike) {
      const mutualLike = await prisma.like.findUnique({
        where: {
          fromId_toId: {
            fromId: targetUserId,
            toId: currentUserId,
          },
        },
      });

      if (mutualLike && mutualLike.isLike) {
        // We have a mutual match!
        isMatch = true;

        // Create the match record
        await prisma.match.create({
          data: {
            user1Id: currentUserId < targetUserId ? currentUserId : targetUserId,
            user2Id: currentUserId > targetUserId ? currentUserId : targetUserId,
          },
        });
      }
    }

    return NextResponse.json({ success: true, isMatch });
  } catch (error) {
    console.error('Swipe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
