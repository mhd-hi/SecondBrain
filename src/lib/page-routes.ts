export const ROUTES = {
  LANDING: '/',
  DASHBOARD: '/dashboard',
  COURSES: '/courses',
  ADD_COURSE: '/courses/add',
  POMODORO: '/pomodoro',
  CALENDAR: '/calendar',
  KANBAN: '/kanban',
  ROADMAP: '/roadmap',
  SETTINGS: '/settings',
  SIGNIN: '/auth/signin',
  TERMS: '/terms',
  PRIVACY: '/privacy',
} as const;

// Route builder helpers
export const getCoursePath = (id: string | number) => `${ROUTES.COURSES}/${id}`;
export const getCourseTaskPath = (courseId: string | number, taskId: string | number) =>
  `${getCoursePath(courseId)}#task-${taskId}`;
export const getAddCoursePath = () => ROUTES.ADD_COURSE;
export const getPomodoroPath = () => ROUTES.POMODORO;
export const getKanbanPath = () => ROUTES.KANBAN;
export const getCalendarPath = (view?: string) => (view ? `${ROUTES.CALENDAR}?view=${view}` : ROUTES.CALENDAR);
export const getSettingsPath = (view?: 'profile' | 'pomodoro') =>
  view ? `${ROUTES.SETTINGS}?view=${view}` : ROUTES.SETTINGS;
