/**
 * PocketBase schema bootstrap for SPSM.
 * Creates all collections mirroring the Appwrite snake_case schema.
 * Usage: POCKETBASE_URL=... POCKETBASE_ADMIN_EMAIL=... POCKETBASE_ADMIN_PASSWORD=... node scripts/setup-pocketbase.mjs
 */
import PocketBase from 'pocketbase';

const url = process.env.POCKETBASE_URL || 'https://spsm.basthstudio.my.id';
const email = process.env.POCKETBASE_ADMIN_EMAIL;
const password = process.env.POCKETBASE_ADMIN_PASSWORD;
if (!email || !password) {
  console.error('Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD');
  process.exit(1);
}

const pb = new PocketBase(url);
await pb.collection('_superusers').authWithPassword(email, password);

const T = (name, extra = {}) => ({ name, type: 'text', required: false, ...extra });
const N = (name, extra = {}) => ({ name, type: 'number', required: false, ...extra });
const B = (name, extra = {}) => ({ name, type: 'bool', required: false, ...extra });
const D = (name, extra = {}) => ({ name, type: 'date', required: false, ...extra });
const J = (name, extra = {}) => ({ name, type: 'json', required: false, ...extra });
const FILE = (name, extra = {}) => ({ name, type: 'file', required: false, maxSelect: 1, ...extra });

const apiRule = ''; // admin-only by default via backend; tighten later
const collections = [
  {
    name: 'users',
    type: 'auth',
    fields: [
      T('user_id'),           // legacy Appwrite user id
      T('name'),              // nama lengkap (Google OAuth / onboarding)
      T('role'),              // student | lecturer | kaprodi | akademik | reviewer
      T('nim_or_nip'),
      T('department'),
      N('batch_year'),
      N('current_sks'),
      T('academic_requirements'),
      T('avatar_url'),
      FILE('avatar'),
      T('phone'),
      B('has_uploaded_thesis'),
      T('push_token'),
      T('appwrite_id'),       // migration mapping
      T('external_id'),       // future external user directory mapping
    ],
    options: { allowEmailAuth: false, allowOAuth2Auth: true, minPasswordLength: 8 },
  },
  {
    name: 'thesis_submissions',
    type: 'base',
    fields: [
      T('student_id', { required: true }),
      T('advisor_1_id'),
      T('advisor_2_id'),
      T('advisor_id'),
      T('preferred_advisor_1_id'),
      T('preferred_advisor_2_id'),
      T('status', { required: true }),
      D('submitted_at'),
      T('reviewer_notes'),
      T('kaprodi_notes'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'submission_options',
    type: 'base',
    fields: [
      T('submission_id', { required: true }),
      N('option_number', { required: true }),
      T('title', { required: true }),
      T('background'),
      T('relevance_table'),
      T('relevance_variable'),
      T('relevance_methodology'),
      T('relevance_note'),
      T('journal_title'),
      T('journal_author'),
      T('journal_year'),
      T('journal_file_id'),
      FILE('journal_file'),
      B('is_selected'),
      B('is_selected_by_lecturer'),
      T('lecturer_notes'),
      T('review_notes'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'approval_logs',
    type: 'base',
    fields: [
      T('submission_id', { required: true }),
      T('actor_id', { required: true }),
      T('action', { required: true }),
      T('notes'),
      D('created_at'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'surat',
    type: 'base',
    fields: [
      T('submission_id', { required: true }),
      T('nomor_surat'),
      N('urutan'),
      T('no_dokumen'),
      T('template_sk_id'),
      FILE('template_sk'),
      T('scanned_sk_id'),
      FILE('scanned_sk'),
      D('created_at'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'lecturers',
    type: 'base',
    fields: [
      T('user_id'),
      T('nip', { required: true }),
      T('name', { required: true }),
      T('email'),
      T('phone'),
      T('department_id'),
      T('expertise'),
      N('quota'),
      N('current_students'),
      N('rejected_assignments'),
      J('rejection_history'),
      T('role'),
      B('is_active'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'departments',
    type: 'base',
    fields: [
      T('name', { required: true }),
      T('code', { required: true }),
      T('faculty'),
      B('is_active'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'batch_years',
    type: 'base',
    fields: [
      N('year', { required: true }),
      T('label'),
      B('is_active'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'system_settings',
    type: 'base',
    fields: [
      T('academic_year'),
      B('is_active'),
      T('start_date'),
      T('end_date'),
      N('min_sks'),
      N('required_title_count'),
      J('required_courses'),
      T('appwrite_id'),
    ],
  },
  // ---- File storage buckets (dipakai pocketbaseStorageAdapter) ----
  {
    name: 'repo_files',
    type: 'base',
    fields: [
      T('name'),
      T('original_name'),
      N('size'),
      T('mime'),
      T('kind'),
      T('submission_id'),
      FILE('file'),
      T('appwrite_id'),
    ],
  },
  {
    name: 'sk_files',
    type: 'base',
    fields: [
      T('name'),
      T('original_name'),
      N('size'),
      T('mime'),
      T('kind'),           // template | scan | generated
      T('submission_id'),
      FILE('file'),
      T('appwrite_id'),
    ],
  },
];

const rules = {
  listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
};

for (const c of collections) {
  const body = { ...c, listRule: apiRule, viewRule: apiRule, createRule: apiRule, updateRule: apiRule, deleteRule: apiRule };
  try {
    const existing = await pb.collections.getFirstListItem('name = "' + c.name + '"').catch(() => null);
    if (existing) {
      await pb.collections.update(existing.id, body);
      console.log('updated', c.name);
    } else {
      await pb.collections.create(body);
      console.log('created', c.name);
    }
  } catch (e) {
    console.error('FAILED', c.name, e.message || e);
    if (e.response) console.error(JSON.stringify(e.response).slice(0, 500));
  }
}

console.log('done');
