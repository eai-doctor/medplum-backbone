import type { Config } from './config.js';
import { fetchWithTimeout, UpstreamError } from './http.js';

export class PythonClient {
  constructor(private readonly config: Config) {}

  async triage(payload: unknown, requestId: string): Promise<{ status: number; body: unknown }> {
    const url = new URL('v1/triage', this.config.EAI_PYTHON_BASE_URL);
    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify(payload),
      },
      this.config.REQUEST_TIMEOUT_MS,
    );
    const body = await response.json().catch(() => ({ error: 'invalid upstream response' }));
    if (response.status >= 500 && response.status !== 501) {
      throw new UpstreamError('python', response.status, JSON.stringify(body).slice(0, 500));
    }
    return { status: response.status, body };
  }
}

