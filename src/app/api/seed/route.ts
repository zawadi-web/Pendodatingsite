import { NextResponse } from 'next/server';

/**
 * Seed endpoint has been permanently disabled.
 * All mock data has been removed from the database.
 * Do NOT re-enable this in production.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint is disabled.' },
    { status: 410 } // 410 Gone
  );
}
