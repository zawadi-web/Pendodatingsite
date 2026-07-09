import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const userId = (payload as any).id;

    // People I have liked (sent likes)
    const sent = await prisma.like.findMany({
      where: { fromId: userId, isLike: true },
      include: {
        to: {
          include: {
            profile: {
              select: { name: true, photos: true, dob: true, location: true, bio: true, isVerified: true, isPremium: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // People who liked me (received likes, excluding already-matched)
    const received = await prisma.like.findMany({
      where: { toId: userId, isLike: true },
      include: {
        from: {
          include: {
            profile: {
              select: { name: true, photos: true, dob: true, location: true, bio: true, isVerified: true, isPremium: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // IDs of matches (mutual likes) so we can tag them
    const matches = await prisma.match.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      select: { user1Id: true, user2Id: true },
    });
    const matchedIds = new Set(
      matches.map(m => (m.user1Id === userId ? m.user2Id : m.user1Id))
    );

    const formatAge = (dob: Date | null) => {
      if (!dob) return null;
      return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    };

    const sentFormatted = sent.map(l => ({
      id: l.to.id,
      name: l.to.profile?.name || 'Unknown',
      age: formatAge(l.to.profile?.dob ?? null),
      location: l.to.profile?.location || '',
      bio: l.to.profile?.bio || '',
      photo: JSON.parse(l.to.profile?.photos || '[]')[0] || null,
      isVerified: l.to.profile?.isVerified || false,
      isPremium: l.to.profile?.isPremium || false,
      isMatch: matchedIds.has(l.to.id),
      likedAt: l.createdAt,
    }));

    const receivedFormatted = received.map(l => ({
      id: l.from.id,
      name: l.from.profile?.name || 'Unknown',
      age: formatAge(l.from.profile?.dob ?? null),
      location: l.from.profile?.location || '',
      bio: l.from.profile?.bio || '',
      photo: null, // blurred until you like back
      isVerified: l.from.profile?.isVerified || false,
      isPremium: l.from.profile?.isPremium || false,
      isMatch: matchedIds.has(l.from.id),
      likedAt: l.createdAt,
    }));

    return NextResponse.json({ sent: sentFormatted, received: receivedFormatted });
  } catch (error) {
    console.error('Likes API error:', error);
    return NextResponse.json({ error: 'Failed to load likes' }, { status: 500 });
  }
}
