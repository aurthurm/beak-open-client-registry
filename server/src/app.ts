// @ts-nocheck
import logger from '@config/logger.ts';
import config from '@config/index.ts';
import { start } from '@bootstrap/server.ts';

import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start(() =>
    logger.info(`Server is running and listening on port: ${config.get('app:port')}`)
  );
}

export { start } from '@bootstrap/server.ts';
