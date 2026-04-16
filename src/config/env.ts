import path from 'path';
import dotenv from 'dotenv';
import { EnvConfig } from '../types';

// path.resolve asegura que funcione sin importar el cwd (CRON, Task Scheduler, etc.)
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

// Funciona desde src/config/ y dist/config/ — ambos a 2 niveles de la raiz
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Fail-fast: mejor fallar al arrancar que a las 8 AM cuando deberia enviar el report
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Variable de entorno "${key}" es requerida pero no esta definida. Revisa tu archivo .env`
    );
  }
  return value;
};

const parseCommaSeparated = (value: string): ReadonlyArray<string> =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

const parsePositiveInt = (value: string | undefined, fallback: number): number =>
  Math.max(0, parseInt(value ?? String(fallback), 10) || fallback);

const env: EnvConfig = {
  snmpCommunity: process.env.SNMP_COMMUNITY ?? 'public',

  smtpHost: requireEnv('SMTP_HOST'),
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: requireEnv('SMTP_USER'),
  smtpPass: requireEnv('SMTP_PASS'),

  mailFrom: requireEnv('MAIL_FROM'),
  mailTo: parseCommaSeparated(requireEnv('MAIL_TO')),
  cronSchedule: process.env.CRON_SCHEDULE ?? '0 8 28-31 * *',
  errorMailTo: parseCommaSeparated(requireEnv('ERROR_MAIL_TO')),
  maxRetries: parsePositiveInt(process.env.MAX_RETRIES, 3),
  retryDelayMs: parsePositiveInt(process.env.RETRY_DELAY_SECONDS, 60) * 1000,
};

export default env;
