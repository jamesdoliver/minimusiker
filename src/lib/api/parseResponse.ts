/**
 * Parse a fetch Response as JSON or throw a meaningful Error.
 *
 * If the response is not OK (status outside 200-299), throws an Error whose
 * message comes from the body's `error` field (when JSON), the response text
 * (truncated to 200 chars), or the status text — in that order of preference.
 *
 * On parse failure of an OK response (e.g. 200 with a stray HTML page),
 * throws an Error explaining the parse failure rather than returning `{}`.
 *
 * @example
 * const res = await fetch('/api/admin/tasks/123', { method: 'PATCH', body: ... });
 * const data = await parseJsonOrThrow<{ success: boolean; data?: Task }>(res);
 */
export async function parseJsonOrThrow<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let parsedError: string | undefined;
    try {
      parsedError = (JSON.parse(text) as { error?: string })?.error;
    } catch {
      // Body was not JSON — fall back to text snippet
    }
    throw new Error(
      parsedError
        ?? `Request failed (${response.status}): ${
          text.slice(0, 200) || response.statusText || 'no body'
        }`,
    );
  }

  try {
    return await response.json() as T;
  } catch (err) {
    throw new Error(
      `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
