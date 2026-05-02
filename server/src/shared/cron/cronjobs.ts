// @ts-nocheck
import cron from 'node-cron';
import matchMixin from '@domain/matching/matchMixin.ts';
import config from '@config/index.ts';
import logger from '@config/logger.ts';

const patientReprocessing = config.get('cronJobs:patientReprocessing');

if (typeof patientReprocessing === 'string' && patientReprocessing.trim()) {
  cron.schedule(patientReprocessing, () => {
    logger.info('Running cron job for patients reprocessing');
    matchMixin.reprocessPatients().then(() => {
      logger.info('Done running cron job for patients reprocessing');
    });
  });
} else {
  logger.warn('Skipping patient reprocessing cron job because no valid schedule was configured');
}
