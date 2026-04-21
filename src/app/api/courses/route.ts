import type { Daypart } from '@/types/course';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAuthSimple } from '@/lib/auth/api';
import { createUserCourse, getUserCourseSummaries } from '@/lib/auth/db';
import { generateRandomCourseColor } from '@/lib/utils/colors-util';
import { db } from '@/server/db';
import { courses } from '@/server/db/schema';

export const GET = withAuthSimple(async (_request, user) => {
  const courseSummaries = await getUserCourseSummaries(user.id);
  return NextResponse.json(courseSummaries, {
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
    },
  });
});

export const POST = withAuthSimple(async (request, user) => {
  const data = (await request.json()) as {
    code: string;
    name: string;
    term: string;
    daypart: Daypart;
    userContext?: string;
  };

  if (!data.code || !data.name) {
    return NextResponse.json(
      { error: 'code and name are required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  const { code, name, term, daypart } = data;

  if (!term) {
    return NextResponse.json(
      { error: 'term is required', code: 'MISSING_TERM' },
      { status: 400 },
    );
  }

  // Lightweight existence check: query DB for same user+code+term only
  const existingCourse = await db.query.courses.findFirst({
    where: and(eq(courses.userId, user.id), eq(courses.code, code), eq(courses.term, term)),
    columns: { id: true, code: true, name: true },
  });

  if (existingCourse) {
    // Return conflict with existing course info
    return NextResponse.json({ error: 'Course already exists', course: existingCourse }, { status: 409 });
  }

  // Use secure function to create course with automatic user assignment
  // Attempt to create course; handle possible unique constraint race
  let course;
  try {
    course = await createUserCourse(user.id, {
      code,
      name,
      term,
      daypart,
      color: generateRandomCourseColor(),
    });
  } catch (err) {
    // Postgres unique violation code is 23505 - map to 409 Conflict
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('23505') || /duplicate key|unique constraint/i.test(message)) {
      return NextResponse.json({ error: 'Course already exists' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json(course);
});
