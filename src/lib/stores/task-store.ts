import type { FetchStatus } from './helpers/fetch-status';
import type { StatusTask } from '@/types/status-task';
import type { Subtask } from '@/types/subtask';
import type { Task, TaskType } from '@/types/task';
import { toast } from 'sonner';
import { create } from 'zustand';
import { invalidateCalendarEvents } from '@/lib/stores/calendar-view-store';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { CommonErrorMessages, ErrorHandlers } from '@/lib/utils/errors/error';
import {
  getFetchStatusForKey,
  setFetchStatusForKey,
} from './helpers/fetch-status';

function replaceTasksForCourse(
  existingTasks: ReadonlyMap<string, Task>,
  courseId: string,
  tasks: Task[],
) {
  const nextTasks = new Map(existingTasks);

  for (const [taskId, task] of nextTasks.entries()) {
    if (task.courseId === courseId) {
      nextTasks.delete(taskId);
    }
  }

  for (const task of tasks) {
    nextTasks.set(task.id, task);
  }

  return nextTasks;
}

type TaskStore = {
  tasks: Map<string, Task>;
  fetchStatusByCourse: Map<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;

  setTasks: (tasks: Task[]) => void;
  upsertTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;

  addSubtask: (taskId: string, subtask: Subtask) => void;
  updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;

  getTask: (taskId: string) => Task | undefined;
  getTasksByCourse: (courseId: string) => Task[];
  getTasksByStatus: (status: StatusTask) => Task[];
  getTasksByDateRange: (startDate: Date, endDate: Date) => Task[];
  getAllTasks: () => Task[];
  getFetchStatusByCourse: (courseId: string) => FetchStatus;

  fetchTask: (taskId: string) => Promise<Task | null>;
  fetchTasksByCourse: (courseId: string) => Promise<Task[]>;
  createTask: (courseId: string, newTask: {
    title: string;
    notes: string;
    estimatedEffort: number;
    dueDate: Date;
    type: TaskType;
    status: StatusTask;
  }) => Promise<boolean>;
  removeTask: (taskId: string) => Promise<boolean>;

  clearError: () => void;
  reset: () => void;
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: new Map(),
  fetchStatusByCourse: new Map(),
  isLoading: false,
  error: null,

  setTasks: (tasks) => {
    const taskMap = new Map<string, Task>();
    for (const task of tasks) {
      taskMap.set(task.id, task);
    }
    set({ tasks: taskMap });
  },

  upsertTasks: (tasks) => {
    set((state) => {
      const nextTasks = new Map(state.tasks);
      for (const task of tasks) {
        nextTasks.set(task.id, task);
      }
      return { tasks: nextTasks };
    });
  },

  addTask: (task) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.set(task.id, task);
      return { tasks: newTasks };
    });
  },

  updateTask: (taskId, updates) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      const existingTask = newTasks.get(taskId);
      if (existingTask) {
        newTasks.set(taskId, { ...existingTask, ...updates });
      }
      return { tasks: newTasks };
    });
  },

  deleteTask: (taskId) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      newTasks.delete(taskId);
      return { tasks: newTasks };
    });
  },

  addSubtask: (taskId, subtask) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      const task = newTasks.get(taskId);
      if (task) {
        const updatedTask = {
          ...task,
          subtasks: [...(task.subtasks || []), subtask],
        };
        newTasks.set(taskId, updatedTask);
      }
      return { tasks: newTasks };
    });
  },

  updateSubtask: (taskId, subtaskId, updates) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      const task = newTasks.get(taskId);
      if (task && task.subtasks) {
        const updatedSubtasks = task.subtasks.map(sub =>
          sub.id === subtaskId ? { ...sub, ...updates } : sub,
        );
        newTasks.set(taskId, { ...task, subtasks: updatedSubtasks });
      }
      return { tasks: newTasks };
    });
  },

  deleteSubtask: (taskId, subtaskId) => {
    set((state) => {
      const newTasks = new Map(state.tasks);
      const task = newTasks.get(taskId);
      if (task && task.subtasks) {
        const updatedSubtasks = task.subtasks.filter(sub => sub.id !== subtaskId);
        newTasks.set(taskId, { ...task, subtasks: updatedSubtasks });
      }
      return { tasks: newTasks };
    });
  },

  getTask: (taskId) => {
    return get().tasks.get(taskId);
  },

  getTasksByCourse: (courseId) => {
    return Array.from(get().tasks.values()).filter(task => task.courseId === courseId);
  },

  getTasksByStatus: (status) => {
    return Array.from(get().tasks.values()).filter(task => task.status === status);
  },

  getTasksByDateRange: (startDate, endDate) => {
    return Array.from(get().tasks.values()).filter((task) => {
      const taskDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      return taskDate >= startDate && taskDate <= endDate;
    });
  },

  getAllTasks: () => {
    return Array.from(get().tasks.values());
  },

  getFetchStatusByCourse: (courseId) => {
    return getFetchStatusForKey(get().fetchStatusByCourse, courseId);
  },

  fetchTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      const task = await api.get<Task>(
        API_ENDPOINTS.TASKS.DETAIL(taskId),
        CommonErrorMessages.TASK_FETCH_FAILED,
      );
      get().addTask(task);
      set({ isLoading: false });
      return task;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : CommonErrorMessages.TASK_FETCH_FAILED;
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.silent(error, 'TaskStore fetchTask');
      return null;
    }
  },

  fetchTasksByCourse: async (courseId) => {
    set(state => ({
      isLoading: true,
      error: null,
      fetchStatusByCourse: setFetchStatusForKey(state.fetchStatusByCourse, courseId, 'loading'),
    }));
    try {
      const tasks = await api.get<Task[]>(
        API_ENDPOINTS.TASKS.LIST_BY_COURSE(courseId),
        CommonErrorMessages.TASKS_FETCH_FAILED,
      );
      set(state => ({
        tasks: replaceTasksForCourse(state.tasks, courseId, tasks),
        isLoading: false,
        fetchStatusByCourse: setFetchStatusForKey(state.fetchStatusByCourse, courseId, 'success'),
      }));
      return tasks;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : CommonErrorMessages.TASKS_FETCH_FAILED;
      set(state => ({
        isLoading: false,
        error: errorMessage,
        fetchStatusByCourse: setFetchStatusForKey(state.fetchStatusByCourse, courseId, 'error'),
      }));
      ErrorHandlers.silent(error, 'TaskStore fetchTasksByCourse');
      return [];
    }
  },

  createTask: async (courseId, newTask) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(API_ENDPOINTS.TASKS.LIST, {
        courseId,
        tasks: [
          {
            ...newTask,
            dueDate: newTask.dueDate.toISOString(),
          },
        ],
      });

      // If the API returns the created task, add it to the store
      if (response && Array.isArray(response) && response.length > 0) {
        get().addTask(response[0] as Task);
      }

      invalidateCalendarEvents();
      set({ isLoading: false });
      return true;
    } catch (error) {
      const errorMessage = 'Failed to add task';
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.silent(error, 'TaskStore createTask');
      return false;
    }
  },

  removeTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(API_ENDPOINTS.TASKS.DETAIL(taskId), 'Failed to delete task');

      // Remove from store
      get().deleteTask(taskId);

      invalidateCalendarEvents();
      toast.success('Task deleted successfully');
      set({ isLoading: false });
      return true;
    } catch (error) {
      const errorMessage = 'Failed to delete task';
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.silent(error, 'TaskStore removeTask');
      return false;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    tasks: new Map(),
    fetchStatusByCourse: new Map(),
    isLoading: false,
    error: null,
  }),
}));
