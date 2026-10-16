import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AIError } from '@/lib/ai/error';
import {
  createDraft,
  DraftValidationError,
  findDraftByNamespacedRequest,
  prepareDraft,
} from '@/lib/ai/chat/drafts';
import { plannerOutputSchema } from '@/lib/ai/chat/types';
import { CourseCreationError } from '@/lib/courses/create-course-pipeline';
import { requireScopes } from '@/lib/auth/mcp';
import type { McpAuthContext } from '@/lib/auth/mcp';
import { canonicalRequestHash } from './approval';
import {
  createDraftReviewer,
  errorResult,
  handleError,
} from './task-tools';
import type { ToolResult } from './task-tools';

/**
 * Course-creation tools (MCP surface for the shared pipeline).
 *
 * `prepare_course_creation` creates a reviewable draft. The shared web UI
 * performs approval; MCP calls cannot prove human consent.
 */

const prepareCourseInputSchema = z.strictObject({
  requestId: z.uuid(),
  summary: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(2000),
  courseCode: z.string().trim().min(1).max(20),
  term: z.string().regex(/^\d{4}[1-3]$/),
  school: z.enum(['ets', 'none']),
  courseName: z.string().trim().min(1).max(300).optional(),
  daypart: z.enum(['EVEN', 'AM', 'PM']).default('AM'),
  userContext: z.string().max(3000).optional(),
});

function handleCourseError(error: unknown): ToolResult {
  if (error instanceof DraftValidationError) {
    // Duplicate course or invalid identity: caller-fixable, not internal.
    return errorResult('INVALID_INPUT', 'Invalid draft targets');
  }
  if (error instanceof CourseCreationError) {
    return errorResult(error.code, error.message);
  }
  if (error instanceof AIError) {
    const safe: Record<string, string> = {
      AI_INPUT_TOO_LARGE: 'Course-plan input is too large',
      AI_ABORTED: 'AI processing was cancelled',
      AI_DEADLINE_EXCEEDED: 'AI processing timed out',
      AI_PROVIDERS_EXHAUSTED: 'AI processing is temporarily unavailable',
    };
    return errorResult(error.code, safe[error.code] ?? 'AI processing failed');
  }
  return handleError(error);
}

export function registerCourseTools(server: McpServer, context: McpAuthContext) {
  const reviewBase = createDraftReviewer();

  server.registerTool(
    'prepare_course_creation',
    {
      title: 'Prepare course creation',
      description:
        'Validate a new course request and persist it as an immutable review draft with parsed plan tasks as preview. Nothing is created until the user approves through the authenticated web review page. Use list_terms for confirmed YYYY[1-3] IDs and list_supported_schools for supported schools ("none" creates an empty course). Reopen with render_task_review or inspect with get_task_draft.',
      inputSchema: {
        requestId: z
          .uuid()
          .describe('Unique UUID for this request; reused for idempotent retries'),
        summary: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe('Short human-readable summary, e.g. "Create PHY335 Automne 2026"'),
        reason: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .describe('Why the user asked for this course'),
        courseCode: z
          .string()
          .trim()
          .min(1)
          .max(20)
          .describe('Course code, e.g. PHY335 (normalized to uppercase)'),
        term: z
          .string()
          .regex(/^\d{4}[1-3]$/)
          .describe('Confirmed term id YYYY[1-3], e.g. 20263 (use list_terms)'),
        school: z
          .enum(['ets', 'none'])
          .describe('ets = ÉTS PlanETS pipeline; none = empty course without plan tasks'),
        courseName: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .optional()
          .describe('Display name; defaults to the course code'),
        daypart: z
          .enum(['EVEN', 'AM', 'PM'])
          .default('AM')
          .describe('Class daypart'),
        userContext: z
          .string()
          .max(3000)
          .optional()
          .describe('Optional extra context for plan parsing'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (rawArgs: Record<string, unknown>) => {
      try {
        requireScopes(context, ['secondbrain:write']);
        const input = prepareCourseInputSchema.parse(rawArgs);
        const output = plannerOutputSchema.parse({
          kind: 'draft',
          message: input.summary,
          summary: input.summary,
          reason: input.reason,
          actions: [
            {
              type: 'create_course',
              course: {
                code: input.courseCode,
                name: input.courseName,
                term: input.term,
                school: input.school,
                daypart: input.daypart,
                userContext: input.userContext,
              },
              tasks: [],
            },
          ],
        });
        if (output.kind !== 'draft') {
          return errorResult('INVALID_INPUT', 'Expected a draft output');
        }

        // Hash the MODEL actions (deterministic). The stored actions include
        // server-generated plan tasks, which may differ across retries and
        // must not poison idempotent replay.
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
        return handleCourseError(error);
      }
    },
  );
}
