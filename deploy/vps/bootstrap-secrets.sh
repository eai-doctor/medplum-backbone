#!/bin/sh
set -eu

SECRETS_DIR=${SECRETS_DIR:-/opt/eai/secrets}
PATIENT_ENV=${EAI_PATIENT_ENV_FILE:-$SECRETS_DIR/patient.env}
IDENTITY_ENV=${EAI_IDENTITY_ENV_FILE:-$SECRETS_DIR/identity.env}
DEPLOY_ENV=${DEPLOY_ENV_FILE:-/opt/eai/medplum-backbone/deploy/vps/deploy.env}
PATIENT_CONTEXT=${EAI_PATIENT_CONTEXT:-/opt/eai/main-service}

umask 077
mkdir -p "$SECRETS_DIR"

if [ ! -f "$PATIENT_ENV" ]; then
  flask_secret=$(openssl rand -hex 32)
  jwt_secret=$(openssl rand -hex 32)
  temporary_file=$(mktemp "$SECRETS_DIR/patient.env.XXXXXX")

  {
    printf '%s\n' 'ENVIRONMENT=staging'
    printf 'SECRET_KEY=%s\n' "$flask_secret"
    printf 'JWT_SECRET_KEY=%s\n' "$jwt_secret"
    printf '%s\n' 'ALLOWED_ORIGINS='
    printf '%s\n' 'FHIR_PROVIDER=medplum'
    printf '%s\n' 'MEDPLUM_PROFILE=patient'
    printf '%s\n' 'MEDPLUM_FHIR_BASE_URL=https://api.eai-medplum-staging.tech/fhir/R4'
    printf '%s\n' 'MEDPLUM_PATIENT_CLIENT_ID='
    printf '%s\n' 'MEDPLUM_PATIENT_CLIENT_SECRET='
    printf '%s\n' 'USE_EMAIL_MICROSERVICE=false'
    printf '%s\n' 'EMAIL_ENABLED=false'
    printf '%s\n' 'EMAIL_SERVICE_URL=http://email-service.invalid'
    printf '%s\n' 'EMAIL_SERVICE_API_KEY=disabled-staging-placeholder'
    printf '%s\n' 'PUBMED_SERVICE_ENABLED=false'
    printf '%s\n' 'USE_MIXEHR_SERVICE=false'
    printf '%s\n' 'USE_TRANSCRIPTION_MICROSERVICE=false'
    printf '%s\n' 'GCP_PROJECT=disabled-staging-placeholder'
    printf '%s\n' 'GCP_LOCATION=northamerica-northeast1'
    printf '%s\n' 'GEMINI_MODEL=disabled-staging-placeholder'
  } > "$temporary_file"

  mv "$temporary_file" "$PATIENT_ENV"
fi

if [ ! -f "$IDENTITY_ENV" ]; then
  jwt_secret=$(sed -n 's/^JWT_SECRET_KEY=//p' "$PATIENT_ENV")
  if [ "${#jwt_secret}" -lt 32 ]; then
    printf '%s\n' 'JWT_SECRET_KEY must contain at least 32 characters' >&2
    exit 1
  fi
  temporary_file=$(mktemp "$SECRETS_DIR/identity.env.XXXXXX")
  {
    printf 'EAI_INTERNAL_JWT_SECRET=%s\n' "$jwt_secret"
    printf '%s\n' 'EAI_INTERNAL_JWT_TTL_SECONDS=60'
  } > "$temporary_file"
  mv "$temporary_file" "$IDENTITY_ENV"
fi

if [ ! -f "$DEPLOY_ENV" ]; then
  temporary_file=$(mktemp "$(dirname "$DEPLOY_ENV")/deploy.env.XXXXXX")
  {
    printf 'EAI_PATIENT_CONTEXT=%s\n' "$PATIENT_CONTEXT"
    printf 'BACKBONE_ENV_FILE=%s\n' "$SECRETS_DIR/backbone.env"
    printf 'EAI_PATIENT_ENV_FILE=%s\n' "$PATIENT_ENV"
    printf 'EAI_IDENTITY_ENV_FILE=%s\n' "$IDENTITY_ENV"
  } > "$temporary_file"
  mv "$temporary_file" "$DEPLOY_ENV"
fi

if ! grep -q '^EAI_IDENTITY_ENV_FILE=' "$DEPLOY_ENV"; then
  printf 'EAI_IDENTITY_ENV_FILE=%s\n' "$IDENTITY_ENV" >> "$DEPLOY_ENV"
fi

chmod 600 "$PATIENT_ENV" "$IDENTITY_ENV" "$DEPLOY_ENV"
printf '%s\n' 'VPS secret files are ready (values not displayed).'
