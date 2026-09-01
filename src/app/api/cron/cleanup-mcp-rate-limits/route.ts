import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { mcpRateLimits } from '@/server/db/schema';

/**
 * Deletes expired fixed-window rows from mcp_rate_limits (plan section 9:
 * "A scheduled or opportunistic cleanup may delete expired windows").
 * Protected by the shared CRON_SECRET like the other cron routes.
 */
export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const deleted = await db
    .delete(mcpRateLimits)
    .where(sql`${mcpRateLimits.expiresAt} < now()`)
    .returning({ key: mcpRateLimits.key });
  return NextResponse.json({ deletedWindows: deleted.length });
}
