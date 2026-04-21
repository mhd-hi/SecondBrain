import { CalendarRange, Columns, Grid2x2, Grid3x3, List, Plus } from 'lucide-react';

import { useState } from 'react';
import { NavigationControls } from '@/components/Calendar/NavigationControls';

import { AddTaskDialog } from '@/components/shared/dialogs/AddTaskDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCourses } from '@/hooks/course/use-course-store';
import { useCalendarViewStore } from '@/lib/stores/calendar-view-store';

export function CalendarHeader() {
  const view = useCalendarViewStore(state => state.view);
  const setView = useCalendarViewStore(state => state.setView);
  const { courses, isLoading } = useCourses();
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const selectedDate = useCalendarViewStore(state => state.selectedDate);
  const setSelectedDate = useCalendarViewStore(state => state.setSelectedDate);

  // Compute weekDates based on selectedDate
  const getCurrentWeekDates = () => {
    const date = selectedDate;
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Sunday = 0
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  };

  const handleTodayClick = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <NavigationControls
          weekDates={getCurrentWeekDates()}
          isLoading={false}
          onWeekChange={handleWeekChange}
          onTodayClick={handleTodayClick}
        />
      </div>

      <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-between">
        <div className="flex w-full items-center gap-1.5">
          <div className="inline-flex first:rounded-r-none last:rounded-l-none [&:not(:first-child):not(:last-child)]:rounded-none">
            <Button
              aria-label="View by day"
              size="icon"
              variant={view === 'day' ? 'default' : 'outline'}
              className="rounded-r-none [&_svg]:size-5"
              onClick={() => setView('day')}
            >
              <List strokeWidth={1.8} />
            </Button>
            <Button
              aria-label="View by week"
              size="icon"
              variant={view === 'week' ? 'default' : 'outline'}
              className="-ml-px rounded-none [&_svg]:size-5"
              onClick={() => setView('week')}
            >
              <Columns strokeWidth={1.8} />
            </Button>
            <Button
              aria-label="View by month"
              size="icon"
              variant={view === 'month' ? 'default' : 'outline'}
              className="-ml-px rounded-none [&_svg]:size-5"
              onClick={() => setView('month')}
            >
              <Grid2x2 strokeWidth={1.8} />
            </Button>
            <Button
              aria-label="View by year"
              size="icon"
              variant={view === 'year' ? 'default' : 'outline'}
              className="-ml-px rounded-none [&_svg]:size-5"
              onClick={() => setView('year')}
            >
              <Grid3x3 strokeWidth={1.8} />
            </Button>
            <Button
              aria-label="View by agenda"
              size="icon"
              variant={view === 'agenda' ? 'default' : 'outline'}
              className="-ml-px rounded-l-none [&_svg]:size-5"
              onClick={() => setView('agenda')}
            >
              <CalendarRange strokeWidth={1.8} />
            </Button>
          </div>
        </div>

        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full sm:w-auto" variant="default" disabled={isLoading}>
                <Plus className="mr-2" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <button type="button" className="w-full text-left" onClick={() => setAddTaskOpen(true)}>
                  Add Task
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AddTaskDialog
            open={addTaskOpen}
            onOpenChange={setAddTaskOpen}
            courses={courses}
            dueDate={selectedDate}
            trigger={false}
            onTaskAdded={() => setAddTaskOpen(false)}
          />
        </>
      </div>
    </div>
  );
}
