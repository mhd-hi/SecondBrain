import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/env';
import * as schema from '@/server/db/schema';

// For query purposes - optimized with connection pooling
export const dbClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'test' ? 4 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Disable prepared statements for serverless compatibility
});

export const db: PostgresJsDatabase<typeof schema> = drizzle(dbClient, { schema });
