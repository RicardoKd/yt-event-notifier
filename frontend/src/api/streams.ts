import { apiFetch } from './client';
import type { Stream } from '../types';

export function listStreams(groupId: number): Promise<Stream[]> {
  return apiFetch<Stream[]>(`/group/${groupId}/streams`);
}
