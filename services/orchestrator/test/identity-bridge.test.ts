import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Config } from '../src/config.js';
import { AuthenticationError, createInternalToken, readBearerToken } from '../src/identity-bridge.js';

const config = {
  EAI_INTERNAL_JWT_SECRET: 'test-secret-that-is-at-least-32-bytes-long',
  EAI_INTERNAL_JWT_TTL_SECONDS: 60,
} as Config;

describe('Medplum identity bridge', () => {
  it('maps a validated Patient profile to a short-lived Python token', () => {
    const token = createInternalToken(
      { sub: 'membership-123', email: 'synthetic@example.invalid', fhirUser: 'Patient/patient-456' },
      config,
      1_000,
    );
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
    const expected = createHmac('sha256', config.EAI_INTERNAL_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    expect(signature).toBe(expected);
    expect(claims).toMatchObject({
      sub: 'membership-123',
      role: 'patient',
      fhir_profile: 'Patient/patient-456',
      iat: 1_000,
      exp: 1_060,
      aud: 'eai-python-sidecar',
    });
  });

  it('maps an absolute Practitioner profile URL to clinician', () => {
    const token = createInternalToken(
      { sub: 'membership-789', profile: 'https://api.example/fhir/R4/Practitioner/practitioner-1' },
      config,
      2_000,
    );
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Record<string, unknown>;
    expect(claims).toMatchObject({ role: 'clinician', fhir_profile: 'Practitioner/practitioner-1' });
  });

  it('rejects missing bearer tokens and unsupported profiles', () => {
    expect(() => readBearerToken()).toThrow(AuthenticationError);
    expect(() => createInternalToken({ sub: 'membership', profile: 'Organization/1' }, config)).toThrow(
      AuthenticationError,
    );
  });
});
