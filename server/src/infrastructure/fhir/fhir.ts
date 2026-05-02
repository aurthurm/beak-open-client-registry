// @ts-nocheck
import request from 'request';
import URI from 'urijs';
import async from 'async';
import { v4 as uuid4 } from 'uuid';
import isJSON from 'is-json';
import logger from '@config/logger.ts';
import config from '@config/index.ts';
import fhirPkg from 'fhir';

const Fhir = fhirPkg.Fhir;

class InvalidRequestError extends Error {
  response: {
    status: number;
    body: {
      resourceType: string;
      issue: Array<{
        severity: string;
        code: string;
        diagnostics: string;
      }>;
    };
  };

  constructor(message: string, status?: number) {
    super(message);
    this.response = {
      status: status || 400,
      body: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'required',
            diagnostics: message,
          },
        ],
      },
    };
  }
}

type Callback = (resourceData: any, statusCode: number) => void;
const asyncAny: any = async;

export default () => ({
  getResource({
    resource,
    extraPath = [],
    noCaching = false,
    url: initialUrl,
    id,
    query,
    count
  }: {
    resource?: string;
    extraPath?: string[];
    noCaching?: boolean;
    url?: string;
    id?: string;
    query?: string;
    count?: any;
  }, callback: Callback) {
    let statusCode = 500;
    let url: any = initialUrl;
    let resourceData: any = { entry: [] };
    let workingUrl: any;
    if (!url) {
      workingUrl = URI(config.get('fhirServer:baseURL')).segment(resource);
      for (const path of extraPath) {
        workingUrl = workingUrl.segment(path);
      }
      if (id) {
        workingUrl = workingUrl.segment(id);
      }
      if (count && !isNaN(Number(count))) {
        workingUrl = workingUrl.addQuery('_count', count as number);
      } else {
        count = 0;
      }
      if (query) {
        const queries = query.split('&');
        for (const qr of queries) {
          const qrArr = qr.split('=');
          if (qrArr.length !== 2) {
            logger.error('Invalid query supplied, stop getting resources');
            return callback(resourceData, 400);
          }
          workingUrl = workingUrl.addQuery(qrArr[0], qrArr[1]);
          if (qrArr[0] === '_count') {
            count = true;
          }
        }
      }
      url = workingUrl.toString();
    } else {
      count = true;
    }
    logger.info(`Getting ${url} from server`);
    let headers: any = {};
    if (noCaching) {
      headers = { 'Cache-Control': 'no-cache' };
    }
    asyncAny.whilst(
      (callback1: any) => callback1(null, url !== false),
      (callback2: any) => {
        const options = {
          url,
          withCredentials: true,
          auth: {
            username: config.get('fhirServer:username'),
            password: config.get('fhirServer:password'),
          },
          headers
        };
        url = false as any;
        request.get(options, (err, res, body) => {
          statusCode = res.statusCode;
          if (res && (res.statusCode < 200 || res.statusCode > 299) && res.statusCode !== 404) {
            logger.error(body);
          }
          if (err) {
            logger.error(err);
          }
          if (!isJSON(body)) {
            logger.error(options);
            logger.error(body);
            logger.error('Non JSON has been returned while getting data for resource ' + resource);
            return callback2(null, false as any);
          }
          body = JSON.parse(body);
          if ((id && body) || body.resourceType !== 'Bundle') {
            resourceData = body;
          } else if (body.entry && body.entry.length > 0) {
            if (count) {
              resourceData = { ...body };
            } else {
              resourceData.entry = resourceData.entry.concat(body.entry);
            }
          } else {
            resourceData = { ...body };
            resourceData.entry = [];
          }
          let next = body.link && body.link.find((link: any) => link.relation === 'next');

          if (err || res.statusCode < 200 || res.statusCode > 299) {
            next = false;
          }
          if (!count || (count && !isNaN(Number(count)) && resourceData.entry && resourceData.entry.length < Number(count))) {
            if (next) {
              url = next.url;
            }
          }
          if (!id) {
            resourceData.link = body.link;
          }
          return callback2(null, url as any);
        });
      }, () => callback(resourceData, statusCode)
    );
  },

  deleteResource(resource: string, callback: (err: any, body?: any) => void) {
    const url = URI(config.get('fhirServer:baseURL'))
      .segment(resource)
      .toString();
    const options = {
      url,
      withCredentials: true,
      auth: {
        username: config.get('fhirServer:username'),
        password: config.get('fhirServer:password'),
      },
    };
    request.delete(options, (err, res, body) => {
      if (err) {
        logger.error(err);
        return callback(err);
      }
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 399)) {
        return callback(true);
      }
      callback(err, body);
    });
  },

  saveResource({ resourceData }: { resourceData: any }, callback: (err: any, body?: any) => void) {
    logger.info('Saving resource data');
    const url = URI(config.get('fhirServer:baseURL')).toString();
    const options = {
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      auth: {
        username: config.get('fhirServer:username'),
        password: config.get('fhirServer:password'),
      },
      json: resourceData,
    };
    request.post(options, (err, res, body) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        logger.error('saving ' + JSON.stringify(resourceData, null, 2));
        logger.error(JSON.stringify(body, null, 2));
        err = true;
      }
      if (err) {
        logger.error(err);
        return callback(err, body);
      }
      logger.info('Resource(s) data saved successfully');
      callback(err, body);
    });
  },

  create(resource: any, callback: (code: number, err: any, res?: any, body?: any) => void) {
    let err;
    if (resource === undefined) {
      err = new InvalidRequestError('resource must be defined');
      err.response = { status: 400 };
      return callback(400, err);
    }
    let url = URI(config.get('fhirServer:baseURL'));
    if (resource.resourceType !== 'Bundle') {
      url = url.segment(resource.resourceType);
    } else {
      if (!(resource.type === 'transaction' || resource.type === 'batch')) {
        err = new InvalidRequestError("Bundles must of type 'transaction' or 'batch'");
        err.response = { status: 400 };
        return callback(400, err);
      }
    }
    url = url.toString();
    const options = {
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
      auth: {
        username: config.get('fhirServer:username'),
        password: config.get('fhirServer:password'),
      },
      json: resource,
    };
    request.post(options, (reqErr, res, body) => {
      let code;
      if (res && res.statusCode) {
        code = res.statusCode;
      } else {
        code = 500;
      }
      return callback(code, reqErr, res, body);
    });
  },

  '$meta-delete'({
    resourceParameters,
    resourceType,
    resourceID
  }: {
    resourceParameters: any;
    resourceType: string;
    resourceID: string;
  }) {
    return new Promise((resolve, reject) => {
      const url = URI(config.get('fhirServer:baseURL'))
        .segment(resourceType)
        .segment(resourceID)
        .segment('$meta-delete')
        .toString();
      const options = {
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
        auth: {
          username: config.get('fhirServer:username'),
          password: config.get('fhirServer:password'),
        },
        json: resourceParameters,
      };
      request.post(options, (err, res, body) => {
        if (err || !res.statusCode || (res.statusCode < 200 && res.statusCode > 299)) {
          return reject(err || body);
        }
        return resolve(body);
      });
    });
  },

  createGoldenRecord() {
    return {
      id: uuid4(),
      resourceType: 'Patient',
      meta: {
        tag: [{
          code: config.get('codes:goldenRecord'),
          display: 'Golden Record'
        }]
      }
    };
  },
});
