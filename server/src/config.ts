import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: (() => {
    const s = process.env.JWT_SECRET || '';
    if (!s || s.length < 16) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[config] JWT_SECRET wajib diset di .env production (min 32 karakter)!');
      }
      return s || 'dev_only_spsm_secret_not_for_production_12345678';
    }
    return s;
  })(),
  dbAdapter: process.env.DB_ADAPTER || 'appwrite',
  pocketbase: {
    url: process.env.POCKETBASE_URL || 'https://spsm.basthstudio.my.id',
    adminEmail: process.env.POCKETBASE_ADMIN_EMAIL || '',
    adminPassword: process.env.POCKETBASE_ADMIN_PASSWORD || '',
  },
  appwrite: {
    endpoint: process.env.APPWRITE_ENDPOINT || 'https://spsm.basthstudio.my.id/v1',
    projectId: process.env.APPWRITE_PROJECT_ID || '6af9b97e002cf5c78067',
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
    // Appwrite Messaging → Push provider (FCM). ID provider dari Appwrite Console > Messaging > Providers.
    messagingProviderId: process.env.APPWRITE_MESSAGING_PROVIDER_ID || '6af5e387003576bf7f1c',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-2.0-flash',
  },
  fcm: {
    // Service account Firebase (JSON inline atau path file) — untuk FCM HTTP v1.
    serviceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON || '',
    serviceAccountPath: process.env.FCM_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },
};
