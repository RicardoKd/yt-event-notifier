import { useMemo } from 'react';

export function useGroupId(): number | null {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('group_id');
    return id ? parseInt(id, 10) : null;
  }, []);
}
