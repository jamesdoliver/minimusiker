// Stub web globals that next/server expects at module-load time. The helper
// under test is pure and never actually constructs Request/Response, so empty
// classes are enough. Kept (rather than deleted) because Jest still parses the
// route file when this test imports it; the stubs let the import succeed under
// the jsdom environment.
class StubRequest {}
class StubResponse {}
class StubHeaders {}
if (typeof (globalThis as { Request?: unknown }).Request === 'undefined') {
  (globalThis as { Request: unknown }).Request = StubRequest;
}
if (typeof (globalThis as { Response?: unknown }).Response === 'undefined') {
  (globalThis as { Response: unknown }).Response = StubResponse;
}
if (typeof (globalThis as { Headers?: unknown }).Headers === 'undefined') {
  (globalThis as { Headers: unknown }).Headers = StubHeaders;
}

// The route file pulls in service modules that touch Airtable/fetch/etc.
// `isValidStatusOverride` doesn't reach into them, but loading the route file
// still pulls them in. Mock them out to keep this a true unit test of the
// exported helper wiring.
jest.mock('@/lib/services/taskService', () => ({ getTaskService: jest.fn() }));
jest.mock('@/lib/auth/verifyAdminSession', () => ({ requireAdmin: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isValidStatusOverride } =
  require('@/app/api/admin/tasks/[taskId]/route') as typeof import('@/app/api/admin/tasks/[taskId]/route');

// The helper is a thin wrapper around `createWhitelistGuard`, which is fully
// covered by `validators.test.ts`. These cases verify the wrapper is wired up
// to the right whitelist values for the PATCH route.
describe('isValidStatusOverride', () => {
  it('accepts the four valid overrides', () => {
    expect(isValidStatusOverride('cancelled')).toBe(true);
    expect(isValidStatusOverride('skipped')).toBe(true);
    expect(isValidStatusOverride('partial')).toBe(true);
    expect(isValidStatusOverride('pending')).toBe(true);
  });
  it('accepts undefined (default completion path)', () => {
    expect(isValidStatusOverride(undefined)).toBe(true);
  });
  it('rejects unknown strings', () => {
    expect(isValidStatusOverride('completed')).toBe(false);
    expect(isValidStatusOverride('done')).toBe(false);
    expect(isValidStatusOverride('')).toBe(false);
    expect(isValidStatusOverride('skipped_and_destroy')).toBe(false);
  });
});
