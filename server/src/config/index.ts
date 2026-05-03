// @ts-nocheck
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nconf from 'nconf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = process.env.NODE_ENV || 'development';
console.log(`Loading config for environment: ${env}`);
const decisionRulesFile = env === 'test'
  ? join(__dirname, '../../config/decisionRulesTest.json')
  : join(__dirname, '../../config/decisionRules.json');

nconf
  .argv()
  .env({ separator: '__' })
  .file(join(__dirname, '../../config', `config_${env}.json`))
  .file('decRules', decisionRulesFile);

export default nconf;
