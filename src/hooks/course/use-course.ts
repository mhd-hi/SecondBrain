'use client';

import type { CourseApiResponse } from '@/types/api/course';
import type { TCourseColor } from '@/types/colors';
import type { Course, Daypart } from '@/types/course';
import type { StatusTask } from '@/types/status-task';
import type { Task } from '@/types/task';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useCourseStore } from '@/lib/stores/course-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { withLoadingAndErrorHandling } from '@/lib/utils/api/loading-util';
import { ErrorHandlers } from '@/lib/utils/errors/error';

export function useCourse(courseId: string) {
  const [course, setCourse] = useState<Course | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCourse = useCallback(async () => {
    await withLoadingAndErrorHandling(
      async () => {
        const data = await api.get<CourseApiResponse>(API_ENDPOINTS.COURSES.DETAIL(courseId));

        const tasksWithValidatedDates: Task[] = data.tasks.map(task => ({
          ...task,
          actualEffort: task.actualEffort ?? 0,
          dueDate: task.dueDate ? new Date(task.dueDate) : new Date(),
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          course: {
            id: data.id,
            code: data.code,
            name: data.name,
            color: data.color as TCourseColor,
            daypart: data.daypart,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          },
        }));

        setCourse({
          ...data,
          color: data.color as TCourseColor,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          tasks: tasksWithValidatedDates,
        });
        setTasks(tasksWithValidatedDates);
      },
      setIsLoading,
      (error) => {
        setError('Failed to load course data');
        ErrorHandlers.silent(error, 'useCourse fetchCourse');
      },
    );
  }, [courseId]);

  const getFilteredTasks = useCallback((status?: StatusTask) => {
    if (!status) {
      return tasks;
    }
    return tasks.filter(task => task.status === status);
  }, [tasks]);

  const updateCourseColor = useCallback(async (color: TCourseColor) => {
    await withLoadingAndErrorHandling(
      async () => {
        await updateCourseFieldById(courseId, 'color', color);

        // Update the local course state with the new color
        setCourse(prevCourse =>
          prevCourse ? { ...prevCourse, color } : prevCourse,
        );
      },
      setIsLoading,
      (error) => {
        setError('Failed to update course color');
        ErrorHandlers.silent(error, 'useCourse updateCourseColor');
      },
    );
  }, [courseId]);

  const updateCourseDaypart = useCallback(async (daypart: Daypart) => {
    await withLoadingAndErrorHandling(
      async () => {
        await updateCourseFieldById(courseId, 'daypart', daypart);

        // Update the local course state with the new daypart
        setCourse(prevCourse =>
          prevCourse ? { ...prevCourse, daypart } : prevCourse,
        );
      },
      setIsLoading,
      (error) => {
        setError('Failed to update course daypart');
        ErrorHandlers.silent(error, 'useCourse updateCourseDaypart');
      },
    );
  }, [courseId]);

  const deleteCourse = useCallback(async () => {
    await withLoadingAndErrorHandling(
      async () => {
        await deleteCourseById(courseId);
        setCourse(null);
        setTasks([]);
      },
      setIsLoading,
      (error) => {
        setError('Failed to delete course');
        ErrorHandlers.silent(error, 'useCourse deleteCourse');
      },
    );
  }, [courseId]);

  return {
    course,
    tasks,
    isLoading,
    error,
    fetchCourse,
    getFilteredTasks,
    setCourse,
    setTasks,
    updateCourseColor,
    updateCourseDaypart,
    deleteCourse,
  };
}

export async function deleteCourseById(courseId: string) {
  const { getCourse, deleteCourse, addCourse } = useCourseStore.getState();
  const originalCourse = getCourse(courseId);

  if (originalCourse) {
    deleteCourse(courseId);
  }

  try {
    await api.delete(
      API_ENDPOINTS.COURSES.DETAIL(courseId),
      'Failed to delete course',
    );
    return true;
  } catch (error) {
    if (originalCourse) {
      addCourse(originalCourse);
    }

    console.error('Failed to delete course', error);
    throw error;
  }
}

export async function updateCourseFieldById(
  courseId: string,
  field: string,
  value: unknown,
) {
  const { getCourse, updateCourse } = useCourseStore.getState();
  const originalCourse = getCourse(courseId);

  if (!originalCourse) {
    return false;
  }

  updateCourse(courseId, { [field]: value } as Partial<Course>);

  try {
    await api.patch(
      API_ENDPOINTS.COURSES.DETAIL(courseId),
      { [field]: value },
      'Failed to update course',
    );
    toast.success('Course updated successfully');
    return true;
  } catch (error) {
    if (Object.hasOwn(originalCourse, field)) {
      updateCourse(
        courseId,
        { [field]: originalCourse[field as keyof Course] } as Partial<Course>,
      );
    }

    console.error('Failed to update course', error);
    throw error;
  }
}
