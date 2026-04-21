/**
 * API Endpoints Constants
 */

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    BASE: '/api/auth',
    SIGN_IN: '/api/auth/signin',
    SIGN_OUT: '/api/auth/signout',
    CALLBACK: '/api/auth/callback',
  },

  // Courses
  COURSES: {
    LIST: '/api/courses',
    DETAIL: (courseId: string) => `/api/courses/${courseId}`,
    PIPELINE: '/api/course-pipeline',
  },

  // Tasks
  TASKS: {
    LIST: '/api/tasks',
    LIST_BY_COURSE: (courseId: string) => `/api/tasks?courseId=${encodeURIComponent(courseId)}`,
    DETAIL: (taskId: string) => `/api/tasks/${taskId}`,
    STATUS: (taskId: string) => `/api/tasks/${taskId}/status`,
    SUBTASKS: (taskId: string) => `/api/tasks/${taskId}/subtasks`,
    SUBTASK_DETAIL: (taskId: string, subtaskId: string) => `/api/tasks/${taskId}/subtasks/${subtaskId}`,
    FOCUS: '/api/tasks/focus',
    CALENDAR: '/api/tasks/calendar',
    UPDATE: '/api/tasks/update',
    BATCH_STATUS: '/api/tasks/batch/status',
    SUBTASK_UPDATE: '/api/subtasks/update',
  },

  // Custom Links
  CUSTOM_LINKS: {
    LIST: '/api/custom-links',
    DETAIL: (customLinkId: string) => `/api/custom-links/${customLinkId}`,
    BY_COURSE: (courseId: string) => `/api/custom-links?courseId=${encodeURIComponent(courseId)}`,
  },

  // Pomodoro
  POMODORO: {
    BASE: '/api/pomodoro',
    COMPLETE: '/api/pomodoro/complete',
    STREAK: '/api/pomodoro/streak',
  },

  // Terms
  TERMS: {
    EXISTS: '/api/terms/exists',
  },
  // Course Parsing
  PARSE_COURSE: {
    BASE: '/api/parse-course',
  },
} as const;
