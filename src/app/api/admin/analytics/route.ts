import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token.value) as any;
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Profile & media unlocks
    const profileUnlockCount = await prisma.profileUnlock.count();
    const mediaUnlockCount = await prisma.mediaUnlock.count();
    const unlocksToday = await prisma.profileUnlock.count({ where: { createdAt: { gte: oneDayAgo } } });

    // Subscriptions
    const activeSubscriptions = await prisma.subscription.count({ where: { status: 'ACTIVE' } });

    // Total coins in circulation
    const walletAgg = await prisma.wallet.aggregate({ _sum: { coins: true } });
    const totalCoins = walletAgg._sum.coins ?? 0;

    // Messages sent
    const messagesSent = await prisma.message.count();

    // Matches
    const matchesCreated = await prisma.match.count({ where: { isMatch: true } });

    // Financial: all transactions
    const allTx = await prisma.transaction.findMany({ where: { status: 'SUCCESS' } });
    
    // Coin purchases (positive amounts = credits)
    const coinTx = allTx.filter(t => t.type === 'COIN_PURCHASE' && t.amount > 0);
    const coinRevenue = coinTx.reduce((sum, t) => sum + (t.amount * 2), 0); // 2 KES per coin approx

    // Subscription revenue
    const subTx = allTx.filter(t => t.type === 'SUBSCRIPTION');
    const subscriptionRevenue = subTx.length * 500; // rough estimate

    // Total deposits from payments
    const successPayments = await prisma.payment.findMany({ where: { status: 'SUCCESS' } });
    const totalDeposits = successPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

    // Total revenue estimate
    const totalRevenue = totalDeposits;

    // Pending transactions
    const pendingTransactions = await prisma.payment.count({ where: { status: 'PENDING' } });

    return NextResponse.json({
      totalRevenue,
      unlocksToday,
      activeSubscriptions,
      totalCoins,
      profileUnlocks: profileUnlockCount,
      mediaUnlocks: mediaUnlockCount,
      messagesSent,
      matchesCreated,
      totalDeposits,
      pendingTransactions,
      subscriptionRevenue,
      coinRevenue,
    });
  } catch (error) {
    console.error('Fetch admin analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
