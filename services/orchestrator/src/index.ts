import { loadConfig } from './config.js';
import { buildServer } from './server.js';

const config = loadConfig();
const server = buildServer(config);

await server.listen({ host: '0.0.0.0', port: config.PORT });

