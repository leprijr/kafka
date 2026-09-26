import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, User } from './api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { user } = await api('/api/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('kafka_token')) refresh();
    else setLoading(false);
  }, []);

  const login = async (login: string, password: string) => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
