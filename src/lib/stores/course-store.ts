import type { FetchStatus } from './helpers/fetch-status';
import type { CourseListItem, CourseSummaryApiResponse } from '@/types/api/course';
import type { Course } from '@/types/course';
import { create } from 'zustand';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { ErrorHandlers } from '@/lib/utils/errors/error';
import { getOverdueTasks } from '@/lib/utils/task/task-util';

type CourseStore = {
  courses: Map<string, Course>;
  fetchStatus: FetchStatus;
  isLoading: boolean;
  error: string | null;

  bootstrapCourses: (courses: Course[]) => void;
  setCourses: (courses: Course[]) => void;
  addCourse: (course: Course) => void;
  updateCourse: (courseId: string, updates: Partial<Course>) => void;
  deleteCourse: (courseId: string) => void;

  getCourse: (courseId: string) => Course | undefined;
  getCourseByCode: (code: string) => Course | undefined;
  getAllCourses: () => Course[];
  getCoursesListItems: () => CourseListItem[];

  fetchCourses: () => Promise<void>;
  refreshCourses: () => Promise<void>;

  clearError: () => void;
  reset: () => void;
};

export function getCourseListItemsFromCourses(courses: Iterable<Course>): CourseListItem[] {
  return Array.from(courses)
    .map(course => ({
      id: course.id,
      code: course.code,
      name: course.name,
      color: course.color,
      overdueCount: course.overdueCount ?? getOverdueTasks(course.tasks ?? []).length,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  courses: new Map(),
  fetchStatus: 'idle',
  isLoading: false,
  error: null,

  bootstrapCourses: (courses) => {
    get().setCourses(courses);
    set({
      fetchStatus: 'success',
      isLoading: false,
      error: null,
    });
  },

  setCourses: (courses) => {
    const courseMap = new Map<string, Course>();
    for (const course of courses) {
      courseMap.set(course.id, course);
    }
    set({ courses: courseMap });
  },

  addCourse: (course) => {
    set((state) => {
      const newCourses = new Map(state.courses);
      // Check if course already exists to avoid duplicates
      if (!newCourses.has(course.id)) {
        newCourses.set(course.id, course);
      }
      return { courses: newCourses };
    });
  },

  updateCourse: (courseId, updates) => {
    set((state) => {
      const newCourses = new Map(state.courses);
      const existingCourse = newCourses.get(courseId);
      if (existingCourse) {
        newCourses.set(courseId, { ...existingCourse, ...updates });
      }
      return { courses: newCourses };
    });
  },

  deleteCourse: (courseId) => {
    set((state) => {
      const newCourses = new Map(state.courses);
      newCourses.delete(courseId);
      return { courses: newCourses };
    });
  },

  getCourse: (courseId) => {
    return get().courses.get(courseId);
  },

  getCourseByCode: (code) => {
    return Array.from(get().courses.values()).find(course => course.code === code);
  },

  getAllCourses: () => {
    return Array.from(get().courses.values());
  },

  getCoursesListItems: () => {
    return getCourseListItemsFromCourses(get().courses.values());
  },

  fetchCourses: async () => {
    if (get().fetchStatus === 'loading') {
      return;
    }

    set({ fetchStatus: 'loading', error: null });
    try {
      const data = await api.get<CourseSummaryApiResponse[]>(API_ENDPOINTS.COURSES.LIST);
      get().setCourses(data ?? []);
      set({ fetchStatus: 'success' });
    } catch (error) {
      const errorMessage = 'Failed to load courses';
      set({ fetchStatus: 'error', error: errorMessage });
      ErrorHandlers.silent(error, 'CourseStore fetchCourses');
    }
  },

  refreshCourses: async () => {
    set({ fetchStatus: 'loading', error: null });
    try {
      const data = await api.get<CourseSummaryApiResponse[]>(API_ENDPOINTS.COURSES.LIST);
      get().setCourses(data ?? []);
      set({ fetchStatus: 'success' });
    } catch (error) {
      const errorMessage = 'Failed to refresh courses';
      set({ fetchStatus: 'error', error: errorMessage });
      ErrorHandlers.silent(error, 'CourseStore refreshCourses');
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    courses: new Map(),
    fetchStatus: 'idle',
    isLoading: false,
    error: null,
  }),
}));
