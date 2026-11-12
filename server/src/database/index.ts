import { AppwriteAdapter } from './appwriteAdapter';
import { IDatabaseAdapter } from './types';

// Singleton instance of the active database adapter
// To migrate to PostgreSQL / Supabase, simply instantiate a PostgresAdapter here!
export const db: IDatabaseAdapter = new AppwriteAdapter();

export * from './types';
