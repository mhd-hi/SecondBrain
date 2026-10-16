import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createDraft,
  findDraftByNamespacedRequest,
  getOwnedDraft,
  prepareDraft,
} from '@/lib/ai/chat/drafts';
import { plannerOutputSchema, reviewPayloadSchema } from '@/lib/ai/chat/types';
import { requireScopes } from '@/lib/auth/mcp';
import type { McpAuthContext } from '@/lib/auth/mcp';
import { canonicalRequestHash } from './approval';

/**
 * Draft tools (plan sections 11.2, 11.3):
 * - prepare_task_changes / render_task_review / get_task_draft: model-visible.
 * Mutations require approval through the authenticated web UI. MCP client
 * metadata cannot prove that a human saw or approved a review card.
 */

export type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function textResult(payload: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

export function errorResult(code: string, message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ code, message }) }],
    isError: true,
  };
}

function webReviewUrl(draftId: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${origin}/mcp/review/${draftId}`;
}

const prepareInputSchema = z.strictObject({
  requestId: z.uuid(),
  summary: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(2000),
  actions: z.array(z.record(z.string(), z.unknown())).min(1).max(20),
});

const draftIdInputSchema = z.strictObject({ draftId: z.uuid() });

const draftActionSchemaLoose = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('add_task'),
    courseId: z.uuid(),
    task: z.record(z.string(), z.unknown()),
  }),
  z.strictObject({
    type: z.literal('update_task'),
    taskId: z.uuid(),
    changes: z.record(z.string(), z.unknown()),
  }),
  z.strictObject({
    type: z.literal('delete_task'),
    taskId: z.uuid(),
  }),
]);

export async function reviewDraftForConnection(
  draftId: string,
  context: McpAuthContext,
) {
  const draft = await getOwnedDraft(context.userId, draftId);
  if (!draft) {
    return undefined;
  }
  if (
    draft.source === 'mcp' &&
    draft.sourceConnectionId !== context.connectionId
  ) {
    // One connection cannot render or query another connection's draft.
    return undefined;
  }
  return draft;
}

const READ_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/**
 * Shared review formatter for task AND course drafts (course-tools.ts reuses
 * this). The authenticated web UI is the only approval path.
 */
export function createDraftReviewer() {
  return async (
    draft: NonNullable<Awaited<ReturnType<typeof reviewDraftForConnection>>>,
  ) => {
    const base = {
      draftId: draft.id,
      status: draft.status,
      summary: draft.summary,
      reason: draft.reason,
      reviewPayload: reviewPayloadSchema.parse(draft.reviewPayload),
      expiresAt: draft.expiresAt.toISOString(),
      webReviewUrl: webReviewUrl(draft.id),
    };
    return { ...textResult(base), structuredContent: base } satisfies ToolResult;
  };
}

export function registerTaskTools(
  server: McpServer,
  context: McpAuthContext,
) {
  const reviewBase = createDraftReviewer();

  server.registerTool(
    'prepare_task_changes',
    {
      title: 'Prepare task changes',
      description:
        'Validate and persist proposed task changes as an immutable review draft. Nothing changes until the user approves through the authenticated web review page.',
      inputSchema: {
        requestId: z
          .uuid()
          .describe('Unique UUID for this request; reused for idempotent retries'),
        summary: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe('Short human-readable summary of the proposed changes'),
        reason: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .describe('Why the user asked for these changes'),
        actions: z
          .array(
            z.discriminatedUnion('type', [
              z.strictObject({
                type: z.literal('add_task').describe('Add a new task'),
                courseId: z
                  .uuid()
                  .describe('Target course ID (use search_courses to find it)'),
                task: z.strictObject({
                  title: z.string().trim().min(1).max(300),
                  dueDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .describe('Due date, Toronto calendar date YYYY-MM-DD'),
                  notes: z.string().max(2000).optional(),
                  status: z
                    .enum(['TODO', 'IN_PROGRESS', 'COMPLETED'])
                    .default('TODO'),
                  estimatedEffort: z.number().finite().min(1).default(3),
                  actualEffort: z.number().finite().min(0).default(0),
                  type: z
                    .enum(['theorie', 'pratique', 'exam', 'homework', 'lab'])
                    .default('theorie'),
                }),
              }),
              z.strictObject({
                type: z.literal('update_task').describe('Update an existing task'),
                taskId: z.uuid(),
                changes: z.strictObject({
                  title: z.string().trim().min(1).max(300).optional(),
                  notes: z.string().max(2000).optional(),
                  dueDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .optional(),
                  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
                  estimatedEffort: z.number().finite().min(1).optional(),
                  actualEffort: z.number().finite().min(0).optional(),
                  type: z
                    .enum(['theorie', 'pratique', 'exam', 'homework', 'lab'])
                    .optional(),
                }),
              }),
              z.strictObject({
                type: z.literal('delete_task').describe('Delete a task'),
                taskId: z.uuid(),
              }),
            ]),
          )
          .min(1)
          .max(20)
          .describe(
            '1-20 action objects. Each has a "type" discriminator: add_task {courseId, task:{title, dueDate, ...}}, update_task {taskId, changes:{title?/dueDate?/status?/...}}, delete_task {taskId}. Task IDs and course IDs come from the read tools.',
          ),
      },
      annotations: READ_ANNOTATIONS,
    },
    async (rawArgs: Record<string, unknown>) => {
      try {
        requireScopes(context, ['secondbrain:write']);
        const input = prepareInputSchema.parse(rawArgs);
        const parsedActions = z
          .array(draftActionSchemaLoose)
          .parse(input.actions);
        const output = plannerOutputSchema.parse({
          kind: 'draft',
          message: input.summary,
          summary: input.summary,
          reason: input.reason,
          actions: parsedActions,
        });
        if (output.kind !== 'draft') {
          return errorResult('INVALID_INPUT', 'Expected a draft output');
        }

        const requestNamespace = `mcp:${context.connectionId}`;
        const requestHash = canonicalRequestHash({
          requestId: input.requestId,
          summary: input.summary,
          reason: input.reason,
          actions: output.actions,
        });

        const existing = await findDraftByNamespacedRequest({
          userId: context.userId,
          requestNamespace,
          requestId: input.requestId,
        });
        if (existing && existing.requestHash !== requestHash) {
          return errorResult(
            'IDEMPOTENCY_CONFLICT',
            'This request ID was already used with different input',
          );
        }

        const draft =
          existing ??
          (await createDraft({
            userId: context.userId,
            requestId: input.requestId,
            output,
            prepared: await prepareDraft(context.userId, output),
            mcp: {
              connectionId: context.connectionId,
              requestNamespace,
              requestHash,
            },
          }));
        return await reviewBase(draft);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.registerTool(
    'render_task_review',
    {
      description:
        'Reopen an owned pending task-change draft and return its authenticated web review link.',
      inputSchema: { draftId: z.uuid() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (rawArgs: Record<string, unknown>) => {
      try {
        requireScopes(context, ['secondbrain:write']);
        const { draftId } = draftIdInputSchema.parse(rawArgs);
        const draft = await reviewDraftForConnection(draftId, context);
        if (!draft || draft.source !== 'mcp') {
          return errorResult('DRAFT_NOT_FOUND', 'Draft not found');
        }
        if (draft.status !== 'pending') {
          return errorResult('DRAFT_NOT_PENDING', `Draft is ${draft.status}`);
        }
        return await reviewBase(draft);
      } catch (error) {
        return handleError(error);
      }
    },
  );

  server.registerTool(
    'get_task_draft',
    {
      description:
        'Read the status of an owned task-change draft. Returns the persisted execution receipt after execution.',
      inputSchema: { draftId: z.uuid() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (rawArgs: Record<string, unknown>) => {
      try {
        requireScopes(context, ['secondbrain:read']);
        const { draftId } = draftIdInputSchema.parse(rawArgs);
        const draft = await reviewDraftForConnection(draftId, context);
        if (!draft) {
          return errorResult('DRAFT_NOT_FOUND', 'Draft not found');
        }
        return textResult({
          draftId: draft.id,
          status: draft.status,
          summary: draft.summary,
          failureCode: draft.failureCode,
          createdAt: draft.createdAt.toISOString(),
          expiresAt: draft.expiresAt.toISOString(),
          executionReceipt: draft.executionReceipt ?? null,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  );
}

export function handleError(error: unknown): ToolResult {
  if (error instanceof z.ZodError) {
    return errorResult('INVALID_INPUT', 'Invalid tool input');
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('DRAFT_')) {
    return errorResult(message, 'Draft state does not allow this operation');
  }
  console.error('MCP task tool error', message);
  return errorResult('INTERNAL_ERROR', 'Tool execution failed');
}
