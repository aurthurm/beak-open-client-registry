// @ts-nocheck
import fs from 'node:fs';
import logger from '@config/logger.ts';
import config from '@config/index.ts';

const env = process.env.NODE_ENV || 'development';

const isMatchBroken = (resourceData: any, reference: string) => {
  const isBroken = resourceData.extension && resourceData.extension.find((extension: any) => {
    return extension.url === config.get('systems:brokenMatch:uri') && extension.valueReference.reference === reference;
  });
  return isBroken;
};

const getClientDisplayName = (clientid: string) => {
  const clients = config.get('clients');
  const clientDet = clients.find((client: any) => {
    return client.id === clientid;
  });
  if (clientDet) {
    return clientDet.displayName;
  }
  return '';
};

const getClientIdentifier = (resource: any) => {
  const internalIdURI = config.get('systems:internalid:uri');
  const validSystem = resource.identifier && resource.identifier.find((identifier: any) => {
    return internalIdURI.includes(identifier.system) && identifier.value;
  });
  return validSystem;
};

const setNestedKey = (obj: any, path: string[], value: any, callback: () => void) => {
  if (path.length === 1) {
    obj[path[0]] = value;
    return callback();
  }
  setNestedKey(obj[path[0]], path.slice(1), value, () => {
    return callback();
  });
};

const updateConfigFile = (path: string[], newValue: any, callback: () => void) => {
  const pathString = path.join(':');
  config.set(pathString, newValue);
  logger.info('Updating config file');
  const configFile = `${__dirname}/../../../config/config_${env}.json`;
  const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  setNestedKey(configData, path, newValue, () => {
    fs.writeFile(configFile, JSON.stringify(configData, null, 2), (err) => {
      if (err) {
        throw err;
      }
      logger.info('Done updating config file');
      return callback();
    });
  });
};

const flattenComplex = (extension: any) => {
  const results: any = {};
  for (const ext of extension) {
    let value: any = '';
    for (const key of Object.keys(ext)) {
      if (key !== 'url') {
        value = ext[key];
      }
    }
    if (results[ext.url]) {
      if (Array.isArray(results[ext.url])) {
        results[ext.url].push(value);
      } else {
        results[ext.url] = [results[ext.url], value];
      }
    } else {
      if (Array.isArray(value)) {
        results[ext.url] = [value];
      } else {
        results[ext.url] = value;
      }
    }
  }
  return results;
};

const removeDir = function(path: string) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path);

    if (files.length > 0) {
      files.forEach(function(filename) {
        if (fs.statSync(path + '/' + filename).isDirectory()) {
          removeDir(path + '/' + filename);
        } else {
          fs.unlinkSync(path + '/' + filename);
        }
      });
      fs.rmdirSync(path);
    } else {
      fs.rmdirSync(path);
    }
  }
};

export default {
  updateConfigFile,
  flattenComplex,
  getClientIdentifier,
  getClientDisplayName,
  isMatchBroken,
  removeDir
};
