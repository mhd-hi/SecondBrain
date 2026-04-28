'use client';

import type { CourseListItem } from '@/types/api/course';
import {
  ChevronsUpDown,
  LogOut,
  NotebookText,
  Plus,
  Settings,
} from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppLogo } from '@/components/shared/atoms/AppLogo';
import { StatusBadge } from '@/components/shared/atoms/StatusBadge';
import { NavigationItems } from '@/components/shared/Navigation/NavigationItems';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAddCoursePath, getCoursePath, ROUTES } from '@/lib/page-routes';
import { TEST_IDS } from '@/lib/testing/selectors';

type SidebarProps = {
  courses: CourseListItem[];
  isLoading?: boolean;
  onCourseAdded?: () => void;
};

export function AppSidebar({ courses, isLoading = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isMobile = useIsMobile();

  return (
    <Sidebar collapsible="icon" className="h-screen" data-testid={TEST_IDS.shell.sidebar}>
      <SidebarHeader>
        <AppLogo />
      </SidebarHeader>
      <SidebarContent>
        {/* Navigation Group - Mobile only */}
        <SidebarGroup className="md:hidden">
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavigationItems variant="vertical" />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="md:hidden" />

        {/* My Courses Group */}
        <SidebarGroup>
          <SidebarGroupLabel>My Courses</SidebarGroupLabel>
          {isMobile
            ? (
                <SidebarGroupAction
                  onClick={() => router.push(getAddCoursePath())}
                  className="h-8 w-8"
                >
                  <Plus className="size-5" />
                </SidebarGroupAction>
              )
            : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarGroupAction
                        onClick={() => router.push(getAddCoursePath())}
                        className="h-8 w-8"
                      >
                        <Plus className="size-5" />
                      </SidebarGroupAction>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Add course</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading
                ? Array.from({ length: 5 }, (_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon index={i} />
                    </SidebarMenuItem>
                  ))
                : courses.length === 0
                  ? ''
                  : courses.map((course) => {
                      const isActive = pathname === `/courses/${course.id}`;
                      return (
                        <SidebarMenuItem key={course.id}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={getCoursePath(course.id)} data-testid={TEST_IDS.shell.sidebarCourseLink}>
                              <NotebookText
                                className="size-4"
                                style={{ color: course.color }}
                              />
                              <span>{course.code}</span>
                              <div className="ml-auto flex items-center gap-1">
                                {course.overdueCount > 0 && (
                                  <StatusBadge
                                    content={course.overdueCount}
                                    variant="yellow"
                                    tooltipText={`${course.overdueCount} overdue tasks`}
                                  />
                                )}
                              </div>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="py-6">
        <SidebarMenu>
          {/* User Authentication */}
          <SidebarMenuItem>
            {status === 'loading'
? (
              <SidebarMenuButton disabled className="h-12">
                <Skeleton className="h-6 w-6 rounded-full" />
                <span>Loading...</span>
              </SidebarMenuButton>
            )
: session
? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="group/user-menu h-12 w-full" data-testid={TEST_IDS.shell.authMenuTrigger}>
                    {session.user?.image && (
                      <Image
                        src={session.user.image}
                        alt="Profile"
                        width={24}
                        height={24}
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <span className="truncate">{session.user?.name}</span>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="right"
                  sideOffset={8}
                  className="w-56"
                >
                  <ThemeToggle />
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.PREFERENCES}>
                      <Settings className="mr-2 size-4" />
                      Preferences
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                    onClick={() => signOut()}
                  >
                    <LogOut className="mr-2 size-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
: (
              <SidebarMenuButton onClick={() => signIn()} className="h-12">
                Sign In
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
