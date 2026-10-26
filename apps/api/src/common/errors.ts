/** A readable message from anything that was thrown. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
