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

    const blockerId = decoded.id;
    const body = await request.json();
    const { blockedId } = body;

    if (!blockedId) {
      return NextResponse.json({ error: 'blockedId is required' }, { status: 400 });
    }

    // Check if block already exists
    const existingBlock = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId }
      }
    });

    if (existingBlock) {
      return NextResponse.json({ message: 'User already blocked' });
    }

    const block = await prisma.block.create({
      data: {
        blockerId,
        blockedId,
      },
    });

    // We should also delete any existing mutual Match or Likes to clean up the workspace
    // Find if a match exists between blockerId and blockedId
    const matchId1 = blockerId < blockedId ? blockerId : blockedId;
    const matchId2 = blockerId > blockedId ? blockerId : blockedId;

    await prisma.match.deleteMany({
      where: {
        user1Id: matchId1,
        user2Id: matchId2,
      }
    });

    // Delete likes
    await prisma.like.deleteMany({
      where: {
        OR: [
          { fromId: blockerId, toId: blockedId },
          { fromId: blockedId, toId: blockerId }
        ]
      }
    });

    return NextResponse.json({ message: 'User blocked successfully', block });
  } catch (error) {
    console.error('Block user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
