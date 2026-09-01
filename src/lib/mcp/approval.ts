import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { sha256Hex } from '@/lib/auth/mcp';
import { db } from '@/server/db';
import { aiActionDrafts } from '@/server/db/schema';
import type { DraftAction } from '@/lib/ai/chat/types';

/**
 * Approval capability lifecycle (plan sections 10 and 13).
 *
 * A capability is a cryptographically random 32-byte value. Only its SHA-256
 * hash is persisted on the draft row. The raw value travels only in tool
 * result `_meta` (never in content or structuredContent) and lives only in
 * MCP App component memory. Rendering a review again rotates the hash, which
 * invalidates every previously rendered card (latest write wins). A consumed
 * capability authorizes receipt replay only.
 */

export const APPROVAL_CAPABILITY_TTL_MS = 10 * 60 * 1_000;

export const CAPABILITY_META_KEY = 'secondbrain.approvalCapability';

export class ApprovalCapabilityError extends Error {
  readonly code:
    | 'CAPABILITY_MISSING'
    | 'CAPABILITY_MISMATCH'
    | 'CAPABILITY_EXPIRED'
    | 'CAPABILITY_CONSUMED'
    | 'DRAFT_NOT_PENDING'
    | 'DRAFT_EXPIRED';

  constructor(code: ApprovalCapabilityError['code']) {
    super(code);
    this.name = 'ApprovalCapabilityError';
    this.code = code;
  }
}

export function generateApprovalCapability(): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = randomBytes(32).toString('base64url');
  return {
    raw,
    hash: sha256Hex(raw),
    expiresAt: new Date(Date.now() + APPROVAL_CAPABILITY_TTL_MS),
  };
}

/**
 * Canonical serialization for the idempotency request hash.
 *
 * Deterministic: object keys are sorted recursively; trailing whitespace on
 * strings is already normalized by the draft input schemas (trim). The
 * `requestId` participates, so the same requestId with different actions
 * collides into a detectable IDEMPOTENCY_CONFLICT rather than silently
 * returning a stale draft. Equivalent payloads with reordered object keys
 * hash identically.
 */
export function canonicalRequestHash(input: {
  requestId: string;
  summary: string;
  reason: string;
  actions: DraftAction[];
}): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(canonicalize);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonicalize(entry)]),
      );
    }
    return value;
  };
  return sha256Hex(JSON.stringify(canonicalize(input)));
}

/**
 * Rotate (set) the capability hash on a pending, unexpired, MCP-created draft.
 * Concurrent renders: latest write wins, conditioned on the previous hash.
 */
export async function rotateApprovalCapability(
  draftId: string,
  connectionId: string,
): Promise<{ raw: string; expiresAt: Date }> {
  const capability = generateApprovalCapability();
  const now = new Date();

  const current = await db
    .select({
      status: aiActionDrafts.status,
      expiresAt: aiActionDrafts.expiresAt,
      source: aiActionDrafts.source,
      sourceConnectionId: aiActionDrafts.sourceConnectionId,
    })
    .from(aiActionDrafts)
    .where(eq(aiActionDrafts.id, draftId))
    .limit(1)
    .then((rows) => rows[0]);

  if (
    !current ||
    current.source !== 'mcp' ||
    current.sourceConnectionId !== connectionId
  ) {
    throw new ApprovalCapabilityError('DRAFT_NOT_PENDING');
  }
  if (current.status !== 'pending') {
    throw new ApprovalCapabilityError('DRAFT_NOT_PENDING');
  }
  if (current.expiresAt.getTime() <= now.getTime()) {
    throw new ApprovalCapabilityError('DRAFT_EXPIRED');
  }

  await db
    .update(aiActionDrafts)
    .set({
      approvalCapabilityHash: capability.hash,
      approvalCapabilityExpiresAt: capability.expiresAt,
      approvalCapabilityConsumedAt: null,
    })
    .where(
      and(
        eq(aiActionDrafts.id, draftId),
        eq(aiActionDrafts.status, 'pending'),
        eq(aiActionDrafts.source, 'mcp'),
        eq(aiActionDrafts.sourceConnectionId, connectionId),
      ),
    );

  return { raw: capability.raw, expiresAt: capability.expiresAt };
}
