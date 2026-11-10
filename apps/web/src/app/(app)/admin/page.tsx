import type { Metadata } from 'next';
import { AdminPage } from '@/features/admin/AdminPage';

export const metadata: Metadata = { title: 'Admin' };

/** Admin pages, for admins only (the API checks the role on every call too). */
export default function Admin() {
  return <AdminPage />;
}
