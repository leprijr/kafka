const TOKEN_KEY = 'kafka_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export type Role = 'ADMIN' | 'GESTOR' | 'USUARIO';
export interface User {
  id: number;
  name: string;
  login: string;
  role: Role;
  manager_id: number | null;
  active: boolean;
}
