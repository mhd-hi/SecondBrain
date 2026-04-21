'use client';

import type { Daypart } from '@/types/course';
import { AlertCircle, NotebookText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ActionButtons } from '@/components/shared/dialogs/ActionButtons';
import { CourseInputForm } from '@/components/shared/dialogs/CourseInputForm';
import { ProcessingSteps } from '@/components/shared/dialogs/ProcessingSteps';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAddCourse } from '@/hooks/course/use-add-course';
import { useCourses } from '@/hooks/course/use-course-store';
import { useTerms } from '@/hooks/use-terms';
import { getCoursePath, ROUTES } from '@/lib/page-routes';
import { isValidCourseCode, normalizeCourseCode } from '@/lib/utils/course/course';
import { PipelineErrorHandlers } from '@/lib/utils/errors/error';
import { MAX_USER_CONTEXT_LENGTH } from '@/lib/utils/sanitize';
import { getDatesForTerm, isValidTermId } from '@/lib/utils/term-util';
import { DEFAULT_UNIVERSITY } from '@/types/university';

export default function AddCoursePage() {
  const router = useRouter();
  const [courseCode, setCourseCode] = useState('');
  const [term, setTerm] = useState<string>('');
  const [firstDayOfClass, setFirstDayOfClass] = useState<Date | undefined>(
    undefined,
  );
  const [daypart, setDaypart] = useState<Daypart | ''>('');
  const [university, setUniversity] = useState<string>(DEFAULT_UNIVERSITY);
  const [userContext, setUserContext] = useState<string>('');
  const [showDaypartError, setShowDaypartError] = useState(false);

  const {
    terms,
    loading: termsLoading,
    error: termsError,
    fetchTerms,
  } = useTerms();
  const { refreshCourses } = useCourses();

  const {
    currentStep,
    stepStatus,
    parsedData,
    createdCourseId,
    error,
    isProcessing,
    startProcessing,
    retry,
  } = useAddCourse();

  // Fetch terms on mount
  useEffect(() => {
    if (terms.length > 0 || termsLoading) {
      return;
    }

    void fetchTerms().catch((err) => {
      console.error('Failed to fetch terms:', err);
    });
  }, [fetchTerms, terms.length, termsLoading]);

  useEffect(() => {
    if (term || terms.length === 0) {
      return;
    }

    const middle = terms.length === 3 ? terms[1] : terms[Math.floor(terms.length / 2)];
    if (middle) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setTerm(middle.id);
    }
  }, [term, terms]);

  // Set first day of class based on term
  useEffect(() => {
    if (!term || !isValidTermId(term)) {
      return;
    }

    const termDateStart = getDatesForTerm(term).start;
    if (termDateStart) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setFirstDayOfClass(termDateStart);
    }
  }, [term]);

  // Automatically refresh courses when course creation is completed
  useEffect(() => {
    if (currentStep === 'completed' && createdCourseId) {
      void refreshCourses();
    }
  }, [currentStep, createdCourseId, refreshCourses]);

  const handleStartParsing = async () => {
    if (!courseCode.trim()) {
      toast.error('Please enter a course code');
      return;
    }

    if (userContext.length > MAX_USER_CONTEXT_LENGTH) {
      toast.error(
        `User context is too long. Please reduce to ${MAX_USER_CONTEXT_LENGTH} characters or less.`,
      );
      return;
    }

    const cleanCode = normalizeCourseCode(courseCode);

    // Validate course code format
    if (!isValidCourseCode(cleanCode)) {
      toast.error(
        'Invalid course code format. Please use format like MAT145 or LOG210',
      );
      return;
    }

    if (!term) {
      toast.error('Please select a term');
      return;
    }

    if (!firstDayOfClass) {
      toast.error('Please select a first day of class.');
      return;
    }

    if (!daypart) {
      toast.error('Please select a daypart for the first day of class.');
      setShowDaypartError(true);
      return;
    }
    setShowDaypartError(false);

    let termToUse = term;
    if (!isValidTermId(termToUse)) {
      const cleaned = termToUse.replace(/^0+/, '');
      if (isValidTermId(cleaned)) {
        termToUse = cleaned;
      } else {
        toast.error(
          'Selected term id looks invalid. Please pick a valid term.',
        );
        return;
      }
    }

    await startProcessing(
      cleanCode,
      termToUse,
      firstDayOfClass,
      daypart,
      university,
      userContext,
    );
  };

  const handleRetry = () => {
    retry();
  };

  const handleGoToCourse = () => {
    if (!createdCourseId) {
      return;
    }
    router.push(getCoursePath(createdCourseId));
  };

  const handleCancel = () => {
    router.push(ROUTES.DASHBOARD);
  };

  return (
    <main className="container mx-auto mt-2 mb-3.5 flex min-h-screen flex-col gap-6 px-8">
      <div>
        <h1 className="text-foreground text-3xl font-bold">
          <NotebookText className="align-text-middle mr-2 inline-block h-7 w-7" />
          Add new course
        </h1>
        <p className="text-muted-foreground mt-2">
          Enter a course code to automatically fetch its syllabus data and
          generate a structured learning plan.
        </p>
      </div>

      <div className="bg-card mx-auto w-full max-w-3xl space-y-6 rounded-lg border p-6">
        <CourseInputForm
          courseCode={courseCode}
          setCourseCode={setCourseCode}
          term={term}
          setTerm={setTerm}
          availableTerms={terms}
          firstDayOfClass={firstDayOfClass}
          setFirstDayOfClass={setFirstDayOfClass}
          daypart={daypart}
          setDaypart={setDaypart}
          university={university}
          setUniversity={setUniversity}
          userContext={userContext}
          setUserContext={setUserContext}
          isProcessing={isProcessing}
          currentStep={currentStep}
          showDaypartError={showDaypartError}
          onSubmit={handleStartParsing}
        />

        <ProcessingSteps currentStep={currentStep} stepStatus={stepStatus} />

        {/* Success Display */}
        {currentStep === 'completed' && createdCourseId && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Course Created Successfully!</AlertTitle>
            <AlertDescription>
              {parsedData
                ? 'AI-generated tasks have been created. Please review the tasks and adjust them as needed.'
                : 'Course has been created. You can now add tasks manually.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {PipelineErrorHandlers.getSafeErrorMessage(error)}
            </AlertDescription>
          </Alert>
        )}

        {termsError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Term Loading Failed</AlertTitle>
            <AlertDescription>{termsError}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <ActionButtons
            currentStep={currentStep}
            existingCourse={null}
            isCheckingExistence={false}
            courseCode={courseCode}
            userContext={userContext}
            isProcessing={isProcessing}
            parsedData={parsedData}
            createdCourseId={createdCourseId}
            onStartParsing={handleStartParsing}
            onRetry={handleRetry}
            onDialogClose={handleCancel}
            onGoToCourse={handleGoToCourse}
          />
        </div>
      </div>
    </main>
  );
}
