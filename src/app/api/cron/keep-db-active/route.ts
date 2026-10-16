import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import { isValidCronAuth } from '@/lib/auth/cron';
import { db } from '@/server/db';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/cron/keep-db-active:
 *   get:
 *     summary: Cron job that pings the database to keep it warm (requires CRON_SECRET bearer token)
 *     tags: [Cron]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: authorization
 *         required: true
 *         schema: { type: string, example: 'Bearer <CRON_SECRET>' }
 *     responses:
 *       200:
 *         description: Keepalive completed
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!isValidCronAuth(authHeader, env.CRON_SECRET)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
          code: 'CRON_UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    const [heartbeat] = await db.execute(sql<{ connectedAt: Date }>`
      SELECT NOW() AS "connectedAt"
    `);

    return NextResponse.json({
      success: true,
      message: 'Database keepalive completed',
      heartbeat: heartbeat ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running database keepalive:', error);

    return NextResponse.json(
      { success: false, message: 'Failed to keep database active' },
      { status: 500 },
    );
  }
}
