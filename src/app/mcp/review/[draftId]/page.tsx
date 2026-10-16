import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';

/**
 * Web fallback router (plan section 15). The MCP server always returns this
 * stable URL; it never guesses whether the user's browser holds a session.
 *
 * The draft UUID is not an authorization credential: after redirect, the
 * dashboard loads the draft through the existing authenticated owned-draft
 * query, so another user receives not-found rather than the draft.
 */
export default async function McpReviewPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/mcp/review/${draftId}`);
  }
  redirect(`/?draft=${draftId}`);
}
