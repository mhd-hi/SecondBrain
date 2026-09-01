import { NextResponse } from 'next/server';

/**
 * RFC 9728 Protected Resource Metadata (plan 19.1). Tells MCP clients which
 * authorization server to use and what scopes this resource accepts.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const resource = `${url.origin}/api/mcp`;
  const issuer = process.env.MCP_OAUTH_ISSUER;
  if (!issuer) {
    return NextResponse.json(
      { error: 'MCP OAuth is not configured' },
      { status: 503 },
    );
  }
  return NextResponse.json(
    {
      resource,
      authorization_servers: [issuer],
      scopes_supported: ['secondbrain:read', 'secondbrain:write'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${url.origin}/docs/mcp`,
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
