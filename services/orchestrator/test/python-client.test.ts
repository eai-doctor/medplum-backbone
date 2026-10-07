import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import { PythonClient } from '../src/python-client.js';

const config: Config = {
  PORT: 5200,
  MEDPLUM_BASE_URL: 'https://medplum.example/',
  MEDPLUM_CLIENT_ID: 'client-id',
  MEDPLUM_CLIENT_SECRET: 'client-secret',
  EAI_PYTHON_BASE_URL: 'http://python-sidecar:5101/',
  EAI_TRIAGE_PATH: 'triage/perform',
  EAI_INTERNAL_JWT_SECRET: 'test-secret-that-is-at-least-32-bytes-long',
  EAI_INTERNAL_JWT_TTL_SECONDS: 60,
  REQUEST_TIMEOUT_MS: 1_000,
};

afterEach(() => vi.unstubAllGlobals());

describe('PythonClient', () => {
  it('uses the configured legacy triage path and sends only the internal bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new PythonClient(config);
    await client.triage({ symptoms: ['mild_pain'] }, 'request-123', 'internal-jwt');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://python-sidecar:5101/triage/perform');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer internal-jwt',
      'x-request-id': 'request-123',
    });
  });

  it('returns Python authentication errors without changing them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new PythonClient(config);
    const result = await client.triage({}, 'request-456', 'internal-jwt');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: 'Bearer internal-jwt' });
    expect(result.status).toBe(401);
  });
});
