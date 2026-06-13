require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding live Neon database...');

  // Admin user
  const adminHash = await bcrypt.hash('Admin@Pendo2025', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pendo.app' },
    update: {},
    create: {
      email: 'admin@pendo.app',
      passwordHash: adminHash,
      role: 'ADMIN',
      profile: {
        create: {
          name: 'Pendo Admin',
          dob: new Date('1990-01-01'),
          gender: 'OTHER',
          preference: 'BOTH',
          bio: 'Platform Administrator',
          interests: 'Admin',
          photos: '[]',
          location: 'Nairobi',
        }
      },
      wallet: {
        create: { balance: 10000, coins: 10000 }
      }
    }
  });
  console.log('✅ Admin created:', admin.email);

  // System config / pricing
  await prisma.systemConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      saccoAccName: 'Pendo SACCO Account',
      saccoAccNo: '174379',
      saccoInstructions: '1. Go to Lipa na M-Pesa. 2. Select Paybill. 3. Enter Business Number 174379. 4. Enter Account Number: Your Phone Number. 5. Enter Amount and PIN.',
      saccoEnabled: true,
      profileUnlockFee: 200.0,
      mediaUnlockFee: 100.0,
      weeklySubPrice: 100.0,
      monthlySubPrice: 350.0,
      yearlySubPrice: 2500.0,
      coinPrice10: 100.0,
      coinPrice50: 450.0,
      coinPrice100: 800.0,
      commissionFeePct: 10.0,
    }
  });
  console.log('✅ System config initialized');

  console.log('\n🎉 Database ready!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin Email:    admin@pendo.app');
  console.log('  Admin Password: Admin@Pendo2025');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
