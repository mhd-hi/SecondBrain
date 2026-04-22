import * as React from 'react';
import { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

type EditableFieldProps = {
  value: string;
  onSave: (newValue: string) => void | Promise<void>;
  className?: string;
  inputType?: 'input' | 'textarea';
  placeholder?: string;
  disabled?: boolean;
};

export const EditableField: React.FC<EditableFieldProps> = ({
  value,
  onSave,
  className = '',
  inputType = 'input',
  placeholder = '',
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isSavingRef = useRef(false);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Save and exit edit mode
  const saveEdit = async () => {
    const nextValue = inputRef.current?.value ?? editValue;

    if (nextValue !== editValue) {
      setEditValue(nextValue);
    }

    if (isSavingRef.current) {
      return;
    }

    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      await onSave(nextValue);
      setIsEditing(false);
    } catch {
      focusInput();
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // Enter edit mode
  const startEdit = () => {
    setIsEditing(true);
    setEditValue(value);
    focusInput();
  };

  // Save on blur
  const handleBlur = () => {
    void saveEdit();
  };

  // Save on Enter (for input)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputType === 'input') {
      void saveEdit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    }
  };

  // Helper for ellipsis display
  const getDisplayValue = () => {
    if (inputType === 'input') {
      // Single line, ellipsis
      return (
        <span
          className={`block truncate ${!value ? 'opacity-50' : ''}`}
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {value || placeholder}
        </span>
      );
    } else {
      // Textarea: max 3 lines, ellipsis
      const lines = (value || '').split('\n');
      let display = lines.slice(0, 3).join(' ');
      if (lines.length > 3 || display.length > 120) {
        display = `${display.slice(0, 120)}...`;
      }
      return (
        <span
          className={`block overflow-hidden ${!value ? 'opacity-50' : ''}`}
          style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', textOverflow: 'ellipsis' }}
        >
          {display || placeholder}
        </span>
      );
    }
  };

  return (
    <div
      className={`relative flex items-center group max-w-full ${className}`}
      style={{ minWidth: 0 }}
    >
      {isEditing
        ? (
          inputType === 'textarea'
            ? (
              <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                className="resize-y min-h-[2.5em] w-full max-w-full"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleBlur}
                rows={3}
                placeholder={placeholder}
                disabled={disabled || isSaving}
              />
            )
            : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                className="w-full max-w-full border border-muted-foreground/40 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground transition-all"
                style={{ borderWidth: '1.5px' }}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled || isSaving}
                maxLength={120}
              />
            )
        )
        : (
          <button
            type="button"
            className="w-full max-w-full text-left pl-2 pr-0 py-1 rounded-md border border-transparent bg-transparent hover:border-muted-foreground/40 focus:border-muted-foreground/60 cursor-pointer transition-all overflow-hidden"
            onClick={startEdit}
            disabled={disabled || isSaving}
            style={{ minWidth: 0 }}
          >
            {getDisplayValue()}
          </button>
        )}
    </div>
  );
};
