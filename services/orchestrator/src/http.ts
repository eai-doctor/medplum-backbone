export class UpstreamError extends Error {
  constructor(
    public readonly upstream: 'medplum' | 'python',
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(input, { ...init, signal });
}

