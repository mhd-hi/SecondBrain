export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export function isPendingFetchStatus(status: FetchStatus) {
  return status === 'idle' || status === 'loading';
}

export function getFetchStatusForKey(
  statuses: ReadonlyMap<string, FetchStatus>,
  key: string,
): FetchStatus {
  return statuses.get(key) ?? 'idle';
}

export function setFetchStatusForKey(
  statuses: ReadonlyMap<string, FetchStatus>,
  key: string,
  status: FetchStatus,
) {
  const nextStatuses = new Map(statuses);
  nextStatuses.set(key, status);
  return nextStatuses;
}
