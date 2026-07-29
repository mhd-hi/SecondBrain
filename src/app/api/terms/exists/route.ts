import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { withAuthSimple } from '@/lib/auth/api';
import { buildTerm, getCurrentTerm, getNextTerm, getPrevTerm, isValidTermId, nextTerm } from '@/lib/utils/term-util';
import { db } from '@/server/db';

/**
 * @swagger
 * /api/terms/exists:
 *   get:
 *     summary: Ensure previous, current, and next terms exist in the terms table
 *     tags: [Terms]
 *     responses:
 *       200:
 *         description: Terms
 */
// Returns and ensures previous, current and next sessions exist in terms table.
export const GET = withAuthSimple(async (_request, _user) => {
  const now = new Date();
  const year = now.getFullYear();

  // Determine current session (or next if between sessions)
  const currentTerm = getCurrentTerm() ?? getNextTerm();

  // Build previous, current, next
  const prevInfo = getPrevTerm(currentTerm, year);
  const currentInfo = { trimester: currentTerm, year };
  const nextInfo = nextTerm(currentTerm, year);

  const terms = [buildTerm(prevInfo), buildTerm(currentInfo), buildTerm(nextInfo)];

  // Validate IDs and only insert well-formed term ids (YYYY[1-3])
  for (const t of terms) {
    if (!isValidTermId(t.id)) {
      console.error(`Skipping malformed term ID: ${t.id}`);
      continue;
    }

    // Upsert into DB
    await db.execute(sql`
      INSERT INTO terms (id, label, created_at)
      VALUES (${t.id}, ${t.label}, NOW())
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  return NextResponse.json({ terms });
});
