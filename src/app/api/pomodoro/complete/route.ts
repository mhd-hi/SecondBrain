import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { startOfPomodoroDay } from '@/lib/pomodoro/date';
import { db } from '@/server/db';
import { pomodoroDaily } from '@/server/db/schema';

type CompleteSessionRequest = {
  durationHours: number;
};

export const POST = withAuthSimple(
  async (request, user) => {
    try {
      const body = await request.json() as CompleteSessionRequest;
      const { durationHours } = body;

      if (typeof durationHours !== 'number' || durationHours <= 0) {
        return NextResponse.json(
          { error: 'Valid durationHours is required' },
          { status: 400 },
        );
      }

      const today = startOfPomodoroDay(new Date(Date.now()));
      const sessionMinutes = Math.round(durationHours * 3600) / 60;
      await db
        .insert(pomodoroDaily)
        .values({
          userId: user.id,
          day: today,
          totalMinutes: sessionMinutes,
        })
        .onConflictDoUpdate({
          target: [pomodoroDaily.userId, pomodoroDaily.day],
          set: {
            totalMinutes: sql`${pomodoroDaily.totalMinutes} + ${sessionMinutes}`,
          },
        });

      return NextResponse.json({
        success: true,
      });
    } catch (error) {
      console.error('Failed to complete Pomodoro session:', error);
      return NextResponse.json(
        { error: 'Failed to complete Pomodoro session' },
        { status: 500 },
      );
    }
  },
);
