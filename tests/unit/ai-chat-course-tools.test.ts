import { describe, expect, it, vi } from 'vitest';

// tools.ts imports the server db at module top; the two pure tools under
// test never touch it, so stub the module instead of loading env.
vi.mock('@/server/db', () => ({ db: {} }));

const { CHAT_READ_TOOLS, executeReadTool } = await import(
  '@/lib/ai/chat/tools'
);

const budget = () => ({ remaining: 12_000 });

describe('course read tools (Lucy)', () => {
  it('registers list_supported_schools and list_terms', () => {
    const names = new Set(
      CHAT_READ_TOOLS.map((tool) =>
        'function' in tool ? tool.function.name : '',
      ),
    );

    expect(names.has('list_supported_schools')).toBe(true);
    expect(names.has('list_terms')).toBe(true);
  });

  it('lists ETS plus the empty-course fallback', async () => {
    const schools = (await executeReadTool({
      name: 'list_supported_schools',
      argumentsJson: '{}',
      userId: 'user-1',
      budget: budget(),
    })) as Array<{ id: string; label: string }>;

    expect(schools.map((school) => school.id).sort()).toEqual(['ets', 'none']);
    expect(schools.find((school) => school.id === 'ets')!.label).toMatch(/ÉTS/);
  });

  it('lists prev/current/next terms as YYYY[1-3] ids', async () => {
    const terms = (await executeReadTool({
      name: 'list_terms',
      argumentsJson: '{}',
      userId: 'user-1',
      budget: budget(),
    })) as Array<{ id: string; label: string }>;

    expect(terms).toHaveLength(3);

    for (const term of terms) {
      expect(term.id).toMatch(/^\d{4}[1-3]$/);
      expect(term.label.length).toBeGreaterThan(0);
    }
  });
});
