import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import { buildServer } from '../src/server.js';

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

describe('triage authentication', () => {
  it('rejects a missing bearer token without calling an upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const app = buildServer(config);
    const response = await app.inject({ method: 'POST', url: '/v1/triage', payload: {} });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes Medplum malformed-token responses to unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    const app = buildServer(config);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/triage',
      headers: { authorization: 'Bearer malformed-token' },
      payload: {},
    });
    await app.close();

    expect(response.statusCode).toBe(401);
  });
});

describe('Patient read authentication', () => {
  it('rejects a missing bearer token without using the service credential', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const app = buildServer(config);
    const response = await app.inject({ method: 'GET', url: '/v1/patients/patient-123' });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the caller token so Medplum applies the caller AccessPolicy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ resourceType: 'Patient', id: 'patient-123' }), {
        status: 200,
        headers: { 'content-type': 'application/fhir+json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const app = buildServer(config);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/patients/patient-123',
      headers: { authorization: 'Bearer caller-medplum-token' },
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).authorization).toBe('Bearer caller-medplum-token');
  });
});
