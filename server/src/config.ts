import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default_spsm_secret_jwt_change_in_prod',
  appwrite: {
    endpoint: process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1',
    projectId: process.env.APPWRITE_PROJECT_ID || '6af1b3b200056ab6bc1d',
    apiKey: process.env.APPWRITE_API_KEY || '',
    databaseId: process.env.APPWRITE_DATABASE_ID || 'spsm_db',
    collections: {
      users: 'users',
      submissions: 'thesis_submissions',
      options: 'submission_options',
      approvalLogs: 'approval_logs',
      departments: 'departments',
      batchYears: 'batch_years',
      lecturers: 'lecturers',
      systemSettings: 'system_settings',
      surat: 'surat',
    },
    buckets: {
      journals: process.env.APPWRITE_BUCKET_JOURNALS || 'journal_files',
      sk: process.env.APPWRITE_BUCKET_SK || 'journal_files',
    },
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-2.0-flash',
  },
};
