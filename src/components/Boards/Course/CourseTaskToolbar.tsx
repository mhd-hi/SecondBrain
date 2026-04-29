'use client';

import type { Ref } from 'react';

import { Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { AddTaskDialog } from '@/components/shared/dialogs/AddTaskDialog';
import { SearchBar } from '@/components/shared/atoms/SearchBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TEST_IDS } from '@/lib/testing/selectors';

type CourseTaskToolbarProps = {
  courseId: string;
  addTaskButtonRef: Ref<HTMLDivElement>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  hideCompleted: boolean;
  onHideCompletedChange: (hideCompleted: boolean) => void;
  showFloatingButton: boolean;
};

export function CourseTaskToolbar({
  courseId,
  addTaskButtonRef,
  searchQuery,
  onSearchQueryChange,
  hideCompleted,
  onHideCompletedChange,
  showFloatingButton,
}: CourseTaskToolbarProps) {
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const hideCompletedCheckboxId = 'course-page-hide-completed-checkbox';

  return (
    <>
      <div ref={addTaskButtonRef} className="mb-2 flex items-center gap-2">
        <SearchBar
          id="course-tasks-search-bar"
          name="course-tasks-search-bar"
          placeholder="Search tasks by title, notes, or subtasks..."
          value={searchQuery}
          onChange={onSearchQueryChange}
          className="flex-[1_1_18rem] min-w-0"
          inputTestId={TEST_IDS.coursePage.searchInput}
        />
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={hideCompleted ? 'secondary' : 'outline'}
              size="icon"
              className="shrink-0"
              aria-label="Task filters"
              data-testid={TEST_IDS.coursePage.hideCompletedToggle}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium leading-none">Task filters</h4>
                <p className="text-sm text-muted-foreground">
                  Control which tasks appear in the list.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50">
                <Checkbox
                  id={hideCompletedCheckboxId}
                  checked={hideCompleted}
                  onCheckedChange={(checked) => {
                    onHideCompletedChange(checked === true);
                    setFilterPopoverOpen(false);
                  }}
                />
                <label htmlFor={hideCompletedCheckboxId} className="cursor-pointer space-y-1">
                  <span className="block text-sm font-medium leading-none">
                    Hide completed tasks
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Completed tasks stay hidden until you turn this off.
                  </span>
                </label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <AddTaskDialog
          courseId={courseId}
          trigger={(
            <Button data-testid={TEST_IDS.coursePage.addTaskButton}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          )}
        />
      </div>

      {showFloatingButton && (
        <div className="fixed top-20 z-40" style={{ right: '2rem' }}>
          <AddTaskDialog
            courseId={courseId}
            trigger={(
              <Button className="w-30 shadow-lg transition-all hover:shadow-xl">
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            )}
          />
        </div>
      )}
    </>
  );
}
