import { NextResponse } from 'next/server';
import {
  createDraft,
  findDraftByRequest,
  prepareDraft,
} from '@/lib/ai/chat/drafts';
import { planTaskAction } from '@/lib/ai/chat/planner';
import { chatRequestSchema, type ChatEvent } from '@/lib/ai/chat/types';
import { AIError } from '@/lib/ai/error';
import { withAuthSimple } from '@/lib/auth/api';

export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function serializeEvent(event: ChatEvent) {
  return encoder.encode(
    `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
  );
}

export const POST = withAuthSimple(async (request, user) => {
  const parsed = chatRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let connected = true;
      const send = (event: ChatEvent) => {
        if (!connected || request.signal.aborted) {
          connected = false;
          return false;
        }
        try {
          controller.enqueue(serializeEvent(event));
          return true;
        } catch {
          connected = false;
          return false;
        }
      };

      void (async () => {
        try {
          if (!parsed.success) {
            send({
              type: 'error',
              data: {
                code: 'INVALID_REQUEST',
                message: 'Invalid chat request',
              },
            });
            send({ type: 'done', data: {} });
            return;
          }

          const existing = await findDraftByRequest(
            user.id,
            parsed.data.requestId,
          );
          if (existing) {
            send({ type: 'draft.ready', data: { draftId: existing.id } });
            send({ type: 'done', data: {} });
            return;
          }

          send({ type: 'status', data: { status: 'searching' } });
          let prepared: Awaited<ReturnType<typeof prepareDraft>> | undefined;
          const output = await planTaskAction({
            request: parsed.data,
            userId: user.id,
            signal: request.signal,
            validateOutput: async (candidate) => {
              if (candidate.kind === 'draft') {
                prepared = await prepareDraft(user.id, candidate);
              }
            },
          });
          if (request.signal.aborted) {
            return;
          }

          if (output.kind === 'reply') {
            send({ type: 'status', data: { status: 'planning' } });
            for (let index = 0; index < output.message.length; index += 256) {
              if (
                !send({
                  type: 'message.delta',
                  data: { delta: output.message.slice(index, index + 256) },
                })
              ) {
                return;
              }
            }
          } else if (output.kind === 'clarification') {
            send({
              type: 'clarification',
              data: { message: output.message, options: output.options },
            });
          } else {
            send({ type: 'status', data: { status: 'validating' } });
            const draft = await createDraft({
              userId: user.id,
              requestId: parsed.data.requestId,
              output,
              prepared: prepared ?? (await prepareDraft(user.id, output)),
            });
            if (request.signal.aborted) {
              return;
            }
            send({ type: 'draft.ready', data: { draftId: draft.id } });
          }
          send({ type: 'done', data: {} });
        } catch (error) {
          if (request.signal.aborted) {
            return;
          }
          const routeError =
            error instanceof AIError
              ? {
                  code: error.code,
                  message:
                    error.code === 'AI_DEADLINE_EXCEEDED'
                      ? 'AI planning timed out'
                      : 'AI planning is temporarily unavailable',
                }
              : {
                  code: 'AI_PLANNING_FAILED',
                  message: 'AI planning is temporarily unavailable',
                };
          send({ type: 'error', data: routeError });
          send({ type: 'done', data: {} });
        } finally {
          if (connected) {
            try {
              controller.close();
            } catch {
              // The client closed the stream between the final send and close.
            }
          }
        }
      })();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
});
