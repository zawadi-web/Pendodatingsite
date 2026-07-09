import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { getLocationCoordinates } from '@/lib/locations';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      profile: user.profile,
      email: user.email,
      phone: user.phone,
      role: user.role
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || !decoded.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      name, bio, location, interests, gender, preference, photos,
      latitude, longitude, phone, instagram, facebook, telegram
    } = body;

    // Validate name
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let finalLat = latitude !== undefined && latitude !== null ? parseFloat(latitude) : null;
    let finalLng = longitude !== undefined && longitude !== null ? parseFloat(longitude) : null;

    if (location && (finalLat === null || finalLng === null)) {
      const coords = getLocationCoordinates(location);
      if (coords) {
        finalLat = coords.latitude;
        finalLng = coords.longitude;
      }
    }

    // Update User phone if provided
    if (phone !== undefined) {
      const cleanPhone = phone ? phone.trim() : '';
      if (cleanPhone !== '') {
        const existingPhone = await prisma.user.findFirst({
          where: {
            phone: cleanPhone,
            id: { not: decoded.id }
          }
        });
        if (existingPhone) {
          return NextResponse.json({ error: 'Phone number already in use by another account' }, { status: 400 });
        }
      }

      await prisma.user.update({
        where: { id: decoded.id },
        data: { phone: cleanPhone || null }
      });
    }

    // Update profile
    const updatedProfile = await prisma.profile.update({
      where: { userId: decoded.id },
      data: {
        name,
        bio: bio || '',
        location: location || '',
        latitude: finalLat,
        longitude: finalLng,
        interests: interests || '',
        gender,
        preference,
        photos: photos ? JSON.stringify(photos) : '[]',
        instagram: instagram !== undefined ? (instagram ? instagram.trim() : null) : undefined,
        facebook: facebook !== undefined ? (facebook ? facebook.trim() : null) : undefined,
        telegram: telegram !== undefined ? (telegram ? telegram.trim() : null) : undefined,
      },
    });

    return NextResponse.json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
