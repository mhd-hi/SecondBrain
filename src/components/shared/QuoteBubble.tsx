'use client';

import type { Quote } from '@/lib/util/quotes';
import { RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { nextQuote } from '@/lib/util/quotes';

type Props = {
  className?: string;
};

export function QuoteBubble({ className }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);

  const refresh = useCallback(() => {
    setQuote(nextQuote());
  }, []);

  // Initialize quote on client side only to avoid hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setQuote(nextQuote());
  }, []);

  // Don't render until quote is loaded to avoid hydration mismatch
  if (!quote) {
    return null;
  }

  return (
    <div className={className}>
      <Card className="w-full overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between px-5 pb-1 sm:px-6">
            <CardTitle className="text-base font-semibold">
              Daily Quote
            </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={refresh}
            aria-label="Refresh quote"
            title="New quote"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0 px-5 pb-5 sm:px-6">
          <p className="max-w-3xl text-sm leading-7 text-foreground/90 sm:text-base">
            {quote.content}
          </p>
          <p className="text-sm italic text-muted-foreground">
            —
            {quote.author}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
