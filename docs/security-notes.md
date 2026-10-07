# Security notes

## Medplum-to-EAI identity bridge

The triage adapter validates the caller's Medplum access token against the
self-hosted `/oauth2/userinfo` endpoint. It accepts only profiles that resolve
explicitly to `Patient/{id}` or `Practitioner/{id}` and creates a short-lived
HS256 token for the private Python sidecar. The caller token and Medplum
ClientApplication credentials are never sent to Python.

The local legacy experiment was found to use an HS256 secret shorter than the
32-byte minimum recommended by RFC 7518. The secret value was not copied into
this repository. Deployment requirements are:

1. Generate a new high-entropy secret of at least 32 bytes in the deployment
   secret manager.
2. Rotate all legacy tokens; do not reuse the local experiment secret. The
   orchestrator and Python sidecar share only the new internal signing secret.
3. Keep Python reachable only on the private container network.
4. Keep the internal token TTL short (60 seconds by default) and never expose
   it to a browser.
5. Do not log tokens, secrets, or clinical request bodies.

Synthetic end-to-end contract tests persist no clinical record. Before a
public route is enabled, complete browser authorization-code testing, rate
limits, audit logging, and authorization tests for patient/clinician access.
