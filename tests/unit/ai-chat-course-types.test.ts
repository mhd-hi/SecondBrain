import { describe, expect, it } from 'vitest';
import {
  draftActionsSchema,
  draftPayloadSchema,
  plannerOutputSchema,
  reviewPayloadSchema,
} from '@/lib/ai/chat/types';

const courseAction = {
  type: 'create_course',
  course: { code: 'PHY335', term: '20263', school: 'ets' },
};

describe('course draft types (v2)', () => {
  it('accepts a model create_course action with course identity only', () => {
    const output = plannerOutputSchema.parse({
      kind: 'draft',
      message: 'Create PHY335',
      summary: 'Create PHY335 Automne 2026',
      reason: 'User asked for a new ETS course',
      actions: [courseAction],
    });

    expect(output.kind === 'draft' && output.actions).toHaveLength(1);
    expect(output.kind === 'draft' && output.actions[0]).toMatchObject({
      type: 'create_course',
      tasks: [],
    });
  });

  it('rejects create_course mixed with task actions or duplicated', () => {
    expect(() =>
      draftActionsSchema.parse([
        courseAction,
        {
          type: 'add_task',
          courseId: '22222222-2222-4222-8222-222222222222',
          task: { title: 'T', dueDate: '2026-09-08' },
        },
      ]),
    ).toThrow();
    expect(() => draftActionsSchema.parse([courseAction, courseAction])).toThrow();
  });

  it('rejects bad terms and schools at the schema boundary', () => {
    expect(() =>
      draftActionsSchema.parse([
        { type: 'create_course', course: { code: 'PHY335', term: 'H2025', school: 'ets' } },
      ]),
    ).toThrow();
    expect(() =>
      draftActionsSchema.parse([
        { type: 'create_course', course: { code: 'PHY335', term: '20263', school: 'mcgill' } },
      ]),
    ).toThrow();
  });

  it('keeps v1 payloads readable (pending task drafts do not fail)', () => {
    const v1 = draftPayloadSchema.parse({
      payloadVersion: 1,
      actions: [
        {
          type: 'add_task',
          courseId: '22222222-2222-4222-8222-222222222222',
          task: { title: 'T', dueDate: '2026-09-08' },
        },
      ],
    });

    expect(v1.payloadVersion).toBe(1);
  });

  it('defaults review counts.courses to 0 for old task-only payloads', () => {
    const review = reviewPayloadSchema.parse({
      summary: 's',
      counts: { adds: 1, updates: 0, deletes: 0 },
      items: [],
    });

    expect(review.counts.courses).toBe(0);
  });

  it('accepts create_course review items', () => {
    const review = reviewPayloadSchema.parse({
      summary: 'Create PHY335',
      counts: { adds: 0, updates: 0, deletes: 0, courses: 1 },
      items: [
        {
          type: 'create_course',
          title: 'PHY335',
          courseCode: 'PHY335',
          after: { code: 'PHY335', term: '20263' },
          diff: { code: { after: 'PHY335' } },
          warnings: [],
          riskLevel: 'low',
        },
      ],
    });

    expect(review.items[0]!.type).toBe('create_course');
  });
});
