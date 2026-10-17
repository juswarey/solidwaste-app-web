import { useCallback, useEffect, useRef, useState } from 'react';

/** Web data hook: runs `fn` on mount (and when deps change); optional polling. */
export function useLoad(fn, deps = [], { pollMs } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const first = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent && first.current) setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
      first.current = false;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    first.current = true;
    load();
    if (!pollMs) return undefined;
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, pollMs, ...deps]);

  return { data, error, loading, reload: () => load(true) };
}
