import { NextResponse } from 'next/server';
import { DraftExecutionError, rejectDraft } from '@/lib/ai/chat/executor';
import { publicDraft } from '@/lib/ai/chat/drafts';
import { requireSameOrigin } from '@/lib/auth/origin';
import { withAuth } from '@/lib/auth/api';

export const POST = withAuth<{ actionId: string }>(
  async (request, { params, user }) => {
    const crossOrigin = requireSameOrigin(request);
    if (crossOrigin) {
      return crossOrigin;
    }
    const { actionId } = await params;
    try {
      return NextResponse.json(
        publicDraft(await rejectDraft(user.id, actionId)),
      );
    } catch (error) {
      if (!(error instanceof DraftExecutionError)) {
        throw error;
      }
      return NextResponse.json(
        {
          code: error.code,
          message:
            error.code === 'DRAFT_EXPIRED'
              ? 'Draft expired'
              : 'Draft cannot be rejected',
        },
        {
          status:
            error.code === 'DRAFT_NOT_FOUND'
              ? 404
              : error.code === 'DRAFT_EXPIRED'
                ? 410
                : 409,
        },
      );
    }
  },
);
