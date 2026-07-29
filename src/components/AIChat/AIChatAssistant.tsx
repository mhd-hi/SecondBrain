'use client';

import type {
  ClarificationOption,
  DraftReviewResponse,
  ReviewPayload,
} from '@/lib/ai/chat/types';
import {
  ArrowUp,
  Bot,
  GripVertical,
  History,
  Info,
  SquarePen,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { invalidateCalendarEvents } from '@/lib/stores/calendar-view-store';
import { useTaskStore } from '@/lib/stores/task-store';
import type { Task } from '@/types/task';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  draftId?: string;
  draftStatus?: 'applied';
  options?: ClarificationOption[];
};

type ChatConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

type ChatStore = {
  activeConversationId: string;
  conversations: ChatConversation[];
};

const STORAGE_KEY = 'second-brain-ai-conversations-v1';
const LEGACY_STORAGE_KEY = 'second-brain-ai-chat-v2';
const DEFAULT_CHAT_WIDTH = 384;
const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 720;
const CHAT_INPUT_MAX_HEIGHT = 240;

function clampChatWidth(width: number) {
  const maximum = Math.max(
    MIN_CHAT_WIDTH,
    Math.min(MAX_CHAT_WIDTH, window.innerWidth * 0.6),
  );
  return Math.min(Math.max(width, MIN_CHAT_WIDTH), maximum);
}

function createConversation(messages: ChatMessage[] = []): ChatConversation {
  return {
    id: crypto.randomUUID(),
    title:
      messages.find((message) => message.role === 'user')?.text.slice(0, 48) ||
      'New conversation',
    messages,
  };
}

function assistantStatusText(status: unknown) {
  switch (status) {
    case 'searching':
      return 'Searching…';
    case 'planning':
      return 'Thinking…';
    case 'validating':
      return 'Generating…';
    default:
      return 'Thinking…';
  }
}

const ASSISTANT_STATUS_TEXTS = new Set([
  'Searching…',
  'Thinking…',
  'Generating…',
]);

function readChatStore(): ChatStore {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as ChatStore | null;
    if (
      parsed?.activeConversationId &&
      Array.isArray(parsed.conversations) &&
      parsed.conversations.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Fall through to the legacy transcript.
  }
  let legacy: ChatMessage[] = [];
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]',
    );
    legacy = Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    // Start fresh when legacy storage is malformed.
  }
  const conversation = createConversation(legacy);
  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

function eventFromBlock(block: string) {
  const event = block
    .split('\n')
    .find((line) => line.startsWith('event: '))
    ?.slice(7);
  const data = block
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice(6);
  return event && data ? { event, data: JSON.parse(data) as unknown } : null;
}

function ReviewDialog({
  draft,
  open,
  busy,
  onOpenChange,
  onApprove,
  onReject,
}: {
  draft: DraftReviewResponse | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const groups: Array<{
    type: ReviewPayload['items'][number]['type'];
    label: string;
  }> = [
    { type: 'add', label: 'Added tasks' },
    { type: 'update', label: 'Updated tasks' },
    { type: 'delete', label: 'Deleted tasks' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft?.summary ?? 'Review changes'}</DialogTitle>
          <DialogDescription>{draft?.reason}</DialogDescription>
        </DialogHeader>
        {draft && (
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-5">
              {groups.map((group) => {
                const items = draft.reviewPayload.items.filter(
                  (item) => item.type === group.type,
                );
                return items.length > 0 ? (
                  <section key={group.type} className="space-y-2">
                    <h3 className="font-semibold">{group.label}</h3>
                    {items.map((item, index) => (
                      <details
                        key={item.taskId ?? `${item.courseId}-${index}`}
                        className={
                          item.type === 'delete'
                            ? 'rounded-md border border-red-500/50 p-3'
                            : 'rounded-md border p-3'
                        }
                      >
                        <summary className="flex cursor-pointer items-center justify-between gap-2">
                          <span>{item.title}</span>
                          <Badge
                            variant={
                              item.riskLevel === 'high'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {item.riskLevel} risk
                          </Badge>
                        </summary>
                        <div className="mt-3 space-y-2 text-xs">
                          {Object.entries(item.diff).map(([field, change]) => (
                            <div
                              key={field}
                              className="grid grid-cols-[7rem_1fr] gap-2"
                            >
                              <span className="font-medium">{field}</span>
                              <span className="break-words">
                                {JSON.stringify(change.before)} →{' '}
                                {JSON.stringify(change.after)}
                              </span>
                            </div>
                          ))}
                          {item.warnings.map((warning) => (
                            <p
                              key={warning}
                              className="text-amber-700 dark:text-amber-300"
                            >
                              {warning}
                            </p>
                          ))}
                        </div>
                      </details>
                    ))}
                  </section>
                ) : null;
              })}
            </div>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy || draft?.status !== 'pending'}
            onClick={onReject}
          >
            Reject
          </Button>
          <Button
            disabled={busy || draft?.status !== 'pending'}
            onClick={onApprove}
          >
            Approve all changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AIChatAssistant() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [conversations, setConversations] = React.useState<ChatConversation[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] = React.useState('');
  const [hydrated, setHydrated] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<DraftReviewResponse | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [chatWidth, setChatWidth] = React.useState(DEFAULT_CHAT_WIDTH);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const resizeStart = React.useRef<{ x: number; width: number } | null>(null);

  React.useEffect(() => {
    const store = readChatStore();
    setConversations(store.conversations);
    setActiveConversationId(store.activeConversationId);
    setMessages(
      store.conversations.find(
        (conversation) => conversation.id === store.activeConversationId,
      )?.messages ?? [],
    );
    setHydrated(true);
  }, []);
  React.useEffect(() => {
    if (!hydrated || !activeConversationId) {
      return;
    }
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              title:
                messages
                  .find((message) => message.role === 'user')
                  ?.text.slice(0, 48) || 'New conversation',
              messages: messages.slice(-100),
            }
          : conversation,
      ),
    );
  }, [activeConversationId, hydrated, messages]);
  React.useEffect(() => {
    if (hydrated && activeConversationId && conversations.length > 0) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activeConversationId, conversations }),
      );
    }
  }, [activeConversationId, conversations, hydrated]);
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  React.useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      CHAT_INPUT_MAX_HEIGHT,
    )}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

  const switchConversation = (conversationId: string) => {
    if (busy) {
      return;
    }
    const conversation = conversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation) {
      return;
    }
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setInput('');
    setDraft(null);
    setReviewOpen(false);
  };

  const startConversation = () => {
    if (busy) {
      return;
    }
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setMessages([]);
    setInput('');
    setDraft(null);
    setReviewOpen(false);
  };

  const openReview = async (draftId: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/ai/actions/${draftId}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Draft could not be loaded');
      }
      setDraft((await response.json()) as DraftReviewResponse);
      setReviewOpen(true);
    } catch {
      toast.error('Draft could not be loaded');
    } finally {
      setBusy(false);
    }
  };

  const handleDraft = async (action: 'approve' | 'reject') => {
    if (!draft) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/ai/actions/${draft.id}/${action}`, {
        method: 'POST',
      });
      const body = (await response.json()) as {
        draft?: DraftReviewResponse;
        tasks?: Task[];
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        if (body.draft) {
          setDraft(body.draft);
        }
        throw new Error(body.message ?? 'Draft action failed');
      }
      setDraft(
        action === 'approve'
          ? (body.draft ?? { ...draft, status: 'executed' })
          : (body as unknown as DraftReviewResponse),
      );
      toast.success(
        action === 'approve' ? 'Changes applied' : 'Draft rejected',
      );
      if (action === 'approve') {
        const taskStore = useTaskStore.getState();
        taskStore.upsertTasks(body.tasks ?? []);
        for (const item of (body.draft ?? draft).reviewPayload.items) {
          if (item.type === 'delete' && item.taskId) {
            taskStore.deleteTask(item.taskId);
          }
        }
        invalidateCalendarEvents();
        setMessages((current) => [
          ...current.map((message) =>
            message.draftId === draft.id
              ? { ...message, draftStatus: 'applied' as const }
              : message,
          ),
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Changes applied.',
          },
        ]);
        setReviewOpen(false);
      }
    } catch (error) {
      if (action === 'approve') {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Changes didn’t apply correctly. Please try again.',
          },
        ]);
      }
      toast.error(
        error instanceof Error ? error.message : 'Draft action failed',
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const message = input.trim();
    if (!message || busy) {
      return;
    }
    const assistantId = crypto.randomUUID();
    setMessages((previous) => [
      ...previous,
      { id: crypto.randomUUID(), role: 'user', text: message },
      { id: assistantId, role: 'assistant', text: '' },
    ]);
    setInput('');
    setBusy(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          message,
          history: messages
            .filter((item) => item.text.trim())
            .slice(-12)
            .map((item) => ({
              role: item.role,
              content: item.text.slice(0, 2_000),
            })),
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error('AI assistant is unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }
        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const parsed = eventFromBlock(block);
          if (!parsed) {
            continue;
          }
          const data = parsed.data as Record<string, unknown>;
          if (parsed.event === 'status') {
            setMessages((previous) =>
              previous.map((item) =>
                item.id === assistantId &&
                (!item.text.trim() || ASSISTANT_STATUS_TEXTS.has(item.text))
                  ? { ...item, text: assistantStatusText(data.status) }
                  : item,
              ),
            );
          } else if (parsed.event === 'message.delta') {
            setMessages((previous) =>
              previous.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      text: ASSISTANT_STATUS_TEXTS.has(item.text)
                        ? String(data.delta)
                        : item.text + String(data.delta),
                    }
                  : item,
              ),
            );
          } else if (parsed.event === 'clarification') {
            setMessages((previous) =>
              previous.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      text: String(data.message),
                      options: data.options as
                        | ClarificationOption[]
                        | undefined,
                    }
                  : item,
              ),
            );
          } else if (parsed.event === 'draft.ready') {
            setMessages((previous) =>
              previous.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      text: 'I prepared changes for your review.',
                      draftId: String(data.draftId),
                    }
                  : item,
              ),
            );
          } else if (parsed.event === 'error') {
            throw new Error(String(data.message));
          }
        }
      }
    } catch (error) {
      setMessages((previous) =>
        previous.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text:
                  error instanceof Error
                    ? error.message
                    : 'AI assistant is unavailable',
              }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const activeConversationTitle =
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    )?.title ?? 'New conversation';

  return (
    <>
      {!open && (
        <Button
          aria-label="Open Lucy"
          className="fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg md:right-6 md:bottom-6"
          size="icon"
          onClick={() => setOpen(true)}
        >
          <Bot className="size-7" />
        </Button>
      )}
      {open && (
        <aside
          aria-label="Lucy task assistant"
          className="bg-background fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden border-l md:sticky md:inset-auto md:top-0 md:z-30 md:h-svh md:w-[var(--chat-width)] md:max-w-[60vw] md:min-w-80 md:shrink-0"
          style={{ '--chat-width': `${chatWidth}px` } as React.CSSProperties}
        >
          {/* Focusable ARIA separator is a resize control, despite jsx-a11y's static role classification. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            role="separator"
            aria-label="Resize Lucy"
            aria-orientation="vertical"
            aria-valuemin={MIN_CHAT_WIDTH}
            aria-valuemax={MAX_CHAT_WIDTH}
            aria-valuenow={chatWidth}
            tabIndex={0}
            className="border-border bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 left-0 z-10 hidden h-12 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border shadow-sm outline-none focus-visible:ring-2 md:flex"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setChatWidth((width) =>
                  clampChatWidth(
                    width + (event.key === 'ArrowLeft' ? 24 : -24),
                  ),
                );
              }
            }}
            onPointerDown={(event) => {
              resizeStart.current = { x: event.clientX, width: chatWidth };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (resizeStart.current) {
                setChatWidth(
                  clampChatWidth(
                    resizeStart.current.width +
                      resizeStart.current.x -
                      event.clientX,
                  ),
                );
              }
            }}
            onPointerUp={(event) => {
              resizeStart.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              resizeStart.current = null;
            }}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </div>
          <header className="shrink-0 border-b px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Lucy
                </p>
                <h2 className="text-lg font-semibold">Your task assistant</h2>
              </div>
              <Button
                aria-label="Close Lucy"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                {activeConversationTitle}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Conversation history"
                    title="Conversation history"
                    variant="outline"
                    size="icon"
                    disabled={busy}
                  >
                    <History className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Conversations</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={activeConversationId}
                    onValueChange={switchConversation}
                  >
                    {conversations.map((conversation) => (
                      <DropdownMenuRadioItem
                        key={conversation.id}
                        value={conversation.id}
                      >
                        <span className="truncate">{conversation.title}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                aria-label="New conversation"
                title="New conversation"
                variant="outline"
                size="icon"
                disabled={busy}
                onClick={startConversation}
              >
                <SquarePen className="size-3.5" />
              </Button>
            </div>
          </header>
          <ScrollArea className="min-h-0 flex-1 px-4 py-4">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Ask Lucy to add, update, reschedule, or delete tasks.
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-12 rounded-lg p-3 text-sm'
                      : 'bg-muted mr-12 rounded-lg p-3 text-sm'
                  }
                >
                  <p className="whitespace-pre-wrap">{message.text || '…'}</p>
                  {message.options?.map((option) => (
                    <Button
                      key={`${option.label}-${option.taskId ?? option.courseId}`}
                      variant="outline"
                      size="sm"
                      className="mt-2 mr-2"
                      onClick={() => setInput(option.label)}
                    >
                      {option.label}
                    </Button>
                  ))}
                  {message.draftId && (
                    <Button
                      size="sm"
                      variant={
                        message.draftStatus === 'applied'
                          ? 'secondary'
                          : 'default'
                      }
                      className="mt-3"
                      disabled={busy || message.draftStatus === 'applied'}
                      onClick={() => void openReview(message.draftId!)}
                    >
                      {message.draftStatus === 'applied'
                        ? 'Changes applied'
                        : 'Review changes'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <footer className="bg-muted/20 shrink-0 border-t p-4">
            <div className="relative">
              <Textarea
                ref={inputRef}
                aria-label="Message the task assistant"
                value={input}
                disabled={busy}
                rows={1}
                className="max-h-60 min-h-12 resize-none py-3 pr-12 leading-6"
                placeholder="Move my LOG210 homework to Friday…"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
              <Button
                aria-label="Send message"
                size="icon"
                disabled={busy || !input.trim()}
                onClick={() => void submit()}
                className="absolute top-1/2 right-2 size-8 -translate-y-1/2 rounded-full"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
            <Link
              href="/privacy/ai"
              className="text-muted-foreground hover:text-foreground mx-auto mt-2 flex w-fit items-center gap-1 text-xs underline-offset-4 hover:underline"
            >
              <Info className="size-3" aria-hidden="true" />
              About Lucy &amp; privacy
            </Link>
          </footer>
        </aside>
      )}
      <ReviewDialog
        draft={draft}
        open={reviewOpen}
        busy={busy}
        onOpenChange={setReviewOpen}
        onApprove={() => void handleDraft('approve')}
        onReject={() => void handleDraft('reject')}
      />
    </>
  );
}
