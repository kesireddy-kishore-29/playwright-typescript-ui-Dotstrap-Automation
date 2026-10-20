import { z } from 'zod';

/**
 * Every URL, credential and timeout the framework uses, validated once at start-up. A bad value
 * fails the run before the first browser opens, with every problem listed together.
 * Override any key with an environment variable of the same name.
 */
const RecordMode = z.enum(['failures', 'all', 'off']);

const EnvSchema = z.object({
  SAUCE_BASE_URL: z.url().default('https://www.saucedemo.com'),
  // Public demo credentials published on the Sauce Demo login page itself.
  SAUCE_USERNAME: z.string().min(1).default('standard_user'),
  SAUCE_PASSWORD: z.string().min(1).default('secret_sauce'),

  APP_PORT: z.coerce.number().int().min(1024).max(65535).default(4173),
  APP_BASE_URL: z.url().optional(),
  // Seeded demo account of the self-hosted app; not a real person.
  APP_USERNAME: z.string().min(1).default('ava@example.test'),
  APP_PASSWORD: z.string().min(8).default('demo-password-1'),

  LIVE_BASE_URL: z.url().default('https://dotstrap.com'),

  ACTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  NAVIGATION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  EXPECT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(7_000),

  RECORD_MODE: RecordMode.default('failures'),
  EVIDENCE_ROOT: z.string().min(1).default('run-evidence'),
  RUN_ID: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,80}$/, 'letters, digits, ".", "_" and "-" only')
    .optional(),
  CI: z.stringbool().default(false),
});

export type Env = z.infer<typeof EnvSchema> & { APP_BASE_URL: string; RUN_ID: string };
export type RecordModeValue = z.infer<typeof RecordMode>;

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..*$/, '');
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid test configuration:\n${z.prettifyError(result.error)}`);
  }
  const parsed = result.data;
  return {
    ...parsed,
    APP_BASE_URL: parsed.APP_BASE_URL ?? `http://localhost:${String(parsed.APP_PORT)}`,
    RUN_ID: parsed.RUN_ID ?? `local-${timestamp()}`,
  };
}

export const env: Env = parseEnv(process.env);
