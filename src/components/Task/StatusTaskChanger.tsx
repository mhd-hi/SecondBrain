'use client';

import { ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/colors-util';
import { getNextStatusTask, getStatusBgClass, getStatusTextClass, isValidStatusTask, TASK_STATUS_CONFIG } from '@/lib/utils/task/task-util';
import { StatusTask } from '@/types/status-task';

type StatusTaskChangerProps = {
  currentStatus: StatusTask;
  onStatusChange: (newStatus: StatusTask) => void;
};

const USER_STATUS_ORDER = [
  StatusTask.TODO,
  StatusTask.IN_PROGRESS,
  StatusTask.COMPLETED,
] as const;

const StatusTaskChanger = ({ currentStatus, onStatusChange }: StatusTaskChangerProps) => {
  const handleArrowClick = () => {
    onStatusChange(getNextStatusTask(currentStatus));
  };

  const handleDropdownSelect = (status: StatusTask) => {
    onStatusChange(status);
  };

  const validStatus = isValidStatusTask(currentStatus) ? currentStatus : StatusTask.TODO;
  const config = TASK_STATUS_CONFIG[validStatus];

  return (
    <div
      className={cn(
        'inline-flex items-center h-8 rounded-md overflow-hidden',
        getStatusBgClass(validStatus),
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
      )}
      role="group"
      aria-label="Status task changer"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'px-3 h-full flex items-center',
              'font-medium text-xs uppercase leading-none',
              'border-r-[0.5px] border-background',
              'hover:bg-black/5 focus:outline-none',
              getStatusTextClass(validStatus),
            )}
            aria-label="Change task status"
          >
            {config.label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-(--radix-dropdown-menu-trigger-width) p-0 rounded-md overflow-hidden"
        >
          {USER_STATUS_ORDER.map((status, index) => {
            return (
              <DropdownMenuItem
                key={status}
                onClick={() => handleDropdownSelect(status)}
                className={cn(
                  'h-8 px-4 rounded-none flex items-center gap-2',
                  'font-medium text-xs uppercase',
                  'hover:bg-accent hover:text-accent-foreground focus:outline-none',
                  'cursor-pointer',
                  index !== USER_STATUS_ORDER.length - 1 && 'border-b border-border',
                )}
              >
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    status === StatusTask.COMPLETED
                      ? getStatusBgClass(status)
                      : `${getStatusBgClass(status)} border border-current`,
                  )}
                />
                {TASK_STATUS_CONFIG[status].label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={handleArrowClick}
        className={cn(
          'h-full flex items-center justify-center px-2 leading-none',
          'hover:bg-black/5 focus:outline-none',
          'transition-colors',
          getStatusTextClass(validStatus),
        )}
        aria-label="Cycle to next status"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};

export { StatusTaskChanger };
