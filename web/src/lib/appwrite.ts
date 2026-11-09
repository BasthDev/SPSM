import { Client, Databases, Storage, Account, Query, ID } from 'appwrite';

export const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
  projectId: '6af1b3b200056ab6bc1d',
  databaseId: 'spsm_db',
  storageBucketId: 'journal_files',
  collections: {
    users: 'users',
    thesisSubmissions: 'thesis_submissions',
    submissionOptions: 'submission_options',
    approvalLogs: 'approval_logs',
    departments: 'departments',
    batchYears: 'batch_years',
    lecturers: 'lecturers',
  },
};

export const client = new Client();
client
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

export const databases = new Databases(client);
export const storage = new Storage(client);
export const account = new Account(client);

export { Query, ID };
