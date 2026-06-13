const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const target = process.argv[2];

if (!target || (target !== 'sqlite' && target !== 'postgresql')) {
  console.log('Usage: node switch-db.js [sqlite|postgresql]');
  process.exit(1);
}

try {
  let schema = fs.readFileSync(schemaPath, 'utf8');

  if (target === 'sqlite') {
    // Switch to sqlite
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    console.log('Setting database provider to SQLite...');
  } else {
    // Switch to postgresql
    schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
    console.log('Setting database provider to PostgreSQL...');
  }

  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log('Successfully updated schema.prisma!');
  
  console.log('Running Prisma generate...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Done! Database switched successfully.');
} catch (error) {
  console.error('Error switching database:', error.message);
}
