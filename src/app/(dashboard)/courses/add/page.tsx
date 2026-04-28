'use client';
import { AlertCircle, NotebookText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useEffect, useLayoutEffect } from 'react';
import { toast } from 'sonner';
import { ActionButtons } from '@/components/shared/dialogs/ActionButtons';
import { CourseInputForm } from '@/components/shared/dialogs/CourseInputForm';
import { ProcessingSteps } from '@/components/shared/dialogs/ProcessingSteps';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAddCourse } from '@/hooks/course/use-add-course';
import { useCourses } from '@/hooks/course/use-course-store';
import { useTerms } from '@/hooks/use-terms';
import { getCoursePath, ROUTES } from '@/lib/page-routes';
import { useAddCourseFormStore } from '@/lib/stores/add-course-form-store';
import { isValidCourseCode, normalizeCourseCode } from '@/lib/utils/course/course';
import { PipelineErrorHandlers } from '@/lib/utils/errors/error';
import { MAX_USER_CONTEXT_LENGTH } from '@/lib/utils/sanitize';
import { getDatesForTerm, getNormalizedValidTermId } from '@/lib/utils/term-util';
import { TEST_IDS } from '@/lib/testing/selectors';

export default function AddCoursePage() {
  const router = useRouter();
  const courseCode = useAddCourseFormStore(state => state.courseCode);
  const term = useAddCourseFormStore(state => state.term);
  const firstDayOfClass = useAddCourseFormStore(state => state.firstDayOfClass);
  const daypart = useAddCourseFormStore(state => state.daypart);
  const school = useAddCourseFormStore(state => state.school);
  const userContext = useAddCourseFormStore(state => state.userContext);
  const setTerm = useAddCourseFormStore(state => state.setTerm);
  const setFirstDayOfClass = useAddCourseFormStore(state => state.setFirstDayOfClass);
  const setShowDaypartError = useAddCourseFormStore(state => state.setShowDaypartError);
  const resetForm = useAddCourseFormStore(state => state.reset);

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
  const normalizedTerm = getNormalizedValidTermId(term);

  useLayoutEffect(() => {
    resetForm();
    return () => resetForm();
  }, [resetForm]);

  // Fetch terms on mount
  useEffect(() => {
    if (terms.length > 0 || termsLoading) {
      return;
    }

    void fetchTerms().catch((err) => {
      console.error('Failed to fetch terms:', err);
    });
  }, [fetchTerms, terms.length, termsLoading]);

  useLayoutEffect(() => {
    if (term || terms.length === 0) {
      return;
    }

    const middle = terms.length === 3 ? terms[1] : terms[Math.floor(terms.length / 2)];
    if (middle) {
      setTerm(middle.id);
    }
  }, [setTerm, term, terms]);

  // Set first day of class based on term
  useLayoutEffect(() => {
    setFirstDayOfClass(normalizedTerm ? getDatesForTerm(normalizedTerm).start : undefined);
  }, [normalizedTerm, setFirstDayOfClass]);

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

    if (!daypart) {
      toast.error('Please select a daypart for the first day of class.');
      setShowDaypartError(true);
      return;
    }
    setShowDaypartError(false);

    if (!normalizedTerm) {
      toast.error(
        'Selected term id looks invalid. Please pick a valid term.',
      );
      return;
    }

    const resolvedFirstDayOfClass = firstDayOfClass ?? getDatesForTerm(normalizedTerm).start;

    await startProcessing(
      cleanCode,
      normalizedTerm,
      resolvedFirstDayOfClass,
      daypart,
      school,
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
    <main className="container mx-auto mt-2 mb-3.5 flex min-h-screen flex-col gap-6 px-8" data-testid={TEST_IDS.addCourse.page}>
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
          availableTerms={terms}
          isProcessing={isProcessing}
          currentStep={currentStep}
          onSubmit={handleStartParsing}
        />

        <ProcessingSteps currentStep={currentStep} stepStatus={stepStatus} />

        {/* Success Display */}
        {currentStep === 'completed' && createdCourseId && (
          <Alert data-testid={TEST_IDS.addCourse.successAlert}>
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
