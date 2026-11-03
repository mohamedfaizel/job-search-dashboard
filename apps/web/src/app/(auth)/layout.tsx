import type { ReactNode } from 'react';
import { FlagStripe } from '@/components/FlagStripe';

/** The login and sign-up pages: the black, red and gold stripe on top, then the form. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FlagStripe />
      {children}
    </>
  );
}
