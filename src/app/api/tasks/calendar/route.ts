import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth/api';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { getCalendarEvents } from '@/lib/utils/task/queries';

async function handleGetCalendarTasks(
    request: NextRequest,
    user: AuthenticatedUser,
): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
        return NextResponse.json(
            { error: 'Start and end dates are required' },
            { status: 400 },
        );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return NextResponse.json(
            { error: 'Invalid date format' },
            { status: 400 },
        );
    }

    const tasks = await getCalendarEvents(startDate, endDate, user.id);
    return NextResponse.json(tasks);
}

/**
 * @swagger
 * /api/tasks/calendar:
 *   get:
 *     summary: Get tasks with a due date between start and end
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: end
 *         required: true
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Tasks in range
 *       400:
 *         description: Missing or invalid dates
 */
export const GET = withAuthSimple(handleGetCalendarTasks);
