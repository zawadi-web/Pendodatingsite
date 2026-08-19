import prisma from '@/lib/db';

const CONCIERGE_EMAIL = 'concierge@pendo.love';

/**
 * Ensures the Pendo Concierge system user exists in the database.
 */
export async function getOrCreateConciergeUser() {
  let concierge = await prisma.user.findUnique({
    where: { email: CONCIERGE_EMAIL },
    include: { profile: true },
  });

  if (!concierge) {
    concierge = await prisma.user.create({
      data: {
        email: CONCIERGE_EMAIL,
        role: 'ADMIN',
        profile: {
          create: {
            name: 'Pendo Concierge ✨',
            dob: new Date('2000-01-01'),
            gender: 'OTHER',
            preference: 'BOTH',
            bio: 'Your official Pendo assistant! I am here to help you get started, optimize your profile, and find great matches safely.',
            interests: 'Matchmaking, Safety, Support, Events',
            location: 'Nairobi',
            photos: JSON.stringify(['/icon-512.png']),
            isVerified: true,
            isPremium: true,
          },
        },
        wallet: {
          create: {
            balance: 1000000.0,
            coins: 100000,
          },
        },
      },
      include: { profile: true },
    });
  }

  return concierge;
}

/**
 * Automatically creates a match and sends an onboarding welcome message
 * from Pendo Concierge to a newly registered user.
 */
export async function sendConciergeWelcomeMessage(userId: string) {
  try {
    const concierge = await getOrCreateConciergeUser();
    if (concierge.id === userId) return;

    // Check if match already exists
    let match = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: concierge.id, user2Id: userId },
          { user1Id: userId, user2Id: concierge.id },
        ],
      },
    });

    if (!match) {
      match = await prisma.match.create({
        data: {
          user1Id: concierge.id,
          user2Id: userId,
        },
      });
    }

    // Check if welcome message was already sent
    const existingWelcome = await prisma.message.findFirst({
      where: {
        matchId: match.id,
        senderId: concierge.id,
      },
    });

    if (!existingWelcome) {
      await prisma.message.create({
        data: {
          matchId: match.id,
          senderId: concierge.id,
          content: `Welcome to Pendo! ✨\n\nI'm your Pendo Concierge assistant. Here are 3 quick tips to get 3x more matches:\n\n1. 📸 Add at least 2 clear profile photos.\n2. 📝 Write a fun bio highlighting your interests.\n3. 📍 Set your city location to discover people nearby.\n\nEnjoy connecting, and let me know if you have any questions!`,
          isDelivered: true,
          isRead: false,
        },
      });
    }
  } catch (error) {
    console.error('Failed to send Concierge welcome message:', error);
  }
}
