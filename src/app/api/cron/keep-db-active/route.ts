import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import { db } from '@/server/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
