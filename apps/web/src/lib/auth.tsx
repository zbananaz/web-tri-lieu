'use client';

import type { AuthUser, LoginInput, RegisterInput, Role } from '@wtl/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api } from './api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Trang mac dinh sau khi dang nhap theo vai tro. */
export const HOME_BY_ROLE: Record<Role, string> = { client: '/me', expert: '/expert', admin: '/admin' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api<{ user: AuthUser }>('/auth/me')
      .then((r) => alive && setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const r = await api<{ user: AuthUser }>('/auth/login', { body: input });
    setUser(r.user);
    return r.user;
  }, []);
  const register = useCallback(async (input: RegisterInput) => {
    const r = await api<{ user: AuthUser }>('/auth/register', { body: input });
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth phai nam trong AuthProvider');
  return v;
}
