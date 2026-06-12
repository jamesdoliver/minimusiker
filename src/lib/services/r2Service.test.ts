// r2Service builds a real S3Client in its constructor; stub the SDK so we can
// drive .send() and assert which commands are issued, while keeping the real
// command classes so `new CopyObjectCommand(...)` etc. still construct and
// expose their `.input`. (Jest allows factory refs to vars prefixed "mock".)
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

import { getR2Service } from './r2Service';

const commandNames = (): string[] =>
  mockSend.mock.calls.map((c) => (c[0] as { constructor: { name: string } }).constructor.name);
const commandOfType = (name: string) =>
  mockSend.mock.calls.map((c) => c[0]).find((c) => c.constructor.name === name) as
    | { input: Record<string, unknown> }
    | undefined;

beforeAll(() => {
  process.env.R2_ENDPOINT ||= 'https://example.r2';
  process.env.R2_ACCESS_KEY_ID ||= 'k';
  process.env.R2_SECRET_ACCESS_KEY ||= 's';
  process.env.R2_BUCKET_NAME ||= 'minimusiker';
  process.env.R2_ASSETS_BUCKET_NAME ||= 'minimusiker-assets';
});

describe('R2Service.moveFile — server-side copy (no buffer round-trip)', () => {
  let errSpy: jest.SpyInstance;
  beforeEach(() => {
    mockSend.mockReset();
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errSpy.mockRestore());

  it('copies via CopyObjectCommand then deletes the temp original — never fetches the body', async () => {
    mockSend.mockResolvedValue({}); // copy + delete both succeed
    const r2 = getR2Service();

    const ok = await r2.moveFile(
      'temp/eng_123/My Mix.wav',
      'recordings/evt/cls/song/final/Title - Klasse 1a.wav'
    );

    expect(ok).toBe(true);
    const names = commandNames();
    expect(names).toContain('CopyObjectCommand');
    expect(names).toContain('DeleteObjectCommand');
    // The whole point of the change: large WAVs must not be pulled into the
    // function's memory, so no GetObject/PutObject round-trip.
    expect(names).not.toContain('GetObjectCommand');
    expect(names).not.toContain('PutObjectCommand');

    const copy = commandOfType('CopyObjectCommand')!;
    // CopySource must be URL-encoded (space -> %20) or R2 can't find the key.
    expect(copy.input.CopySource).toBe('minimusiker/temp/eng_123/My%20Mix.wav');
    expect(copy.input.Key).toBe('recordings/evt/cls/song/final/Title - Klasse 1a.wav');
    expect(copy.input.Bucket).toBe('minimusiker');
  });

  it('returns false and does NOT delete the temp file when the copy fails', async () => {
    mockSend.mockImplementation((cmd: { constructor: { name: string } }) =>
      cmd.constructor.name === 'CopyObjectCommand'
        ? Promise.reject(new Error('copy boom'))
        : Promise.resolve({})
    );
    const r2 = getR2Service();

    const ok = await r2.moveFile('temp/u/x.wav', 'final/x.wav');

    expect(ok).toBe(false);
    expect(commandNames()).not.toContain('DeleteObjectCommand'); // temp preserved for retry
  });
});

describe('R2Service.fileExistsWithRetry — tolerate read-after-write lag on confirm', () => {
  let errSpy: jest.SpyInstance;
  beforeEach(() => {
    mockSend.mockReset();
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errSpy.mockRestore());

  it('returns true once the object appears within the retry budget', async () => {
    let calls = 0;
    mockSend.mockImplementation(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('not found yet'));
      return Promise.resolve({ ContentLength: 10 }); // HeadObject succeeds on 3rd try
    });
    const r2 = getR2Service();

    const exists = await r2.fileExistsWithRetry('temp/u/x.wav', 3, 0);

    expect(exists).toBe(true);
    expect(calls).toBe(3);
  });

  it('returns false after exhausting attempts (genuinely missing)', async () => {
    mockSend.mockRejectedValue(new Error('not found'));
    const r2 = getR2Service();

    const exists = await r2.fileExistsWithRetry('temp/u/missing.wav', 3, 0);

    expect(exists).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });
});
