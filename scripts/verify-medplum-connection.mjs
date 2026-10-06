import fs from 'node:fs';

const environment = parseEnv(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8'));
const baseUrl = environment.MEDPLUM_BASE_URL;
const clientId = environment.MEDPLUM_CLIENT_ID;
const clientSecret = environment.MEDPLUM_CLIENT_SECRET;

if (!baseUrl || !clientId || !clientSecret || clientSecret === 'PASTE_SECRET_HERE') {
  throw new Error('Complete MEDPLUM_BASE_URL, MEDPLUM_CLIENT_ID, and MEDPLUM_CLIENT_SECRET in .env first.');
}

const tokenResponse = await fetch(new URL('oauth2/token', baseUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }),
});

if (!tokenResponse.ok) {
  throw new Error(`Medplum OAuth failed with status ${tokenResponse.status}.`);
}

const { access_token: accessToken } = await tokenResponse.json();
const patientResponse = await fetch(new URL('fhir/R4/Patient?_count=5', baseUrl), {
  headers: {
    accept: 'application/fhir+json',
    authorization: `Bearer ${accessToken}`,
  },
});

if (!patientResponse.ok) {
  throw new Error(`Medplum FHIR Patient search failed with status ${patientResponse.status}.`);
}

const bundle = await patientResponse.json();
const patientIds = (bundle.entry ?? [])
  .map((entry) => entry.resource?.id)
  .filter(Boolean);

console.log(JSON.stringify({
  oauth: 'ok',
  fhir: 'ok',
  resourceType: bundle.resourceType,
  returned: patientIds.length,
  patientIds,
}, null, 2));

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}
