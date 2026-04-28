'use client';
import type { Task } from '@/types/task';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CourseProgressTile } from '@/components/Boards/Progress/TaskCompletionProgressTile';
import CourseCustomLinks from '@/components/CustomLinks/CourseCustomLinks';
import { ActionsDropdown } from '@/components/shared/atoms/actions-dropdown';
import { getCourseActions } from '@/components/shared/atoms/get-course-actions';
import { SearchBar } from '@/components/shared/atoms/SearchBar';

import { AddTaskDialog } from '@/components/shared/dialogs/AddTaskDialog';
import { CourseUpdateDialog } from '@/components/shared/dialogs/UpdateCourseDialog';
import UpdateCustomLinksDialog from '@/components/shared/dialogs/UpdateCustomLinksDialog';
import { CourseSkeleton } from '@/components/shared/skeletons/CourseSkeleton';

import { TaskCard } from '@/components/Task/TaskCard';

import { Button } from '@/components/ui/button';
import { useCourseMutations, useCourses } from '@/hooks/course/use-course-store';
import { batchUpdateStatusTask, updateTaskStatus } from '@/hooks/task/use-task';
import { useCourseTasksStore } from '@/hooks/task/use-task-store';
import { useCourseCustomLinksStore } from '@/hooks/use-custom-link-store';
import { ROUTES } from '@/lib/page-routes';
import { useCourseStore } from '@/lib/stores/course-store';
import { useCustomLinkStore } from '@/lib/stores/custom-link-store';
import { getFetchStatusForKey, isPendingFetchStatus } from '@/lib/stores/helpers/fetch-status';
import { useTaskStore } from '@/lib/stores/task-store';
import { getWeekNumberFromDueDate } from '@/lib/utils/date-util';
import { handleConfirm } from '@/lib/utils/dialog-util';
import { CommonErrorMessages, ErrorHandlers } from '@/lib/utils/errors/error';
import { getOverdueTasks } from '@/lib/utils/task/task-util';
import { StatusTask } from '@/types/status-task';
import { TEST_IDS } from '@/lib/testing/selectors';

type CoursePageProps = {
  params: Promise<{
    course: string;
  }>;
};

export default function CoursePage({ params }: CoursePageProps) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const courseId = unwrappedParams.course;

  // Use store-based hooks (read-only, layout handles fetching)
  const { isLoading: areCoursesLoading } = useCourses();
  const { deleteCourse, updateCourseField } = useCourseMutations();
  const course = useCourseStore(state => state.courses.get(courseId));
  const [searchQuery, setSearchQuery] = useState('');
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const addTaskButtonRef = useRef<HTMLDivElement>(null);

  // Get tasks directly from the store for automatic reactivity
  const courseTasks = useCourseTasksStore(courseId);
  const tasksFetchStatus = useTaskStore(state =>
    getFetchStatusForKey(state.fetchStatusByCourse, courseId),
  );

  // Get custom links directly from the store for automatic reactivity
  const customLinks = useCourseCustomLinksStore(courseId);
  const customLinksFetchStatus = useCustomLinkStore(state =>
    getFetchStatusForKey(state.fetchStatusByCourse, courseId),
  );
  const isCourseContentLoading
    = isPendingFetchStatus(tasksFetchStatus) || isPendingFetchStatus(customLinksFetchStatus);

  // Get store methods for operations
  const updateTask = useTaskStore(state => state.updateTask);
  const removeTask = useTaskStore(state => state.removeTask);
  const fetchTasksByCourse = useTaskStore(state => state.fetchTasksByCourse);
  const fetchCustomLinksByCourse = useCustomLinkStore(state => state.fetchCustomLinksByCourse);

  // Fetch tasks and custom links when component mounts or courseId changes
  // Only fetch if courseId is a valid UUID (not a custom link URL)
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (courseId && uuidRegex.test(courseId)) {
      if (tasksFetchStatus === 'idle') {
        fetchTasksByCourse(courseId).catch((error: unknown) => {
          console.error(CommonErrorMessages.TASKS_FETCH_FAILED, error);
        });
      }

      if (customLinksFetchStatus === 'idle') {
        fetchCustomLinksByCourse(courseId).catch((error: unknown) => {
          console.error('Failed to fetch custom links:', error);
        });
      }
    } else if (courseId && !uuidRegex.test(courseId)) {
      // Invalid course ID format - redirect to home
      console.warn('Invalid course ID format, redirecting:', courseId);
      router.push(ROUTES.DASHBOARD);
    }
  }, [
    courseId,
    customLinksFetchStatus,
    fetchCustomLinksByCourse,
    fetchTasksByCourse,
    router,
    tasksFetchStatus,
  ]);

  // Track when Add Task button scrolls out of view
  useEffect(() => {
    const handleScroll = () => {
      if (addTaskButtonRef.current) {
        const rect = addTaskButtonRef.current.getBoundingClientRect();
        // Show floating button when original button is scrolled out of view
        setShowFloatingButton(rect.bottom < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) {
      return courseTasks;
    }

    const query = searchQuery.toLowerCase();
    return courseTasks.filter((task) => {
      // Search in task title
      if (task.title.toLowerCase().includes(query)) {
        return true;
      }

      // Search in task notes
      if (task.notes?.toLowerCase().includes(query)) {
        return true;
      }

      // Search in subtask titles
      if (
        task.subtasks?.some(subtask =>
          subtask.title.toLowerCase().includes(query)
          || subtask.notes?.toLowerCase().includes(query),
        )
      ) {
        return true;
      }

      // Search in course code
      if (task.course?.code.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    });
  }, [courseTasks, searchQuery]);

  const handleUpdateStatusTask = async (taskId: string, newStatus: StatusTask) => {
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch (error) {
      ErrorHandlers.silent(error, 'CoursePage handleUpdateStatusTask');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await removeTask(taskId);
  };

  const handleDeleteCourse = async () => {
    if (!course) {
      return;
    }

    try {
      // Confirm deletion using the existing dialog util
      await handleConfirm(
        'Are you sure you want to delete this course? This action cannot be undone.',
        async () => {
          await deleteCourse(course.id);
          // Redirect to root
          router.push(ROUTES.DASHBOARD);
          // Show toast with course code
          toast.success(`Course ${course.code} deleted successfully`);
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
      // Use centralized error handling
      ErrorHandlers.silent(error, 'CoursePage handleDeleteCourse');
    }
  };

  const [showManageLinks, setShowManageLinks] = useState(false);

  const overdueTasks = getOverdueTasks(filteredTasks, [StatusTask.IN_PROGRESS, StatusTask.COMPLETED]);

  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const handleCompleteOverdueTasks = async () => {
    try {
      const currentOverdueTasks = getOverdueTasks(courseTasks, [StatusTask.IN_PROGRESS, StatusTask.COMPLETED]);

      if (currentOverdueTasks.length === 0) {
        toast.success('No overdue tasks found');
        return;
      }

      const taskIds = currentOverdueTasks.map(task => task.id);

      await batchUpdateStatusTask(taskIds, StatusTask.COMPLETED);

      for (const taskId of taskIds) {
        updateTask(taskId, { status: StatusTask.COMPLETED });
      }

      toast.success('Overdue tasks completed', {
        description: `${currentOverdueTasks.length} overdue tasks have been marked as completed`,
      });
    } catch (error) {
      ErrorHandlers.api(error, 'Failed to complete overdue tasks');
    }
  };

  // Group tasks by week calculated from dueDate
  const tasksByWeek = filteredTasks.reduce((acc, task) => {
    const week = getWeekNumberFromDueDate(task.dueDate);
    acc[week] ??= [];
    acc[week]?.push(task);
    return acc;
  }, {} as Record<number, Task[]>);

  // Sort tasks within each week by dueDate
  Object.keys(tasksByWeek).forEach((week) => {
    tasksByWeek[Number(week)]?.sort((a, b) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  });

  // Show skeleton only if courses haven't loaded yet AND no course found
  if (!course && areCoursesLoading) {
    return (
      <main className="container mx-auto px-8 flex min-h-screen flex-col mt-6 mb-8">
        <CourseSkeleton />
      </main>
    );
  }

  // If courses loaded but this specific course not found, redirect to home
  if (!course) {
    router.push(ROUTES.DASHBOARD);
    return null;
  }

  return (
    <main className="container mx-auto px-8 flex min-h-screen flex-col mt-6 mb-8" data-testid={TEST_IDS.coursePage.page}>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold">{course.code}</h2>
        </div>
        <div>
          <ActionsDropdown
            actions={[
              {
                label: 'Course settings',
                onClick: () => setShowUpdateDialog(true),
              },
              ...getCourseActions({
                onDeleteCourse: handleDeleteCourse,
                onUpdateLinks: () => setShowManageLinks(true),
                overdueCount: overdueTasks.length,
              }).filter(a => a.label !== 'Change color' && a.label !== 'Change daypart'),
            ]}
            overdueCount={overdueTasks.length}
            onCompleteAll={handleCompleteOverdueTasks}
            overdueTasks={overdueTasks.map(task => ({ id: task.id, title: task.title, dueDate: task.dueDate ? String(task.dueDate) : undefined }))}
            triggerText="Actions"
            contentAlign="end"
            triggerTestId={TEST_IDS.coursePage.actionsTrigger}
          />
            <UpdateCustomLinksDialog open={showManageLinks} onOpenChange={setShowManageLinks} courseId={course.id} />
          <CourseUpdateDialog
            open={showUpdateDialog}
            onOpenChange={setShowUpdateDialog}
            course={course}
            onUpdate={async ({ color, daypart }) => {
              try {
                if (color === course.color && daypart === course.daypart) {
                  return;
                }

                // Update color if changed
                if (color !== course.color) {
                  await updateCourseField(course.id, 'color', color);
                }

                // Update daypart if changed
                if (daypart !== course.daypart) {
                  await updateCourseField(course.id, 'daypart', daypart);
                }

                setShowUpdateDialog(false);
              } catch (e) {
                ErrorHandlers.silent(e, 'CoursePage onUpdateCourse');
              }
            }}
          />
        </div>
      </div>

      {isCourseContentLoading
        ? (
          <CourseSkeleton />
        )
        : (
          <div className="space-y-4">
            <section>
              <CourseCustomLinks
                courseId={course.id}
                customLinks={customLinks}
              />
            </section>
            <section>
              <CourseProgressTile tasks={courseTasks} />
            </section>
            <div ref={addTaskButtonRef} className="flex items-center gap-4 mb-2">
              <SearchBar
                id="course-tasks-search-bar"
                name="course-tasks-search-bar"
                placeholder="Search tasks by title, notes, or subtasks..."
                value={searchQuery}
                onChange={setSearchQuery}
                className="flex-1"
                inputTestId={TEST_IDS.coursePage.searchInput}
              />
              <AddTaskDialog
                courseId={course.id}
                trigger={(
                  <Button data-testid={TEST_IDS.coursePage.addTaskButton}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                )}
              />
            </div>

            {/* Floating Add Task Button */}
            {showFloatingButton && (
              <div className="fixed top-20 z-40 animate-in slide-in-from-top duration-200 ease-out" style={{ right: '2rem' }}>
                <AddTaskDialog
                  courseId={course.id}
                  trigger={(
                    <Button className="shadow-lg hover:shadow-xl transition-all w-30">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  )}
                />
              </div>
            )}

            {filteredTasks.length > 0
              ? (
                <div className="space-y-5 will-change-scroll mt-7" data-testid={TEST_IDS.coursePage.taskList}>
                  {Object.entries(tasksByWeek)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([week, weekTasks]) => (
                      <div key={week} className="space-y-3">
                        <h3 className="font-semibold text-lg mb-1">
                          {'Week '}
                          {week}
                        </h3>
                        <div className="space-y-3">
                          {weekTasks.map(task => (
                            <div
                              id={`task-${task.id}`}
                              key={task.id}
                              className="transform-gpu transition-all duration-200 rounded-lg"
                            >
                              <TaskCard
                                task={task}
                                onDeleteTask={handleDeleteTask}
                                onUpdateStatusTask={handleUpdateStatusTask}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )
              : searchQuery.trim()
                ? (
                  <div className="text-center text-muted-foreground py-12" data-testid={TEST_IDS.coursePage.emptyState}>
                    No tasks found matching &quot;
                    {searchQuery}
                    &quot;. Try a different search term.
                  </div>
                )
                : (
                  <div className="text-center text-muted-foreground py-12" data-testid={TEST_IDS.coursePage.emptyState}>
                    No tasks found. Add a task to get started.
                  </div>
                )}
          </div>
        )}
    </main>
  );
}
