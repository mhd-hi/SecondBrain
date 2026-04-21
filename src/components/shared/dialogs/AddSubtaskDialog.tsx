'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubtaskActions } from '@/hooks/task/use-subtask-actions';

type AddSubtaskDialogProps = {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const AddSubtaskDialog = ({ taskId, open, onOpenChange }: AddSubtaskDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState(() => ({
    title: '',
    notes: '',
  }));
  const { addSubtask } = useSubtaskActions({ taskId });

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.title || newSubtask.title.trim() === '') {
      toast.error('Please provide a title for the subtask');
      return;
    }

    setIsLoading(true);
    try {
      const created = await addSubtask({
        title: newSubtask.title,
        notes: newSubtask.notes ?? '',
      });
      if (!created) {
        throw new Error('Creation failed');
      }

      toast.success('Subtask added');
      handleClose();
      setNewSubtask({ title: '', notes: '' });
    } catch {
      toast.error('Failed to add subtask');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="add-subtask-description">
        <DialogHeader>
          <DialogTitle>Add Subtask</DialogTitle>
          <DialogDescription id="add-subtask-description">
            Add a new subtask to this task
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">Title</label>
              <input
                id="title"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newSubtask.title}
                onChange={e => setNewSubtask(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="notes" className="text-sm font-medium">Description</label>
              <textarea
                id="notes"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newSubtask.notes}
                onChange={e => setNewSubtask(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Subtask'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
