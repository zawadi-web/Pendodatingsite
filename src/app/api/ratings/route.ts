import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing user ID parameter' }, { status: 400 });
    }

    // Get all ratings received by this user
    const ratings = await prisma.rating.findMany({
      where: { toId: targetUserId },
    });

    if (ratings.length === 0) {
      return NextResponse.json({
        rating: 0.0,
        reviewCount: 0,
        reputationLevel: 'Bronze',
      });
    }

    let sumRespect = 0;
    let sumCommunication = 0;
    let sumExperience = 0;
    let sumReliability = 0;

    ratings.forEach((r) => {
      sumRespect += r.respect;
      sumCommunication += r.communication;
      sumExperience += r.experience;
      sumReliability += r.reliability;
    });

    const count = ratings.length;
    const avgRespect = sumRespect / count;
    const avgComm = sumCommunication / count;
    const avgExp = sumExperience / count;
    const avgRel = sumReliability / count;

    const overallRating = (avgRespect + avgComm + avgExp + avgRel) / 4;

    // Reputation levels: Bronze, Silver, Gold, Elite
    let reputationLevel = 'Bronze';
    if (count >= 15 && overallRating >= 4.7) reputationLevel = 'Elite';
    else if (count >= 8 && overallRating >= 4.2) reputationLevel = 'Gold';
    else if (count >= 3 && overallRating >= 3.5) reputationLevel = 'Silver';

    return NextResponse.json({
      rating: parseFloat(overallRating.toFixed(1)),
      reviewCount: count,
      reputationLevel,
      breakdown: {
        respect: parseFloat(avgRespect.toFixed(1)),
        communication: parseFloat(avgComm.toFixed(1)),
        experience: parseFloat(avgExp.toFixed(1)),
        reliability: parseFloat(avgRel.toFixed(1)),
      }
    });
  } catch (error) {
    console.error('Fetch ratings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { toId, respect, communication, experience, reliability, comment } = body;

    if (!toId || !respect || !communication || !experience || !reliability) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (decoded.id === toId) {
      return NextResponse.json({ error: 'You cannot rate yourself' }, { status: 400 });
    }

    // Submit or update rating
    const rating = await prisma.rating.upsert({
      where: {
        fromId_toId: {
          fromId: decoded.id,
          toId,
        }
      },
      update: {
        respect: parseInt(respect),
        communication: parseInt(communication),
        experience: parseInt(experience),
        reliability: parseInt(reliability),
      },
      create: {
        fromId: decoded.id,
        toId,
        respect: parseInt(respect),
        communication: parseInt(communication),
        experience: parseInt(experience),
        reliability: parseInt(reliability),
      }
    });

    // Optionally create comment review if provided
    if (comment && comment.trim() !== '') {
      await prisma.review.create({
        data: {
          fromId: decoded.id,
          toId,
          comment: comment.trim(),
        }
      });
    }

    return NextResponse.json({ success: true, message: 'Thank you for your rating!', rating });
  } catch (error) {
    console.error('Submit rating error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
