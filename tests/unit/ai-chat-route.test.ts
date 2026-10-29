import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const planTaskActionMock = vi.fn();
const findDraftByRequestMock = vi.fn();
const prepareDraftMock = vi.fn();
const createDraftMock = vi.fn();

vi.mock('@/lib/auth/api', () => ({
  withAuthSimple: vi.fn(
    (handler: (request: Request, user: { id: string }) => Promise<Response>) =>
      (request: Request) =>
        handler(request, { id: 'user-1' }),
  ),
}));
vi.mock('@/lib/ai/chat/planner', () => ({
  planTaskAction: planTaskActionMock,
}));
vi.mock('@/lib/ai/chat/drafts', () => ({
  findDraftByRequest: findDraftByRequestMock,
  prepareDraft: prepareDraftMock,
  createDraft: createDraftMock,
}));
vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));
vi.mock('@/server/db/schema', () => ({
  users: { nickname: 'nickname' },
}));

const { POST } = await import('@/app/api/ai/chat/route');

beforeEach(() => {
  (planTaskActionMock as unknown as Mock).mockReset();
  (findDraftByRequestMock as unknown as Mock).mockReset();
  (prepareDraftMock as unknown as Mock).mockReset();
  (createDraftMock as unknown as Mock).mockReset();
  (findDraftByRequestMock as unknown as Mock).mockResolvedValue(undefined);
});

function request(message = 'Hello') {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: crypto.randomUUID(), message }),
  });
}

describe('AI chat SSE route', () => {
  it('buffers a validated reply before emitting it', async () => {
    (planTaskActionMock as unknown as Mock).mockImplementation(
      async ({ onStatus }: { onStatus: (status: unknown) => void }) => {
        onStatus({ status: 'tool', tool: 'search_tasks' });
        onStatus({ status: 'planning' });
        return {
          kind: 'reply',
          message: 'Validated response',
        };
      },
    );

    const response = await POST(request() as never, {} as never);
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(body).toContain('"status":"tool","tool":"search_tasks"');
    expect(body).toContain('"status":"planning"');
    expect(body).toContain('event: message.delta');
    expect(body).toContain('Validated response');
    expect(body.match(/event: done/g)).toHaveLength(1);
  });

  it('emits only the persisted draft id, not mutation JSON', async () => {
    const output = {
      kind: 'draft',
      message: 'Review',
      summary: 'Delete secret task',
      reason: 'Requested',
      actions: [
        {
          type: 'delete_task',
          taskId: '11111111-1111-4111-8111-111111111111',
        },
      ],
    };
    (planTaskActionMock as unknown as Mock).mockResolvedValue(output);
    (prepareDraftMock as unknown as Mock).mockResolvedValue({ prepared: true });
    (createDraftMock as unknown as Mock).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    });

    const response = await POST(request('Delete it') as never, {} as never);
    const body = await response.text();

    expect(body).toContain('event: draft.ready');
    expect(body).toContain('22222222-2222-4222-8222-222222222222');
    expect(body).not.toContain('Delete secret task');
    expect(body).not.toContain('delete_task');
  });

  it('returns an existing idempotent draft without replanning', async () => {
    (findDraftByRequestMock as unknown as Mock).mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
    });

    const response = await POST(request() as never, {} as never);
    const body = await response.text();

    expect(body).toContain('event: draft.ready');
    expect(planTaskActionMock).not.toHaveBeenCalled();
    expect(createDraftMock).not.toHaveBeenCalled();
  });
});
