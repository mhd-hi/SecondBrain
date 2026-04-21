import type { FetchStatus } from './helpers/fetch-status';
import type { CourseListItem, CourseSummaryApiResponse } from '@/types/api/course';
import type { Course } from '@/types/course';
import { toast } from 'sonner';
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
  updateCourseField: (courseId: string, field: string, value: unknown) => Promise<boolean>;
  removeCourse: (courseId: string) => Promise<boolean>;

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

  updateCourseField: async (courseId, field, value) => {
    // Store original value for rollback
    const originalCourse = get().getCourse(courseId);
    if (!originalCourse) {
      return false;
    }

    // Optimistic update
    get().updateCourse(courseId, { [field]: value } as Partial<Course>);

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(API_ENDPOINTS.COURSES.DETAIL(courseId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update course');
      }

      set({ isLoading: false });
      toast.success('Course updated successfully');
      return true;
    } catch (error) {
      // Rollback optimistic update
      if (Object.hasOwn(originalCourse, field)) {
        get().updateCourse(courseId, { [field]: originalCourse[field as keyof Course] } as Partial<Course>);
      }

      const errorMessage = 'Failed to update course';
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.api(error, errorMessage);
      toast.error(errorMessage);
      return false;
    }
  },

  removeCourse: async (courseId) => {
    // Store original course for rollback
    const originalCourse = get().getCourse(courseId);
    if (!originalCourse) {
      return false;
    }

    // Optimistic delete
    get().deleteCourse(courseId);

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(API_ENDPOINTS.COURSES.DETAIL(courseId), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete course');
      }

      set({ isLoading: false });
      toast.success('Course deleted successfully');
      return true;
    } catch (error) {
      // Rollback optimistic delete
      get().addCourse(originalCourse);

      const errorMessage = 'Failed to delete course';
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.api(error, errorMessage);
      toast.error(errorMessage);
      return false;
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
