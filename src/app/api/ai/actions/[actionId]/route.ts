import { NextResponse } from 'next/server';
import { getOwnedDraft, publicDraft } from '@/lib/ai/chat/drafts';
import { withAuth } from '@/lib/auth/api';

export const GET = withAuth<{ actionId: string }>(
  async (_request, { params, user }) => {
    const { actionId } = await params;
    const draft = await getOwnedDraft(user.id, actionId);
    if (!draft) {
      return NextResponse.json(
        { code: 'DRAFT_NOT_FOUND', message: 'Draft not found' },
        { status: 404 },
      );
    }
    return NextResponse.json(publicDraft(draft), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  },
);
