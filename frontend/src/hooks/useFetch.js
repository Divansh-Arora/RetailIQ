import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs `fn()` whenever `deps` change. Keeps previous data visible while reloading; ignores stale responses. */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current().then(
      (data) => { if (!cancelled) setState({ data, loading: false, error: null }); },
      (error) => { if (!cancelled) setState({ data: null, loading: false, error }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
