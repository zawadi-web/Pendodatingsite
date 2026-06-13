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

    const reporterId = decoded.id;
    const body = await request.json();
    const { reportedId, reason, description } = body;

    if (!reportedId || !reason) {
      return NextResponse.json({ error: 'reportedId and reason are required' }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedId,
        reason,
        description: description || '',
        status: 'PENDING',
      },
    });

    return NextResponse.json({ message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('Submit report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
