import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkPremiumStatus } from '@/lib/premium';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;

    // Fetch the current user's profile to know their preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { profile: true },
    });

    if (!currentUser || !currentUser.profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { gender, preference } = currentUser.profile;

    // Determine who to filter
    const genderFilter = preference === 'BOTH' ? {} : { gender: preference };
    
    const targetPreferenceFilter = {
      OR: [
        { preference: gender },
        { preference: 'BOTH' }
      ]
    };

    // Find users the current user has already swiped on to exclude them
    const existingSwipes = await prisma.like.findMany({
      where: { fromId: currentUserId },
      select: { toId: true },
    });
    const swipedIds = existingSwipes.map((swipe) => swipe.toId);

    // Fetch potential matches
    const potentialMatches = await prisma.profile.findMany({
      where: {
        userId: {
          not: currentUserId,
          notIn: swipedIds,
        },
        ...genderFilter,
        ...targetPreferenceFilter,
      },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    const isPremiumUser = await checkPremiumStatus(currentUserId);

    // Fetch profile unlock history for these target users
    const targetUserIds = potentialMatches.map(m => m.userId);
    const profileUnlocks = await prisma.profileUnlock.findMany({
      where: {
        userId: currentUserId,
        targetUserId: { in: targetUserIds },
      }
    });
    const unlockedProfileIds = new Set(profileUnlocks.map(u => u.targetUserId));

    // Fetch media unlock history
    const mediaUnlocks = await prisma.mediaUnlock.findMany({
      where: {
        userId: currentUserId,
        targetUserId: { in: targetUserIds },
      }
    });
    const unlockedMediaIds = new Set(mediaUnlocks.map(u => u.targetUserId));

    const processedMatches = potentialMatches.map((m) => {
      const isUnlocked = isPremiumUser || unlockedProfileIds.has(m.userId);
      const isMediaUnlocked = isPremiumUser || unlockedMediaIds.has(m.userId);

      let photoList: string[] = [];
      try {
        photoList = JSON.parse(m.photos || '[]');
      } catch (e) {
        photoList = [];
      }

      // Hide details if locked
      return {
        ...m,
        userId: m.userId,
        name: m.name,
        dob: m.dob,
        bio: isUnlocked ? m.bio : null,
        interests: isUnlocked ? m.interests : '',
        location: isUnlocked ? m.location : null,
        photos: JSON.stringify(isUnlocked ? photoList : (photoList.length > 0 ? [photoList[0]] : [])),
        isUnlocked,
        isMediaUnlocked,
        requiresUnlock: !isUnlocked,
      };
    });

    return NextResponse.json({ profiles: processedMatches });
  } catch (error) {
    console.error('Fetch matches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
