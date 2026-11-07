import type { ReactNode } from 'react';

/** On a real phone there's nothing to frame. See phone-frame.web.tsx for the browser preview. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return children;
}
