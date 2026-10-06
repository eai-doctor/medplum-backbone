# Security notes

## Legacy EAI JWT compatibility

The triage adapter currently forwards the caller's legacy EAI Bearer token to
the configured Python service. This is a temporary compatibility boundary, not
the final Medplum identity design.

The local legacy experiment was found to use an HS256 secret shorter than the
32-byte minimum recommended by RFC 7518. The secret value was not copied into
this repository. Before deploying the Python service:

1. Generate a new high-entropy secret of at least 32 bytes in the deployment
   secret manager.
2. Rotate all legacy tokens; do not reuse the local experiment secret.
3. Keep Python reachable only on the private container network.
4. Replace legacy JWT forwarding with an explicit Medplum-to-EAI identity
   bridge before the frontend uses Medplum authentication for triage.
5. Do not log tokens, secrets, or clinical request bodies.

The synthetic end-to-end contract test performed on 2026-10-06 disabled model
inference and persisted no clinical record.
