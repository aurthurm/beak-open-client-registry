// @ts-nocheck
import logger from '@config/logger.ts';
import config from '@config/index.ts';
import { start } from '@bootstrap/server.ts';

if (import.meta.main) {
  start(() =>
    logger.info(`Server is running and listening on port: ${config.get('app:port')}`)
  );
}

export { start } from '@bootstrap/server.ts';
