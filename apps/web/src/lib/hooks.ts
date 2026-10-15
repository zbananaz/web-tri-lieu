'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';

export interface Query<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Tai du lieu GET; path = null thi tam dung (vd. chua co id). */
export function useQuery<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null); // path da tai xong (thanh cong hoac loi)
  const seq = useRef({ n: 0 });

  const load = useCallback(async () => {
    if (path === null) return;
    const counter = seq.current;
    const mine = ++counter.n;
    try {
      const r = await api<T>(path);
      if (mine === counter.n) {
        setData(r);
        setError(null);
      }
    } catch (e) {
      if (mine === counter.n) setError(errorMessage(e));
    } finally {
      if (mine === counter.n) setSettled(path);
    }
  }, [path]);

  useEffect(() => {
    const counter = seq.current;
    const t = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(t);
      counter.n++;
    };
  }, [load]);

  // Dang chuyen sang path moi thi khong de lo du lieu cua path cu (vd. nut thao tac cua ho so truoc)
  const current = settled === path;
  return { data: current ? data : null, error: current ? error : null, loading: path !== null && !current, reload: load };
}

/** Chay mot thao tac ghi, theo doi dang chay/loi. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        setError(errorMessage(e));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [fn],
  );
  return { run, busy, error, clearError: () => setError(null) };
}
