// @ts-nocheck
const fs = require('fs');
const path = require('path');
const requireFallback = require('./requireFallback.ts');
const { TEST_BACKEND_ORIGIN } = require('./ports.ts');
const request = requireFallback('request');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const logger = require('../server/src/config/logger.ts').default;
const CLIENT_CERT = path.resolve(__dirname, '../server/clientCertificates/openmrs_cert.pem');
const CLIENT_KEY = path.resolve(__dirname, '../server/clientCertificates/openmrs_key.pem');
const SERVER_CERT = path.resolve(__dirname, '../server/serverCertificates/server_cert.pem');

if (!process.argv[2]) {
  logger.error('Please specify path to a JSON file');
  process.exit();
}
const jsonFile = process.argv[2];
let csvTrueLinks = '';
if (process.argv[3]) {
  csvTrueLinks = process.argv[3];
}

try {
  if (!fs.existsSync(jsonFile)) {
    logger.error(`Cant find file ${jsonFile}`);
    process.exit();
  }
  if (!fs.existsSync(csvTrueLinks)) {
    csvTrueLinks = '';
  }
} catch (err) {
  logger.error(err);
  process.exit();
}

const ext = path.extname(jsonFile);
const extTrueLinks = path.extname(csvTrueLinks);
if (ext !== '.json') {
  logger.error('File is not a JSON');
  process.exit();
}
if (extTrueLinks !== '.csv') {
  csvTrueLinks = '';
}

const patients = require(path.resolve(process.cwd(), jsonFile));

logger.info('Upload started ...');

console.time('Total Processing Time');
console.time('Processing Took');
const agentOptions = {
  cert: fs.readFileSync(CLIENT_CERT),
  key: fs.readFileSync(CLIENT_KEY),
  ca: fs.readFileSync(SERVER_CERT),
  securityOptions: 'SSL_OP_NO_SSLv3',
};
const options = {
  url: `${TEST_BACKEND_ORIGIN}/fhir`,
  agentOptions,
  json: patients,
};
request.post(options, (err, res, body) => {
  if (err) {
    logger.error('An error has occured');
    logger.error(err);
    return;
  }
  if (res?.headers?.location) {
    logger.info({
      'Patient ID': res.headers.location,
      'Patient CRUID': res.headers.locationcruid,
    });
  } else {
    logger.error('Something went wrong, no CRUID created');
  }
  console.timeEnd('Processing Took');

  console.timeEnd('Total Processing Time');
  if (csvTrueLinks) {
    const uploadResults = require('./uploadResults.ts');
    uploadResults.uploadResults(csvTrueLinks);
  } else {
    console.log(
      'True links were not specified then upload results wont be displayed'
    );
  }
});
