import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDefaultTaskDraft,
  buildTaskFromSubtask,
  DEFAULT_TASK_ESTIMATED_EFFORT,
  getDefaultTaskDueDate,
} from '@/lib/utils/task/task-draft';
import { restoreSystemDate, setSystemDate } from '../helpers/runtime';

describe('task draft utils', () => {
  beforeEach(() => {
    setSystemDate(new Date('2026-04-01T10:00:00.000Z'));
  });

  afterEach(() => {
    restoreSystemDate();
  });

  it('builds the default task draft with shared defaults', () => {
    const draft = buildDefaultTaskDraft();

    expect(draft).toMatchObject({
      title: '',
      notes: '',
      estimatedEffort: DEFAULT_TASK_ESTIMATED_EFFORT,
      type: 'theorie',
      status: 'TODO',
    });
    expect(draft.dueDate.toISOString()).toBe('2026-04-08T10:00:00.000Z');
  });

  it('preserves an explicit due date when building a default draft', () => {
    const dueDate = new Date('2026-05-10T15:00:00.000Z');

    const draft = buildDefaultTaskDraft({ dueDate });

    expect(draft.dueDate.toISOString()).toBe(dueDate.toISOString());
    expect(draft.dueDate).not.toBe(dueDate);
  });

  it('builds a task draft from a subtask and falls back to the shared due-date default', () => {
    const draft = buildTaskFromSubtask({
      title: 'Review notes',
      notes: 'Summarize chapter 4',
    });

    expect(draft).toMatchObject({
      title: 'Review notes',
      notes: 'Summarize chapter 4',
      estimatedEffort: DEFAULT_TASK_ESTIMATED_EFFORT,
      type: 'theorie',
      status: 'TODO',
    });
    expect(draft.dueDate.toISOString()).toBe(getDefaultTaskDueDate().toISOString());
  });

  it('accepts string due dates when converting a subtask to a task draft', () => {
    const draft = buildTaskFromSubtask(
      {
        title: 'Convert me',
        notes: '',
      },
      { dueDate: '2026-05-20T12:00:00.000Z' },
    );

    expect(draft.dueDate.toISOString()).toBe('2026-05-20T12:00:00.000Z');
    expect(draft.estimatedEffort).toBe(DEFAULT_TASK_ESTIMATED_EFFORT);
  });
});
