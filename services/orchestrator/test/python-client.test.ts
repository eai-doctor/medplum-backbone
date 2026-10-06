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
  REQUEST_TIMEOUT_MS: 1_000,
};

afterEach(() => vi.unstubAllGlobals());

describe('PythonClient', () => {
  it('uses the configured legacy triage path and forwards bearer authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new PythonClient(config);
    await client.triage({ symptoms: ['mild_pain'] }, 'request-123', 'Bearer legacy-jwt');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://python-sidecar:5101/triage/perform');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer legacy-jwt',
      'x-request-id': 'request-123',
    });
  });

  it('does not invent an authorization header when the caller has none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new PythonClient(config);
    const result = await client.triage({}, 'request-456');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('authorization');
    expect(result.status).toBe(401);
  });
});
