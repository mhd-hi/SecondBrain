import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { mcpConnections } from '@/server/db/schema';
import { withAuthSimple } from '@/lib/auth/api';

/**
 * Development-only helper: mint a short-lived HS256 MCP token for the signed
 * in browser user and record the corresponding connection row, so /api/mcp
 * can be smoke-tested end-to-end without a production authorization server.
 *
 * Hard-disabled unless MCP_DEV_TOKEN_SECRET is configured AND the app runs
 * in development. Never deploy with MCP_DEV_TOKEN_SECRET set.
 */
export const POST = withAuthSimple(async (_request, user) => {
  const secret = process.env.MCP_DEV_TOKEN_SECRET;
  if (!secret || process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev token minting is disabled' },
      { status: 404 },
    );
  }

  const issuer =
    process.env.MCP_OAUTH_ISSUER || 'http://localhost:3000/dev-issuer';
  const audience = process.env.MCP_OAUTH_AUDIENCE || 'second-brain-mcp';
  const clientId = 'second-brain-dev-client';
  const grantId = `dev-grant-${user.id}`;

  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({
    scope: 'secondbrain:read secondbrain:write',
    client_id: clientId,
    grant_id: grantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const existing = await db
    .select({ id: mcpConnections.id })
    .from(mcpConnections)
    .where(eq(mcpConnections.oauthGrantId, grantId))
    .limit(1);
  if (!existing[0]) {
    await db.insert(mcpConnections).values({
      userId: user.id,
      oauthIssuer: issuer,
      oauthSubject: user.id,
      oauthClientId: clientId,
      oauthGrantId: grantId,
      clientName: 'Local dev client',
      scopes: ['secondbrain:read', 'secondbrain:write'],
    });
  }

  return NextResponse.json({
    accessToken: token,
    issuer,
    audience,
    expiresIn: 3600,
  });
});
