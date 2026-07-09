import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkPremiumStatus } from '@/lib/premium';
import { getDistanceKm } from '@/lib/locations';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const maxDistanceParam = searchParams.get('maxDistance');
    const maxDistance = maxDistanceParam ? parseFloat(maxDistanceParam) : null;

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserId = decoded.id;

    // Fetch the current user's profile to know their preferences and location
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { profile: true },
    });

    if (!currentUser || !currentUser.profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { gender, preference, latitude: userLat, longitude: userLng } = currentUser.profile;

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
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            lastActiveAt: true,
          }
        }
      }
    });

    const isPremiumUser = await checkPremiumStatus(currentUserId);

    // Process profiles, compute distances, and filter/sort
    let processedMatches = potentialMatches.map((m) => {
      // Calculate distance if both have coordinates
      let distance: number | null = null;
      if (
        userLat !== null &&
        userLng !== null &&
        m.latitude !== null &&
        m.longitude !== null
      ) {
        distance = getDistanceKm(userLat, userLng, m.latitude, m.longitude);
      }

      let photoList: string[] = [];
      try {
        photoList = JSON.parse(m.photos || '[]');
      } catch (e) {
        photoList = [];
      }

      return {
        profile: m,
        distance,
        photoList
      };
    });

    // Apply distance filter if specified
    if (maxDistance !== null && !isNaN(maxDistance)) {
      processedMatches = processedMatches.filter((item) => {
        // Keep matches within distance.
        // Also keep matches that don't have location coordinates only if the user hasn't set strict filtering,
        // but if strict filtering is chosen, we filter out users without locations.
        return item.distance !== null && item.distance <= maxDistance;
      });
    }

    // Sort by distance if user has coordinates (closest first)
    if (userLat !== null && userLng !== null) {
      processedMatches.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1; // Put users without distance last
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    // Paginate/limit results after filtering & sorting
    const limitedMatches = processedMatches.slice(0, 15);

    // Fetch profile unlock history for these target users
    const targetUserIds = limitedMatches.map(item => item.profile.userId);
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

    const finalProfiles = limitedMatches.map((item) => {
      const m = item.profile;
      const isUnlocked = isPremiumUser || unlockedProfileIds.has(m.userId);
      const isMediaUnlocked = isPremiumUser || unlockedMediaIds.has(m.userId);
      const photoList = item.photoList;

      return {
        id: m.id,
        userId: m.userId,
        name: m.name,
        dob: m.dob,
        gender: m.gender,
        preference: m.preference,
        bio: isUnlocked ? m.bio : null,
        interests: isUnlocked ? m.interests : '',
        location: isUnlocked ? m.location : null,
        latitude: m.latitude,
        longitude: m.longitude,
        distance: item.distance, // return distance to frontend!
        photos: JSON.stringify(isUnlocked ? photoList : (photoList.length > 0 ? [photoList[0]] : [])),
        isVerified: m.isVerified,
        isPremium: m.isPremium,
        premiumUntil: m.premiumUntil,
        isUnlocked,
        isMediaUnlocked,
        requiresUnlock: !isUnlocked,
        lastActiveAt: m.user?.lastActiveAt || null,
        phone: isPremiumUser ? m.user?.phone : null,
        instagram: isPremiumUser ? m.instagram : null,
        facebook: isPremiumUser ? m.facebook : null,
        telegram: isPremiumUser ? m.telegram : null,
      };
    });

    return NextResponse.json({ profiles: finalProfiles });
  } catch (error) {
    console.error('Fetch matches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
