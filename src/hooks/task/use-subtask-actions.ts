import type { Subtask } from '@/types/subtask';
import * as React from 'react';
import { toast } from 'sonner';
import { createSubtask, deleteSubtask, useUpdateSubtaskField } from '@/hooks/task/use-subtask';
import { useTaskStore } from '@/lib/stores/task-store';
import { buildTaskFromSubtask } from '@/lib/utils/task/task-draft';

type UseSubtaskActionsParams = {
  taskId: string;
  courseId?: string | null;
  courseIdDueDate?: Date | string | undefined;
  onTaskAdded?: () => void;
};

type NewSubtaskInput = {
  title: string;
  notes: string;
};

function notifyTaskAdded(onTaskAdded?: () => void) {
  if (!onTaskAdded) {
    return;
  }

  try {
    onTaskAdded();
  } catch (error) {
    console.warn('onTaskAdded callback failed', error);
  }
}

export function useSubtaskActions({
  taskId,
  courseId,
  courseIdDueDate,
  onTaskAdded,
}: UseSubtaskActionsParams) {
  const updateSubtaskField = useUpdateSubtaskField(taskId);
  const addSubtaskToStore = useTaskStore(state => state.addSubtask);
  const createTask = useTaskStore(state => state.createTask);
  const deleteSubtaskFromStore = useTaskStore(state => state.deleteSubtask);

  const addSubtask = React.useCallback(async (payload: NewSubtaskInput) => {
    const created = await createSubtask(taskId, payload);
    if (!created) {
      return null;
    }

    addSubtaskToStore(taskId, created);
    return created;
  }, [addSubtaskToStore, taskId]);

  const saveSubtaskField = React.useCallback(async (
    subtaskId: string,
    input: 'title' | 'notes',
    value: string,
  ) => {
    await updateSubtaskField(subtaskId, input, value);
  }, [updateSubtaskField]);

  const saveSubtaskTitle = React.useCallback(async (subtaskId: string, title: string) => {
    await saveSubtaskField(subtaskId, 'title', title);
  }, [saveSubtaskField]);

  const saveSubtaskNotes = React.useCallback(async (subtaskId: string, notes: string) => {
    await saveSubtaskField(subtaskId, 'notes', notes);
  }, [saveSubtaskField]);

  const deleteSubtaskAction = React.useCallback(async (subtaskId: string) => {
    try {
      const deleted = await deleteSubtask(taskId, subtaskId);
      if (!deleted) {
        throw new Error('Failed to delete');
      }

      deleteSubtaskFromStore(taskId, subtaskId);
      toast.success('Subtask deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete subtask');
    }
  }, [deleteSubtaskFromStore, taskId]);

  const convertSubtaskToTask = React.useCallback(async (subtask: Subtask) => {
    try {
      if (!courseId) {
        toast.error('Cannot convert subtask to task: parent task has no course');
        console.warn('Convert aborted: courseId is falsy', { taskId, courseId, courseIdDueDate, subtask });
        return;
      }

      const created = await createTask(
        courseId,
        buildTaskFromSubtask(subtask, { dueDate: courseIdDueDate }),
      );

      if (!created) {
        throw new Error('Failed to create task');
      }

      notifyTaskAdded(onTaskAdded);

      const deleted = await deleteSubtask(taskId, subtask.id);
      if (!deleted) {
        console.warn('Failed to delete subtask after conversion', { taskId, subtaskId: subtask.id });
        toast.success('Subtask converted to task (subtask not removed)');
        return;
      }

      deleteSubtaskFromStore(taskId, subtask.id);
      toast.success('Subtask converted to task');
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert subtask to task');
    }
  }, [
    courseId,
    courseIdDueDate,
    createTask,
    deleteSubtaskFromStore,
    onTaskAdded,
    taskId,
  ]);

  return {
    addSubtask,
    convertSubtaskToTask,
    deleteSubtask: deleteSubtaskAction,
    saveSubtaskNotes,
    saveSubtaskTitle,
  };
}
