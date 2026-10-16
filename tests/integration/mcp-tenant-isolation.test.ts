import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { executeReadTool } from '@/lib/ai/chat/tools';
import { db, dbClient } from '@/server/db';
import { courses, tasks, terms, users } from '@/server/db/schema';

vi.mock('@/lib/auth/api', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

const userIds = new Set<string>();
const termIds = new Set<string>();

afterEach(async () => {
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
  for (const termId of termIds) {
    await db.delete(terms).where(eq(terms.id, termId));
  }
  userIds.clear();
  termIds.clear();
});

afterAll(async () => {
  await dbClient.end();
});

describe('MCP tenant isolation (plan 21.3)', () => {
  it('user A cannot read user B tasks or courses through any read tool', async () => {
    const termId = String(Math.floor(10000 + Math.random() * 89999));
    userIds.clear();
    termIds.clear();
    const userA = randomUUID();
    const userB = randomUUID();
    userIds.add(userA);
    userIds.add(userB);
    termIds.add(termId);
    await db.insert(terms).values({ id: termId, label: 'MCP isolation terms' });
    await db.insert(users).values([
      { id: userA, email: `${userA}@test.local` },
      { id: userB, email: `${userB}@test.local` },
    ]);
    const courseA = randomUUID();
    const courseB = randomUUID();
    await db.insert(courses).values([
      {
        id: courseA,
        userId: userA,
        name: 'A course',
        code: 'LOG100',
        term: termId,
        color: 'blue',
        daypart: 'AM',
      },
      {
        id: courseB,
        userId: userB,
        name: 'B secret course',
        code: 'LOG200',
        term: termId,
        color: 'red',
        daypart: 'PM',
      },
    ]);
    const taskB = randomUUID();
    await db.insert(tasks).values({
      id: taskB,
      userId: userB,
      courseId: courseB,
      title: 'B secret task',
      dueDate: new Date('2026-09-10T04:00:00.000Z'),
    });

    const budget = { remaining: 12000 };

    // search_courses for A never returns B's course.
    const coursesForA = (await executeReadTool({
      name: 'search_courses',
      argumentsJson: JSON.stringify({ query: 'secret' }),
      userId: userA,
      budget,
    })) as { id: string }[];

    expect(coursesForA).toHaveLength(0);

    const allCoursesA = (await executeReadTool({
      name: 'search_courses',
      argumentsJson: JSON.stringify({ query: 'LOG' }),
      userId: userA,
      budget,
    })) as { id: string }[];

    expect(allCoursesA.map((course) => course.id)).toEqual([courseA]);

    // get_task on B's task id throws for A.
    await expect(
      executeReadTool({
        name: 'get_task',
        argumentsJson: JSON.stringify({ taskId: taskB }),
        userId: userA,
        budget,
      }),
    ).rejects.toThrow('Task not found');

    // list_course_tasks on B's course id throws for A.
    await expect(
      executeReadTool({
        name: 'list_course_tasks',
        argumentsJson: JSON.stringify({ courseId: courseB }),
        userId: userA,
        budget,
      }),
    ).rejects.toThrow('Course not found');

    // search_tasks never returns B rows even with a matching title.
    const foundA = (await executeReadTool({
      name: 'search_tasks',
      argumentsJson: JSON.stringify({ query: 'secret' }),
      userId: userA,
      budget,
    })) as { id: string }[];

    expect(foundA).toHaveLength(0);
  });

  it('an inconsistent task/course fixture cannot leak course metadata', async () => {
    const termId = String(Math.floor(10000 + Math.random() * 89999));
    const userA = randomUUID();
    const userB = randomUUID();
    userIds.add(userA);
    userIds.add(userB);
    termIds.add(termId);
    await db.insert(terms).values({ id: termId, label: 'MCP isolation fixture' });
    await db.insert(users).values([
      { id: userA, email: `${userA}@test.local` },
      { id: userB, email: `${userB}@test.local` },
    ]);
    const courseA = randomUUID();
    const courseB = randomUUID();
    await db.insert(courses).values([
      {
        id: courseA,
        userId: userA,
        name: 'A visible course',
        code: 'LOG300',
        term: termId,
        color: 'blue',
        daypart: 'AM',
      },
      {
        id: courseB,
        userId: userB,
        name: 'B hidden metadata',
        code: 'LOG999',
        term: termId,
        color: 'red',
        daypart: 'PM',
      },
    ]);
    // Deliberately inconsistent row: task owned by A references B's course.
    const malformedTask = randomUUID();
    await db.insert(tasks).values({
      id: malformedTask,
      userId: userA,
      courseId: courseB,
      title: 'Malformed ownership task',
      dueDate: new Date('2026-09-10T04:00:00.000Z'),
    });

    const budget = { remaining: 12000 };

    const rows = (await executeReadTool({
      name: 'get_task',
      argumentsJson: JSON.stringify({ taskId: malformedTask }),
      userId: userA,
      budget,
    })) as { courseCode?: string; courseName?: string } | undefined;

    if (rows) {
      // The inner join may project B's course metadata for a malformed row;
      // the fix contract requires such a row to be unreachable or stripped.
      expect(rows.courseCode).not.toBe('LOG999');
      expect(rows.courseName).not.toBe('B hidden metadata');
    }
  });
});
