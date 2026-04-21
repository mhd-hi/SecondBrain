import type { Subtask } from '@/types/subtask';
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
