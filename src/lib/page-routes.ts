export const ROUTES = {
  DASHBOARD: '/',
  COURSES: '/courses',
  ADD_COURSE: '/courses/add',
  POMODORO: '/pomodoro',
  CALENDAR: '/calendar',
  ROADMAP: '/roadmap',
  PREFERENCES: '/preferences',
  SIGNIN: '/auth/signin',
} as const;

// Route builder helpers
export const getCoursePath = (id: string | number) => `${ROUTES.COURSES}/${id}`;
export const getCourseTaskPath = (courseId: string | number, taskId: string | number) =>
  `${getCoursePath(courseId)}#task-${taskId}`;
export const getAddCoursePath = () => ROUTES.ADD_COURSE;
export const getPomodoroPath = (taskId?: string | number) =>
  taskId ? `${ROUTES.POMODORO}?taskId=${taskId}` : ROUTES.POMODORO;
export const getCalendarPath = (view?: string) => (view ? `${ROUTES.CALENDAR}?view=${view}` : ROUTES.CALENDAR);
export const getPreferencesPath = (view?: 'profile' | 'pomodoro') =>
  view ? `${ROUTES.PREFERENCES}?view=${view}` : ROUTES.PREFERENCES;
