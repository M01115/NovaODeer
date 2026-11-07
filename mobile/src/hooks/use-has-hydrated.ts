import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * Web static/server rendering: `false` on the server and during hydration, `true` after.
 * Use it to keep the first client render identical to the server HTML.
 */
export function useHasHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
