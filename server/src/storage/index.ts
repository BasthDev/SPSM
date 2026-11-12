import { AppwriteStorageAdapter } from './appwriteStorageAdapter';
import { IStorageAdapter } from './types';

export const storageAdapter: IStorageAdapter = new AppwriteStorageAdapter();

export * from './types';
