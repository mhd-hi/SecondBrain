import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpAuthContext } from '@/lib/auth/mcp';
import { registerCourseTools } from './course-tools';
import { registerReadTools } from './read-tools';
import { registerTaskTools } from './task-tools';

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
    { instructions: 'Second Brain course and task tools. Reads are automatic; task changes and course creation go through an immutable review draft that the user approves.' },
  );

  registerReadTools(server, context);
  registerTaskTools(server, context as McpAuthContext);
  registerCourseTools(server, context as McpAuthContext);

  return server;
}
