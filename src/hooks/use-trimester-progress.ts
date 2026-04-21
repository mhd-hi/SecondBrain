'use client';

import type { Course } from '@/types/course';
import type { CourseProgressBar, StatsProgressBar, TrimesterProgressBar } from '@/types/trimester-progressbar';
import { useMemo } from 'react';

import { useCourses } from '@/hooks/course/use-course-store';
import { calculateCourseProgressMetrics, calculateProgressMetrics } from '@/lib/utils/progress-util';
import { getCurrentTrimesterInfo } from '@/lib/utils/trimester-util';

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
      const tasks = course.tasks ?? [];
      const progress = tasks.length > 0
        ? calculateProgressMetrics(tasks)
        : {
            total: course.totalTasks ?? 0,
            completed: course.completedTasks ?? 0,
            inProgress: course.inProgressTasks ?? 0,
            todo: course.todoTasks ?? 0,
            completionPercentage:
              (course.totalTasks ?? 0) > 0
                ? Math.round(((course.completedTasks ?? 0) / (course.totalTasks ?? 0)) * 100)
                : 0,
          };
      const dueTasksCount = tasks.length > 0
        ? tasks.filter(task => new Date(task.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length
        : (course.dueSoonCount ?? 0) + (course.overdueCount ?? 0);

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
