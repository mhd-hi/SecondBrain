import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo } from 'react';
import { getCourseListItemsFromCourses, useCourseStore } from '@/lib/stores/course-store';

/**
 * Hook for course operations with automatic fetching on mount
 * Should only be used at the top level (layout) to avoid duplicate fetches
 */
export function useCourseOperations() {
  const { status } = useSession();

  const isLoading = useCourseStore(state => state.isLoading);
  const error = useCourseStore(state => state.error);
  const hasInitialized = useCourseStore(state => state.hasInitialized);

  const coursesMap = useCourseStore(state => state.courses);
  const courses = useMemo(() => Array.from(coursesMap.values()), [coursesMap]);
  const coursesListItems = useMemo(() => getCourseListItemsFromCourses(courses), [courses]);

  // Auto-fetch only if authenticated and not initialized
  useEffect(() => {
    if (status === 'authenticated' && !hasInitialized && !isLoading) {
      void useCourseStore.getState().fetchCourses();
    } else if (status === 'unauthenticated') {
      useCourseStore.getState().reset();
    }
  }, [status, hasInitialized, isLoading]);

  const fetchCourses = useCallback(async () => {
    useCourseStore.setState({ hasInitialized: false });
    return useCourseStore.getState().fetchCourses();
  }, []);

  const refreshCourses = useCallback(async () => {
    return useCourseStore.getState().refreshCourses();
  }, []);

  const updateCourseField = useCallback(
    async (courseId: string, field: string, value: unknown) => {
      return useCourseStore.getState().updateCourseField(courseId, field, value);
    },
    [],
  );

  const deleteCourse = useCallback(async (courseId: string) => {
    return useCourseStore.getState().removeCourse(courseId);
  }, []);

  const getCourse = useCallback((courseId: string) => {
    return useCourseStore.getState().getCourse(courseId);
  }, []);

  const getCourseByCode = useCallback((code: string) => {
    return useCourseStore.getState().getCourseByCode(code);
  }, []);

  return {
    courses,
    coursesListItems,
    isLoading,
    error,
    fetchCourses,
    refreshCourses,
    updateCourseField,
    deleteCourse,
    getCourse,
    getCourseByCode,
    getAllCourses: useCourseStore.getState().getAllCourses,
    getCoursesListItems: useCourseStore.getState().getCoursesListItems,
    clearError: useCourseStore.getState().clearError,
  };
}

/**
 * Hook to read courses from the store without auto-fetching
 * Use this in child components - the layout handles fetching via useCourseOperations
 */
export function useCourses() {
  const isLoading = useCourseStore(state => state.isLoading);
  const error = useCourseStore(state => state.error);

  const coursesMap = useCourseStore(state => state.courses);
  const courses = useMemo(() => Array.from(coursesMap.values()), [coursesMap]);
  const coursesListItems = useMemo(() => getCourseListItemsFromCourses(courses), [courses]);

  const getCourse = useCallback((courseId: string) => {
    return useCourseStore.getState().getCourse(courseId);
  }, []);

  const getCourseByCode = useCallback((code: string) => {
    return useCourseStore.getState().getCourseByCode(code);
  }, []);

  const refreshCourses = useCallback(async () => {
    return useCourseStore.getState().refreshCourses();
  }, []);

  return {
    courses,
    coursesListItems,
    isLoading,
    error,
    refreshCourses,
    getCourse,
    getCourseByCode,
  };
}
