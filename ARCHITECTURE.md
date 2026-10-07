# Architecture

## Decision

Use Medplum as the backbone and system of record. Keep EAI Python capabilities
behind a narrow adapter boundary.

## Ownership rules

1. If Medplum supports the capability as FHIR/auth/access/audit, Medplum owns it.
2. If EAI adds domain behavior that Medplum does not provide, Python owns the
   computation while Medplum owns any resulting clinical record.
3. The orchestrator makes routing explicit. It does not infer ownership from an
   upstream outage and does not silently fail over clinical writes.
4. Cross-service calls use HTTPS contracts; neither service reads the other's
   database.

## Request examples

### Standard FHIR capability

```text
GET /v1/patients/{id}
  -> orchestrator
  -> Medplum GET /fhir/R4/Patient/{id}
  -> caller
```

### EAI-only capability

```text
POST /v1/triage
  -> orchestrator
  -> Medplum /oauth2/userinfo validates caller
  -> orchestrator mints 60-second internal sidecar JWT
  -> Python POST /triage/perform
  -> optional validated FHIR write in a later phase
  -> caller
```

The orchestrator never forwards the caller's Medplum token or the Medplum
ClientApplication secret to Python. It validates the caller through Medplum,
maps the FHIR profile to the narrow legacy role vocabulary, and mints a
short-lived internal token. Unsupported or ambiguous profiles fail closed.

## Failure behavior

- Medplum unavailable: return `502 UPSTREAM_MEDPLUM_ERROR`.
- Python unavailable: return `502 UPSTREAM_PYTHON_ERROR`.
- Timeout: return a normalized `504` response.
- No automatic cross-backend fallback for writes.

## Migration sequence

1. Inventory existing main-app calls and freeze response contracts.
2. Add read-only Medplum routes first.
3. Compare old Python and Medplum results using synthetic data.
4. Add EAI-only Python routes behind the facade.
5. Introduce FHIR identifiers linking legacy IDs to Medplum resources.
6. Migrate one route at a time with feature flags and rollback.
7. Add subscriptions for asynchronous AI workflows.
