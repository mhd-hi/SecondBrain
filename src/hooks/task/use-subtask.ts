import type { Subtask } from '@/types/subtask';
import { useCallback } from 'react';
import { useTaskStore } from '@/lib/stores/task-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { ErrorHandlers } from '@/lib/utils/errors/error';

export async function createSubtask(taskId: string, payload: {
  title: string;
  notes: string;
}): Promise<Subtask | null> {
  try {
    const created = await api.post(API_ENDPOINTS.TASKS.SUBTASKS(taskId), payload);
    return created as Subtask;
  } catch (error) {
    ErrorHandlers.api(error, 'Failed to create subtask');
    return null;
  }
}

export async function deleteSubtask(taskId: string, subtaskId: string): Promise<boolean> {
  try {
    await api.delete(API_ENDPOINTS.TASKS.SUBTASK_DETAIL(taskId, subtaskId));
    return true;
  } catch (error) {
    ErrorHandlers.api(error, 'Failed to delete subtask');
    return false;
  }
}

export function useUpdateSubtaskField(taskId: string) {
  const getTask = useTaskStore(state => state.getTask);
  const updateSubtask = useTaskStore(state => state.updateSubtask);

  return useCallback(async (
    subtaskId: string,
    input: 'title' | 'notes',
    value: string,
  ) => {
    const originalSubtask = getTask(taskId)?.subtasks?.find(subtask => subtask.id === subtaskId);

    updateSubtask(taskId, subtaskId, { [input]: value });

    try {
      await api.post(
        API_ENDPOINTS.TASKS.SUBTASK_UPDATE,
        { id: subtaskId, input, value },
        'Failed to update subtask',
      );
      return true;
    } catch (error) {
      if (originalSubtask) {
        const currentSubtask = getTask(taskId)?.subtasks?.find(subtask => subtask.id === subtaskId);
        if (currentSubtask?.[input] === value) {
          updateSubtask(taskId, subtaskId, { [input]: originalSubtask[input] });
        }
      }

      console.error('Failed to update subtask field', error);
      throw error;
    }
  }, [getTask, taskId, updateSubtask]);
}
