import { describe, expect, it } from 'vitest';
import {
  chatRequestSchema,
  draftActionsSchema,
  plannerOutputSchema,
} from '@/lib/ai/chat/types';

const taskId = '11111111-1111-4111-8111-111111111111';
const courseId = '22222222-2222-4222-8222-222222222222';

describe('AI chat contracts', () => {
  it('applies existing task defaults to add drafts', () => {
    const output = plannerOutputSchema.parse({
      kind: 'draft',
      message: 'Review this task',
      summary: 'Add one task',
      reason: 'Requested by the user',
      actions: [
        {
          type: 'add_task',
          courseId,
          task: { title: 'Read chapter 1', dueDate: '2026-09-08' },
        },
      ],
    });

    expect(output.kind === 'draft' && output.actions[0]).toMatchObject({
      type: 'add_task',
      task: {
        status: 'TODO',
        type: 'theorie',
        estimatedEffort: 3,
        actualEffort: 0,
      },
    });
  });

  it('rejects empty updates and repeated mutation targets', () => {
    expect(() =>
      draftActionsSchema.parse([{ type: 'update_task', taskId, changes: {} }]),
    ).toThrow();
    expect(() =>
      draftActionsSchema.parse([
        {
          type: 'update_task',
          taskId,
          changes: { dueDate: '2026-09-08' },
        },
        { type: 'delete_task', taskId },
      ]),
    ).toThrow();
  });

  it('limits drafts to batches that fit the planner output budget', () => {
    expect(() =>
      draftActionsSchema.parse(
        Array.from({ length: 21 }, () => ({
          type: 'add_task',
          courseId,
          task: { title: 'Task', dueDate: '2026-09-08' },
        })),
      ),
    ).toThrow();
  });

  it('rejects unknown mutation fields and malformed dates', () => {
    expect(() =>
      draftActionsSchema.parse([
        {
          type: 'add_task',
          courseId,
          task: {
            title: 'Task',
            dueDate: 'tomorrow',
            secret: true,
          },
        },
      ]),
    ).toThrow();
  });

  it('bounds clarification history as intent context', () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? ('assistant' as const) : ('user' as const),
      content: `message ${index}`,
    }));

    expect(() =>
      plannerOutputSchema.parse({ kind: 'reply', message: 'ok' }),
    ).not.toThrow();
    expect(
      chatRequestSchema.parse({
        requestId: crypto.randomUUID(),
        message: 'continue',
        history,
      }).history,
    ).toHaveLength(12);
    expect(() =>
      chatRequestSchema.parse({
        requestId: crypto.randomUUID(),
        message: 'continue',
        history: [...history, history[0]],
      }),
    ).toThrow();
  });
});
