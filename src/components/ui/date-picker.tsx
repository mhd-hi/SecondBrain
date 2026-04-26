'use client';

import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils/colors-util';

type DatePickerProps = {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  className?: string;
  open?: boolean;
  triggerTestId?: string;
  calendarTestId?: string;
};

export function DatePicker({
  date,
  onDateChange,
  className,
  open,
  triggerTestId,
  calendarTestId,
}: DatePickerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const popoverOpen = isControlled ? open : internalOpen;
  const setPopoverOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-60 justify-start text-left font-normal border-input',
            !date && 'text-muted-foreground',
            className,
          )}
          data-testid={triggerTestId}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          data-testid={calendarTestId}
          mode="single"
          selected={date}
          onSelect={onDateChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
