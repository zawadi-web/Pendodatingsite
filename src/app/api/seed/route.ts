import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const passwordHash = await hashPassword('password123');
    const adminPasswordHash = await hashPassword('adminpassword');

    // 1. Seed Admin User
    const adminEmail = 'admin@pendo.love';
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        profile: {
          create: {
            name: 'Pendo Admin',
            dob: new Date('1990-01-01'),
            gender: 'OTHER',
            preference: 'BOTH',
            interests: 'Moderation,Security,Safety',
            location: 'Nairobi HQ',
            photos: '[]',
            isVerified: true,
          }
        },
        wallet: {
          create: {
            balance: 5000.0,
            coins: 1000,
          }
        },
        chatRestriction: {
          create: {
            warningsCount: 0,
            isBanned: false,
          }
        }
      }
    });

    // 2. Seed Mock Members
    const mockUsers = [
      {
        name: 'Sarah Wanjiku',
        email: 'sarah@pendo.love',
        gender: 'FEMALE',
        pref: 'MALE',
        age: 24,
        location: 'Nairobi',
        bio: 'Explorer of coffee shops, lover of acoustic covers, and weekend hiker. Looking for someone genuine to explore life with.',
        interests: 'Coffee,Music,Hiking,Outdoors',
        photos: '["/uploads/mock_female1.jpg"]'
      },
      {
        name: 'Jessica Atieno',
        email: 'jessica@pendo.love',
        gender: 'FEMALE',
        pref: 'MALE',
        age: 26,
        location: 'Mombasa',
        bio: 'Beach lover, amateur sushi chef, and full-time tech consultant. Let\'s watch sunsets and talk about astrophysics.',
        interests: 'Tech,Travel,Cooking,Movies',
        photos: '["/uploads/mock_female2.jpg"]'
      },
      {
        name: 'Michael Mwangi',
        email: 'michael@pendo.love',
        gender: 'MALE',
        pref: 'FEMALE',
        age: 28,
        location: 'Nairobi',
        bio: 'Gym enthusiast, startup founder, and avid photographer. Ready to capture our next adventure together.',
        interests: 'Fitness,Tech,Gaming,Coffee',
        photos: '["/uploads/mock_male1.jpg"]'
      },
      {
        name: 'David Ochieng',
        email: 'david@pendo.love',
        gender: 'MALE',
        pref: 'FEMALE',
        age: 25,
        location: 'Kisumu',
        bio: 'Guitar player, poetry writer, and nature enthusiast. Always up for road trips and live acoustic music sessions.',
        interests: 'Music,Outdoors,Hiking,Reading',
        photos: '["/uploads/mock_male2.jpg"]'
      },
      {
        name: 'Aisha Omar',
        email: 'aisha@pendo.love',
        gender: 'FEMALE',
        pref: 'BOTH',
        age: 23,
        location: 'Nakuru',
        bio: 'Graphic designer by day, home baker by night. Let\'s bake cookies and argue about font choices!',
        interests: 'Art,Cooking,Reading,Movies',
        photos: '["/uploads/mock_female3.jpg"]'
      },
    ];

    const seededUsers = [];

    for (const u of mockUsers) {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - u.age);

      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          profile: {
            update: {
              bio: u.bio,
              location: u.location,
              interests: u.interests,
            }
          }
        },
        create: {
          email: u.email,
          passwordHash,
          profile: {
            create: {
              name: u.name,
              dob,
              gender: u.gender,
              preference: u.pref,
              interests: u.interests,
              location: u.location,
              photos: u.photos,
              isVerified: Math.random() > 0.4,
              isPremium: Math.random() > 0.6,
            }
          },
          wallet: {
            create: {
              balance: 1000.0, // Pre-seed balance for testing
              coins: 50,      // Pre-seed coins for testing
            }
          },
          chatRestriction: {
            create: {
              warningsCount: 0,
              isBanned: false,
            }
          }
        },
        include: { profile: true }
      });
      seededUsers.push(user);
    }

    // 3. Setup a mock match & messages to make Chat page immediately functional
    // Let's match Michael and Sarah
    const sarah = seededUsers.find(u => u.email === 'sarah@pendo.love');
    const michael = seededUsers.find(u => u.email === 'michael@pendo.love');

    if (sarah && michael) {
      // Create mutual likes
      await prisma.like.upsert({
        where: { fromId_toId: { fromId: sarah.id, toId: michael.id } },
        update: {},
        create: { fromId: sarah.id, toId: michael.id, isLike: true }
      });

      await prisma.like.upsert({
        where: { fromId_toId: { fromId: michael.id, toId: sarah.id } },
        update: {},
        create: { fromId: michael.id, toId: sarah.id, isLike: true }
      });

      // Create Match
      const matchId1 = sarah.id < michael.id ? sarah.id : michael.id;
      const matchId2 = sarah.id > michael.id ? sarah.id : michael.id;

      const match = await prisma.match.upsert({
        where: { user1Id_user2Id: { user1Id: matchId1, user2Id: matchId2 } },
        update: {},
        create: { user1Id: matchId1, user2Id: matchId2 }
      });

      // Seed messages
      await prisma.message.deleteMany({ where: { matchId: match.id } }); // reset messages
      
      await prisma.message.create({
        data: {
          matchId: match.id,
          senderId: michael.id,
          content: 'Hey Sarah! Loved your hiking photo. Where was that taken?',
        }
      });

      await prisma.message.create({
        data: {
          matchId: match.id,
          senderId: sarah.id,
          content: 'Hey Michael! Thanks! That was at Ngong Hills, hike was amazing!',
        }
      });

      await prisma.message.create({
        data: {
          matchId: match.id,
          senderId: michael.id,
          content: 'Awesome! We should go together sometime. I am planning a trip next Saturday.',
        }
      });
    }

    return NextResponse.json({
      message: 'Database seeding completed successfully.',
      admin: {
        email: adminEmail,
        password: 'adminpassword',
        role: 'ADMIN'
      },
      testUser: {
        email: 'michael@pendo.love',
        password: 'password123',
        role: 'USER'
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
