// @ts-nocheck
const fs = require('fs');
const requireFallback = require('./requireFallback.ts');
const { TEST_BACKEND_ORIGIN } = require('./ports.ts');
const request = requireFallback('request');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const logger = require('../server/src/config/logger.ts').default;

const agentOptions = {
  cert: fs.readFileSync('../server/clientCertificates/openmrs_cert.pem'),
  key: fs.readFileSync('../server/clientCertificates/openmrs_key.pem'),
  ca: fs.readFileSync('../server/serverCertificates/server_cert.pem'),
  securityOptions: 'SSL_OP_NO_SSLv3',
};
const options = {
  url: `${TEST_BACKEND_ORIGIN}/updateConfig/`,
  agentOptions,
  json: [
    { 'systems:internalid:uri': ['http://openmrs.org/openmrs2', 'http://dhis2.org/internalid'] },
  ],
};
request.post(options, (err, res, body) => {
  if (err) {
    logger.error(err);
  }
  logger.info(body);
});
