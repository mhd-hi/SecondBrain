import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildProviderHealthAttemptsMock = vi.fn();
const statsRowsMock = vi.fn();

vi.mock('@/lib/auth/api', () => ({
  withAuthSimple: vi.fn(
    (handler: (request: Request, user: { id: string }) => Promise<Response>) =>
      (request: Request) =>
        handler(request, { id: 'user-1' }),
  ),
}));
vi.mock('@/lib/ai/providers', () => ({
  buildProviderHealthAttempts: buildProviderHealthAttemptsMock,
}));
vi.mock('@/server/db/schema', () => ({
  aiModelStats: {},
}));
vi.mock('@/server/db', () => ({
  db: {
    select: () => ({
      from: () => statsRowsMock(),
    }),
  },
}));

const { GET } = await import('@/app/api/ai/stats/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AI stats route', () => {
  it('returns active models and grouped success/error counts', async () => {
    buildProviderHealthAttemptsMock.mockReturnValue([
      {
        name: 'groq',
        model: 'openai/gpt-oss-120b',
        configured: true,
      },
      {
        name: 'openrouter',
        model: 'openai/gpt-oss-20b:free',
        configured: true,
      },
      {
        name: 'nvidia',
        model: 'meta/llama-3.3-70b-instruct',
        configured: false,
      },
    ]);
    statsRowsMock.mockResolvedValue([
      {
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        status: 'success',
        errorCode: '',
        count: 2,
        lastLatencyMs: 300,
        updatedAt: new Date('2026-07-29T10:00:00.000Z'),
      },
      {
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        status: 'error',
        errorCode: 'HTTP_429',
        count: 1,
        lastLatencyMs: 100,
        updatedAt: new Date('2026-07-29T10:01:00.000Z'),
      },
      {
        provider: 'old-provider',
        model: 'old-model',
        status: 'error',
        errorCode: 'TIMEOUT',
        count: 3,
        lastLatencyMs: 20_000,
        updatedAt: '2026-07-29T09:00:00.000Z',
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/ai/stats') as never,
      {} as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          active: true,
          successCount: 2,
          errorCount: 1,
          errors: [
            {
              error: 'HTTP_429',
              count: 1,
              lastLatencyMs: 100,
              lastSeenAt: '2026-07-29T10:01:00.000Z',
            },
          ],
        }),
        expect.objectContaining({
          provider: 'openrouter',
          model: 'openai/gpt-oss-20b:free',
          active: true,
          successCount: 0,
          errorCount: 0,
        }),
        expect.objectContaining({
          provider: 'old-provider',
          model: 'old-model',
          active: false,
          errorCount: 3,
        }),
      ]),
    );
  });
});
