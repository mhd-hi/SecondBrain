import type { UseAddCourseReturn } from '@/hooks/course/use-add-course';

export type StepName = 'planets' | 'ai' | 'create-course' | 'create-tasks';

export type ProcessingStepsProps = {
  currentStep: UseAddCourseReturn['currentStep'];
  stepStatus: UseAddCourseReturn['stepStatus'];
};

export type ActionButtonsProps = {
  currentStep: UseAddCourseReturn['currentStep'];
  existingCourse: { id: string; code: string; name: string } | null;
  isCheckingExistence: boolean;
  isProcessing: boolean;
  parsedData: UseAddCourseReturn['parsedData'];
  createdCourseId: UseAddCourseReturn['createdCourseId'];
  onStartParsing: () => Promise<void>;
  onRetry: () => void;
  onDialogClose: (open: boolean) => void;
  onGoToCourse: () => void;
};

export type AddCourseInputFormProps = {
  availableTerms: Array<{ id: string; label: string }>;
  isProcessing: boolean;
  currentStep: UseAddCourseReturn['currentStep'];
  onSubmit: () => Promise<void>;
};
