import type { ProfileFieldModel } from './profile.model';

/** The custom fields as stored (JSON), keeping only well-formed entries. */
export function customFieldsOf(json: unknown): ProfileFieldModel[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((f: unknown) => {
    if (!f || typeof f !== 'object') return [];
    const { label, value } = f as Record<string, unknown>;
    return typeof label === 'string' && typeof value === 'string' ? [{ label, value }] : [];
  });
}
