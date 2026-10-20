import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const baseUrl = new URL(process.env.MEDPLUM_BASE_URL ?? 'https://api.eai-medplum-staging.tech/');
const clientId = process.env.MEDPLUM_BROWSER_CLIENT_ID;
const facadeUrl = process.env.BACKBONE_FACADE_URL ?? 'http://127.0.0.1:5200/';
const redirectUri = 'http://localhost:8765/callback';

if (!clientId) throw new Error('MEDPLUM_BROWSER_CLIENT_ID is required');

const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(24).toString('base64url');

const loginPage = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>EAI Identity Bridge Smoke Test</title></head>
  <body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:1rem">
    <h1>One-time Medplum sign in</h1>
    <p>Credentials are sent only to your Medplum server and are not stored.</p>
    <form method="post" action="/login">
      <label>Email<br><input name="email" type="email" required autocomplete="username" style="width:100%;margin:.4rem 0 1rem"></label>
      <label>Password<br><input name="password" type="password" required autocomplete="current-password" style="width:100%;margin:.4rem 0 1rem"></label>
      <button type="submit">Run synthetic identity test</button>
    </form>
  </body>
</html>`;

async function runSmokeTest(code) {
  const tokenResponse = await fetch(new URL('oauth2/token', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Token exchange failed (${tokenResponse.status})`);
  const { access_token: accessToken } = await tokenResponse.json();
  if (typeof accessToken !== 'string') throw new Error('Access token missing');

  const triageResponse = await fetch(new URL('v1/triage', facadeUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      demographics: { age: 35, sex: 'other' },
      chief_complaint: 'synthetic mild ankle pain',
      symptoms: ['mild_pain'],
      pain_score: 3,
      critical_look: false,
      airway_breathing_circulation_issue: false,
      language: 'en',
    }),
  });
  const result = await triageResponse.json().catch(() => ({}));
  return {
    response: triageResponse,
    summary: {
      httpStatus: triageResponse.status,
      success: result.success === true,
      ctasLevel: result.ctas_result?.level,
      hasDisclaimer: typeof result.disclaimer === 'string',
    },
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', redirectUri);
  if (url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(loginPage);
    return;
  }

  if (url.pathname === '/login' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 16_384) throw new Error('Login request too large');
    }
    const form = new URLSearchParams(body);
    const loginResponse = await fetch(new URL('auth/login', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
        clientId,
        scope: 'openid email profile',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      }),
    });
    const loginResult = await loginResponse.json().catch(() => ({}));
    body = '';
    if (!loginResponse.ok || typeof loginResult.code !== 'string') {
      response.writeHead(401, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      response.end('Sign in failed or additional account selection/MFA is required.');
      return;
    }
    try {
      const { response: triageResponse, summary } = await runSmokeTest(loginResult.code);
      console.log(JSON.stringify(summary));
      response.writeHead(triageResponse.ok ? 200 : 502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(triageResponse.ok
        ? 'Identity bridge smoke test passed. You may close this tab.'
        : `Identity bridge smoke test failed (${triageResponse.status}).`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Smoke test failed');
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Identity bridge smoke test failed.');
    } finally {
      setTimeout(() => server.close(), 250);
    }
    return;
  }

  if (url.pathname !== '/callback' || url.searchParams.get('state') !== state) {
    response.writeHead(400).end('Invalid OAuth callback.');
    return;
  }

  try {
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Authorization code missing');
    const { response: triageResponse, summary } = await runSmokeTest(code);
    console.log(JSON.stringify(summary));
    response.writeHead(triageResponse.ok ? 200 : 502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(triageResponse.ok
      ? 'Identity bridge smoke test passed. You may close this tab.'
      : `Identity bridge smoke test failed (${triageResponse.status}).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Smoke test failed');
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Identity bridge smoke test failed.');
  } finally {
    setTimeout(() => server.close(), 250);
  }
});

server.listen(8765, '127.0.0.1', () => {
  console.log('OAuth smoke test ready at http://localhost:8765/');
});
