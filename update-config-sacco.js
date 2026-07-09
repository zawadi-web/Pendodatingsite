const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not defined in your environment variables (.env)');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Updating System Config in database with Tower Sacco details...');

  const config = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    update: {
      saccoAccName: 'Tower Sacco',
      saccoAccNo: '506900',
      saccoInstructions: '1. Go to Lipa na M-Pesa. 2. Select Paybill. 3. Enter Business Number 506900. 4. Enter Account Number: 0026005020010444. 5. Enter the amount to pay. 6. Enter your M-Pesa PIN and complete.',
      mpesaShortCode: '506900',
      mpesaConsumerKey: 'edl96joBlwyVvERZnO9MXuLkRGpYmJuV0FmnzNw7AvfMk3XE',
      mpesaConsumerSecret: 'codevDapuNQybWHO8ER5F2V4L4SyNiiAakc3CJlGe2kchR3bD2RsSME04e5lEPjH6eHj',
    },
    create: {
      id: 'default',
      saccoAccName: 'Tower Sacco',
      saccoAccNo: '506900',
      saccoInstructions: '1. Go to Lipa na M-Pesa. 2. Select Paybill. 3. Enter Business Number 506900. 4. Enter Account Number: 0026005020010444. 5. Enter the amount to pay. 6. Enter your M-Pesa PIN and complete.',
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
      mpesaConsumerKey: 'edl96joBlwyVvERZnO9MXuLkRGpYmJuV0FmnzNw7AvfMk3XE',
      mpesaConsumerSecret: 'codevDapuNQybWHO8ER5F2V4L4SyNiiAakc3CJlGe2kchR3bD2RsSME04e5lEPjH6eHj',
      mpesaPasskey: '',
      mpesaShortCode: '506900',
      mpesaCallbackUrl: '',
    }
  });

  console.log('System Config updated successfully in the database!');
  console.log('SACCO Name:', config.saccoAccName);
  console.log('SACCO Paybill:', config.saccoAccNo);
  console.log('M-Pesa Short Code:', config.mpesaShortCode);
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error('Error updating system config:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
