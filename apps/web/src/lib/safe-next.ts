/**
 * Where to go after logging in. Only a path on this site is allowed ("/tracker"), never
 * another site ("https://evil.example" or "//evil.example"), so a link can't send you away.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/jobs';
  return next;
}
