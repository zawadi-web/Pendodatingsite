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
    const newBalance = wallet.balance + amount;
    const newCoins = wallet.coins + coins;
    
    if (newBalance < 0) {
      throw new Error('Insufficient wallet balance.');
    }
    if (newCoins < 0) {
      throw new Error('Insufficient coins.');
    }
    
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: newBalance,
        coins: newCoins,
      },
    });
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
