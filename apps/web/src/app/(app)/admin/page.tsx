import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminPage } from '@/features/admin/AdminPage';

export const metadata: Metadata = { title: 'Admin' };

/** Admin pages, for admins only (the API checks the role on every call too). */
export default function Admin() {
  // useSearchParams (for ?tab=) needs a Suspense boundary so the rest can be pre-rendered.
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
}
