import { AppwriteAdapter } from './appwriteAdapter';
import { PocketBaseAdapter } from './pocketbaseAdapter';
import { IDatabaseAdapter } from './types';
import { config } from '../config';

// Singleton instance of the active database adapter
// To migrate between providers, set DB_ADAPTER=appwrite|pocketbase.
function createAdapter(): IDatabaseAdapter {
  switch (config.dbAdapter) {
    case 'pocketbase':
      return new PocketBaseAdapter();
    case 'appwrite':
    default:
      return new AppwriteAdapter();
  }
}

export const db: IDatabaseAdapter = createAdapter();

export * from './types';
