'use client';

import type { CustomLink } from '@/types/custom-link';
import { Trash } from 'lucide-react';
import * as React from 'react';

import { toast } from 'sonner';
import LinkFields from '@/components/CustomLinks/LinkFields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCustomLinkStore } from '@/lib/stores/custom-link-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { normalizeUrl, validateUrl } from '@/lib/utils/url-util';
import { LINK_TYPES } from '@/types/custom-link';

type EditingEntry = { title: string; url: string; type: CustomLink };
const UPDATE_CUSTOM_LINKS_DESCRIPTION_ID = 'update-custom-links-description';

type UpdateCustomLinksDialogProps = {
  courseId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const UpdateCustomLinksDialog = ({ courseId, open, onOpenChange }: UpdateCustomLinksDialogProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const controlled = typeof open === 'boolean' && typeof onOpenChange === 'function';
  const dialogOpen = controlled ? open : isOpen;
  const setDialogOpen = (value: boolean) => {
    if (controlled) {
      onOpenChange(value);
    } else {
      setIsOpen(value);
    }
  };

  const store = useCustomLinkStore();
  const links = store.getCustomLinksByCourse(courseId);

  const [editing, setEditing] = React.useState<Map<string, EditingEntry>>(() => new Map());

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const saveLink = async (id: string, data: EditingEntry) => {
    await api.patch<{ success: boolean; customLink: unknown }>(API_ENDPOINTS.CUSTOM_LINKS.DETAIL(id), {
      title: data.title,
      url: data.url,
      type: data.type,
    }, 'Failed to update link');

    store.updateCustomLink(id, { title: data.title, url: data.url, type: data.type });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      // validate modified entries: no empty title or url allowed
      const ops: Promise<unknown>[] = [];
      for (const l of links) {
        const ed = editing.get(l.id);
        if (!ed) {
          continue;
        }
        // only validate entries that were actually modified
        if (ed.title !== l.title || ed.url !== l.url || ed.type !== l.type) {
          const title = String(ed.title ?? '').trim();
          const rawUrl = String(ed.url ?? '').trim();
          if (!title || !rawUrl) {
            setSaveError('Please provide both a title and URL for all modified links.');
            setIsSaving(false);
            return;
          }

          const normalized = normalizeUrl(rawUrl);
          if (!validateUrl(normalized)) {
            setSaveError('One or more links contain an invalid URL. Please use a valid URL (e.g. https://example.com).');
            setIsSaving(false);
            return;
          }

          ops.push(saveLink(l.id, { ...ed, url: normalized }));
        }
      }

      if (ops.length === 0) {
        toast.success('No changes to save');
        setIsSaving(false);
        return;
      }

      await Promise.all(ops);
      setSaveError(null);
      toast.success('Links updated');
      setIsSaving(false);
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save links', err);
      setSaveError('Failed to save links. Please try again.');
      toast.error('Failed to save links');
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const ok = await store.removeCustomLink(id);
      if (ok) {
        toast.success('Link deleted');
      }
    } catch (error) {
      console.error('Failed to delete link', error);
    }
  };

  const handleChange = (id: string, field: keyof EditingEntry, value: string) => {
    setEditing((prev) => {
      const m = new Map(prev);
      const existing: EditingEntry = m.get(id) ?? { title: '', url: '', type: LINK_TYPES.CUSTOM as CustomLink };
      m.set(id, { ...existing, [field]: value as unknown as EditingEntry[typeof field] });
      return m;
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent aria-describedby={UPDATE_CUSTOM_LINKS_DESCRIPTION_ID}>
        <DialogHeader>
          <DialogTitle>Update Links</DialogTitle>
          <p id={UPDATE_CUSTOM_LINKS_DESCRIPTION_ID} className="text-sm text-muted-foreground">
            Edit or remove the saved links for this course.
          </p>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto py-2">
          {links.length === 0 && <div className="text-sm text-muted-foreground">No links for this course</div>}
          {links.map(l => (
            <div key={l.id} className="p-2 border rounded flex items-center gap-3">
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2 w-1/2">
                  <LinkFields
                    title={editing.get(l.id)?.title ?? l.title}
                    onTitleChange={(v: string) => handleChange(l.id, 'title', v)}
                    type={editing.get(l.id)?.type ?? l.type}
                    onTypeSelect={(t: CustomLink) => {
                      handleChange(l.id, 'type', t as unknown as string);
                      if (t !== LINK_TYPES.CUSTOM) {
                        handleChange(l.id, 'title', t as unknown as string);
                      }
                    }}
                    id={`link-${l.id}`}
                  />
                </div>

                <div className="flex items-center gap-2 w-1/2 justify-between">
                  <Input value={editing.get(l.id)?.url ?? l.url} onChange={e => handleChange(l.id, 'url', e.target.value)} className="flex-1" />

                </div>
              </div>
              <div>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(l.id)} aria-label="Delete link">
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {saveError && <div className="text-sm text-red-500 mt-2">{saveError}</div>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveAll} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateCustomLinksDialog;
