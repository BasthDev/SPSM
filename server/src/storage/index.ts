import { AppwriteStorageAdapter } from './appwriteStorageAdapter';
import { PocketBaseStorageAdapter } from './pocketbaseStorageAdapter';
import { IStorageAdapter } from './types';
import { config } from '../config';

export const storageAdapter: IStorageAdapter =
  config.dbAdapter === 'pocketbase'
    ? new PocketBaseStorageAdapter()
    : new AppwriteStorageAdapter();

export * from './types';
