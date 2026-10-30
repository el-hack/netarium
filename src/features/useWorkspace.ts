import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib';
import { navigation, type Page } from '../navigation';
export function useResource<T>(path: string, simulated?: T) {
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key: '', data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => {
    setRevision((n) => n + 1);
  }, []);
  useEffect(() => {
    if (simulated) {
      setState({ key: 'simulation', data: simulated, error: '', loading: false });
      return;
    }
    let active = true;
    let pending = false;
    const controller = new AbortController();
    // A refresh must not unmount forms, dismiss feedback or discard unsaved edits.
    setState((previous) =>
      previous.key === path
        ? { ...previous, loading: true }
        : { key: path, data: null, error: '', loading: true },
    );
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const data = await api<T>(path, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
        });
        if (active) setState({ key: path, data, error: '', loading: false });
      } catch (e) {
        if (active) setState((s) => ({ ...s, error: (e as Error).message, loading: false }));
      } finally {
        pending = false;
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [path, revision, simulated]);
  if (simulated) return { data: simulated, error: '', loading: false, refresh };
  return { ...state, data: state.key === path ? state.data : null, refresh };
}
export function useNavigation() {
  const read = () => new URLSearchParams(location.hash.slice(1));
  const [params, setParams] = useState(read);
  useEffect(() => {
    const update = () => setParams(read());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const navigate = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(location.hash.slice(1));
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    location.hash = next.toString();
    setParams(next);
  }, []);
  const candidate = params.get('page');
  const page: Page = navigation.some((p) => p.id === candidate) ? (candidate as Page) : 'overview';
  return { page, params, navigate };
}
