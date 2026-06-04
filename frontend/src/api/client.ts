export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${apiBase}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API Error: ${response.status}`);
  }
  return response.json();
}
