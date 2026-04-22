'use client';

import type { Subtask } from '@/types/subtask';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/colors-util';

type SubtasksPillProps = {
  subtasks: Subtask[];
  isExpanded: boolean;
  onToggle: () => void;
};

export function SubtasksPill({ subtasks, isExpanded, onToggle }: SubtasksPillProps) {
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  return (
    <Badge
      variant="muted"
      asChild
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls="subtasks-list"
      >
        {subtasks.length}
        {' '}
        Subtask
        {subtasks.length !== 1 ? 's' : ''}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform duration-150', isExpanded && 'rotate-180')}
        />
      </button>
    </Badge>
  );
}
