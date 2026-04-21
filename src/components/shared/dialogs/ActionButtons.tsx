import type { ActionButtonsProps } from '@/types/dialog/add-course-dialog';
import { Link as LinkIcon, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddCourseFormStore } from '@/lib/stores/add-course-form-store';

function GoToCourseActions({
  onCancel,
  onGoToCourse,
}: {
  onCancel: () => void;
  onGoToCourse: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button onClick={onGoToCourse}>
        <LinkIcon className="mr-2 h-4 w-4" />
        Go to Course
      </Button>
    </div>
  );
}

export function ActionButtons({
  currentStep,
  existingCourse,
  isCheckingExistence,
  isProcessing,
  createdCourseId,
  onStartParsing,
  onRetry,
  onDialogClose,
  onGoToCourse,
}: ActionButtonsProps) {
  const courseCode = useAddCourseFormStore(state => state.courseCode);

  // Idle state without existing course - show Cancel and Add Course buttons
  if (currentStep === 'idle' && !existingCourse) {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onDialogClose(false)}>
          Cancel
        </Button>
        <Button
          onClick={onStartParsing}
          // No longer disable for userContext over limit
          disabled={!courseCode.trim() || isCheckingExistence}
        >
          {isCheckingExistence
? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          )
: (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </>
          )}
        </Button>
      </div>
    );
  }

  // Idle state with existing course - show only Cancel button
  if (currentStep === 'idle' && existingCourse) {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onDialogClose(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  // Error state
  if (currentStep === 'error') {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onDialogClose(false)}>
          Cancel
        </Button>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Completed state - show Cancel and Go to Course buttons
  if (currentStep === 'completed' && createdCourseId) {
    return (
      <GoToCourseActions
        onCancel={() => onDialogClose(false)}
        onGoToCourse={onGoToCourse}
      />
    );
  }

  // Processing state - show disabled Processing button
  if (isProcessing) {
    return (
      <div className="flex justify-end gap-2">
        <Button disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </Button>
      </div>
    );
  }

  // Default fallback - show Cancel button
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => onDialogClose(false)}>
        Cancel
      </Button>
    </div>
  );
}
