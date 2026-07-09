import prisma from './db';

export async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 0.0,
        coins: 0,
      },
    });
  }
  return wallet;
}

export async function createWalletTransaction(
  userId: string,
  amount: number,
  coins: number,
  type: 'DEPOSIT' | 'DEDUCTION' | 'COMMISSION' | 'REFUND' | 'PAYOUT',
  description: string,
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' = 'SUCCESS',
  referenceId?: string
) {
  const wallet = await getOrCreateWallet(userId);
  
  if (status === 'SUCCESS') {
    // Build query filter dynamically to prevent negative balance or coins.
    const where: any = { id: wallet.id };
    if (amount < 0) {
      where.balance = { gte: -amount };
    }
    if (coins < 0) {
      where.coins = { gte: -coins };
    }

    const updateResult = await prisma.wallet.updateMany({
      where,
      data: {
        balance: { increment: amount },
        coins: { increment: coins },
      },
    });

    if (updateResult.count === 0) {
      if (amount < 0 && wallet.balance < -amount) {
        throw new Error('Insufficient wallet balance.');
      }
      if (coins < 0 && wallet.coins < -coins) {
        throw new Error('Insufficient coins.');
      }
      throw new Error('Transaction failed due to insufficient funds.');
    }
  }
  
  return await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      amount,
      coins,
      type,
      description,
      status,
      referenceId,
    },
  });
}
