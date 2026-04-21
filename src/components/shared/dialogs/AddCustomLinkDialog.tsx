'use client';

import type { CustomLink as LinkType } from '@/types/custom-link';
import * as React from 'react';
import { toast } from 'sonner';
import CustomLinkForm from '@/components/CustomLinks/CustomLinkForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createCustomLinkAPI } from '@/hooks/use-custom-link';

type AddCustomLinkDialogProps = {
  courseId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLinkCreated?: () => void;
  trigger?: React.ReactNode;
};

export const AddCustomLinkDialog = ({ courseId, open, onOpenChange, onLinkCreated }: AddCustomLinkDialogProps) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const controlled = typeof open === 'boolean' && typeof onOpenChange === 'function';
  const dialogOpen = controlled ? open : isOpen;
  const setDialogOpen = (value: boolean) => {
    if (controlled) {
      onOpenChange(value);
    } else {
      setIsOpen(value);
    }
  };

  const handleCreate = async (data: { title: string; url: string; type: LinkType }) => {
    try {
      await createCustomLinkAPI({ title: data.title, url: data.url, type: data.type, courseId });
      toast.success('Link created');
      setDialogOpen(false);
      onLinkCreated?.();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to create link');
      throw err;
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Link</DialogTitle>
          <DialogDescription>Add a custom link for this course</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <CustomLinkForm onCreate={handleCreate} initialCourseId={courseId} />
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
};
