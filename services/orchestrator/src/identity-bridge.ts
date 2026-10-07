import { createHmac } from 'node:crypto';
import type { Config } from './config.js';
import type { MedplumUserInfo } from './medplum-client.js';

export class AuthenticationError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

export function readBearerToken(authorization?: string): string {
  if (!authorization?.startsWith('Bearer ') || authorization.length <= 7) {
    throw new AuthenticationError(401, 'Bearer token required');
  }
  return authorization.slice(7);
}

export function createInternalToken(userInfo: MedplumUserInfo, config: Config, now = Math.floor(Date.now() / 1000)): string {
  const subject = stringClaim(userInfo.sub);
  if (!subject) throw new AuthenticationError(403, 'Medplum subject is missing');

  const profile = profileReference(userInfo);
  const role = roleForProfile(profile);
  if (!role) throw new AuthenticationError(403, 'Medplum profile is not a supported patient or practitioner');

  const payload = {
    sub: subject,
    email: stringClaim(userInfo.email),
    role,
    fhir_profile: profile,
    iss: 'eai-medplum-backbone',
    aud: 'eai-python-sidecar',
    iat: now,
    exp: now + config.EAI_INTERNAL_JWT_TTL_SECONDS,
  };
  const encodedHeader = encode({ alg: 'HS256', typ: 'JWT' });
  const encodedPayload = encode(payload);
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', config.EAI_INTERNAL_JWT_SECRET).update(content).digest('base64url');
  return `${content}.${signature}`;
}

function profileReference(userInfo: MedplumUserInfo): string | undefined {
  for (const value of [userInfo.fhirUser, userInfo.fhir_user, userInfo.profile]) {
    const claim = stringClaim(value);
    if (!claim) continue;
    const match = claim.match(/(?:^|\/)(Patient|Practitioner)\/([^/?#]+)/);
    if (match) return `${match[1]}/${match[2]}`;
  }
  return undefined;
}

function roleForProfile(profile?: string): 'patient' | 'clinician' | undefined {
  if (profile?.startsWith('Patient/')) return 'patient';
  if (profile?.startsWith('Practitioner/')) return 'clinician';
  return undefined;
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
