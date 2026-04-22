import type { Task } from '@/types/task';
import { useShallow } from 'zustand/react/shallow';
import { useTaskStore } from '@/lib/stores/task-store';

/**
 * Hook to get tasks for a specific course with automatic reactivity
 * Uses Zustand's shallow comparison to prevent infinite loops from array reference changes
 */
export function useCourseTasksStore(courseId: string): Task[] {
  return useTaskStore(
    useShallow(state => state.getTasksByCourse(courseId)),
  );
}
