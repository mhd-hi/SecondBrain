import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import type { McpAuthContext } from '@/lib/auth/mcp';
import { registerReadTools } from './read-tools';
import { registerTaskTools } from './task-tools';
import {
  buildTaskReviewHtml,
  TASK_REVIEW_RESOURCE_MIME_TYPE
  
} from './task-review-app';
import type {TaskReviewBoot} from './task-review-app';

/**
 * Stateless MCP server assembly (plan section 5).
 *
 * One fresh McpServer per request: no protocol-session state, no
 * process-memory sessions. All tools close over the per-request
 * authenticated context (user, connection, grant, scopes), so nothing
 * survives the request.
 */

export function createMcpServer(context: {
  userId: string;
  connectionId: string;
  clientId: string;
  grantId: string;
  issuer: string;
  scopes: string[];
}): McpServer {
  const server = new McpServer(
    { name: 'second-brain', version: '1.0.0' },
    { instructions: 'Second Brain course and task tools. Reads are automatic; task changes go through an immutable review draft that the user approves.' },
  );

  registerReadTools(server, context);
  registerTaskTools(server, context as McpAuthContext);

  registerAppResource(
    server,
    'Task change review',
    'ui://second-brain/task-review/v1',
    { mimeType: TASK_REVIEW_RESOURCE_MIME_TYPE },
    async (uri, extra) => {
      void uri;
      void extra;
      // The static shell renders an empty review until the preparing tool
      // call's result is linked by the host. Per-draft content is carried in
      // tool results; hosts render this resource inside the tool call frame.
      const html = buildTaskReviewHtml({
        review: {
          draftId: '',
          summary: 'Task review',
          reason: '',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reviewPayload: {
            summary: 'Task review',
            counts: { adds: 0, updates: 0, deletes: 0 },
            items: [],
          },
        },
        capability: null,
        capabilityExpiresAt: null,
      });
      return { contents: [{ uri: 'ui://second-brain/task-review/v1', mimeType: TASK_REVIEW_RESOURCE_MIME_TYPE, text: html }] };
    },
  );

  return server;
}

export { buildTaskReviewHtml };
export type { TaskReviewBoot };
