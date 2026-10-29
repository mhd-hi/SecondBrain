import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {},
}));

const { canonicalRequestHash } = await import('@/lib/mcp/approval');
type HashInput = Parameters<typeof canonicalRequestHash>[0];

describe('canonical request hash (plan 21.5/21.9)', () => {
  const requestId = randomUUID();
  const base: {
    requestId: string;
    summary: string;
    reason: string;
    actions: {
      type: string;
      taskId: string;
      changes: { dueDate: string; title: string };
    }[];
  } = {
    requestId,
    summary: 'Move tasks to Friday',
    reason: 'User request',
    actions: [
      {
        type: 'update_task',
        taskId: randomUUID(),
        changes: { dueDate: '2026-09-01', title: 'Read chapter 3' },
      },
    ],
  };

  it('hashes equivalent payloads with reordered keys identically', () => {
    const reordered = {
      actions: [
        {
          changes: { title: 'Read chapter 3', dueDate: '2026-09-01' },
          taskId: base.actions[0]!.taskId,
          type: 'update_task',
        },
      ],
      reason: base.reason,
      summary: base.summary,
      requestId,
    };

    expect(canonicalRequestHash(reordered as HashInput)).toBe(canonicalRequestHash(base as HashInput));
  });

  it('changes when any action value changes', () => {
    const changed = structuredClone(base);
    changed.actions[0]!.changes.dueDate = '2026-09-02';

    expect(canonicalRequestHash(changed as HashInput)).not.toBe(
      canonicalRequestHash(base as HashInput),
    );
  });

  it('includes the requestId, so a changed requestId differs', () => {
    const other = structuredClone(base);
    other.requestId = randomUUID();

    expect(canonicalRequestHash(other as HashInput)).not.toBe(canonicalRequestHash(base as HashInput));
  });

  it('is deterministic and a 64-character sha-256 hex digest', () => {
    const hash = canonicalRequestHash(base as HashInput);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalRequestHash(structuredClone(base) as HashInput)).toBe(hash);
  });
});
