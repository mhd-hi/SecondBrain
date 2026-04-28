import type { BrowserContext, Route } from '@playwright/test';
import type { TCourseColor } from '@/types/colors';
import type { Daypart } from '@/types/course';
import type { StatusTask } from '@/types/status-task';
import type { TaskType } from '@/types/task';
import { AUTH_SESSION_MAX_AGE_SECONDS } from '@/server/auth/session-contract';
import type { MockDataStore } from './mock-data';
import { MOCK_TERMS } from './mock-data';

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installMockApiRoutes(context: BrowserContext, store: MockDataStore) {
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;
    const method = request.method();

    if (method === 'GET' && pathname === '/api/auth/session') {
      return json(route, 200, {
        user: store.user,
        expires: store.getSessionExpiryIso(AUTH_SESSION_MAX_AGE_SECONDS),
      });
    }

    if (method === 'GET' && pathname === '/api/terms/exists') {
      return json(route, 200, { terms: MOCK_TERMS });
    }

    if (method === 'GET' && pathname === '/api/courses') {
      return json(route, 200, store.getCourseSummaries());
    }

    if (method === 'POST' && pathname === '/api/courses') {
      const body = request.postDataJSON() as {
        code: string;
        name: string;
        term: string;
        daypart: Daypart;
      };

      const result = store.createCourse(body);

      if (result.duplicate) {
        return json(route, 409, {
          error: 'Course already exists',
          course: {
            id: result.duplicate.id,
            code: result.duplicate.code,
            name: result.duplicate.name,
          },
        });
      }

      return json(route, 200, { id: result.course.id });
    }

    if (method === 'GET' && pathname.startsWith('/api/courses/')) {
      const courseId = pathname.split('/')[3];

      if (!courseId) {
        return json(route, 400, { error: 'Course id is required' });
      }

      const course = store.getCourseDetail(courseId);

      if (!course) {
        return json(route, 404, { error: 'Course not found' });
      }

      return json(route, 200, course);
    }

    if (method === 'PATCH' && pathname.startsWith('/api/courses/')) {
      const courseId = pathname.split('/')[3];

      if (!courseId) {
        return json(route, 400, { error: 'Course id is required' });
      }

      const body = request.postDataJSON() as Partial<{
        code: string;
        name: string;
        color: TCourseColor;
        daypart: Daypart;
      }>;

      const updated = store.updateCourse(courseId, body);

      if (!updated) {
        return json(route, 404, { error: 'Course not found or access denied' });
      }

      return json(route, 200, updated);
    }

    if (method === 'DELETE' && pathname.startsWith('/api/courses/')) {
      const courseId = pathname.split('/')[3];

      if (!courseId) {
        return json(route, 400, { error: 'Course id is required' });
      }

      const deleted = store.deleteCourse(courseId);

      if (!deleted) {
        return json(route, 404, { error: 'Course not found or access denied' });
      }

      return json(route, 200, { success: true });
    }

    if (method === 'GET' && pathname === '/api/tasks/focus') {
      return json(route, 200, []);
    }

    if (method === 'GET' && pathname === '/api/tasks') {
      const courseId = searchParams.get('courseId');

      if (!courseId) {
        return json(route, 400, {
          error: 'courseId parameter is required',
          code: 'MISSING_PARAMETER',
        });
      }

      const tasks = store.getTasksForCourse(courseId).map(task => store.buildTaskResponse(task));
      return json(route, 200, tasks);
    }

    if (method === 'POST' && pathname === '/api/tasks') {
      const body = request.postDataJSON() as {
        courseId: string;
        tasks: Array<{
          title: string;
          notes?: string;
          type: TaskType;
          status?: StatusTask;
          estimatedEffort: number;
          dueDate: string;
          subtasks?: Array<{
            id?: string;
            title?: string;
            notes?: string;
          }>;
        }>;
      };

      const course = store.getCourseById(body.courseId);

      if (!course) {
        return json(route, 404, { error: 'Course not found' });
      }

      return json(route, 200, store.createTasks(body.courseId, body.tasks));
    }

    if (method === 'GET' && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
      const taskId = pathname.split('/')[3];

      if (!taskId) {
        return json(route, 400, { error: 'Task id is required' });
      }

      const task = store.getTaskById(taskId);

      if (!task) {
        return json(route, 404, { error: 'Task not found' });
      }

      return json(route, 200, store.buildTaskResponse(task));
    }

    if (method === 'POST' && pathname === '/api/tasks/update') {
      const body = request.postDataJSON() as {
        taskId: string;
        input: 'title' | 'notes' | 'status' | 'estimatedEffort' | 'actualEffort' | 'dueDate' | 'type';
        value: string | number | StatusTask;
      };

      const updated = store.updateTaskField(body.taskId, body.input, body.value);

      if (!updated) {
        return json(route, 404, { error: 'Task not found or access denied' });
      }

      return json(route, 200, updated);
    }

    if (method === 'POST' && pathname === '/api/subtasks/update') {
      const body = request.postDataJSON() as {
        id: string;
        input: 'title' | 'notes';
        value: string;
      };

      const updated = store.updateSubtaskField(body.id, body.input, body.value);

      if (!updated) {
        return json(route, 404, { success: false, error: 'Subtask not found' });
      }

      return json(route, 200, { success: true, updated });
    }

    if (method === 'POST' && /^\/api\/tasks\/[^/]+\/subtasks$/.test(pathname)) {
      const taskId = pathname.split('/')[3];

      if (!taskId) {
        return json(route, 400, { error: 'Task id is required' });
      }

      const body = request.postDataJSON() as {
        id?: string;
        title?: string;
        notes?: string;
      };

      const created = store.createSubtask(taskId, body);

      if (!created) {
        return json(route, 404, { error: 'Task not found or unauthorized' });
      }

      return json(route, 200, created);
    }

    if (method === 'PATCH' && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
      const taskId = pathname.split('/')[3];

      if (!taskId) {
        return json(route, 400, { error: 'Task id is required' });
      }

      const body = request.postDataJSON() as {
        title?: string;
        notes?: string;
        type?: TaskType;
        status?: StatusTask;
        estimatedEffort?: number;
        actualEffort?: number;
        dueDate?: string;
        subtasks?: Array<{
          id?: string;
          title?: string;
          notes?: string;
        }>;
      };

      const updated = store.updateTask(taskId, body);

      if (!updated) {
        return json(route, 404, { error: 'Task not found or access denied' });
      }

      return json(route, 200, updated);
    }

    if (method === 'DELETE' && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
      const taskId = pathname.split('/')[3];

      if (!taskId) {
        return json(route, 400, { error: 'Task id is required' });
      }

      const deleted = store.deleteTask(taskId);

      if (!deleted) {
        return json(route, 404, { error: 'Task not found or access denied' });
      }

      return json(route, 200, { success: true });
    }

    if (method === 'PATCH' && pathname.startsWith('/api/tasks/') && pathname.endsWith('/status')) {
      const taskId = pathname.split('/')[3];
      const body = request.postDataJSON() as { status: StatusTask };

      if (!taskId) {
        return json(route, 400, { error: 'Task id is required' });
      }

      const task = store.updateTaskStatus(taskId, body.status);

      if (!task) {
        return json(route, 404, { error: 'Task not found' });
      }

      return json(route, 200, task);
    }

    if (method === 'DELETE' && /^\/api\/tasks\/[^/]+\/subtasks\/[^/]+$/.test(pathname)) {
      const [, , , taskId, , subtaskId] = pathname.split('/');

      if (!taskId || !subtaskId) {
        return json(route, 400, { error: 'Task id and subtask id are required' });
      }

      const deleted = store.deleteSubtask(taskId, subtaskId);

      if (!deleted) {
        return json(route, 404, { error: 'Subtask not found' });
      }

      return json(route, 200, { success: true });
    }

    if (method === 'GET' && pathname === '/api/custom-links') {
      return json(route, 200, {
        success: true,
        customLinks: [],
      });
    }

    return json(route, 501, {
      error: `Unhandled mocked API request: ${method} ${pathname}`,
    });
  });
}
