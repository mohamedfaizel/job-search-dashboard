import { vi } from 'vitest';

/** A stand-in for Next's router, so components can be tested without a Next server. */
export const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
export const location = { pathname: '/jobs', search: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => location.pathname,
  useSearchParams: () => location.search,
}));
