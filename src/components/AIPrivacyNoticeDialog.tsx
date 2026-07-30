'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function AIPrivacyNoticeDialog({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI provider privacy notice</DialogTitle>
          <DialogDescription>
            What Lucy AI may share.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-6">
          <p>
            Course-plan content, optional context, and task data requested
            through Lucy may be sent to the AI providers configured by this
            deployment.
          </p>
          <div className="bg-muted/40 rounded-md border p-4">
            <p className="font-medium">Configured providers</p>
            <p className="text-muted-foreground">
              Groq, Google AI Studio, NVIDIA NIM, OpenRouter, and xAI.
            </p>
          </div>
          <p>
            Do not include sensitive information in course plans or
            optional context.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
