import { describe, expect, it } from 'vitest';
import {
  buildTaskReviewHtml,
  TASK_REVIEW_RESOURCE_MIME_TYPE,
  TASK_REVIEW_RESOURCE_URI
  
} from '@/lib/mcp/task-review-app';
import type {TaskReviewBoot} from '@/lib/mcp/task-review-app';
import type { ReviewPayload } from '@/lib/ai/chat/types';

const maliciousPayload: ReviewPayload = {
  summary: '<img src=x onerror=alert(1)> inject summary',
  counts: { adds: 1, updates: 0, deletes: 0, courses: 0 },
  items: [
    {
      type: 'add',
      courseId: 'c1',
      courseCode: '<script>alert(1)</script>',
      courseName: '<svg onload=alert(2)>',
      title: '<img src=x onerror=alert(3)>',
      diff: {},
      warnings: ['<iframe src="evil"></iframe>'],
      riskLevel: 'low',
    },
  ],
};

function bootWith(review: Partial<TaskReviewBoot['review']>): TaskReviewBoot {
  return {
    review: {
      draftId: 'd1',
      summary: 'Test',
      reason: 'Test reason',
      status: 'pending',
      expiresAt: new Date('2026-09-01T00:00:00Z').toISOString(),
      reviewPayload: {
        summary: 'Test',
        counts: { adds: 0, updates: 0, deletes: 0, courses: 0 },
        items: [],
      },
      ...review,
    },
    capability: 'capability-raw-value-0123456789',
    capabilityExpiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
}

describe('MCP App review resource (plan 19.1 / 21.7)', () => {
  it('serves the versioned resource URI and the MCP Apps MIME type', () => {
    expect(TASK_REVIEW_RESOURCE_URI).toBe('ui://second-brain/task-review/v1');
    expect(TASK_REVIEW_RESOURCE_MIME_TYPE).toBe('text/html;profile=mcp-app');
  });

  it('embeds boot data in a JSON data island, not inline script source', () => {
    const html = buildTaskReviewHtml(bootWith({}));

    expect(html).toContain('application/json" id="sb-review-data"');
    expect(html).not.toContain('capability-raw-value-0123456789</');
  });

  it('HTML-escapes malicious task titles, course names, and warnings', () => {
    const html = buildTaskReviewHtml(
      bootWith({ reviewPayload: maliciousPayload }),
    );

    // Raw vectors must not appear unescaped in the document.
    expect(html).not.toContain('<img src=x onerror=alert(3)>');
    expect(html).not.toContain('<svg onload=alert(2)>');
    expect(html).not.toContain('<iframe src="evil">');
    // The script-tag vector inside the data island must be escaped.
    expect(html).not.toContain('<script>alert(1)</script>');
    // The document's own script tag is still present exactly once (the
    // static inline bundle) plus the JSON island.
    expect(html.split('<script>').length - 1).toBe(1);
  });

  it('never emits user-controlled values as script source (plan 21.7)', () => {
    const html = buildTaskReviewHtml(
      bootWith({
        summary: '"; fetch("https://evil") //',
        reason: '</script><script>alert(9)</script>',
      }),
    );

    // The closing-tag injection attempt must be escaped inside the island.
    expect(html).not.toContain('</script><script>alert(9)</script>');
  });

  it('keeps the capability out of the DOM and page source entirely', () => {
    const html = buildTaskReviewHtml(bootWith({}));
    // The capability is passed to the component but must not be rendered as
    // text anywhere except inside the JSON data island (parsed at runtime).
    const islandMatch = html.match(
      /<script type="application\/json" id="sb-review-data">([\s\S]*?)<\/script>/i,
    );

    expect(islandMatch).toBeTruthy();

    const island = islandMatch![1];

    expect(island).toContain('capability-raw-value-0123456789');

    // No other occurrence of the raw capability outside the island.
    const stripped = html.replace(islandMatch![0], '');

    expect(stripped).not.toContain('capability-raw-value-0123456789');
  });

  it('renders course-creation drafts with a course pill and label', () => {
    const html = buildTaskReviewHtml(
      bootWith({
        summary: 'Create PHY335',
        reviewPayload: {
          summary: 'Create PHY335',
          counts: { adds: 0, updates: 0, deletes: 0, courses: 1 },
          items: [
            {
              type: 'create_course',
              title: 'PHY335',
              courseCode: 'PHY335',
              courseName: 'Physique des ondes',
              after: { code: 'PHY335', term: '20263' },
              diff: { code: { after: 'PHY335' } },
              warnings: [],
              riskLevel: 'low',
            },
          ],
        } satisfies ReviewPayload,
      }),
    );

    // Pill text and item labels render client-side from the island; the
    // static document must carry the branch plus the courses count.
    expect(html).toContain('New course: ');
    expect(html).toContain('courseCount');
    expect(html).toContain('"courses":1');
    expect(html).toContain('"type":"create_course"');
  });

  it('renders approval controls disabled without a capability (web fallback)', () => {
    const html = buildTaskReviewHtml({
      ...bootWith({}),
      capability: null,
      capabilityExpiresAt: null,
    });

    expect(html).toContain('setButtons(Boolean(capability))');
  });
});
