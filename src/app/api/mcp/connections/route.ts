import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
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
      scopes: mcpConnections.scopes,
      keyPrefix: mcpConnections.keyPrefix,
      keyLastUsedAt: mcpConnections.keyLastUsedAt,
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
    .where(
      and(
        eq(mcpConnections.id, connectionId),
        eq(mcpConnections.userId, user.id),
      ),
    )
    .returning({ id: mcpConnections.id });
  if (!revoked[0]) {
    return NextResponse.json(
      { error: 'Connection not found' },
      { status: 404 },
    );
  }
  return NextResponse.json({ revoked: revoked[0].id });
});
