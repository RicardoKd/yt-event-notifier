import { apiFetch } from './client';

export function getAuthUrl(groupId: number): Promise<{url: string}> {
  return apiFetch<{url: string}>(`/group/${groupId}/youtube/auth-url`);
}

export function disconnectYoutube(groupId: number): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/group/${groupId}/youtube`, {
    method: 'DELETE',
  });
}
