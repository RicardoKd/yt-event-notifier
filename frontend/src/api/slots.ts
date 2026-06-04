import { apiFetch } from './client';
import type { Slot } from '../types';

export function listSlots(groupId: number): Promise<Slot[]> {
  return apiFetch<Slot[]>(`/group/${groupId}/slots`);
}

export function addSlot(groupId: number, data: {day_of_week: number, local_time: string, title_template: string}): Promise<{slot_id: number}> {
  return apiFetch<{slot_id: number}>(`/group/${groupId}/slots`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function removeSlot(groupId: number, slotId: number): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/group/${groupId}/slots/${slotId}`, {
    method: 'DELETE',
  });
}

export function updateSlot(groupId: number, slotId: number, data: Partial<Slot>): Promise<{status: string}> {
  return apiFetch<{status: string}>(`/group/${groupId}/slots/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
