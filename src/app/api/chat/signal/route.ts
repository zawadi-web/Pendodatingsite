import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  setSignal,
  getSignal,
  clearSignal,
  getIncomingRings,
  type SignalType,
} from '@/lib/callSignals';

/**
 * GET /api/chat/signal
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = decoded.id;
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    console.log(`[Signal GET] User: ${userId}, matchId param: ${matchId}`);

    // --- Single match signal lookup (used by caller to poll for ACCEPT/REJECT/END) ---
    if (matchId) {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
        console.warn(`[Signal GET] Match ${matchId} not found or user ${userId} is not member`);
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const sig = getSignal(matchId);
      console.log(`[Signal GET] Match: ${matchId}, Retrieved signal:`, sig);
      return NextResponse.json({ signal: sig ?? null });
    }

    // --- Incoming call poll (used by callee to detect any RING signal across all conversations) ---
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    });

    const matchIds = matches.map((m: { id: string }) => m.id);
    const incoming = getIncomingRings(userId, matchIds);
    console.log(`[Signal GET Global] User: ${userId}, Match IDs:`, matchIds, 'Incoming signals:', incoming);

    if (incoming.length === 0) {
      return NextResponse.json({ incomingCall: null });
    }

    const ring = incoming[0];
    const caller = await prisma.user.findUnique({
      where: { id: ring.callerId },
      include: { profile: true },
    });

    console.log(`[Signal GET Global] Returning incoming call from ${ring.callerId} for match ${ring.matchId}`);

    return NextResponse.json({
      incomingCall: {
        matchId: ring.matchId,
        callerId: ring.callerId,
        callerName: caller?.profile?.name ?? 'Someone',
        callerPhoto: caller?.profile?.photos
          ? (() => { try { const p = JSON.parse(caller.profile!.photos); return p[0] ?? null; } catch { return null; } })()
          : null,
        callType: ring.callType,
      },
    });
  } catch (error) {
    console.error('GET /api/chat/signal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/chat/signal
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = decoded.id;
    const body = await request.json();
    const { matchId, signal, callType } = body as {
      matchId: string;
      signal: SignalType;
      callType?: 'voice' | 'video';
    };

    console.log(`[Signal POST] User: ${userId}, matchId: ${matchId}, signal: ${signal}, callType: ${callType}`);

    if (!matchId || !signal) {
      return NextResponse.json({ error: 'matchId and signal are required' }, { status: 400 });
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
      console.warn(`[Signal POST] Match ${matchId} not found or user ${userId} is not member`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (signal === 'RING') {
      if (!callType || !['voice', 'video'].includes(callType)) {
        return NextResponse.json({ error: 'callType is required for RING' }, { status: 400 });
      }
      setSignal(matchId, {
        matchId,
        callerId: userId,
        callType: callType as 'voice' | 'video',
        signal: 'RING',
        createdAt: Date.now(),
      });
      console.log(`[Signal POST] Set RING signal for match ${matchId} by caller ${userId}`);
    } else if (signal === 'ACCEPT') {
      const existing = getSignal(matchId);
      if (!existing) {
        console.warn(`[Signal POST] Accept failed: no active signal for match ${matchId}`);
        return NextResponse.json({ error: 'No active call to accept' }, { status: 404 });
      }
      setSignal(matchId, { ...existing, signal: 'ACCEPT' });
      console.log(`[Signal POST] Set ACCEPT signal for match ${matchId}`);
    } else if (signal === 'REJECT') {
      const existing = getSignal(matchId);
      if (!existing) {
        console.warn(`[Signal POST] Reject failed: no active signal for match ${matchId}`);
        return NextResponse.json({ error: 'No active call to reject' }, { status: 404 });
      }
      setSignal(matchId, { ...existing, signal: 'REJECT' });
      console.log(`[Signal POST] Set REJECT signal for match ${matchId}`);
    } else if (signal === 'END') {
      clearSignal(matchId);
      console.log(`[Signal POST] Cleared signal for match ${matchId}`);
    }

    return NextResponse.json({ success: true, signal });
  } catch (error) {
    console.error('POST /api/chat/signal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
