import 'dotenv/config';
import prisma from './src/lib/db';

async function main() {
  console.log('Updating System Config in Neon DB with NCBA details...');

  const config = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    update: {
      saccoAccName: 'NCBA Bank',
      saccoAccNo: '880100 (Acc: 647147)',
      saccoInstructions: '1. Go to Lipa na M-Pesa. 2. Select Paybill. 3. Enter Business Number 880100. 4. Enter Account Number: 647147. 5. Enter the amount to pay. 6. Enter your M-Pesa PIN and complete.',
    },
    create: {
      id: 'default',
      saccoAccName: 'NCBA Bank',
      saccoAccNo: '880100 (Acc: 647147)',
      saccoInstructions: '1. Go to Lipa na M-Pesa. 2. Select Paybill. 3. Enter Business Number 880100. 4. Enter Account Number: 647147. 5. Enter the amount to pay. 6. Enter your M-Pesa PIN and complete.',
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
      mpesaConsumerKey: '',
      mpesaConsumerSecret: '',
      mpesaPasskey: '',
      mpesaShortCode: '',
      mpesaCallbackUrl: '',
    }
  });

  console.log('System Config updated successfully with NCBA paybill 880100, account 647147!');
  console.log('SACCO Name:', config.saccoAccName);
  console.log('SACCO Account:', config.saccoAccNo);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
