import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { mcpConnections } from '@/server/db/schema';
import { withAuthSimple } from '@/lib/auth/api';

/**
 * Browser-authenticated connection management (plan 19.1): list and revoke
 * the signed-in user's MCP connections from the Preferences UI. Revocation
 * takes effect immediately: the next MCP request fails the local
 * `mcp_connections` check even with an unexpired access token.
 */

export const GET = withAuthSimple(async (_request, user) => {
  const connections = await db
    .select({
      id: mcpConnections.id,
      clientName: mcpConnections.clientName,
      lastUsedAt: mcpConnections.lastUsedAt,
      revokedAt: mcpConnections.revokedAt,
    })
    .from(mcpConnections)
    .where(eq(mcpConnections.userId, user.id))
    .orderBy(desc(mcpConnections.createdAt));
  return NextResponse.json({ connections });
});

export const DELETE = withAuthSimple(async (request, user) => {
  const url = new URL(request.url);
  const connectionId = url.searchParams.get('id');
  if (!connectionId) {
    return NextResponse.json(
      { error: 'Missing connection id' },
      { status: 400 },
    );
  }
  const revoked = await db
    .update(mcpConnections)
    .set({ revokedAt: new Date() })
    .where(eq(mcpConnections.id, connectionId))
    .returning({ id: mcpConnections.id, userId: mcpConnections.userId });
  if (!revoked[0] || revoked[0].userId !== user.id) {
    return NextResponse.json(
      { error: 'Connection not found' },
      { status: 404 },
    );
  }
  return NextResponse.json({ revoked: revoked[0].id });
});
