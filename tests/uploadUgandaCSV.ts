// @ts-nocheck
const fs = require('fs');
const requireFallback = require('./requireFallback.ts');
const { TEST_BACKEND_ORIGIN } = require('./ports.ts');
const async = requireFallback('async');
const csv = requireFallback('fast-csv');
const path = require('path');
const request = requireFallback('request');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const logger = require('../server/src/config/logger.ts').default;
const CLIENT_CERT = path.resolve(__dirname, '../server/clientCertificates/openmrs_cert.pem');
const CLIENT_KEY = path.resolve(__dirname, '../server/clientCertificates/openmrs_key.pem');
const SERVER_CERT = path.resolve(__dirname, '../server/serverCertificates/server_cert.pem');
const { buildPatientResource } = require('./patientCsvMapper.ts');

if (!process.argv[2]) {
  logger.error('Please specify path to a CSV file');
  process.exit();
}
const csvFile = process.argv[2];
let csvTrueLinks = '';
if (process.argv[3]) {
  csvTrueLinks = process.argv[3];
}

try {
  if (!fs.existsSync(csvFile)) {
    logger.error(`Cant find file ${csvFile}`);
    process.exit();
  }
  if (!fs.existsSync(csvTrueLinks)) {
    csvTrueLinks = '';
  }
} catch (err) {
  logger.error(err);
  process.exit();
}

const ext = path.extname(csvFile);
const extTrueLinks = path.extname(csvTrueLinks);
if (ext !== '.csv') {
  logger.error('File is not a CSV');
  process.exit();
}
if (extTrueLinks !== '.csv') {
  csvTrueLinks = '';
}

logger.info('Upload started ...');
let bundles = [];
let bundle = {};
const BATCH_SIZE = 250;
bundle.type = 'batch';
bundle.resourceType = 'Bundle';
bundle.entry = [];
const promises = [];
let totalRecords = 0;
fs.createReadStream(path.resolve(__dirname, '', csvFile))
  .pipe(
    csv.parse({
      headers: true,
    })
  )
  .on('error', error => console.error(error))
  .on('data', row => {
    promises.push(
      new Promise((resolve, reject) => {
        const resource = buildPatientResource(row, 'Uganda CSV Data');
        bundle.entry.push({
          resource,
        });
        if (bundle.entry.length === BATCH_SIZE) {
          bundles.push({
            ...bundle,
          });
          bundle.entry = [];
        }
        resolve();
      })
    );
  })
  .on('end', rowCount => {
    totalRecords = rowCount;
    if (bundle.entry.length > 0) {
      bundles.push(bundle);
    }
    Promise.all(promises).then(() => {
      let count = 0;
      async.eachSeries(
        bundles,
        (bundle, nxt) => {
          console.log(
            'Sending patient batch of ' + bundle.entry.length + ' records'
          );
          async.eachSeries(
            bundle.entry,
            (entry, nxtEntry) => {
              count++;
              console.log(`Processing ${count}/${totalRecords}`);
              const agentOptions = {
                cert: fs.readFileSync(CLIENT_CERT),
                key: fs.readFileSync(CLIENT_KEY),
                ca: fs.readFileSync(SERVER_CERT),
                securityOptions: 'SSL_OP_NO_SSLv3',
              };
              const options = {
                url: `${TEST_BACKEND_ORIGIN}/fhir/Patient`,
                agentOptions,
                json: entry.resource,
              };
              request.post(options, (err, res, body) => {
                if (err) {
                  logger.error('An error has occured');
                  logger.error(err);
                  return nxtEntry();
                }
                if (!res || !res.headers) {
                  logger.error('Something went wrong, this transaction was not successfully, please cross check the URL and authentication details;');
                  return nxtEntry();
                }
                if (res.headers.location) {
                  logger.info({
                    'Patient ID': res.headers.location,
                    'Patient CRUID': res.headers.locationcruid,
                  });
                } else {
                  logger.error('Something went wrong, no CRUID created');
                }
                return nxtEntry();
              });
            },
            () => {
              return nxt();
            }
          );
        },
        () => {
          if (csvTrueLinks) {
            const uploadResults = require('./uploadResults.ts');
            uploadResults.uploadResults(csvTrueLinks);
          } else {
            console.log(
              'True links were not specified then upload results wont be displayed'
            );
          }
        }
      );
    });
  });
