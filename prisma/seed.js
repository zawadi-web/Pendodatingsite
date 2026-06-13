const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create a default user password
  const passwordHash = await bcrypt.hash('password123', 10);

  const mockUsers = [
    { name: 'Sarah', email: 'sarah@example.com', gender: 'FEMALE', pref: 'MALE', age: 24, location: 'Nairobi' },
    { name: 'Jessica', email: 'jessica@example.com', gender: 'FEMALE', pref: 'MALE', age: 26, location: 'Mombasa' },
    { name: 'Michael', email: 'michael@example.com', gender: 'MALE', pref: 'FEMALE', age: 28, location: 'Nairobi' },
    { name: 'David', email: 'david@example.com', gender: 'MALE', pref: 'FEMALE', age: 25, location: 'Kisumu' },
    { name: 'Aisha', email: 'aisha@example.com', gender: 'FEMALE', pref: 'BOTH', age: 23, location: 'Nakuru' },
  ];

  for (const u of mockUsers) {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - u.age);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        profile: {
          create: {
            name: u.name,
            dob,
            gender: u.gender,
            preference: u.pref,
            interests: 'Music,Travel',
            location: u.location,
            photos: '[]',
          }
        }
      },
    });
    console.log(`Created user: ${user.email}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
