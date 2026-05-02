// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import moment from 'moment';
import winston from 'winston';
import 'winston-daily-rotate-file';

const logPrefix = 'openclientregistry-';
const maxLogFiles = 10;
const logDatePattern = 'YYYY-MM-DD-HH';
const transports: any[] = [new winston.transports.Console()];

function resolveLogDir(): string | null {
  const candidateDirs = [
    process.env.OPENCR_LOG_DIR,
    '/var/log',
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../../logs')
  ].filter(Boolean) as string[];

  for (const candidate of candidateDirs) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

const logDir = resolveLogDir();

if (process.env.NODE_ENV !== 'test') {
  if (logDir) {
    try {
      const transport = new winston.transports.DailyRotateFile({
        dirname: logDir,
        filename: `${logPrefix}%DATE%.log`,
        datePattern: logDatePattern,
        zippedArchive: true,
        maxSize: '10m',
        maxFiles: '14d',
      });
      transport.on('rotate', () => {
        deleteOldLogs();
      });
      transport.on('new', () => {
        deleteOldLogs();
      });
      transport.on('archive', () => {
        deleteOldLogs();
      });
      transports.push(transport);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Falling back to console-only logging: ${message}`);
    }
  }
}

const logger: any = winston.createLogger({
  transports,
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
});

function deleteOldLogs(): void {
  if (!logDir) {
    return;
  }

  fs.readdir(logDir, (err, files) => {
    if (err) {
      return;
    }
    const logs = files.filter(file => file.startsWith(logPrefix));
    if (logs.length > maxLogFiles) {
      const keep: string[] = [];
      for (const file of logs) {
        if (keep.length < maxLogFiles) {
          keep.push(file);
          continue;
        }
        let removeKept = file.replace(logPrefix, '').split('.log')[0];
        let removeKeptIndex = -1;
        for (const index in keep) {
          let keptDate = keep[index].replace(logPrefix, '');
          keptDate = keep[index].split('.log')[0];
          if (moment(keptDate, logDatePattern) < moment(removeKept, logDatePattern)) {
            removeKept = keptDate;
            removeKeptIndex = Number(index);
          }
        }
        if (removeKeptIndex !== -1) {
          keep.splice(removeKeptIndex, 1);
          keep.push(file);
        }
      }
      for (const file of logs) {
        const exist = keep.find(kp => kp === file);
        if (!exist) {
          try {
            fs.unlinkSync(`${logDir}/${file}`);
          } catch {
            continue;
          }
        }
      }
    }
  });
}

deleteOldLogs();

export default logger;
