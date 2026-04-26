'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { OverdueTasksDialog } from '@/components/shared/dialogs/CompleteOverdueTasksDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/colors-util';

export type DropdownAction = {
  label: string;
  onClick: () => void;
  className?: string;
  destructive?: boolean;
  disabled?: boolean;
  title?: string;
};

type OverdueTask = {
  id: string;
  title: string;
  dueDate?: string;
};

type ActionsDropdownProps = {
  actions: DropdownAction[];
  triggerClassName?: string;
  contentAlign?: 'start' | 'center' | 'end';
  className?: string;
  triggerText?: string;
  triggerTestId?: string;
  // optional overdue dialog support (for bulk actions)
  overdueCount?: number;
  onCompleteAll?: () => void;
  overdueTasks?: OverdueTask[];
};

export function ActionsDropdown({
  actions,
  triggerClassName,
  contentAlign = 'end',
  className,
  triggerText,
  triggerTestId,
  overdueCount,
  onCompleteAll,
  overdueTasks,
}: ActionsDropdownProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid={triggerTestId}
          className={cn(
            'rounded-full bg-accent p-1.5 hover:bg-muted hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground transition-opacity',
            triggerClassName,
            triggerText && 'rounded-md px-4 py-2 font-medium',
          )}
        >
          {triggerText
            ? (<span>{triggerText}</span>)
            : (<MoreHorizontal className="h-5 w-5 text-muted-foreground" aria-label="More actions" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={contentAlign} className={className}>
          {actions.map((action) => {
            const clickHandler
              = action.label === 'Complete overdue tasks' && onCompleteAll
                ? () => setDialogOpen(true)
                : action.onClick;

            return (
              <DropdownMenuItem
                key={action.label}
                onClick={clickHandler}
                className={cn(action.destructive && 'text-destructive focus:text-destructive', action.className)}
                disabled={action.disabled}
                title={action.title}
                variant={action.destructive ? 'destructive' : 'default'}
              >
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {onCompleteAll && (
        <OverdueTasksDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          overdueCount={overdueCount ?? 0}
          onCompleteAll={onCompleteAll}
          overdueTasks={overdueTasks}
        />
      )}
    </>
  );
}
