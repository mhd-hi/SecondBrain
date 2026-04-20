import type { Task } from '@/types/task';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusTask } from '@/types/status-task';
import { taskToEvent } from '../../../src/calendar/event-utils';

vi.mock('@/lib/utils', () => ({
  getStatusBgClass: vi.fn(() => 'mock-secondary'),
}));

vi.mock('@/lib/utils/course/daypart', () => ({
  getDaypartTimes: vi.fn(() => ({
    startDate: new Date('2026-02-14T08:00:00.000Z'),
    endDate: new Date('2026-02-14T09:00:00.000Z'),
  })),
}));

describe('taskToEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps Task fields to TEvent correctly', () => {
    const task: Task = {
      id: 't1',
      dueDate: new Date('2026-02-14T15:30:00.000Z'),
      title: 'Test Task',
      notes: 'Do something important',
      course: { id: 'c1', code: 'MATH101', name: 'Math', daypart: 'AM', color: 'red' },
      courseId: 'c1',
      status: StatusTask.TODO,
      type: 'homework',
      estimatedEffort: 1,
      actualEffort: 0,
    };

    const event = taskToEvent(task);

    expect(event.id).toBe('t1');
    expect(event.title).toBe('Test Task');
    expect(event.description).toBe('Do something important');
    expect(event.color).toBe('red');
    expect(event.secondaryColor).toBe('mock-secondary');
    expect(event.type).toBe('task');
    expect(event.courseCode).toBe('MATH101');
    expect(event.courseId).toBe('c1');
    expect(event.startDate).toEqual(new Date('2026-02-14T08:00:00.000Z'));
    expect(event.endDate).toEqual(new Date('2026-02-14T09:00:00.000Z'));
  });

  it('passes a start-of-day Date to getDaypartTimes', async () => {
    const { getDaypartTimes } = await import('@/lib/utils/course/daypart');

    const task: Task = {
      id: 't2',
      dueDate: new Date('2026-02-14T23:59:59.999Z'),
      title: 'Edge Task',
      notes: '',
      course: { id: 'c2', code: 'ENG202', name: 'Eng', daypart: 'EVEN', color: 'green' },
      courseId: 'c2',
      status: StatusTask.IN_PROGRESS,
      type: 'homework',
      estimatedEffort: 1,
      actualEffort: 0,
    };

    taskToEvent(task);

    expect(getDaypartTimes).toHaveBeenCalled();

    // eslint-disable-next-line ts/no-explicit-any
    const calledWith = (getDaypartTimes as any).mock.calls[0][0] as Date;

    expect(calledWith.getHours()).toBe(0);
    expect(calledWith.getMinutes()).toBe(0);
    expect(calledWith.getSeconds()).toBe(0);
    expect(calledWith.getMilliseconds()).toBe(0);
  });
});
