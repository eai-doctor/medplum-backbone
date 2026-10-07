import type { Config } from './config.js';
import { fetchWithTimeout, UpstreamError } from './http.js';

type TokenResponse = { access_token: string; expires_in?: number };
export type MedplumUserInfo = {
  sub?: unknown;
  email?: unknown;
  fhirUser?: unknown;
  fhir_user?: unknown;
  profile?: unknown;
};

export class MedplumClient {
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: Config) {}

  async readResource(resourceType: string, id: string): Promise<unknown> {
    const token = await this.getToken();
    const url = new URL(`fhir/R4/${encodeURIComponent(resourceType)}/${encodeURIComponent(id)}`, this.config.MEDPLUM_BASE_URL);
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { authorization: `Bearer ${token}`, accept: 'application/fhir+json' } },
      this.config.REQUEST_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new UpstreamError('medplum', response.status, await safeMessage(response));
    }
    return response.json();
  }

  async validateUserToken(token: string): Promise<MedplumUserInfo> {
    const url = new URL('oauth2/userinfo', this.config.MEDPLUM_BASE_URL);
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } },
      this.config.REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new UpstreamError('medplum', response.status, await safeMessage(response));
    }
    return response.json() as Promise<MedplumUserInfo>;
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;

    const url = new URL('oauth2/token', this.config.MEDPLUM_BASE_URL);
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.MEDPLUM_CLIENT_ID,
      client_secret: this.config.MEDPLUM_CLIENT_SECRET,
    });
    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
      this.config.REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) throw new UpstreamError('medplum', response.status, await safeMessage(response));

    const token = (await response.json()) as TokenResponse;
    this.token = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }
}

async function safeMessage(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500) || `HTTP ${response.status}`;
}
