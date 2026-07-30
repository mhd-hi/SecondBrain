import { z } from 'zod';
import {
  DEFAULT_TASK_ESTIMATED_EFFORT,
  MIN_TASK_ESTIMATED_EFFORT,
} from '@/lib/utils/task/task-draft';
import { StatusTask } from '@/types/status-task';
import { TASK_TYPES } from '@/types/task';
import { parseTorontoDueDate } from './date';

export const AI_DRAFT_PAYLOAD_VERSION = 1;

const titleSchema = z.string().trim().min(1).max(300);
const notesSchema = z.string().max(2_000).optional();
const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      parseTorontoDueDate(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid calendar date');
const effortSchema = z.number().finite().min(MIN_TASK_ESTIMATED_EFFORT);
const actualEffortSchema = z.number().finite().min(0);

export const taskChangesSchema = z
  .strictObject({
    title: titleSchema.optional(),
    notes: notesSchema,
    dueDate: dueDateSchema.optional(),
    status: z.enum(StatusTask).optional(),
    estimatedEffort: effortSchema.optional(),
    actualEffort: actualEffortSchema.optional(),
    type: z.enum(TASK_TYPES).optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Task updates cannot be empty',
  });

export const draftActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('add_task'),
    courseId: z.uuid(),
    task: z.strictObject({
      title: titleSchema,
      notes: notesSchema,
      dueDate: dueDateSchema,
      status: z.enum(StatusTask).default(StatusTask.TODO),
      estimatedEffort: effortSchema.default(DEFAULT_TASK_ESTIMATED_EFFORT),
      actualEffort: actualEffortSchema.default(0),
      type: z.enum(TASK_TYPES).default(TASK_TYPES.THEORIE),
    }),
  }),
  z.strictObject({
    type: z.literal('update_task'),
    taskId: z.uuid(),
    changes: taskChangesSchema,
  }),
  z.strictObject({
    type: z.literal('delete_task'),
    taskId: z.uuid(),
  }),
]);

export const draftActionsSchema = z
  .array(draftActionSchema)
  .min(1)
  .max(20)
  .superRefine((actions, context) => {
    const taskIds = new Set<string>();
    for (const action of actions) {
      if (action.type === 'add_task') {
        continue;
      }
      if (taskIds.has(action.taskId)) {
        context.addIssue({
          code: 'custom',
          message: `Task ${action.taskId} is referenced more than once`,
        });
      }
      taskIds.add(action.taskId);
    }
  });

export const clarificationOptionSchema = z.strictObject({
  label: z.string().trim().min(1).max(300),
  taskId: z.uuid().optional(),
  courseId: z.uuid().optional(),
});

export const plannerOutputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('reply'),
    message: z.string().trim().min(1).max(10_000),
  }),
  z.strictObject({
    kind: z.literal('clarification'),
    message: z.string().trim().min(1).max(2_000),
    options: z.array(clarificationOptionSchema).max(20).optional(),
  }),
  z.strictObject({
    kind: z.literal('draft'),
    message: z.string().trim().min(1).max(2_000),
    summary: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(2_000),
    actions: draftActionsSchema,
  }),
]);

export const chatRequestSchema = z.strictObject({
  requestId: z.uuid(),
  message: z.string().trim().min(1).max(10_000),
  history: z
    .array(
      z.strictObject({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2_000),
      }),
    )
    .max(12)
    .optional(),
  context: z
    .strictObject({
      courseId: z.uuid().optional(),
      taskIds: z.array(z.uuid()).max(100).optional(),
    })
    .optional(),
});

export const draftPayloadSchema = z.strictObject({
  payloadVersion: z.literal(AI_DRAFT_PAYLOAD_VERSION),
  actions: draftActionsSchema,
});

export const reviewItemSchema = z.strictObject({
  type: z.enum(['add', 'update', 'delete']),
  taskId: z.uuid().optional(),
  courseId: z.uuid().optional(),
  title: titleSchema,
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
  diff: z.record(
    z.string(),
    z.strictObject({
      before: z.unknown().optional(),
      after: z.unknown().optional(),
    }),
  ),
  warnings: z.array(z.string()),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export const reviewPayloadSchema = z.strictObject({
  summary: z.string(),
  counts: z.strictObject({
    adds: z.number().int().nonnegative(),
    updates: z.number().int().nonnegative(),
    deletes: z.number().int().nonnegative(),
  }),
  items: z.array(reviewItemSchema),
});

export type DraftAction = z.infer<typeof draftActionSchema>;
export type PlannerOutput = z.infer<typeof plannerOutputSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type DraftPayload = z.infer<typeof draftPayloadSchema>;
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;
export type ClarificationOption = z.infer<typeof clarificationOptionSchema>;

export type DraftStatus =
  | 'pending'
  | 'executing'
  | 'rejected'
  | 'executed'
  | 'stale'
  | 'expired'
  | 'failed';

export type DraftReviewResponse = {
  id: string;
  requestId: string;
  status: DraftStatus;
  summary: string;
  reason: string;
  reviewPayload: ReviewPayload;
  failureCode: string | null;
  createdAt: string;
  expiresAt: string;
};

export type ChatStatus =
  | { status: 'searching' | 'planning' | 'validating' }
  | { status: 'tool'; tool: string };

export type ChatEvent =
  | {
      type: 'status';
      data: ChatStatus;
    }
  | { type: 'message.delta'; data: { delta: string } }
  | {
      type: 'clarification';
      data: { message: string; options?: ClarificationOption[] };
    }
  | { type: 'draft.ready'; data: { draftId: string } }
  | { type: 'error'; data: { code: string; message: string } }
  | { type: 'done'; data: Record<string, never> };
