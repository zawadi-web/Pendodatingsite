/**
 * Prisma v7 uses a WASM-based query compiler that ALWAYS requires a driver
 * adapter — the old binary query engine is no longer used.
 *
 * PrismaLibSql / PrismaPg are FACTORIES: they take a config object (not a
 * pre-built client instance) and create the connection internally.
 *
 * Adapter selection is automatic based on DATABASE_URL:
 *   file:*          → @prisma/adapter-libsql  (SQLite / local dev)
 *   postgresql:*    → @prisma/adapter-pg       (Neon / production)
 *   postgres:*      → @prisma/adapter-pg
 */
import { PrismaClient } from '@prisma/client';

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pendo';

  if (url.startsWith('postgresql:') || url.startsWith('postgres:')) {
    // ── PostgreSQL (Neon / production) ─────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg') as typeof import('pg');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg');
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  }

  if (url.startsWith('file:')) {
    // ── SQLite (LibSQL / local dev) ──────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql');
    const adapter = new PrismaLibSql({ url });
    return new PrismaClient({ adapter } as any);
  }

  throw new Error(
    `Unsupported DATABASE_URL scheme. Expected "postgresql:" or "postgres:". Got: ${url.split(':')[0]}:`
  );
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
