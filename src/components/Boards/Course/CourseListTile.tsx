'use client';

import type { Course } from '@/types/course';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import CourseCard from '@/components/Boards/Course/CourseCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCourseMutations, useCourses } from '@/hooks/course/use-course-store';
import { getAddCoursePath } from '@/lib/page-routes';
import { handleConfirm } from '@/lib/utils/dialog-util';
import { CommonErrorMessages, ErrorHandlers } from '@/lib/utils/errors/error';
import { TEST_IDS } from '@/lib/testing/selectors';

export function CourseListTile() {
  const router = useRouter();
  const { courses, isLoading, refreshCourses } = useCourses();
  const { deleteCourse } = useCourseMutations();

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await handleConfirm(
        'Are you sure you want to delete this course? This action cannot be undone.',
        async () => {
          await deleteCourse(courseId);
          await refreshCourses();
        },
        undefined,
        {
          title: 'Delete Course',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          variant: 'destructive',
        },
      );
    } catch (error) {
      ErrorHandlers.api(
        error,
        CommonErrorMessages.COURSE_DELETE_FAILED,
        'CourseListTile handleDeleteCourse',
      );
    }
  };

  return (
    <div className="bg-muted/30 rounded-lg border p-6" data-testid={TEST_IDS.dashboard.courseList}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Courses</h2>
        <Button data-testid={TEST_IDS.dashboard.addCourseButton} onClick={() => router.push(getAddCoursePath())}>
          <Plus className="mr-2 h-4 w-4 rounded-sm" />
          Add Course
        </Button>
      </div>
      <div
        className="grid w-full gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        {isLoading
? (
          Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map(id => (
            <Skeleton key={id} className="h-40 w-full rounded-lg" />
          ))
        )
: (courses ?? []).length > 0
? (
          (courses ?? []).map((course: Course) => (
            <CourseCard
              key={course.id}
              course={course}
              onDeleteCourse={handleDeleteCourse}
            />
          ))
        )
: (
          <div className="text-muted-foreground col-span-full text-center" data-testid={TEST_IDS.dashboard.courseListEmpty}>
            Add a new course to get started.
          </div>
        )}
      </div>
    </div>
  );
}
