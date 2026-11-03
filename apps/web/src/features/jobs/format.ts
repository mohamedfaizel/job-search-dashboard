/** "senior" → "Senior", "node.js" stays as is. */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
