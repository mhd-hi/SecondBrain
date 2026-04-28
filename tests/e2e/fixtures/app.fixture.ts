import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_IDS } from '@/lib/testing/selectors';
import { getAddCoursePath } from '@/lib/page-routes';
import { pickCalendarDate } from '../support/calendar-utils';
import { MockDataStore } from '../support/mock-data';
import { installMockApiRoutes } from '../support/mock-routes';
import { selectRadixOption } from '../support/select-utils';
import { installAuthenticatedSession } from '../support/session';
import { createE2ETestUser } from '../support/test-user';

const SCHOOL_LABELS = {
  none: 'None',
  ets: 'ÉTS - École de technologie supérieure',
} as const;

const DAYPART_LABELS = {
  AM: 'AM',
  PM: 'PM',
  EVEN: 'Evening',
} as const;

const TASK_TYPE_VALUES = new Set(['theorie', 'pratique', 'exam', 'homework', 'lab']);

export type AppFixture = {
  dashboard: {
    goto: () => Promise<void>;
    gotoAddCourse: () => Promise<void>;
  };
  addCoursePage: {
    create: (options: {
      code: string;
      name: string;
      school: keyof typeof SCHOOL_LABELS;
      daypart: keyof typeof DAYPART_LABELS;
      firstDayOfClass?: Date;
      userContext?: string;
    }) => Promise<void>;
    goToCreatedCourse: () => Promise<void>;
  };
  coursePage: {
    addTask: (options: {
      title: string;
      notes?: string;
      type?: 'theorie' | 'pratique' | 'exam' | 'homework' | 'lab';
      dueDate?: Date;
      estimatedEffort?: number;
    }) => Promise<void>;
    searchTasks: (query: string) => Promise<void>;
    changeTaskStatus: (title: string, statusLabel: string) => Promise<void>;
    editCourse: (options: { name: string; code: string }) => Promise<void>;
    deleteCourse: () => Promise<void>;
    goTo: (courseId: string) => Promise<void>;
    assertOnCoursePage: (courseName: string) => Promise<void>;
    taskCard: (title: string) => import('@playwright/test').Locator;
    createTask: (task: { title: string; notes: string; dueDate: Date }) => Promise<void>;
  };
  taskPage: {
    assertOnTaskPage: (taskTitle: string) => Promise<void>;
    editTask: (task: { title: string; notes: string; dueDate: Date }) => Promise<void>;
    deleteTask: () => Promise<void>;
    createSubtask: (title: string) => Promise<void>;
    completeSubtask: (title: string) => Promise<void>;
    deleteSubtask: (title: string) => Promise<void>;
    subtask: (title: string) => import('@playwright/test').Locator;
  };
};

function getTaskCard(page: Page, title: string) {
  return page.getByTestId(TEST_IDS.task.card).filter({
    has: page.getByText(title, { exact: true }),
  }).first();
}

export async function createAppFixture({
  page,
  context,
  seed,
}: {
  page: Page;
  context: BrowserContext;
  seed: string;
}): Promise<AppFixture> {
  const user = createE2ETestUser(seed);
  const store = new MockDataStore({ seed, user });

  await installMockApiRoutes(context, store);
  await installAuthenticatedSession(context, user);

  return {
    dashboard: {
      goto: async () => {
        await page.goto('/');

        await expect(page.getByTestId(TEST_IDS.dashboard.page)).toBeVisible();
      },
      gotoAddCourse: async () => {
        await page.goto(getAddCoursePath());

        await expect(page.getByTestId(TEST_IDS.addCourse.page)).toBeVisible();
      },
    },
    addCoursePage: {
      create: async ({
        code,
        school,
        daypart,
        firstDayOfClass,
        userContext,
      }) => {
        await expect(page.getByTestId(TEST_IDS.addCourse.page)).toBeVisible();

        const termTrigger = page.getByTestId(TEST_IDS.addCourse.termTrigger);

        await expect(termTrigger).toBeVisible();
        await expect(termTrigger).not.toContainText('Select term');

        await page.getByTestId(TEST_IDS.addCourse.courseCodeInput).fill(code);
        await selectRadixOption(
          page,
          page.getByTestId(TEST_IDS.addCourse.schoolTrigger),
          SCHOOL_LABELS[school],
        );
        await selectRadixOption(
          page,
          page.getByTestId(TEST_IDS.addCourse.daypartTrigger),
          DAYPART_LABELS[daypart],
        );

        if (firstDayOfClass) {
          await pickCalendarDate(
            page.getByTestId(TEST_IDS.addCourse.firstDayTrigger),
            page.getByTestId(TEST_IDS.addCourse.firstDayCalendar),
            firstDayOfClass,
          );
        }

        if (userContext) {
          await page.getByTestId(TEST_IDS.addCourse.additionalInfoToggle).click();
          await page.getByTestId(TEST_IDS.addCourse.userContextInput).fill(userContext);
        }

        await page.getByTestId(TEST_IDS.addCourse.submitButton).click();

        await expect(page.getByTestId(TEST_IDS.addCourse.successAlert)).toBeVisible();
      },
      goToCreatedCourse: async () => {
        await expect(page.getByTestId(TEST_IDS.addCourse.successAlert)).toBeVisible();

        await page.getByTestId(TEST_IDS.addCourse.goToCourseButton).click();

        await expect(page.getByTestId(TEST_IDS.coursePage.page)).toBeVisible();
      },
    },
    coursePage: {
      goTo: async (courseId: string) => {
        await page.goto(`/courses/${courseId}`);
      },
      assertOnCoursePage: async (courseName: string) => {
        await expect(
          page.getByRole('heading', { name: courseName }),
        ).toBeVisible();
      },
      taskCard: (title: string) => {
        return page.getByRole('link', { name: title });
      },
      createTask: async (task: { title: string; notes: string; dueDate: Date }) => {
        await page.getByRole('button', { name: 'Add Task' }).click();
        await page.getByLabel('Title').fill(task.title);
        await page.getByLabel('Notes').fill(task.notes);
        await page.getByLabel('Due Date').fill(task.dueDate.toISOString().slice(0, 10));
        await page.getByRole('button', { name: 'Create' }).click();
      },
      editCourse: async ({ name, code }) => {
        await page.getByRole('button', { name: 'Actions' }).click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();
        await page.getByLabel('Name').fill(name);
        await page.getByLabel('Code').fill(code);
        await page.getByRole('button', { name: 'Save' }).click();
      },
      deleteCourse: async () => {
        await page.getByRole('button', { name: 'Actions' }).click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Confirm' }).click();
      },
      addTask: async ({ title, notes, type, dueDate, estimatedEffort }) => {
        await expect(page.getByTestId(TEST_IDS.coursePage.page)).toBeVisible();

        await page.getByTestId(TEST_IDS.coursePage.addTaskButton).click();

        const dialog = page.getByTestId(TEST_IDS.addTaskDialog.dialog);

        await expect(dialog).toBeVisible();

        await page.getByTestId(TEST_IDS.addTaskDialog.titleInput).fill(title);

        if (notes) {
          await page.getByTestId(TEST_IDS.addTaskDialog.notesInput).fill(notes);
        }

        if (type && TASK_TYPE_VALUES.has(type)) {
          await page.getByTestId(TEST_IDS.addTaskDialog.typeSelect).selectOption(type);
        }

        if (dueDate) {
          await pickCalendarDate(
            page.getByTestId(TEST_IDS.addTaskDialog.dueDateTrigger),
            page.getByTestId(TEST_IDS.addTaskDialog.dueDateCalendar),
            dueDate,
          );
        }

        if (estimatedEffort !== undefined) {
          const estimatedEffortInput = page.getByTestId(TEST_IDS.addTaskDialog.estimatedEffortInput);
          await estimatedEffortInput.fill('');
          await estimatedEffortInput.fill(String(estimatedEffort));
        }

        await page.getByTestId(TEST_IDS.addTaskDialog.submitButton).click();

        await expect(dialog).toBeHidden();
        await expect(getTaskCard(page, title)).toBeVisible();
      },
      searchTasks: async (query: string) => {
        const searchInput = page.getByTestId(TEST_IDS.coursePage.searchInput);

        await searchInput.fill(query);

        await expect(searchInput).toHaveValue(query);
      },
      changeTaskStatus: async (title: string, statusLabel: string) => {
        const taskCard = getTaskCard(page, title);

        await expect(taskCard).toBeVisible();

        await taskCard.getByTestId(TEST_IDS.task.statusTrigger).click();
        await page.getByRole('menuitem', { name: statusLabel, exact: true }).click();

        await expect(taskCard.getByTestId(TEST_IDS.task.statusTrigger)).toContainText(statusLabel);
      },
    },
    taskPage: {
      assertOnTaskPage: async (taskTitle: string) => {
        await expect(
          page.getByRole('heading', { name: taskTitle }),
        ).toBeVisible();
      },
      editTask: async (task: { title: string; notes: string; dueDate: Date }) => {
        await page.getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('Title').fill(task.title);
        await page.getByLabel('Notes').fill(task.notes);
        await page.getByLabel('Due Date').fill(task.dueDate.toISOString().slice(0, 10));
        await page.getByRole('button', { name: 'Save' }).click();
      },
      deleteTask: async () => {
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Confirm' }).click();
      },
      createSubtask: async (title: string) => {
        await page.getByPlaceholder('Add subtask...').fill(title);
        await page.getByRole('button', { name: 'Add' }).click();
      },
      completeSubtask: async (title: string) => {
        await page.getByTestId(`subtask-${title}`).getByRole('checkbox').check();
      },
      deleteSubtask: async (title: string) => {
        await page.getByTestId(`subtask-${title}`).getByRole('button', { name: 'Delete' }).click();
      },
      subtask: (title: string) => {
        return page.getByTestId(`subtask-${title}`);
      },
    },
  };
}
