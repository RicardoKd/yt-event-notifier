import { apiFetch } from './client';

export function triggerCheck(groupId: number): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/group/${groupId}/check`, {
    method: 'POST',
  });
}
