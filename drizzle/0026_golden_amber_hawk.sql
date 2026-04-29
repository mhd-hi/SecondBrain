ALTER TABLE "pomodoro_daily" ALTER COLUMN "total_minutes" TYPE real USING "total_minutes" / 60.0;
