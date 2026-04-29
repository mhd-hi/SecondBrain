import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { calculatePomodoroStreak } from '@/lib/pomodoro/streak';
import { db } from '@/server/db';
import { pomodoroDaily } from '@/server/db/schema';

export const GET = withAuthSimple(
  async (_, user) => {
    try {
      const rows = await db
        .select({
          day: pomodoroDaily.day,
        })
        .from(pomodoroDaily)
        .where(eq(pomodoroDaily.userId, user.id));
      const { streakDays, lastCompletedPomodoroDate } = calculatePomodoroStreak(rows);

      return NextResponse.json({
        streakDays,
        lastCompletedPomodoroDate,
      });
    } catch (error) {
      console.error('Failed to fetch user streak:', { error, userId: user?.id, endpoint: API_ENDPOINTS.POMODORO.STREAK });
      return NextResponse.json(
        { error: 'Failed to fetch streak information' },
        { status: 500 },
      );
    }
  },
);
