'use client';

import { get, set } from 'idb-keyval';
import { useCallback, useEffect, useState } from 'react';
import type { Hosted } from './hosting';

const KEY = 'mm:hosted:v1';

/**
 * Remembers where images were published (URLs only, no secrets), so reopening the builder does not
 * force a re-publish for an unchanged signature. Content-hashed names make this safe: a file
 * name can only ever mean one image.
 */
export function useHosted() {
  const [hosted, setHostedState] = useState<Hosted | null>(null);

  useEffect(() => {
    let live = true;
    get<Hosted>(KEY)
      .then((h) => live && h && setHostedState(h))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const setHosted = useCallback(
    (next: Hosted | null | ((prev: Hosted | null) => Hosted | null)) => {
      setHostedState((prev) => {
        const v = typeof next === 'function' ? next(prev) : next;
        set(KEY, v).catch(() => {});
        return v;
      });
    },
    [],
  );

  return { hosted, setHosted };
}
