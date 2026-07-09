import prisma from './db';

export const DEFAULT_CONFIG = {
  saccoAccName: "Tower Sacco",
  saccoAccNo: "506900",
  saccoInstructions: "1. Go to Lipa na M-Pesa. 2. Select Paybill. 3. Enter Business Number 506900. 4. Enter Account Number: 0026005020010444. 5. Enter Amount and PIN.",
  saccoEnabled: true,
  profileUnlockFee: 200.0,
  mediaUnlockFee: 100.0,
  weeklySubPrice: 1000.0,
  monthlySubPrice: 2500.0,
  yearlySubPrice: 5000.0,
  coinPrice10: 100.0,
  coinPrice50: 450.0,
  coinPrice100: 800.0,
  commissionFeePct: 10.0,
  mpesaConsumerKey: "",
  mpesaConsumerSecret: "",
  mpesaPasskey: "",
  mpesaShortCode: "506900",
  mpesaCallbackUrl: "",
};

export async function getSystemConfig() {
  try {
    let config = await prisma.systemConfig.findUnique({
      where: { id: 'default' },
    });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          id: 'default',
          ...DEFAULT_CONFIG,
        },
      });
    }
    return config;
  } catch (e) {
    console.error('Failed to get SystemConfig, returning defaults:', e);
    return { id: 'default', ...DEFAULT_CONFIG, updatedAt: new Date() };
  }
}
