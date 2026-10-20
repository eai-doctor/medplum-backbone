# Google Cloud Run staging deployment

This deployment runs the TypeScript orchestrator and Python sidecar in one
Cloud Run multi-container instance. The orchestrator is the only ingress
container. The sidecar is reachable only at `127.0.0.1:5101` inside the
instance.

Medplum Server and PostgreSQL are **not** deployed by this repository. The
orchestrator connects to Medplum through its HTTPS FHIR/OAuth API.

## Current readiness

- Orchestrator health, capability routing, Medplum user-token validation and
  caller-scoped Patient reads are implemented and tested.
- The committed Python image is a safe placeholder. Its triage route returns
  `501 NOT_CONNECTED`; replace it with the reviewed EAI implementation before
  claiming functional AI triage.
- The public Cloud Run endpoint relies on Medplum bearer-token enforcement at
  application routes. Keep unauthenticated clinical routes out of the service.
- Browser CORS, rate limiting, alerting and a production privacy/security
  review are still release gates.

## 1. Choose project and region

The screenshot used project `eai-doctor` and `europe-west1`. Confirm that this
region satisfies the team's healthcare data-residency decision before creating
resources. Artifact Registry, Cloud Build and Cloud Run should use the same
region.

## 2. Enable APIs

```bash
gcloud config set project eai-doctor
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com
```

## 3. Create Artifact Registry once

```bash
gcloud artifacts repositories create medplum-backbone \
  --repository-format=docker \
  --location=europe-west1 \
  --description='EAI Medplum backbone images'
```

## 4. Create a least-privilege runtime identity

```bash
gcloud iam service-accounts create medplum-backbone-runner \
  --display-name='Medplum Backbone Cloud Run'
```

Grant this runtime service account Secret Manager access only to the three
secrets listed below. Do not grant Owner, Editor or Cloud Run Admin.

## 5. Create secrets once

Create these in Secret Manager without putting values in shell history, Git,
Cloud Build substitutions, screenshots or chat:

- `medplum-client-id`
- `medplum-client-secret`
- `eai-internal-jwt-secret` — at least 32 random bytes

Pin Cloud Run to secret version `1` for the first test. Rotate by adding a new
version and explicitly updating the deployment; do not silently use `latest`.

## 6. Build immutable images

From the repository root:

```bash
gcloud builds submit \
  --region=europe-west1 \
  --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA="$(git rev-parse HEAD)",_REGION=europe-west1,_REPOSITORY=medplum-backbone
```

Cloud Build tags both images with the Git commit SHA. Do not deploy `latest`.
`COMMIT_SHA` is supplied explicitly above because a manual source upload does
not have the Git-trigger substitutions that Developer Connect provides.

For continuous deployment, select **Cloud Build configuration file** in the
Google Cloud repository connection and enter `/cloudbuild.yaml`. Limit the
trigger to the reviewed branch; do not auto-deploy pull requests.

## 7. Deploy the multi-container service

After the build succeeds, set non-secret deployment inputs and run:

```bash
export PROJECT_ID=eai-doctor
export REGION=europe-west1
export IMAGE_TAG='<full Git commit SHA built by Cloud Build>'
export MEDPLUM_BASE_URL='https://api.eai-medplum-staging.tech/'
export RUNTIME_SERVICE_ACCOUNT='medplum-backbone-runner@eai-doctor.iam.gserviceaccount.com'
./deploy/gcp/deploy-cloud-run.sh
```

The script verifies both images and all three secret resources before it calls
Cloud Run. It does not create or print secret values.

## 8. Verify before frontend traffic

1. Check the new revision logs for secret/config errors and token leakage.
2. Call `/health` and `/v1/capabilities`.
3. Confirm a missing bearer token receives `401` on both Patient and triage.
4. Use a synthetic Patient token to read its own Patient.
5. Confirm the same token cannot read a different Patient.
6. Confirm triage returns `501 NOT_CONNECTED` until the real Python service is
   intentionally substituted.
7. Verify the corresponding allow/deny AuditEvents in Medplum logs and, after
   the Medplum `5.2.2+` audit fix is tested, in PostgreSQL.

Do not connect the production frontend or real PHI until these checks, CORS,
rate limiting, monitoring and the security review pass.

## Console screen shown in the screenshot

Developer Connect can build this repository, but it should use
`/cloudbuild.yaml`; there is no single root Dockerfile because the service has
two containers. Complete the GitHub connection, choose the reviewed branch,
select a Cloud Build YAML configuration, and keep automatic deployment disabled
until the first manual build and smoke test pass.
