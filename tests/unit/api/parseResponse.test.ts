import { parseJsonOrThrow } from '@/lib/api/parseResponse';

/**
 * jsdom omits the Web Response constructor, so we build a minimal mock that
 * exposes only the surface `parseJsonOrThrow` consumes: `ok`, `status`,
 * `statusText`, `text()`, `json()`. This avoids pulling in heavyweight
 * polyfills (undici depends on TextDecoder, also missing in jsdom).
 */
function makeResponse(status: number, body: string): Response {
  const ok = status >= 200 && status < 300;
  const statusText =
    status === 401 ? 'Unauthorized' : status === 500 ? 'Internal Server Error' : 'OK';

  return {
    ok,
    status,
    statusText,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

describe('parseJsonOrThrow', () => {
  it('parses a 200 JSON response', async () => {
    const res = makeResponse(200, '{"success": true, "data": {"id": "abc"}}');
    const data = await parseJsonOrThrow<{ success: boolean; data: { id: string } }>(res);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('abc');
  });

  it('throws with the body error field on a JSON error response', async () => {
    const res = makeResponse(400, '{"success": false, "error": "Invalid status"}');
    await expect(parseJsonOrThrow(res)).rejects.toThrow('Invalid status');
  });

  it('throws with the body text when the error response is not JSON', async () => {
    const res = makeResponse(502, '<html>Bad Gateway</html>');
    await expect(parseJsonOrThrow(res)).rejects.toThrow(/Request failed \(502\)/);
  });

  it('truncates a long error body to 200 chars', async () => {
    const longBody = 'x'.repeat(500);
    const res = makeResponse(500, longBody);
    await expect(parseJsonOrThrow(res)).rejects.toThrow(/x{200}(?!x)/);
  });

  it('throws on a 200 response with broken JSON', async () => {
    const res = makeResponse(200, '<html>Wrong endpoint</html>');
    await expect(parseJsonOrThrow(res)).rejects.toThrow(/Failed to parse JSON/);
  });

  it('falls back to statusText when body is empty', async () => {
    const res = makeResponse(401, '');
    await expect(parseJsonOrThrow(res)).rejects.toThrow(/Request failed \(401\)/);
  });
});
