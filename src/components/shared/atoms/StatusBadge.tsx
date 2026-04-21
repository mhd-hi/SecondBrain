'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/colors-util';

type StatusBadgeProps = {
  content: string | number;
  variant: 'yellow' | 'red' | 'blue' | 'default';
  tooltipText: string;
  className?: string;
};

export function StatusBadge({
  content,
  variant,
  tooltipText,
  className,
}: StatusBadgeProps) {
  let badgeColorClass = '';
  switch (variant) {
    case 'yellow':
      badgeColorClass = 'bg-yellow-500/70 text-yellow-foreground';
      break;
    case 'red':
      badgeColorClass = 'bg-gray-500/60 text-red-foreground';
      break;
    case 'blue':
      badgeColorClass = 'bg-blue-500/70 text-blue-foreground';
      break;
    default:
      badgeColorClass = 'bg-muted text-muted-foreground';
      break;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-s inline-flex items-center justify-center -mt-px min-[]:h-[20px] min-w-6.25 font-medium',
              badgeColorClass,
              className,
            )}
          >
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
