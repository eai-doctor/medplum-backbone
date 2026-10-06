import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(5200),
  MEDPLUM_BASE_URL: z.string().url(),
  MEDPLUM_CLIENT_ID: z.string().min(1),
  MEDPLUM_CLIENT_SECRET: z.string().min(1),
  EAI_PYTHON_BASE_URL: z.string().url(),
  EAI_TRIAGE_PATH: z.string().min(1).default('triage/perform'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const config = schema.parse(environment);
  return {
    ...config,
    MEDPLUM_BASE_URL: ensureTrailingSlash(config.MEDPLUM_BASE_URL),
    EAI_PYTHON_BASE_URL: ensureTrailingSlash(config.EAI_PYTHON_BASE_URL),
  };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
