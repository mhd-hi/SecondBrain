'use client';

import { useEffect, useRef } from 'react';
import { getCalendarPath, ROUTES } from '../../page-routes';

type Dialog = 'add-task';

type ShortcutAction =
  | { type: 'navigate'; path: string }
  | { type: 'dialog'; dialog: Dialog }
  | { type: 'toggle'; target: 'command-palette' };

type KeyboardShortcut = {
  key: string;
  ctrl: boolean;
  alt: boolean;
  meta?: boolean;
  action: ShortcutAction;
  description: string;
};

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Command palette
  {
    key: 'k',
    ctrl: true,
    alt: true,
    action: { type: 'toggle', target: 'command-palette' },
    description: 'Open command palette',
  },
  // Navigation shortcuts
  {
    key: 'd',
    ctrl: true,
    alt: true,
    action: { type: 'navigate', path: ROUTES.DASHBOARD },
    description: 'Go to Dashboard',
  },
  {
    key: 'p',
    ctrl: true,
    alt: true,
    action: { type: 'navigate', path: ROUTES.POMODORO },
    description: 'Go to Pomodoro',
  },
  {
    key: 'c',
    ctrl: true,
    alt: true,
    action: { type: 'navigate', path: getCalendarPath() },
    description: 'Go to Calendar',
  },
  // Dialog shortcuts
  {
    key: 'r',
    ctrl: true,
    alt: true,
    action: { type: 'navigate', path: ROUTES.ADD_COURSE },
    description: 'Add Course',
  },
  {
    key: 't',
    ctrl: true,
    alt: true,
    action: { type: 'dialog', dialog: 'add-task' },
    description: 'Add Task',
  },
];

export function getShortcutForPath(path: string): KeyboardShortcut | undefined {
  return KEYBOARD_SHORTCUTS.find(
    shortcut =>
      shortcut.action.type === 'navigate' && shortcut.action.path === path,
  );
}

export function getShortcutForDialog(
  dialog: Dialog,
): KeyboardShortcut | undefined {
  return KEYBOARD_SHORTCUTS.find(
    shortcut =>
      shortcut.action.type === 'dialog' && shortcut.action.dialog === dialog,
  );
}

type ShortcutHandlers = {
  onToggleCommandPalette: () => void;
  onOpenAddTaskDialog: () => void;
  onNavigate: (path: string) => void;
};

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);

  // Keep the ref up to date with the latest handlers
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const pressedKey
        = typeof e.key === 'string' ? e.key.toLowerCase() : '';

      if (!pressedKey) {
        return;
      }

      const isMac
        = typeof navigator !== 'undefined'
        // eslint-disable-next-line style/indent-binary-ops
        && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

      const matchingShortcut = KEYBOARD_SHORTCUTS.find((shortcut) => {
        const shortcutKey
          = typeof shortcut.key === 'string' ? shortcut.key.toLowerCase() : '';

        if (!shortcutKey) {
          return false;
        }

        const keyMatches = pressedKey === shortcutKey;
        const ctrlMatches = shortcut.ctrl === (isMac ? e.metaKey : e.ctrlKey);
        const altMatches = shortcut.alt === e.altKey;

        return keyMatches && ctrlMatches && altMatches;
      });

      if (matchingShortcut) {
        e.preventDefault();

        // Use the current handlers from the ref
        const currentHandlers = handlersRef.current;

        switch (matchingShortcut.action.type) {
          case 'navigate':
            currentHandlers.onNavigate(matchingShortcut.action.path);
            break;
          case 'dialog':
            switch (matchingShortcut.action.dialog) {
              case 'add-task':
                currentHandlers.onOpenAddTaskDialog();
                break;
            }
            break;
          case 'toggle':
            currentHandlers.onToggleCommandPalette();
            break;
        }
      }
    };

    // Attach the event listener only once
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array - listener is attached only once
}

export function getShortcutDisplayText(shortcut: KeyboardShortcut): string {
  const isMac
    = typeof navigator !== 'undefined'
    // eslint-disable-next-line style/indent-binary-ops
    && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(isMac ? 'Cmd' : 'Ctrl');
  }
  if (shortcut.alt) {
    parts.push('Alt');
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}
