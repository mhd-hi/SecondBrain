'use client';

import type { Course } from '@/types/course';
import type { Task } from '@/types/task';
import type { CourseProgressBar, StatsProgressBar, TrimesterProgressBar } from '@/types/trimester-progressbar';
import { useMemo } from 'react';

import { useCourses } from '@/hooks/course/use-course-store';
import { calculateCourseProgressMetrics, calculateProgressMetrics } from '@/lib/utils/progress-util';
import { getCurrentTrimesterInfo } from '@/lib/utils/trimester-util';
import { StatusTask } from '@/types/status-task';

export function useTrimesterProgress(): StatsProgressBar | null {
  const { courses, isLoading } = useCourses();

  return useMemo(() => {
    if (isLoading) {
      return null;
    }

    // Calculate current session info dynamically
    const currentDate = new Date();
    const { totalWeeks, weekOfTrimester } = getCurrentTrimesterInfo();

    // Calculate course progress
    const courseProgresses: CourseProgressBar[] = courses.map((course: Course) => {
      const tasks = course.tasks || [];
      const progress = calculateProgressMetrics(tasks);

      // Tasks due within the next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const dueTasksCount = tasks.filter((task: Task) =>
        task.status !== StatusTask.COMPLETED
        && new Date(task.dueDate) <= nextWeek,
      ).length;

      return {
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        color: course.color,
        totalTasks: progress.total,
        completedTasks: progress.completed,
        inProgressTasks: progress.inProgress,
        todoTasks: progress.todo,
        completionPercentage: progress.completionPercentage,
        dueTasksCount,
      };
    });

    // Calculate trimester progress based on completion percentages
    const trimesterMetrics = calculateCourseProgressMetrics(courseProgresses);

    const trimesterProgress: TrimesterProgressBar = {
      totalCourses: trimesterMetrics.total,
      completedCourses: trimesterMetrics.completed,
      inProgressCourses: trimesterMetrics.inProgress,
      todoCourses: trimesterMetrics.todo,
      completionPercentage: trimesterMetrics.completionPercentage,
    };

    return {
      trimester: trimesterProgress,
      courses: courseProgresses,
      currentSession: {
        date: currentDate,
        sessionIndicator: `Week ${weekOfTrimester} of ${totalWeeks}`,
        weekOfTrimester,
        totalWeeks,
      },
    };
  }, [courses, isLoading]);
}
