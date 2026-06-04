import { apiFetch } from './client';
import type { Group } from '../types';

export function getGroup(groupId: number): Promise<Group> {
  return apiFetch<Group>(`/group/${groupId}`);
}

export function patchGroup(groupId: number, data: Partial<Group>): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/group/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
