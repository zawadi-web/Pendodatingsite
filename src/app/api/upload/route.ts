import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = decoded.id;
    const body = await request.json();
    const { fileData, fileName } = body;

    if (!fileData || !fileName) {
      return NextResponse.json({ error: 'Missing file data or file name' }, { status: 400 });
    }

    // Parse base64
    const base64Data = fileData.split(';base64,').pop();
    if (!base64Data) {
      return NextResponse.json({ error: 'Invalid file format' }, { status: 400 });
    }
    const buffer = Buffer.from(base64Data, 'base64');

    // Setup directories
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique name
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
    const uniqueName = `${userId}_${Date.now()}_${sanitizedFileName}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Save file
    await fs.writeFile(filePath, buffer);

    const publicPath = `/uploads/${uniqueName}`;
    return NextResponse.json({ filePath: publicPath });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// Next.js App Router: set max request body size via segment config
export const maxDuration = 30;
