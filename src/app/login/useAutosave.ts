import { useEffect, useRef, useState } from 'react';

export function useAutosave<T>(
  value: T,
  saveFn: (v: T) => Promise<void>,
  delay = 600
) {
  const [status, setStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const first = useRef(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await saveFn(value);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 1000);
      } catch {
        setStatus('error');
      }
    }, delay);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  return status;
}
