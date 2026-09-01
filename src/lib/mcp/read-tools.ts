import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  executeReadTool,
  MAX_PLANNER_NOTES_CHARACTERS,
} from '@/lib/ai/chat/tools';
import type { NotesBudget } from '@/lib/ai/chat/tools';

/**
 * Adapter mapping the existing OpenAI-shaped chat read tools (plan 11.1) to
 * MCP tool registrations. Execution is delegated to the existing
 * `executeReadTool()`; the database query layer is not duplicated. User
 * identity comes from the validated MCP access token, never from tool
 * arguments.
 */

export const MCP_READ_TOOL_NAMES = [
  'search_courses',
  'search_tasks',
  'get_task',
  'list_course_tasks',
  'resolve_course_week',
] as const;

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const READ_TOOL_DESCRIPTIONS: Record<string, string> = {
  search_courses:
    'Find the authenticated user’s courses by code or name, including empty courses.',
  search_tasks:
    'Search owned tasks with optional course, status, and Toronto date filters.',
  get_task: 'Load one owned task with full notes.',
  list_course_tasks: 'List owned tasks for one owned course.',
  resolve_course_week:
    'Resolve a numbered course week to authoritative calendar dates. Always use this for "week N" or "semaine N".',
};

const searchTasksInputSchema = z.strictObject({
  query: z.string().trim().max(300),
  courseId: z.uuid().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
  dateRange: z
    .strictObject({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
  limit: z.number().int().min(1).max(20).default(20),
});

/**
 * Validate tool input against the same rules the chat tools enforce. Zod
 * parses here provide a strict, server-owned schema check before the shared
 * executor runs; `executeReadTool` re-parses with its own schemas anyway, so
 * this is defense in depth, not duplication of query logic.
 */
function validateReadToolInput(name: string, input: unknown): unknown {
  if (name === 'search_courses') {
    return z.strictObject({ query: z.string().trim().max(300) }).parse(input);
  }
  if (name === 'search_tasks') {
    return searchTasksInputSchema.parse(input);
  }
  if (name === 'get_task') {
    return z.strictObject({ taskId: z.uuid() }).parse(input);
  }
  if (name === 'list_course_tasks') {
    return z.strictObject({ courseId: z.uuid() }).parse(input);
  }
  if (name === 'resolve_course_week') {
    return z
      .strictObject({
        courseId: z.uuid(),
        week: z.number().int().min(1).max(13),
      })
      .parse(input);
  }
  throw new Error(`Unknown read tool: ${name}`);
}

export function registerReadTools(
  server: McpServer,
  context: { userId: string; scopes: string[] },
) {
  // Zod raw shapes (SDK inputSchema format); the JSON Schemas are generated
  // from them by the SDK. Limits mirror tools.ts schemas exactly.
  const rawShapes = {
    search_courses: { query: z.string().trim().max(300) },
    search_tasks: {
      query: z.string().trim().max(300),
      courseId: z.uuid().optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
      dateRange: z
        .strictObject({
          start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .optional(),
      limit: z.number().int().min(1).max(20).optional(),
    },
    get_task: { taskId: z.uuid() },
    list_course_tasks: { courseId: z.uuid() },
    resolve_course_week: {
      courseId: z.uuid(),
      week: z.number().int().min(1).max(13),
    },
  } as const;

  for (const name of MCP_READ_TOOL_NAMES) {
    server.registerTool(
      name,
      {
        description: READ_TOOL_DESCRIPTIONS[name],
        inputSchema: rawShapes[name],
        annotations: READ_ANNOTATIONS,
      },
      async (args: Record<string, unknown>) => {
        const budget: NotesBudget = {
          remaining: MAX_PLANNER_NOTES_CHARACTERS,
        };
        const validated = validateReadToolInput(name, args ?? {});
        const result = await executeReadTool({
          name,
          argumentsJson: JSON.stringify(validated),
          userId: context.userId,
          budget,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result),
            },
          ],
          structuredContent: { result },
        };
      },
    );
  }
}
