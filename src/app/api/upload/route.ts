import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

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

    // 1. Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const dotIndex = fileName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? fileName.substring(dotIndex + 1).toLowerCase() : '';
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Invalid file extension. Only JPG, JPEG, PNG, GIF, and WEBP images are allowed.' }, { status: 400 });
    }

    // 2. Validate MIME type prefix
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mimeMatch = fileData.match(/^data:([^;]+);base64,/);
    if (!mimeMatch) {
      return NextResponse.json({ error: 'Invalid file data format. Must be base64 data URL.' }, { status: 400 });
    }
    const mimeType = mimeMatch[1];
    if (!allowedMimeTypes.includes(mimeType)) {
      return NextResponse.json({ error: 'Invalid MIME type. Only JPG, JPEG, PNG, GIF, and WEBP images are allowed.' }, { status: 400 });
    }

    // 3. Parse base64 content
    const base64Data = fileData.split(';base64,').pop();
    if (!base64Data) {
      return NextResponse.json({ error: 'Invalid base64 payload' }, { status: 400 });
    }
    const buffer = Buffer.from(base64Data, 'base64');

    // 4. Validate file size (Limit to 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit.' }, { status: 400 });
    }

    // Save file using new modular storage service (handles local/cloud storage)
    const publicPath = await uploadFile(buffer, fileName, mimeType, userId);
    return NextResponse.json({ filePath: publicPath });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// Next.js App Router: set max request body size via segment config
export const maxDuration = 30;
