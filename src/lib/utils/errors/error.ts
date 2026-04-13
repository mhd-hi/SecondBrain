'use client';

import { toast } from 'sonner';

export const ErrorHandlers = {
  // API error handler with consistent logging and user notification
  api: (error: unknown, userMessage: string, context?: string) => {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const logContext = context ? `[${context}]` : '';

    console.error(logContext, 'API Error:', error);
    toast.error(userMessage);

    return errorMessage;
  },

  // Silent error handler (logs but doesn't show toast)
  silent: (error: unknown, context?: string) => {
    const logContext = context ? `[${context}]` : '';
    console.error(logContext, 'Silent Error:', error);
  },
};

// Common error messages for consistency across the app
export const CommonErrorMessages = {
  // Course-specific
  COURSE_DELETE_FAILED: 'Failed to delete course. Please try again.',

  // Task-specific
  TASK_FETCH_FAILED: 'Failed to fetch task',
  TASK_STATUS_UPDATE_FAILED: 'Failed to update task status',
  TASK_DUE_DATE_UPDATE_FAILED: 'Failed to update task due date',
  TASKS_FETCH_FAILED: 'Failed to fetch tasks',

  // General
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',

  // Pipeline-specific
  PIPELINE_COURSE_EXISTS:
    'This course already exists in your account. Please remove it first if you want to re-create it.',
  PIPELINE_PLANETS_ERROR:
    'PlanETS error, please try another session or course.',
  PIPELINE_COURSE_NOT_FOUND:
    'Course not found or not available for the current term',
  PIPELINE_PARSING_ERROR:
    'Unable to process course information. Please try again',
  PIPELINE_AI_ERROR: 'Failed to parse with AI. Please try again later.',
  PIPELINE_INVALID_FORMAT:
    'Invalid course code format. Please use format like MAT145 or LOG210',
} as const;

// Pipeline-specific error handling utilities
export const PipelineErrorHandlers = {
  /**
   * Classify a pipeline error based on error message patterns
   */
  classifyError: (
    errorMessage: string,
  ):
    | 'COURSE_EXISTS'
    | 'PLANETS_ERROR'
    | 'COURSE_NOT_FOUND'
    | 'PARSING_ERROR'
    | 'AI_ERROR'
    | 'INVALID_FORMAT'
    | 'UNKNOWN' => {
    if (!errorMessage) {
      return 'UNKNOWN';
    }

    const normalizedError = errorMessage.toLowerCase().trim();

    // Course existence errors
    const courseExistsPatterns = [
      'already exists in your account',
      'course already exists',
      'already exists',
    ];

    if (
      courseExistsPatterns.some(pattern => normalizedError.includes(pattern))
    ) {
      return 'COURSE_EXISTS';
    }

    // AI processing errors
    const aiPatterns = [
      'failed to process with ai',
      'failed to parse with ai',
      'ai error',
      'ai processing failed',
    ];

    if (aiPatterns.some(pattern => normalizedError.includes(pattern))) {
      return 'AI_ERROR';
    }

    // PlanETS-related errors
    const planetsPatterns = [
      'failed to fetch planets data',
      'planets fetch failed',
      'content div not found in planets page',
      'no html content found in divcontenustraining',
      'content div',
      'planets error',
    ];

    if (planetsPatterns.some(pattern => normalizedError.includes(pattern))) {
      return 'PLANETS_ERROR';
    }

    // Course not found errors
    const courseNotFoundPatterns = [
      'failed to fetch course data',
      'fetch course data',
      'course not found',
      'not available for the current term',
    ];

    if (
      courseNotFoundPatterns.some(pattern =>
        normalizedError.includes(pattern),
      )
    ) {
      return 'COURSE_NOT_FOUND';
    }

    // Parsing errors (general, non-AI)
    const parsingPatterns = [
      'failed to parse course content',
      'parse course content',
      'parsing error',
      'unable to process',
    ];

    if (parsingPatterns.some(pattern => normalizedError.includes(pattern))) {
      return 'PARSING_ERROR';
    }

    // Format validation errors
    const formatPatterns = ['invalid course code format', 'invalid format'];

    if (formatPatterns.some(pattern => normalizedError.includes(pattern))) {
      return 'INVALID_FORMAT';
    }

    return 'UNKNOWN';
  },

  getSafeErrorMessage: (errorMessage: string): string => {
    const category = PipelineErrorHandlers.classifyError(errorMessage);

    switch (category) {
      case 'COURSE_EXISTS':
        return CommonErrorMessages.PIPELINE_COURSE_EXISTS;
      case 'PLANETS_ERROR':
        return CommonErrorMessages.PIPELINE_PLANETS_ERROR;
      case 'COURSE_NOT_FOUND':
        return CommonErrorMessages.PIPELINE_COURSE_NOT_FOUND;
      case 'AI_ERROR':
        return CommonErrorMessages.PIPELINE_AI_ERROR;
      case 'PARSING_ERROR':
        return CommonErrorMessages.PIPELINE_PARSING_ERROR;
      case 'INVALID_FORMAT':
        return CommonErrorMessages.PIPELINE_INVALID_FORMAT;
      default:
        return CommonErrorMessages.UNKNOWN_ERROR;
    }
  },
} as const;
