# VPS staging deployment

This topology runs the TypeScript orchestrator and the existing Python patient
service as separate containers. It does not copy Python code into this
repository and it does not expose Python to the public network.

## Expected VPS layout

```text
/opt/eai/medplum-backbone  # this private repository
/opt/eai/main-service      # private main-service checkout/approved snapshot
/opt/eai/secrets/
  backbone.env             # Medplum ClientApplication credentials
  patient.env              # rotated Python secrets
```

Both secret files must be owned by the deployment user and mode `600`. Never
reuse the weak JWT secret from the local experiment.

After securely placing `backbone.env`, generate new Python and deployment
secrets directly on the VPS (the values are never printed):

```bash
sh deploy/vps/bootstrap-secrets.sh
```

## Validate before starting

Create `/opt/eai/medplum-backbone/deploy/vps/deploy.env` from
`deploy.env.example`, then run from the repository root:

```bash
docker compose \
  --env-file deploy/vps/deploy.env \
  -f deploy/vps/compose.yaml \
  config -q
```

Start only after both checkouts are pinned to reviewed commits:

```bash
docker compose \
  --env-file deploy/vps/deploy.env \
  -f deploy/vps/compose.yaml \
  up -d --build
```

The orchestrator is reachable only at `127.0.0.1:5200` on the VPS. The Python
container has no host port. Do not add a public reverse-proxy route until the
Medplum-to-EAI identity bridge, rate limits, audit strategy, and synthetic-only
acceptance tests are complete.
