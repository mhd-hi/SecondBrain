'use client';

import type { TCourseColor } from '@/types/colors';
import * as React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCourse } from '@/hooks/course/use-course';
import { COURSE_COLORS } from '@/lib/utils/colors-util';

const CHANGE_COURSE_COLOR_DESCRIPTION_ID = 'change-course-color-description';

type Props = {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentColor: TCourseColor;
  onUpdated?: (newColor: TCourseColor) => void;
};

export const ChangeCourseColorDialog = ({ courseId, open, onOpenChange, currentColor, onUpdated }: Props) => {
  const [pendingColor, setPendingColor] = useState<TCourseColor>(currentColor ?? 'blue');
  const [isSaving, setIsSaving] = useState(false);

  const { updateCourseColor } = useCourse(courseId);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await updateCourseColor(pendingColor);
      onOpenChange(false);
      onUpdated?.(pendingColor);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update course color');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={CHANGE_COURSE_COLOR_DESCRIPTION_ID}>
        <DialogHeader>
          <DialogTitle>Change Course Color</DialogTitle>
          <p id={CHANGE_COURSE_COLOR_DESCRIPTION_ID} className="text-sm text-muted-foreground">
            Choose a new color for this course.
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="course-color-select" className="text-sm font-medium">Course Color</label>
            <Select value={pendingColor} onValueChange={value => setPendingColor(value as TCourseColor)}>
              <SelectTrigger id="course-color-select" className="w-full">
                <SelectValue placeholder="Select a color" />
              </SelectTrigger>
              <SelectContent>
                {COURSE_COLORS.map(color => (
                  <SelectItem key={color} value={color}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize">{color}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button size="sm" onClick={handleConfirm} disabled={isSaving}>Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
