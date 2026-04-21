import type { Task } from '@/types/task';
import * as React from 'react';
import { toast } from 'sonner';
import { useUpdateField } from '@/hooks/use-update-field';

function getEditableEffort(task: Task) {
  return task.estimatedEffort > 0 ? task.estimatedEffort : undefined;
}

function normalizeEffortValue(estimatedEffort: number | undefined) {
  const rawValue = estimatedEffort ?? 0;

  if (!Number.isFinite(rawValue)) {
    return 0.5;
  }

  return rawValue < 0 ? 0.5 : Math.max(0, rawValue);
}

export function useTaskCard(task: Task) {
  const updateField = useUpdateField();
  const effortInputContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [editedTitle, setEditedTitle] = React.useState(task.title);
  const [editedDescription, setEditedDescription] = React.useState(task.notes ?? '');
  const [isEditingEffort, setIsEditingEffort] = React.useState(false);
  const [editedEffort, setEditedEffort] = React.useState<number | undefined>(() => getEditableEffort(task));
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = React.useState(false);
  const [editedType, setEditedType] = React.useState(task.type);
  const [editedDueDate, setEditedDueDate] = React.useState(() => (task.dueDate ? new Date(task.dueDate) : undefined));

  React.useEffect(() => {
    if (!isEditingEffort) {
      return;
    }

    const input = effortInputContainerRef.current?.querySelector('input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, [isEditingEffort]);

  const saveTaskField = React.useCallback(async (input: string, value: string) => {
    await updateField({
      type: 'task',
      id: task.id,
      input,
      value,
    });
  }, [task.id, updateField]);

  const saveTitle = React.useCallback(async (title: string) => {
    setEditedTitle(title);
    await saveTaskField('title', title);
  }, [saveTaskField]);

  const saveDescription = React.useCallback(async (description: string) => {
    setEditedDescription(description);
    await saveTaskField('notes', description);
  }, [saveTaskField]);

  const saveType = React.useCallback(async (type: Task['type']) => {
    setEditedType(type);
    setIsTypeDropdownOpen(false);

    if (type === task.type) {
      return;
    }

    await saveTaskField('type', type);
    toast.success('Task type updated');
  }, [saveTaskField, task.type]);

  const saveDueDate = React.useCallback(async (dueDate: Date | null | undefined) => {
    const nextDueDate = dueDate instanceof Date && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined;
    setEditedDueDate(nextDueDate);

    if (nextDueDate) {
      await saveTaskField('dueDate', nextDueDate.toISOString());
      toast.success('Due date updated');
      return;
    }

    await saveTaskField('dueDate', '');
    toast.success('Due date cleared');
  }, [saveTaskField]);

  const startEffortEditing = React.useCallback(() => {
    setEditedEffort(getEditableEffort(task));
    setIsEditingEffort(true);
  }, [task]);

  const cancelEffortEditing = React.useCallback(() => {
    setEditedEffort(getEditableEffort(task));
    setIsEditingEffort(false);
  }, [task]);

  const saveEffort = React.useCallback(async () => {
    setIsEditingEffort(false);

    const nextEffort = normalizeEffortValue(editedEffort);
    const currentEffort = typeof task.estimatedEffort === 'number' ? task.estimatedEffort : 0;

    if (nextEffort === currentEffort) {
      return;
    }

    try {
      await saveTaskField('estimatedEffort', String(nextEffort));
      toast.success('Estimated effort updated');
    } catch (error) {
      console.error('Failed to save estimated effort', error);
      toast.error('Failed to update estimated effort');
    }
  }, [editedEffort, saveTaskField, task.estimatedEffort]);

  const handleEffortKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }

    if (event.key === 'Escape') {
      cancelEffortEditing();
    }
  }, [cancelEffortEditing]);

  return {
    editedDescription,
    editedDueDate,
    editedEffort,
    editedTitle,
    editedType,
    effortInputContainerRef,
    handleEffortKeyDown,
    isEditingEffort,
    isTypeDropdownOpen,
    saveDescription,
    saveDueDate,
    saveEffort,
    saveTitle,
    saveType,
    setEditedEffort,
    setIsTypeDropdownOpen,
    startEffortEditing,
  };
}
