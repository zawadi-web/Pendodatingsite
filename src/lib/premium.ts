import prisma from './db';

export async function checkPremiumStatus(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    // 1. Check Profile-level premium flag
    if (user.profile?.isPremium) {
      if (user.profile.premiumUntil) {
        if (new Date(user.profile.premiumUntil) > new Date()) {
          return true;
        } else {
          // Flag has expired, reset it
          await prisma.profile.update({
            where: { userId },
            data: { isPremium: false, premiumUntil: null }
          });
        }
      } else {
        return true;
      }
    }

    // 2. Check Subscription model
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      }
    });

    if (activeSub) {
      // Sync status to Profile
      await prisma.profile.update({
        where: { userId },
        data: {
          isPremium: true,
          premiumUntil: activeSub.expiresAt
        }
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Check premium status error:', error);
    return false;
  }
}
