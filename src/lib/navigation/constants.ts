import { getCalendarPath, getKanbanPath, getPomodoroPath, ROUTES } from '@/lib/page-routes';

export const navbarItems = [
  {
    title: 'Dashboard',
    url: ROUTES.DASHBOARD,
    icon: '🎯',
  },
  {
    title: 'Pomodoro',
    url: getPomodoroPath(),
    icon: '🍅',
  },
  {
    title: 'Kanban',
    url: getKanbanPath(),
    icon: '📋',
  },
  {
    title: 'Calendar',
    url: getCalendarPath(),
    icon: '📅',
  },
];
