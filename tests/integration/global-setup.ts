import path from 'node:path';
import { loadEnv } from 'vite';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Runs pending drizzle migrations against the test database before the
 * integration suite starts, so a stale local test DB (e.g. missing a new
 * column) fails never with cryptic errors. Mirrors CI, which runs
 * `bun run db:migrate` before `bun run test:integration`.
 *
 * Targets ONLY the test database (`DATABASE_URL` after loading `.env.test`,
 * same source as the suite itself) — never dev or prod.
 */
export default async function setup() {
  for (const [key, value] of Object.entries(loadEnv('test', process.cwd(), ''))) {
    process.env[key] ??= value;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (checked .env.test); cannot migrate test DB');
  }

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.join(process.cwd(), 'drizzle'),
    });
  } finally {
    await client.end();
  }
}
