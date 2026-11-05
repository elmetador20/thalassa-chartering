import { inject } from 'vitest';

// The app's database client reads DATABASE_URL lazily on first use, so
// setting it here — before any test runs — points it at the test database.
process.env.DATABASE_URL = inject('databaseUrl');
