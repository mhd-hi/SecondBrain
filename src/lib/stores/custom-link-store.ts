import type { FetchStatus } from './fetch-status';
import type { CustomLink, CustomLinkItem } from '@/types/custom-link';
import { create } from 'zustand';
import { api } from '@/lib/utils/api/api-client-util';
import { API_ENDPOINTS } from '@/lib/utils/api/endpoints';
import { ErrorHandlers } from '@/lib/utils/errors/error';
import {
  getFetchStatusForKey,
  setFetchStatusForKey,
} from './fetch-status';

function replaceCustomLinksForCourse(
  existingLinks: ReadonlyMap<string, CustomLinkItem>,
  courseId: string,
  customLinks: CustomLinkItem[],
) {
  const nextLinks = new Map(existingLinks);

  for (const [linkId, link] of nextLinks.entries()) {
    if (link.courseId === courseId) {
      nextLinks.delete(linkId);
    }
  }

  for (const customLink of customLinks) {
    nextLinks.set(customLink.id, customLink);
  }

  return nextLinks;
}

type CustomLinkStore = {
  customLinks: Map<string, CustomLinkItem>;
  fetchStatusByCourse: Map<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;

  setCustomLinks: (customLinks: CustomLinkItem[]) => void;
  addCustomLink: (customLink: CustomLinkItem) => void;
  updateCustomLink: (customLinkId: string, updates: Partial<CustomLinkItem>) => void;
  removeLocalCustomLink: (customLinkId: string) => void;

  getCustomLink: (customLinkId: string) => CustomLinkItem | undefined;
  getCustomLinksByCourse: (courseId: string) => CustomLinkItem[];
  getAllCustomLinks: () => CustomLinkItem[];
  getFetchStatusByCourse: (courseId: string) => FetchStatus;

  fetchCustomLinksByCourse: (courseId: string) => Promise<CustomLinkItem[]>;
  createCustomLink: (data: {
    title: string;
    url: string;
    type?: CustomLink;
    courseId?: string | null;
  }) => Promise<CustomLinkItem>;
  removeCustomLink: (customLinkId: string) => Promise<boolean>;

  clearError: () => void;
  reset: () => void;
};

export const useCustomLinkStore = create<CustomLinkStore>((set, get) => ({
  customLinks: new Map(),
  fetchStatusByCourse: new Map(),
  isLoading: false,
  error: null,

  setCustomLinks: (customLinks) => {
    const customLinkMap = new Map<string, CustomLinkItem>();
    for (const customLink of customLinks) {
      customLinkMap.set(customLink.id, customLink);
    }
    set({ customLinks: customLinkMap });
  },

  addCustomLink: (customLink) => {
    set((state) => {
      const newCustomLinks = new Map(state.customLinks);
      newCustomLinks.set(customLink.id, customLink);
      return { customLinks: newCustomLinks };
    });
  },

  updateCustomLink: (customLinkId, updates) => {
    set((state) => {
      const newCustomLinks = new Map(state.customLinks);
      const existingCustomLink = newCustomLinks.get(customLinkId);
      if (existingCustomLink) {
        newCustomLinks.set(customLinkId, { ...existingCustomLink, ...updates });
      }
      return { customLinks: newCustomLinks };
    });
  },

  removeLocalCustomLink: (customLinkId) => {
    set((state) => {
      const newCustomLinks = new Map(state.customLinks);
      newCustomLinks.delete(customLinkId);
      return { customLinks: newCustomLinks };
    });
  },

  getCustomLink: (customLinkId) => {
    return get().customLinks.get(customLinkId);
  },

  getCustomLinksByCourse: (courseId) => {
    return Array.from(get().customLinks.values()).filter(link => link.courseId === courseId);
  },

  getAllCustomLinks: () => {
    return Array.from(get().customLinks.values());
  },

  getFetchStatusByCourse: (courseId) => {
    return getFetchStatusForKey(get().fetchStatusByCourse, courseId);
  },

  fetchCustomLinksByCourse: async (courseId) => {
    set(state => ({
      isLoading: true,
      error: null,
      fetchStatusByCourse: setFetchStatusForKey(state.fetchStatusByCourse, courseId, 'loading'),
    }));
    try {
      const response = await api.get<{ success: boolean; customLinks: CustomLinkItem[] }>(API_ENDPOINTS.CUSTOM_LINKS.BY_COURSE(courseId));
      const customLinks = response.customLinks ?? [];
      set(state => ({
        customLinks: replaceCustomLinksForCourse(state.customLinks, courseId, customLinks),
        isLoading: false,
        fetchStatusByCourse: setFetchStatusForKey(state.fetchStatusByCourse, courseId, 'success'),
      }));
      return customLinks;
    } catch (error) {
      const errorMessage = 'Failed to fetch custom links';
      set(state => ({
        isLoading: false,
        error: errorMessage,
        fetchStatusByCourse: setFetchStatusForKey(state.fetchStatusByCourse, courseId, 'error'),
      }));
      ErrorHandlers.silent(error, 'CustomLinkStore fetchCustomLinksByCourse');
      return [];
    }
  },

  createCustomLink: async (data) => {
    const payload = {
      title: data.title,
      url: data.url,
      type: data.type ?? 'custom',
      courseId: data.courseId ?? null,
    };

    // Optimistic update
    const tempId = `temp-link-${Date.now()}`;
    const optimisticLink: CustomLinkItem = {
      id: tempId,
      url: data.url,
      title: data.title,
      type: data.type ?? 'custom',
      courseId: data.courseId,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    get().addCustomLink(optimisticLink);

    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ success: boolean; customLink: CustomLinkItem }>(API_ENDPOINTS.CUSTOM_LINKS.LIST, payload);
      const customLink = response.customLink;

      // Replace optimistic with real
      get().removeLocalCustomLink(tempId);
      get().addCustomLink(customLink);

      set({ isLoading: false });
      return customLink;
    } catch (error) {
      // Rollback optimistic update
      get().removeLocalCustomLink(tempId);

      const errorMessage = 'Failed to create custom link';
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.api(error, errorMessage);
      throw error;
    }
  },

  removeCustomLink: async (customLinkId) => {
    // Store original for rollback
    const originalCustomLink = get().getCustomLink(customLinkId);
    if (!originalCustomLink) {
      return false;
    }

    // Optimistic delete
    get().removeLocalCustomLink(customLinkId);

    set({ isLoading: true, error: null });
    try {
      await api.delete(API_ENDPOINTS.CUSTOM_LINKS.DETAIL(customLinkId));
      set({ isLoading: false });
      return true;
    } catch (error) {
      // Rollback
      get().addCustomLink(originalCustomLink);

      const errorMessage = 'Failed to delete custom link';
      set({ isLoading: false, error: errorMessage });
      ErrorHandlers.api(error, errorMessage);
      return false;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    customLinks: new Map(),
    fetchStatusByCourse: new Map(),
    isLoading: false,
    error: null,
  }),
}));
