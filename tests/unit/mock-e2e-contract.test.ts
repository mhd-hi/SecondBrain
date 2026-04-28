import { beforeEach, describe, expect, it } from 'vitest';
import { MockDataStore } from '../e2e/support/mock-data';
import { installMockApiRoutes } from '../e2e/support/mock-routes';
import { createE2ETestUser } from '../e2e/support/test-user';

function createStore(seed = 'mock-contract-test') {
  return new MockDataStore({
    seed,
    user: createE2ETestUser(seed),
  });
}

type MockRequestInit = {
  method: string;
  url: string;
  body?: unknown;
};

type MockFulfilledResponse = {
  status: number;
  contentType: string;
  body: string;
};

type MockRoute = {
  request: () => {
    method: () => string;
    url: () => string;
    postDataJSON: () => unknown;
  };
  fulfill: (response: MockFulfilledResponse) => Promise<undefined>;
  getFulfilled: () => MockFulfilledResponse | null;
};

type MockApiHandler = (route: MockRoute) => Promise<unknown>;

function createMockRoute({ method, url, body }: MockRequestInit): MockRoute {
  let fulfilled: { status: number; contentType: string; body: string } | null = null;

  return {
    request() {
      return {
        method: () => method,
        url: () => url,
        postDataJSON: () => body,
      };
    },
    async fulfill(response: { status: number; contentType: string; body: string }) {
      fulfilled = response;
      return undefined;
    },
    getFulfilled() {
      return fulfilled;
    },
  };
}

async function createApiHandler(store: MockDataStore): Promise<MockApiHandler> {
  let handler: MockApiHandler | null = null;

  const context = {
    route: async (_matcher: string, nextHandler: MockApiHandler) => {
      handler = nextHandler;
    },
  };

  await installMockApiRoutes(context as never, store);

  if (!handler) {
    throw new Error('Mock API handler was not registered');
  }

  return handler;
}

describe('e2e mock data contract', () => {
  let store: MockDataStore;

  beforeEach(() => {
    store = createStore();
  });

  it('creates, updates, and deletes subtasks on the parent task', () => {
    const course = store.createCourse({
      code: 'LOG430',
      name: 'Testing',
      term: '20261',
      daypart: 'PM',
    }).course;

    if (!course) {
      throw new Error('Course creation failed in test setup');
    }

    const createdTask = store.createTask(course.id, {
      title: 'Prepare demo',
      type: 'homework',
      dueDate: '2026-04-23T12:00:00.000Z',
    });

    if (!createdTask) {
      throw new Error('Task creation failed in test setup');
    }

    const createdSubtask = store.createSubtask(createdTask.id, {
      title: 'Draft outline',
      notes: 'Initial note',
    });

    expect(createdSubtask).toMatchObject({
      title: 'Draft outline',
      notes: 'Initial note',
    });

    const updatedSubtask = store.updateSubtaskField(createdSubtask!.id, 'notes', 'Updated note');

    expect(updatedSubtask).toMatchObject({
      id: createdSubtask!.id,
      notes: 'Updated note',
    });
    expect(store.getTaskById(createdTask.id)?.subtasks).toEqual([
      {
        id: createdSubtask!.id,
        title: 'Draft outline',
        notes: 'Updated note',
      },
    ]);

    expect(store.deleteSubtask(createdTask.id, createdSubtask!.id)).toBe(true);
    expect(store.getTaskById(createdTask.id)?.subtasks).toEqual([]);
  });

  it('filters tasks by course and returns them sorted by due date', () => {
    const firstCourse = store.createCourse({
      code: 'LOG100',
      name: 'First',
      term: '20261',
      daypart: 'AM',
    }).course;
    const secondCourse = store.createCourse({
      code: 'LOG200',
      name: 'Second',
      term: '20261',
      daypart: 'PM',
    }).course;

    if (!firstCourse || !secondCourse) {
      throw new Error('Course creation failed in test setup');
    }

    store.createTask(firstCourse.id, {
      title: 'Later task',
      type: 'homework',
      dueDate: '2026-05-10T12:00:00.000Z',
    });
    store.createTask(firstCourse.id, {
      title: 'Sooner task',
      type: 'homework',
      dueDate: '2026-04-24T12:00:00.000Z',
    });
    store.createTask(secondCourse.id, {
      title: 'Other course task',
      type: 'homework',
      dueDate: '2026-04-20T12:00:00.000Z',
    });

    const tasks = store.getTasksForCourse(firstCourse.id);

    expect(tasks.map(task => task.title)).toEqual(['Sooner task', 'Later task']);
    expect(tasks.every(task => task.courseId === firstCourse.id)).toBe(true);
  });
});

describe('e2e mock route contract', () => {
  it('returns 404 when creating a subtask for an unknown task', async () => {
    const handler = await createApiHandler(createStore('unknown-task'));
    const route = createMockRoute({
      method: 'POST',
      url: 'http://localhost/api/tasks/missing-task/subtasks',
      body: { title: 'Draft outline', notes: 'Initial note' },
    });

    await handler(route);

    expect(route.getFulfilled()).toMatchObject({
      status: 404,
    });
    expect(JSON.parse(route.getFulfilled()!.body)).toEqual({
      error: 'Task not found or unauthorized',
    });
  });

  it('returns 404 when deleting a missing subtask from an existing task', async () => {
    const store = createStore('missing-subtask');
    const course = store.createCourse({
      code: 'LOG430',
      name: 'Testing',
      term: '20261',
      daypart: 'PM',
    }).course;

    if (!course) {
      throw new Error('Course creation failed in test setup');
    }

    const task = store.createTask(course.id, {
      title: 'Prepare demo',
      type: 'homework',
      dueDate: '2026-04-23T12:00:00.000Z',
    });

    if (!task) {
      throw new Error('Task creation failed in test setup');
    }

    const handler = await createApiHandler(store);
    const route = createMockRoute({
      method: 'DELETE',
      url: `http://localhost/api/tasks/${task.id}/subtasks/missing-subtask`,
    });

    await handler(route);

    expect(route.getFulfilled()).toMatchObject({
      status: 404,
    });
    expect(JSON.parse(route.getFulfilled()!.body)).toEqual({
      error: 'Subtask not found',
    });
  });

  it('returns 400 when the tasks route is requested without a courseId filter', async () => {
    const handler = await createApiHandler(createStore('missing-course-id'));
    const route = createMockRoute({
      method: 'GET',
      url: 'http://localhost/api/tasks',
    });

    await handler(route);

    expect(route.getFulfilled()).toMatchObject({
      status: 400,
    });
    expect(JSON.parse(route.getFulfilled()!.body)).toEqual({
      error: 'courseId parameter is required',
      code: 'MISSING_PARAMETER',
    });
  });
});
