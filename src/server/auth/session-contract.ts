export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function getAuthSessionCookieName(baseURL: string) {
  return new URL(baseURL).protocol === 'https:'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}
