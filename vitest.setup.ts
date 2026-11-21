import { vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './src/server/db/schema';

export let testDb: PgliteDatabase<typeof schema>;

vi.mock('~/server/db', async (importOriginal) => {
  // ESM/dynamic import issues with drizzle-kit/api, this is a workaround
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { createRequire } = await vi.importActual<typeof import('node:module')>(
    'node:module',
  );
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const kitApi = require('drizzle-kit/api') as typeof import('drizzle-kit/api');
  const pushSchema = kitApi.pushSchema;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const pglite = new PGlite();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  testDb = drizzle(pglite, { schema, logger: false });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const { apply } = await pushSchema(schema, testDb as never);
  await apply(); // Execute the generated DDL statements

  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const originalModule = await importOriginal<typeof import('~/server/db')>();

  // Return the mocked module
  return {
    ...originalModule,
    db: testDb, // Provide the PGLite-backed instance
  };
});

vi.mock("~/server/mail", () => ({
  sendEmail: vi.fn().mockResolvedValue({
    data: { delivered: ["mocked@example.com"], queued: [], bounced: [] },
    error: null,
  }),
}));

// Signup email validation does a live MX lookup; stub it so tests never hit DNS.
// Individual tests can override resolveMx (e.g. to simulate a nonexistent domain).
vi.mock("dns/promises", () => ({
  resolveMx: vi.fn().mockResolvedValue([{ exchange: "mx.test", priority: 10 }]),
}));

// No test may reach Slack, Mailjet or Google with the real fetch. Tests that
// stub fetch (vi.stubGlobal or a fetch dependency) never get here; anything
// that falls through to the real network for these hosts fails loudly.
const BLOCKED_HOSTS = [/(^|\.)slack\.com$/, /(^|\.)mailjet\.com$/, /(^|\.)googleapis\.com$/];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (BLOCKED_HOSTS.some((host) => host.test(url.hostname))) {
    throw new Error(`Test tried to reach ${url.hostname}: mock it.`);
  }
  return realFetch(input, init);
}) as typeof fetch;

// No test may write to a Google Sheet: the run-of-show service account is
// Editor on the live sheet. sheetWritesEnabled() (run-of-show-sheet.ts)
// returns false whenever process.env.VITEST is set, so both mirrors write
// nothing and getSheetsClient asks for the read-only scope. A test that
// exercises a write mocks sheetWritesEnabled AND googleapis (or passes a
// fake sheet). SHEET_WRITES is also blanked for the suite (vitest.config.ts).
if (!process.env.VITEST) {
  throw new Error("vitest.setup.ts expects process.env.VITEST to be set");
}
