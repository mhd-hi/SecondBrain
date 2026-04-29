'use client';

import type { Daypart } from '@/types/course';
import * as React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCourse } from '@/hooks/course/use-course';

const CHANGE_COURSE_DAYPART_DESCRIPTION_ID = 'change-course-daypart-description';

type Props = {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDaypart?: Daypart;
  onUpdated?: (newDaypart: Daypart) => void;
};

export const ChangeCourseDaypartDialog = ({ courseId, open, onOpenChange, currentDaypart, onUpdated }: Props) => {
  // keep the state typed as Daypart so we pass correct values to the hook
  const [value, setValue] = useState<Daypart>((currentDaypart ?? 'AM') as Daypart);
  const [isSaving, setIsSaving] = useState(false);

  const { updateCourseDaypart } = useCourse(courseId);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
        if (!value) {
        toast.error('Please select a daypart');
        setIsSaving(false);
        return;
      }

      await updateCourseDaypart(value);
      toast.success('Daypart updated');
      onOpenChange(false);
      onUpdated?.(value);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update daypart');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={CHANGE_COURSE_DAYPART_DESCRIPTION_ID}>
        <DialogHeader>
          <DialogTitle>Change lecture daypart</DialogTitle>
          <DialogDescription id={CHANGE_COURSE_DAYPART_DESCRIPTION_ID}>
            Update when this course usually happens.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <Select value={value} onValueChange={(v: string) => setValue(v as Daypart)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
              <SelectItem value="EVEN">Evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} disabled={isSaving}>Update</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
