'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AIPrivacyPage() {
  return (
    <main className="container mx-auto max-w-3xl space-y-4 px-8 py-10">
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          window.history.length > 1
            ? window.history.back()
            : window.location.assign('/')
        }
      >
        <ArrowLeft />
        Back
      </Button>
      <h1 className="text-3xl font-bold">AI provider privacy notice</h1>
      <p>
        Course-plan content, optional context, and task data requested through
        the task assistant may be sent to the AI providers configured by this
        deployment: Groq, Google AI Studio, NVIDIA NIM, and OpenRouter.
      </p>
      <p>
        OpenRouter&apos;s free router may select a changing underlying provider.
        Do not include sensitive information in course plans or optional
        context.
      </p>
    </main>
  );
}
