'use client';

import { Search } from 'lucide-react';
import { AppLogo } from '@/components/shared/atoms/AppLogo';
import { NavigationItems } from '@/components/shared/Navigation/NavigationItems';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { openCommandPalette } from '@/lib/utils/event-handlers/command-palette';
import { getShortcutDisplayText, KEYBOARD_SHORTCUTS } from '@/lib/utils/event-handlers/keyboard-shortcuts';

export default function Navbar() {
  // Find the command palette shortcut
  const commandPaletteShortcut = KEYBOARD_SHORTCUTS.find(
    shortcut => shortcut.action.type === 'toggle' && shortcut.action.target === 'command-palette',
  );
  const shortcutText = commandPaletteShortcut ? getShortcutDisplayText(commandPaletteShortcut) : '⌘K';

  return (
    <Card className="sticky top-0 z-50 w-full shrink-0 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Tooltip for Close sidebar button */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger />
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Close sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Logo and app name - only visible on mobile */}
          <AppLogo className="md:hidden" />
        </div>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationItems variant="horizontal" />
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* User authentication and theme toggle moved to sidebar footer */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="ml-auto hidden md:inline-flex"
            onClick={() => openCommandPalette()}
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <span className="ml-2 text-xs text-muted-foreground">{shortcutText}</span>
          </Button>
          <a
            href="https://github.com/mhd-hi/SecondBrain-ETS"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
          >
            <Button variant="ghost" size="icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.012c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.37-1.342-3.37-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.091-.646.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.254-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.396.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.579.688.481C19.138 20.19 22 16.436 22 12.012 22 6.484 17.523 2 12 2z" />
              </svg>
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}
