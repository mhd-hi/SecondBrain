'use client';

import { ErrorHandlers } from '@/lib/utils/errors/error';

const validateApiResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
  }
  return response.json() as Promise<T>;
};

const apiRequest = async <T>(
  url: string,
  options: RequestInit = {},
  errorMessage = 'Request failed',
): Promise<T> => {
  try {
    const response = await fetch(url, options);
    return await validateApiResponse<T>(response);
  } catch (error) {
    console.error('API request to', url, 'failed:', error);
    // Use the consolidated error handler instead of direct toast
    ErrorHandlers.api(error, errorMessage);
    throw error;
  }
};

/**
 * Common HTTP methods with error handling
 */
export const api = {
  get: <T>(url: string, errorMessage?: string) =>
    apiRequest<T>(url, { method: 'GET' }, errorMessage),

  post: <T>(url: string, data?: unknown, errorMessage?: string) =>
    apiRequest<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }, errorMessage),

  put: <T>(url: string, data?: unknown, errorMessage?: string) =>
    apiRequest<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }, errorMessage),

  delete: <T>(url: string, errorMessage?: string) =>
    apiRequest<T>(url, { method: 'DELETE' }, errorMessage),

  patch: <T>(url: string, data?: unknown, errorMessage?: string) =>
    apiRequest<T>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }, errorMessage),
};
