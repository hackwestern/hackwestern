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
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: "mocked-email-id" },
        error: null,
      }),
    },
  },
}));
