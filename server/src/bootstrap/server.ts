// @ts-nocheck
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import async from 'async';
import jwt from 'jsonwebtoken';
import medUtils from 'openhim-mediator-utils';
import prerequisites from '@infra/metadata/prerequisites.ts';
import generalMixin from '@shared/utils/generalMixin.ts';
import cacheFHIR from '@infra/fhir/cacheFHIR.ts';
import config from '@config/index.ts';
import logger from '@config/logger.ts';
import mediatorConfig from '@cfg/mediator.json';
import userRouter from '@http/routes/user.ts';
import fhirRoutes from '@http/routes/fhir.ts';
import matchRoutes from '@http/routes/match.ts';
import csvRoutes from '@http/routes/csv.ts';
import configRoutes from '@http/routes/config.ts';

const cacheFHIRAny: any = cacheFHIR;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverCertDir = path.join(__dirname, '../../serverCertificates');
const guiDir = path.join(__dirname, '../../gui');
const configDir = path.join(__dirname, '../../config');

const serverOpts = {
  key: fs.readFileSync(path.join(serverCertDir, 'server_key.pem')),
  cert: fs.readFileSync(path.join(serverCertDir, 'server_cert.pem')),
  requestCert: true,
  rejectUnauthorized: false,
  ca: [fs.readFileSync(path.join(serverCertDir, 'server_cert.pem'))],
};

if (config.get('mediator:register')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

generalMixin.removeDir(path.join(guiDir, 'tmp'));

let authorized = false;

function appRoutes() {
  const app = express();
  app.set('trust proxy', true);
  app.use(bodyParser.json({
    limit: '10Mb',
    type: ['application/fhir+json', 'application/json+fhir', 'application/json']
  }));
  app.use('/crux', express.static(guiDir));

  const jwtValidator = function (req, res, next) {
    if (!req.path.startsWith('/ocrux')) {
      return next();
    }
    if (req.method === 'OPTIONS' || req.path === '/ocrux/user/authenticate') {
      authorized = true;
      return next();
    }
    if (!req.headers.authorization || req.headers.authorization.split(' ').length !== 2) {
      logger.error('Token is missing');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('WWW-Authenticate', 'Bearer realm="Token is required"');
      res.set('charset', 'utf - 8');
      res.status(401).json({
        error: 'Token is missing',
      });
      return;
    }

    const tokenArray = req.headers.authorization.split(' ');
    const token = req.headers.authorization = tokenArray[1];
    jwt.verify(token, config.get('auth:secret'), (err) => {
      if (err) {
        logger.warn('Token expired');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('WWW-Authenticate', 'Bearer realm="Token expired"');
        res.set('charset', 'utf - 8');
        res.status(401).json({
          error: 'Token expired',
        });
        return;
      }
      authorized = true;
      if (req.path === '/ocrux/isTokenActive/') {
        res.set('Access-Control-Allow-Origin', '*');
        res.status(200).send(true);
      } else {
        return next();
      }
    });
  };

  function certificateValidity(req, res, next) {
    if (req.path.startsWith('/ocrux')) {
      return next();
    }
    if (authorized) {
      return next();
    }
    const cert = req.connection.getPeerCertificate();
    if (req.client.authorized) {
      if (!cert.subject.CN) {
        logger.error('Client has submitted a valid certificate but missing Common Name (CN)');
        return res.status(400).send('You have submitted a valid certificate but missing Common Name (CN)');
      }
    } else if (cert.subject) {
      logger.error(`Client ${cert.subject.CN} has submitted an invalid certificate`);
      return res.status(403).send('Sorry, you have submitted an invalid certificate, make sure that your certificate is signed by client registry');
    } else {
      logger.error('Client has submitted request without certificate');
      return res.status(401).send('Sorry, you need to provide a client certificate to continue.');
    }
    next();
  }

  function cleanReqPath(req, res, next) {
    req.url = req.url.replace('ocrux/', '');
    return next();
  }

  app.use(jwtValidator);
  if (!config.get('mediator:register')) {
    app.use(certificateValidity);
  }
  app.use(cleanReqPath);
  app.use('/user', userRouter);
  app.use('/fhir', fhirRoutes);
  app.use('/match', matchRoutes);
  app.use('/csv', csvRoutes);
  app.use('/config', configRoutes);

  app.post('/updateConfig', (req, res) => {
    let configsPath;
    try {
      configsPath = JSON.parse(req.body);
    } catch {
      configsPath = req.body;
    }
    const env = process.env.NODE_ENV || 'development';
    const configFile = path.join(configDir, `config_${env}.json`);
    const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));

    async.eachSeries(configsPath, (configPath, nxt) => {
      const pathKey = Object.keys(configPath)[0];
      const value = Object.values(configPath)[0];
      config.set(pathKey, value);
      setNestedKey(configData, pathKey.split(':'), value, () => nxt());
    }, () => {
      if (!configData) {
        return res.status(500).send();
      }
      fs.writeFile(configFile, JSON.stringify(configData, null, 2), (err) => {
        if (err) {
          logger.error(err);
          return res.status(500).send(err);
        }
        logger.info('Done updating config file');
        return res.status(200).send();
      });
    });

    function setNestedKey(obj, pathParts, value, callback) {
      if (pathParts.length === 1) {
        obj[pathParts[0]] = value;
        return callback();
      }
      setNestedKey(obj[pathParts[0]], pathParts.slice(1), value, () => callback());
    }
  });

  return app;
}

function reloadConfig(data, callback) {
  const tmpFile = path.join(configDir, 'tmpConfig.json');
  fs.writeFile(tmpFile, JSON.stringify(data, null, 2), err => {
    if (err) {
      throw err;
    }
    config.file(tmpFile);
    return callback();
  });
}

function start(callback) {
  const host = config.get('app:host');
  const port = config.get('app:port');

  if (config.get('mediator:register')) {
    logger.info('Running client registry as a mediator');
    medUtils.registerMediator(config.get('mediator:api'), mediatorConfig, err => {
      if (err) {
        logger.error('Failed to register this mediator, check your config');
        logger.error(err.stack);
        process.exit(1);
      }

      config.set('mediator:api:urn', mediatorConfig.urn);

      medUtils.fetchConfig(config.get('mediator:api'), (fetchErr, newConfig) => {
        if (fetchErr) {
          logger.info('Failed to fetch initial config');
          logger.info(fetchErr.stack);
          process.exit(1);
        }

        const env = process.env.NODE_ENV || 'development';
        const configFile = JSON.parse(fs.readFileSync(path.join(configDir, `config_${env}.json`), 'utf8'));
        const updatedConfig = Object.assign(configFile, newConfig);

        reloadConfig(updatedConfig, () => {
          config.set('mediator:api:urn', mediatorConfig.urn);
          logger.info('Received initial config:', newConfig);
          logger.info('Successfully registered mediator!');

          prerequisites.init((initErr) => {
            if (initErr) {
              process.exit();
            }
            if (config.get('matching:tool') === 'elasticsearch') {
              const runsLastSync = config.get('sync:lastFHIR2ESSync');
              cacheFHIRAny.refreshCache(() => {
                cacheFHIRAny.fhir2ES({ lastSync: runsLastSync }, () => {});
                logger.info('Ready to serve requests');
                const app = appRoutes();
                const server = https.createServer(serverOpts, app).listen(port, host, () => {
                  const configEmitter = medUtils.activateHeartbeat(config.get('mediator:api'));
                  configEmitter.on('config', updatedMediatorConfig => {
                    logger.info('Received updated config:', updatedMediatorConfig);
                    const mergedConfig = Object.assign(configFile, updatedMediatorConfig);
                    reloadConfig(mergedConfig, () => {
                      prerequisites.init((reinitErr) => {
                        if (reinitErr) {
                          process.exit();
                        }
                        if (config.get('matching:tool') === 'elasticsearch') {
                          const nextLastSync = config.get('sync:lastFHIR2ESSync');
                          cacheFHIRAny.fhir2ES({ lastSync: nextLastSync }, () => {});
                        }
                      });
                      config.set('mediator:api:urn', mediatorConfig.urn);
                    });
                  });
                  callback(server);
                });
              });
            } else {
              logger.info('Ready to serve requests');
              const app = appRoutes();
              const server = https.createServer(serverOpts, app).listen(port, host, () => {
                const configEmitter = medUtils.activateHeartbeat(config.get('mediator:api'));
                configEmitter.on('config', updatedMediatorConfig => {
                  logger.info('Received updated config:', updatedMediatorConfig);
                  const mergedConfig = Object.assign(configFile, updatedMediatorConfig);
                  reloadConfig(mergedConfig, () => {
                    prerequisites.init((reinitErr) => {
                      if (reinitErr) {
                        process.exit();
                      }
                    });
                    config.set('mediator:api:urn', mediatorConfig.urn);
                  });
                });
                callback(server);
              });
            }
          });
        });
      });
    });
  } else {
    logger.info('Running client registry as a stand alone');
    logger.info('Checking if all elasticsearch plugins are installed');

    prerequisites.init((initErr) => {
      if (initErr) {
        process.exit();
      }
      if (config.get('matching:tool') === 'elasticsearch') {
        const runsLastSync = config.get('sync:lastFHIR2ESSync');
        cacheFHIRAny.fhir2ES({ lastSync: runsLastSync }, () => {});
      }

      const app = appRoutes();
      const server = https.createServer(serverOpts, app).listen(port, host, () => {
        logger.info(`Server is running and listening on port: ${config.get('app:port')}`);
        callback(server);
      });
    });
  }
}

export { appRoutes, reloadConfig, start };
