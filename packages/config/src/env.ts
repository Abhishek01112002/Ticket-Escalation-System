import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEV_AUTH_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DEFAULT_ORGANIZATION_NAME: z.string().trim().min(1).default('Nvara Media'),
  PUBLIC_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().max(10_000).default(60),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SLA_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
});

export type AppConfig = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join('.') + ' ' + issue.message).join('; ')}`);
  if (parsed.data.NODE_ENV === 'production' && parsed.data.DEV_AUTH_ENABLED) throw new Error('Invalid environment configuration: DEV_AUTH_ENABLED must be false in production.');
  if (parsed.data.NODE_ENV === 'production' && !env.DEFAULT_ORGANIZATION_NAME?.trim()) throw new Error('Invalid environment configuration: DEFAULT_ORGANIZATION_NAME is required in production.');
  if (parsed.data.NODE_ENV === 'production' && /^https?:\/\/localhost(?::\d+)?$/i.test(parsed.data.WEB_ORIGIN)) throw new Error('Invalid environment configuration: WEB_ORIGIN must not use localhost in production.');
  return parsed.data;
}
