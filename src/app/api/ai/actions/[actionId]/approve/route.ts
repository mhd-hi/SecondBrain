import { NextResponse } from 'next/server';
import {
  DraftExecutionError,
  executeDraft,
  getAuthoritativeTasks,
} from '@/lib/ai/chat/executor';
import { getOwnedDraft, publicDraft } from '@/lib/ai/chat/drafts';
import { requireSameOrigin } from '@/lib/auth/origin';
import { withAuth } from '@/lib/auth/api';

function statusFor(code: DraftExecutionError['code']) {
  if (code === 'DRAFT_NOT_FOUND') {
    return 404;
  }
  if (code === 'DRAFT_EXPIRED') {
    return 410;
  }
  if (code === 'DRAFT_EXECUTION_FAILED') {
    return 500;
  }
  return 409;
}

export const POST = withAuth<{ actionId: string }>(
  async (request, { params, user }) => {
    const crossOrigin = requireSameOrigin(request);
    if (crossOrigin) {
      return crossOrigin;
    }
    const { actionId } = await params;
    try {
      const result = await executeDraft(user.id, actionId);
      return NextResponse.json({
        draft: result.draft ? publicDraft(result.draft) : null,
        tasks: result.tasks,
      });
    } catch (error) {
      if (!(error instanceof DraftExecutionError)) {
        throw error;
      }
      const draft = await getOwnedDraft(user.id, actionId);
      const taskIds = draft
        ? publicDraft(draft).reviewPayload.items.flatMap((item) =>
            item.taskId ? [item.taskId] : [],
          )
        : [];
      return NextResponse.json(
        {
          code: error.code,
          message:
            error.code === 'DRAFT_EXPIRED'
              ? 'Draft expired'
              : error.code === 'DRAFT_STALE'
                ? 'Tasks changed since this draft was created'
                : 'Draft cannot be approved',
          draft: draft ? publicDraft(draft) : null,
          tasks: await getAuthoritativeTasks(user.id, taskIds),
        },
        { status: statusFor(error.code) },
      );
    }
  },
);
