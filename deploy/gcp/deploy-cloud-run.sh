#!/bin/sh
# Deploy the two prebuilt images as one Cloud Run multi-container service.
# This script never creates or prints secrets.
set -eu

: "${PROJECT_ID:?set PROJECT_ID}"
: "${REGION:?set REGION to the approved data-residency region}"
: "${IMAGE_TAG:?set IMAGE_TAG to an immutable Git commit SHA}"
: "${MEDPLUM_BASE_URL:?set MEDPLUM_BASE_URL, including https://}"
: "${RUNTIME_SERVICE_ACCOUNT:?set RUNTIME_SERVICE_ACCOUNT email}"

SERVICE_NAME=${SERVICE_NAME:-medplum-backbone-staging}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY:-medplum-backbone}
MEDPLUM_CLIENT_ID_SECRET=${MEDPLUM_CLIENT_ID_SECRET:-medplum-client-id}
MEDPLUM_CLIENT_SECRET_SECRET=${MEDPLUM_CLIENT_SECRET_SECRET:-medplum-client-secret}
INTERNAL_JWT_SECRET=${INTERNAL_JWT_SECRET:-eai-internal-jwt-secret}

orchestrator_image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/orchestrator:${IMAGE_TAG}"
sidecar_image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/python-sidecar:${IMAGE_TAG}"

for image in "$orchestrator_image" "$sidecar_image"; do
  gcloud artifacts docker images describe "$image" --project "$PROJECT_ID" >/dev/null
done

for secret in "$MEDPLUM_CLIENT_ID_SECRET" "$MEDPLUM_CLIENT_SECRET_SECRET" "$INTERNAL_JWT_SECRET"; do
  gcloud secrets describe "$secret" --project "$PROJECT_ID" >/dev/null
done

gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --execution-environment gen2 \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --timeout 60 \
  --concurrency 40 \
  --min-instances 0 \
  --max-instances 3 \
  --container orchestrator \
  --image "$orchestrator_image" \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars "PORT=8080,MEDPLUM_BASE_URL=${MEDPLUM_BASE_URL},EAI_PYTHON_BASE_URL=http://127.0.0.1:5101/,EAI_TRIAGE_PATH=triage/perform,EAI_INTERNAL_JWT_TTL_SECONDS=60,REQUEST_TIMEOUT_MS=10000" \
  --set-secrets "MEDPLUM_CLIENT_ID=${MEDPLUM_CLIENT_ID_SECRET}:1,MEDPLUM_CLIENT_SECRET=${MEDPLUM_CLIENT_SECRET_SECRET}:1,EAI_INTERNAL_JWT_SECRET=${INTERNAL_JWT_SECRET}:1" \
  --container python-sidecar \
  --image "$sidecar_image" \
  --cpu 1 \
  --memory 512Mi \
  --set-env-vars "PORT=5101" \
  --set-secrets "EAI_INTERNAL_JWT_SECRET=${INTERNAL_JWT_SECRET}:1"

printf '%s\n' 'Deployment submitted. Verify the new revision before adding frontend traffic.'
