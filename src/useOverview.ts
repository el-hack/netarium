import { useCallback, useEffect, useRef, useState } from 'react';
import type { Overview } from '../shared/types';
import { api } from './lib';
export function useOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await api<Overview>('/overview');
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (error) {
      if (mounted.current) setError((error as Error).message);
    } finally {
      inFlight.current = false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 2000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  return { data, error, refresh };
}
