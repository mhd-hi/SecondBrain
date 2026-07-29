import { NextResponse } from 'next/server';
import { env } from '@/env';
import { cleanupOldCourses } from '@/server/db/queries';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/cron/cleanup-courses:
 *   get:
 *     summary: Cron job that deletes old courses (requires CRON_SECRET bearer token)
 *     tags: [Cron]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: authorization
 *         required: true
 *         schema: { type: string, example: 'Bearer <CRON_SECRET>' }
 *     responses:
 *       200:
 *         description: Cleanup completed
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: Request) {
  try {
    // Basic API key authentication for cron jobs
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

    const deletedRecords = await cleanupOldCourses();
    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      deletedRecords,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning up old records:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to cleanup records' },
      { status: 500 },
    );
  }
}
