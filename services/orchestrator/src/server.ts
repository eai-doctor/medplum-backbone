import Fastify from 'fastify';
import type { Config } from './config.js';
import { capabilityOwners } from './capabilities.js';
import { UpstreamError } from './http.js';
import { MedplumClient } from './medplum-client.js';
import { PythonClient } from './python-client.js';

export function buildServer(config: Config) {
  const app = Fastify({
    logger: true,
    genReqId: (request) => request.headers['x-request-id']?.toString() ?? crypto.randomUUID(),
  });
  const medplum = new MedplumClient(config);
  const python = new PythonClient(config);

  app.get('/health', async () => ({ ok: true, service: 'medplum-backbone-orchestrator' }));
  app.get('/v1/capabilities', async () => ({ strategy: 'medplum-first', ownership: capabilityOwners }));

  app.get<{ Params: { id: string } }>('/v1/patients/:id', async (request, reply) => {
    try {
      return await medplum.readResource('Patient', request.params.id);
    } catch (error) {
      return handleUpstream(error, reply);
    }
  });

  app.post('/v1/triage', async (request, reply) => {
    try {
      const result = await python.triage(request.body, request.id, request.headers.authorization);
      return reply.status(result.status).send(result.body);
    } catch (error) {
      return handleUpstream(error, reply);
    }
  });

  return app;
}

function handleUpstream(error: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (error instanceof UpstreamError) {
    const status = error.status === 404 ? 404 : 502;
    return reply.status(status).send({
      error: `${error.upstream.toUpperCase()}_UPSTREAM_ERROR`,
      upstreamStatus: error.status,
    });
  }
  return reply.status(502).send({ error: 'UPSTREAM_ERROR' });
}
