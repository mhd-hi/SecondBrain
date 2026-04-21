'use client';

import type { Course } from '@/types/course';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionsDropdown } from '@/components/shared/atoms/actions-dropdown';
import { DueDateDisplay } from '@/components/shared/atoms/due-date-display';
import { getCourseActions } from '@/components/shared/atoms/get-course-actions';
import { TruncatedTextWithTooltip } from '@/components/shared/atoms/text-with-tooltip';
import { ChangeCourseColorDialog } from '@/components/shared/dialogs/ChangeCourseColorDialog';
import { ChangeCourseDaypartDialog } from '@/components/shared/dialogs/ChangeCourseDaypartDialog';
import { getCoursePath } from '@/lib/page-routes';
import {
  calculateProgress,
  getCompletedTasksCount,
  getNextTask,
  getTotalTasksCount,
  getUpcomingTask,
} from '@/lib/utils/task/task-util';

type CourseCardProps = {
  course: Course;
  onDeleteCourse: (courseId: string) => void;
};

export default function CourseCard({ course, onDeleteCourse }: CourseCardProps) {
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [showDaypartDialog, setShowDaypartDialog] = useState(false);
  const [selectedColor, setSelectedColor] = useState(course.color || 'blue');
  const tasks = course.tasks ?? [];
  const displayColor = selectedColor || course.color || 'blue';

  const totalTasks = course.totalTasks ?? getTotalTasksCount(tasks);
  const completedTasks = course.completedTasks ?? getCompletedTasksCount(tasks);
  const progressPercentage = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : calculateProgress(tasks);
  const nextTask = course.nextTask ?? getNextTask(tasks);
  const upcomingTask = course.upcomingTask ?? getUpcomingTask(tasks);

  const handleChangeColorClick = () => {
    setShowColorDialog(true);
  };

  const router = useRouter();

  const baseActions = getCourseActions({
    onDeleteCourse: () => onDeleteCourse(course.id),
    onUpdateLinks: undefined,
    onOpenColor: handleChangeColorClick,
    onOpenDaypart: () => setShowDaypartDialog(true),
  });

  const dropdownActions = baseActions.map((a) => {
    if (a.label === 'Complete overdue tasks') {
      return { ...a, onClick: () => router.push(getCoursePath(course.id)) };
    }

    return a;
  });

  const rawStyle: Record<string, string> = {
    borderLeft: `4px solid ${selectedColor}`,
  };

  const cardStyle = rawStyle as React.CSSProperties;

  return (
    <div
      className={`border-l-4 border-${displayColor} relative group flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm p-4 gap-3 h-full min-h-55`}
      style={cardStyle}
    >
      <div className="absolute -top-2.5 -right-2.5 z-10">
        <ActionsDropdown actions={dropdownActions} triggerClassName="absolute -right-[1px] z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <ChangeCourseColorDialog courseId={course.id} open={showColorDialog} onOpenChange={setShowColorDialog} currentColor={selectedColor} onUpdated={clr => setSelectedColor(clr)} />
        <ChangeCourseDaypartDialog
          courseId={course.id}
          open={showDaypartDialog}
          onOpenChange={setShowDaypartDialog}
          currentDaypart={course.daypart}
        />
      </div>

      <div className="flex justify-between items-start">
        <h2 className="text-lg font-bold">
          <Link href={getCoursePath(course.id)} className="hover:underline transition-colors">
            {course.code}
          </Link>
        </h2>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-medium">Progress</p>
          <p className="text-right text-xs text-muted-foreground">
            {completedTasks}
            {' of '}
            {totalTasks}
            {' '}
            tasks
          </p>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%`, backgroundColor: displayColor }}
          />
        </div>
      </div>

      <div className="space-y-1 text-xs flex-1">
        {nextTask && (
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-foreground">Next:</span>
              <Link
                href={`${getCoursePath(course.id)}#task-${nextTask.id}`}
                className="flex-1 hover:underline transition-colors"
              >
                <TruncatedTextWithTooltip
                  text={nextTask.title}
                  className="text-xs text-muted-foreground line-clamp-1 leading-tight hover:text-foreground"
                  maxLines={1}
                />
              </Link>
            </div>
            {nextTask.dueDate && (
              <div className="flex items-center mb-2">
                <DueDateDisplay
                  date={nextTask.dueDate}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        )}

        {upcomingTask && upcomingTask.id !== nextTask?.id && (
          <div>
            <div className="flex items-center gap-1 mt-1 pt-1 border-t border-border">
              <span className="text-xs font-bold text-foreground">Upcoming:</span>
              <Link
                href={`${getCoursePath(course.id)}#task-${upcomingTask.id}`}
                className="flex-1 hover:underline transition-colors"
              >
                <TruncatedTextWithTooltip
                  text={upcomingTask.title}
                  className="text-xs text-muted-foreground line-clamp-1 leading-tight hover:text-foreground"
                  maxLines={1}
                />
              </Link>
            </div>
            {upcomingTask.dueDate && (
              <div className="flex items-center">
                <DueDateDisplay
                  date={upcomingTask.dueDate}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Display message when no upcoming tasks are found */}
        {!nextTask && !upcomingTask && (
          <p className="text-xs text-muted-foreground">No upcoming tasks.</p>
        )}

        {/* Display specific message if next task exists but no upcoming exam/homework is found */}
        {nextTask && !upcomingTask && (
          <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">No upcoming exams or homework.</p>
        )}

      </div>

      <div className="flex justify-end mt-auto">
        <Link
          href={getCoursePath(course.id)}
          className="text-xs text-muted-foreground hover:text-accent-foreground transition-colors hover:underline"
          style={{ color: displayColor }}
        >
          View course
        </Link>
      </div>
    </div>
  );
}
