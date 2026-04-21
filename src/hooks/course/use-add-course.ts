'use client';

import type { CourseAIResponse } from '@/types/api/ai';
import type { Daypart } from '@/types/course';
import type { SchoolId } from '@/types/school';
import type { PipelineStepResult } from '@/types/server-pipelines/pipelines';
import { useCallback, useReducer } from 'react';
import { toast } from 'sonner';
import { createPlanETSLink } from '@/hooks/use-custom-link';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { assertValidCourseCode } from '@/lib/utils/course/course';
import { calculateDueDateTaskForTerm } from '@/lib/utils/task/task-util';
import { SCHOOL } from '@/types/school';
import { pipelineReducer } from './add-course-pipeline/reducer';
import { deriveStepStatus, deriveCurrentStep, deriveParsedData, deriveCreatedCourseId, deriveError, deriveIsProcessing } from './add-course-pipeline/selectors';
import type { StepStatus } from './add-course-pipeline/types';
import { normalizeTasks } from '@/lib/ai/normalize';

export type UseAddCourseReturn = {
  currentStep: string;
  stepStatus: StepStatus;
  parsedData: CourseAIResponse | null;
  createdCourseId: string | null;
  error: string | null;
  isProcessing: boolean;
  startProcessing: (
    courseCode: string,
    term: string,
    firstDayOfClass: Date,
    daypart: Daypart,
    school: SchoolId,
    userContext?: string,
  ) => Promise<void>;
  retry: () => void;
  reset: () => void;
};

async function fetchCourseFromPlanETS(courseCode: string, term: string) {
  const cleanCode = assertValidCourseCode(courseCode);

  const response = await fetch(API_ENDPOINTS.COURSES.PIPELINE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      courseCode: cleanCode,
      term,
      step: 'planets',
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as { error?: string };
    throw new Error(errorData.error ?? 'Failed to fetch planets data');
  }

  const result = (await response.json()) as PipelineStepResult;

  if (result.step.status === 'error') {
    throw new Error(result.step.error ?? 'Failed to fetch course data');
  }

  return {
    html: result.data as string,
  };
}

async function parseCourseWithAI(
  html: string,
  courseCode: string,
  term: string,
  userContext?: string,
): Promise<CourseAIResponse> {
  const cleanCode = assertValidCourseCode(courseCode);

  const response = await fetch(API_ENDPOINTS.COURSES.PIPELINE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      courseCode: cleanCode,
      term,
      step: 'ai',
      htmlData: html,
      userContext,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json()) as { error?: string };
    throw new Error(errorData.error ?? 'Failed to process with AI');
  }

  const result = (await response.json()) as PipelineStepResult;

  if (result.step.status === 'error') {
    throw new Error(result.step.error ?? 'Failed to parse with AI');
  }
  return result.data as CourseAIResponse;
}

async function createCourse(
  courseCode: string,
  courseName: string,
  term: string,
  daypart: Daypart,
): Promise<{ id: string }> {
  const cleanCode = assertValidCourseCode(courseCode);

  const course = await api.post<{ id: string }>(
    API_ENDPOINTS.COURSES.LIST,
    {
      code: cleanCode,
      name: courseName,
      term,
      daypart,
    },
    'Failed to create course',
  );

  if (!course.id) {
    throw new Error('Invalid course response: missing id');
  }

  return course;
}

async function createTasks(
  courseId: string,
  parsedData: CourseAIResponse,
  term: string,
  firstDayOfClass: Date,
): Promise<void> {
  const normalizedTasks = normalizeTasks(parsedData.tasks);

  const tasksWithDueDates = normalizedTasks.map((task, index) => {
    const aiTask = parsedData.tasks[index];
    const week = typeof aiTask?.week === 'number' ? aiTask.week : 1;
    const dueDate = calculateDueDateTaskForTerm(term, week, firstDayOfClass);

    return {
      ...task,
      dueDate: dueDate.toISOString(),
    };
  });

  await api.post(
    API_ENDPOINTS.TASKS.LIST,
    {
      courseId,
      tasks: tasksWithDueDates,
    },
    'Failed to create tasks',
  );
}

export function useAddCourse(): UseAddCourseReturn {
  const [state, dispatch] = useReducer(pipelineReducer, { phase: 'idle' });

  const stepStatus = deriveStepStatus(state);
  const currentStep = deriveCurrentStep(state);
  const parsedData = deriveParsedData(state);
  const createdCourseId = deriveCreatedCourseId(state);
  const error = deriveError(state);
  const isProcessing = deriveIsProcessing(state);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' });
  }, []);

  const startProcessing = useCallback(
    async (
      courseCode: string,
      term: string,
      firstDayOfClass: Date,
      daypart: Daypart,
      school: SchoolId,
      userContext?: string,
    ) => {
      if (!courseCode.trim()) {
        toast.error('Please enter a course code');
        return;
      }

      dispatch({ type: 'START_CHECKING' });

      const shouldSkipPipeline = school !== SCHOOL.ETS;

      if (shouldSkipPipeline) {
        dispatch({ type: 'START_SKIP_PIPELINE' });

        try {
          const course = await createCourse(
            courseCode.trim(),
            courseCode.trim(),
            term,
            daypart,
          );
          dispatch({ type: 'SKIP_COURSE_SUCCESS', courseId: course.id });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'An unknown error occurred';
          dispatch({
            type: 'ERROR',
            error: errorMessage,
            currentPhase: 'skipped-pipeline-course-loading',
          });
          toast.error(errorMessage);
        }
        return;
      }

      dispatch({ type: 'START_FULL_PIPELINE' });

      try {
        const planetsData = await fetchCourseFromPlanETS(
          courseCode.trim(),
          term,
        );
        dispatch({ type: 'PLANETS_SUCCESS', data: planetsData.html });

        const aiData = await parseCourseWithAI(
          planetsData.html,
          courseCode.trim(),
          term,
          userContext,
        );
        dispatch({ type: 'AI_SUCCESS', data: aiData });

        const course = await createCourse(
          courseCode.trim(),
          courseCode.trim(),
          term,
          daypart,
        );
        dispatch({ type: 'COURSE_SUCCESS', courseId: course.id });

        await createTasks(course.id, aiData, term, firstDayOfClass);
        dispatch({ type: 'TASKS_SUCCESS' });

        createPlanETSLink(course.id, courseCode.trim(), term).catch((err) => {
          console.error('Failed to create PlanETS link:', err);
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unknown error occurred';
        dispatch({
          type: 'ERROR',
          error: errorMessage,
          currentPhase: currentStep,
        });
        toast.error(errorMessage);
      }
    },
    [currentStep],
  );

  return {
    currentStep,
    stepStatus,
    parsedData,
    createdCourseId,
    error,
    isProcessing,
    startProcessing,
    retry,
    reset,
  };
}
