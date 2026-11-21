import { afterAll, inject } from 'vitest';

// The app's database client reads DATABASE_URL lazily on first use, so
// setting it here — before any test runs — points it at the test database.
process.env.DATABASE_URL = inject('databaseUrl');

// Close the pool after each file so the worker can exit cleanly (otherwise
// vitest waits on open sockets and warns that it could not tear down).
afterAll(async () => {
  const { getDb } = await import('@/lib/server/db');
  await getDb().$disconnect();
});
