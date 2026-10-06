# Medplum Backbone

Private experimental backend for a **Medplum-first** EAI architecture.

Medplum remains the system of record and owns standard FHIR, identity, access
control, audit, search, and history. The existing EAI Python backend is kept as
an isolated sidecar for capabilities Medplum does not provide, such as AI
triage, RAG, document intelligence, and model inference.

```text
main-app
   |
   v
TypeScript orchestrator
   |-- standard healthcare capability --> Medplum FHIR API --> PostgreSQL
   `-- EAI-only capability -------------> Python sidecar
```

This repository does **not** fork or modify Medplum and does not connect to its
PostgreSQL database directly. All clinical access goes through authenticated
FHIR APIs.

## What is implemented

- Explicit capability ownership registry.
- Medplum-first Patient read route.
- Python-sidecar triage route for an EAI-only capability.
- Legacy-compatible `POST /triage/perform` adapter with caller Bearer-token
  forwarding; no Medplum credential is sent to Python.
- Cached OAuth client-credentials token acquisition.
- Request IDs, timeouts, normalized upstream errors, and health endpoints.
- Docker Compose development topology.
- Unit tests for routing ownership.
- OpenAPI contract for the initial facade.

## Run locally

1. Copy `.env.example` to `.env` and add a least-privilege Medplum
   `ClientApplication` ID and secret.
2. Start the stack:

   ```bash
   docker compose up --build
   ```

3. Check:

   ```bash
   curl http://localhost:5200/health
   curl http://localhost:5200/v1/capabilities
   ```

The included Python service is a safe development placeholder. Replace its URL
with the real EAI Python patient service only after contract tests pass.

## Verify the Medplum connection

After completing the ignored local `.env`, verify OAuth client credentials and
read-only FHIR Patient access without printing the secret or access token:

```bash
node scripts/verify-medplum-connection.mjs
```

The staging connection was first verified against the self-hosted Medplum API
on 2026-10-06. Test records remain in Medplum PostgreSQL; this repository stores
neither FHIR data nor credentials.

## Safety rules

- Synthetic data only until production controls and compliance review finish.
- Never commit OAuth secrets, access tokens, `.env`, or patient data.
- Never query the Medplum PostgreSQL database from EAI code.
- Do not silently fall back from Medplum to Python for clinical writes.
- Route ownership changes require tests and a capability-matrix update.

See [ARCHITECTURE.md](ARCHITECTURE.md) and
[docs/capability-matrix.md](docs/capability-matrix.md).
