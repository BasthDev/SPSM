import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const DATABASE_ID = 'spsm_db';

// Read API key from api.txt or env
let API_KEY = process.env.APPWRITE_API_KEY;
if (!API_KEY) {
  const apiTxtPath = path.join(__dirname, '..', 'api.txt');
  if (fs.existsSync(apiTxtPath)) {
    API_KEY = fs.readFileSync(apiTxtPath, 'utf8').trim();
  }
}

if (!API_KEY) {
  console.error('Error: APPWRITE_API_KEY not found in env or api.txt');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': PROJECT_ID,
  'X-Appwrite-Key': API_KEY,
};

async function api(apiPath, options = {}) {
  const url = `${ENDPOINT}${apiPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text };
  }

  return { status: res.status, ok: res.ok, data: json };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Delete all existing collections
async function deleteAllCollections() {
  console.log(`\n--- [1/5] Checking and clearing collections in database '${DATABASE_ID}' ---`);
  const res = await api(`/databases/${DATABASE_ID}/collections?limit=100`);
  if (!res.ok) {
    console.log(`Note: Database '${DATABASE_ID}' may not exist yet (${res.status}). Will create it.`);
    return;
  }

  const collections = res.data.collections || [];
  console.log(`Found ${collections.length} existing collections.`);
  for (const col of collections) {
    process.stdout.write(`  Deleting collection '${col.$id}' (${col.name})... `);
    const delRes = await api(`/databases/${DATABASE_ID}/collections/${col.$id}`, {
      method: 'DELETE',
    });
    if (delRes.ok || delRes.status === 404) {
      console.log('✓ Deleted');
    } else {
      console.log(`✗ Failed (${delRes.status}): ${delRes.data.message}`);
    }
  }
}

// 2. Ensure Database exists
async function ensureDatabase() {
  console.log(`\n--- [2/5] Ensuring database '${DATABASE_ID}' exists ---`);
  const check = await api(`/databases/${DATABASE_ID}`);
  if (check.ok) {
    console.log(`✓ Database '${DATABASE_ID}' is ready.`);
    return;
  }

  console.log(`Creating database '${DATABASE_ID}'...`);
  const createRes = await api('/databases', {
    method: 'POST',
    body: JSON.stringify({
      databaseId: DATABASE_ID,
      name: 'SPSM Database',
      enabled: true,
    }),
  });
  if (createRes.ok || createRes.status === 409) {
    console.log(`✓ Database '${DATABASE_ID}' created.`);
  } else {
    throw new Error(`Failed to create database: ${createRes.data.message}`);
  }
}

// Helper to create collection with permissions
const DEFAULT_PERMISSIONS = [
  'read("any")',
  'create("any")',
  'update("any")',
  'delete("any")',
];

async function createCollection(collectionId, name, permissions = DEFAULT_PERMISSIONS) {
  process.stdout.write(`Creating collection '${collectionId}' (${name})... `);
  const res = await api(`/databases/${DATABASE_ID}/collections`, {
    method: 'POST',
    body: JSON.stringify({
      collectionId,
      name,
      permissions,
      documentSecurity: false,
      enabled: true,
    }),
  });
  if (res.ok) {
    console.log('✓ Created');
  } else if (res.status === 409) {
    console.log('~ Already exists');
  } else {
    console.log(`✗ Error (${res.status}): ${res.data.message}`);
  }
}

async function createStringAttribute(collectionId, key, size, required = false, defaultValue = null, array = false) {
  const payload = { key, size, required, array };
  if (!required && defaultValue !== null && !array) {
    payload.default = defaultValue;
  }
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/string`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 409) {
    console.log(`    ✗ Attribute string '${key}' failed: ${res.data.message}`);
  }
}

async function createIntegerAttribute(collectionId, key, required = false, defaultValue = null) {
  const payload = { key, required };
  if (!required && defaultValue !== null) {
    payload.default = defaultValue;
  }
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/integer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 409) {
    console.log(`    ✗ Attribute integer '${key}' failed: ${res.data.message}`);
  }
}

async function createBooleanAttribute(collectionId, key, required = false, defaultValue = false) {
  const payload = { key, required, default: defaultValue };
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/boolean`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 409) {
    console.log(`    ✗ Attribute boolean '${key}' failed: ${res.data.message}`);
  }
}

async function createIndex(collectionId, key, type, attributes) {
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/indexes`, {
    method: 'POST',
    body: JSON.stringify({ key, type, attributes }),
  });
  if (!res.ok && res.status !== 409) {
    console.log(`    ✗ Index '${key}' failed: ${res.data.message}`);
  }
}

async function waitForAttributes(collectionId) {
  process.stdout.write(`  Waiting for attributes in '${collectionId}'... `);
  for (let i = 0; i < 30; i++) {
    const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes`);
    const attrs = res.data.attributes || [];
    const pending = attrs.filter((a) => a.status !== 'available');
    if (pending.length === 0 && attrs.length > 0) {
      console.log('✓ All available');
      return;
    }
    await sleep(1000);
  }
  console.log('~ Continuing (timeout waiting)');
}

// 3. Create all collections
async function setupCollections() {
  console.log(`\n--- [3/5] Creating collections, attributes & indexes (SPSM Blueprint v2.2) ---`);

  // 1. system_settings
  console.log('\n[1/9] Setting up system_settings');
  await createCollection('system_settings', 'System Settings');
  await createBooleanAttribute('system_settings', 'is_active', false, true);
  await createStringAttribute('system_settings', 'start_date', 100, false, '2026-01-01T00:00:00.000Z');
  await createStringAttribute('system_settings', 'end_date', 100, false, '2026-12-31T23:59:59.000Z');
  await createStringAttribute('system_settings', 'academic_year', 100, false, '2025/2026 Ganjil');
  await createIntegerAttribute('system_settings', 'min_sks', false, 100);
  await createIntegerAttribute('system_settings', 'required_title_count', false, 3);
  await createStringAttribute('system_settings', 'required_courses', 255, false, null, true);
  await waitForAttributes('system_settings');

  // 2. users
  console.log('\n[2/9] Setting up users');
  await createCollection('users', 'Users');
  await createStringAttribute('users', 'user_id', 255, true);
  await createStringAttribute('users', 'name', 255, true);
  await createStringAttribute('users', 'email', 255, true);
  await createStringAttribute('users', 'role', 50, false, 'student');
  await createStringAttribute('users', 'nim_or_nip', 50, true);
  await createStringAttribute('users', 'department', 100, false);
  await createIntegerAttribute('users', 'batch_year', false, 2022);
  await createIntegerAttribute('users', 'current_sks', false, 120);
  await createStringAttribute('users', 'academic_requirements', 2000, false);
  await createStringAttribute('users', 'avatar_url', 1000, false);
  await createBooleanAttribute('users', 'has_uploaded_thesis', false, false);
  await createStringAttribute('users', 'created_at', 100, false);
  await waitForAttributes('users');
  await createIndex('users', 'idx_users_user_id', 'key', ['user_id']);
  await createIndex('users', 'idx_users_role', 'key', ['role']);

  // 3. thesis_submissions
  console.log('\n[3/9] Setting up thesis_submissions');
  await createCollection('thesis_submissions', 'Thesis Submissions');
  await createStringAttribute('thesis_submissions', 'student_id', 255, true);
  await createStringAttribute('thesis_submissions', 'advisor_id', 255, false);
  await createStringAttribute('thesis_submissions', 'advisor_1_id', 255, false);
  await createStringAttribute('thesis_submissions', 'advisor_2_id', 255, false);
  await createStringAttribute('thesis_submissions', 'status', 50, false, 'pending_lecturer');
  await createStringAttribute('thesis_submissions', 'submitted_at', 100, true);
  await createStringAttribute('thesis_submissions', 'preferred_advisor_1_id', 255, false);
  await createStringAttribute('thesis_submissions', 'preferred_advisor_2_id', 255, false);
  await createStringAttribute('thesis_submissions', 'reviewer_notes', 4000, false);
  await createStringAttribute('thesis_submissions', 'kaprodi_notes', 4000, false);
  await waitForAttributes('thesis_submissions');
  await createIndex('thesis_submissions', 'idx_sub_student_id', 'key', ['student_id']);
  await createIndex('thesis_submissions', 'idx_sub_status', 'key', ['status']);

  // 4. submission_options
  console.log('\n[4/9] Setting up submission_options');
  await createCollection('submission_options', 'Submission Options');
  await createStringAttribute('submission_options', 'submission_id', 255, true);
  await createIntegerAttribute('submission_options', 'option_number', true);
  await createStringAttribute('submission_options', 'title', 500, true);
  await createStringAttribute('submission_options', 'background', 1500, false);
  await createStringAttribute('submission_options', 'relevance_table', 2000, false);
  await createStringAttribute('submission_options', 'relevance_variable', 1000, false);
  await createStringAttribute('submission_options', 'relevance_methodology', 1000, false);
  await createStringAttribute('submission_options', 'relevance_note', 1000, false);
  await createStringAttribute('submission_options', 'journal_title', 500, false);
  await createStringAttribute('submission_options', 'journal_author', 255, false);
  await createStringAttribute('submission_options', 'journal_year', 20, false);
  await createStringAttribute('submission_options', 'journal_file_id', 255, false);
  await createStringAttribute('submission_options', 'lecturer_notes', 2000, false);
  await createBooleanAttribute('submission_options', 'is_selected', false, false);
  await createBooleanAttribute('submission_options', 'is_selected_by_lecturer', false, false);
  await waitForAttributes('submission_options');
  await createIndex('submission_options', 'idx_opt_submission_id', 'key', ['submission_id']);

  // 5. surat
  console.log('\n[5/9] Setting up surat');
  await createCollection('surat', 'Surat');
  await createStringAttribute('surat', 'submission_id', 255, true);
  await createStringAttribute('surat', 'nomor_surat', 255, true);
  await createIntegerAttribute('surat', 'urutan', true);
  await createStringAttribute('surat', 'no_dokumen', 255, true);
  await createStringAttribute('surat', 'template_sk_id', 255, false);
  await createStringAttribute('surat', 'scanned_sk_id', 255, false);
  await createStringAttribute('surat', 'created_at', 100, true);
  await waitForAttributes('surat');
  await createIndex('surat', 'idx_surat_submission_id', 'key', ['submission_id']);
  await createIndex('surat', 'idx_surat_urutan', 'key', ['urutan']);

  // 6. departments
  console.log('\n[6/9] Setting up departments');
  await createCollection('departments', 'Departments');
  await createStringAttribute('departments', 'name', 255, true);
  await createStringAttribute('departments', 'code', 50, true);
  await createStringAttribute('departments', 'faculty', 255, false);
  await createBooleanAttribute('departments', 'is_active', false, true);
  await waitForAttributes('departments');
  await createIndex('departments', 'idx_dept_code', 'unique', ['code']);

  // 7. batch_years
  console.log('\n[7/9] Setting up batch_years');
  await createCollection('batch_years', 'Batch Years');
  await createIntegerAttribute('batch_years', 'year', true);
  await createStringAttribute('batch_years', 'label', 50, true);
  await createBooleanAttribute('batch_years', 'is_active', false, true);
  await waitForAttributes('batch_years');
  await createIndex('batch_years', 'idx_batch_year', 'unique', ['year']);

  // 8. lecturers
  console.log('\n[8/9] Setting up lecturers');
  await createCollection('lecturers', 'Lecturers');
  await createStringAttribute('lecturers', 'user_id', 255, false);
  await createStringAttribute('lecturers', 'nip', 50, true);
  await createStringAttribute('lecturers', 'name', 255, true);
  await createStringAttribute('lecturers', 'email', 255, true);
  await createStringAttribute('lecturers', 'department_id', 255, false);
  await createStringAttribute('lecturers', 'expertise', 1000, false);
  await createIntegerAttribute('lecturers', 'quota', false, 10);
  await createIntegerAttribute('lecturers', 'current_students', false, 0);
  await createStringAttribute('lecturers', 'role', 50, false, 'lecturer');
  await createBooleanAttribute('lecturers', 'is_active', false, true);
  await waitForAttributes('lecturers');
  await createIndex('lecturers', 'idx_lec_nip', 'unique', ['nip']);
  await createIndex('lecturers', 'idx_lec_email', 'key', ['email']);

  // 9. approval_logs
  console.log('\n[9/9] Setting up approval_logs');
  await createCollection('approval_logs', 'Approval Logs');
  await createStringAttribute('approval_logs', 'submission_id', 255, true);
  await createStringAttribute('approval_logs', 'actor_id', 255, true);
  await createStringAttribute('approval_logs', 'action', 100, true);
  await createStringAttribute('approval_logs', 'notes', 4000, false);
  await createStringAttribute('approval_logs', 'created_at', 100, true);
  await waitForAttributes('approval_logs');
  await createIndex('approval_logs', 'idx_log_submission_id', 'key', ['submission_id']);
}

// 4. Setup Storage Buckets
async function ensureBucket(bucketId, name) {
  const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];

  process.stdout.write(`Bucket '${bucketId}' (${name})... `);
  const check = await api(`/storage/buckets/${bucketId}`);
  if (check.ok) {
    // Update allowed file extensions to ensure all needed types are allowed
    await api(`/storage/buckets/${bucketId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        permissions: DEFAULT_PERMISSIONS,
        fileSecurity: false,
        enabled: true,
        maximumFileSize: 50 * 1024 * 1024,
        allowedFileExtensions: allowedExts,
      }),
    });
    console.log('✓ Ready & updated with all allowed extensions');
    return;
  }

  const res = await api('/storage/buckets', {
    method: 'POST',
    body: JSON.stringify({
      bucketId,
      name,
      permissions: DEFAULT_PERMISSIONS,
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 50 * 1024 * 1024,
      allowedFileExtensions: allowedExts,
    }),
  });

  if (res.ok || res.status === 409) {
    console.log('✓ Created');
  } else {
    console.log(`✗ Error (${res.status}): ${res.data.message}`);
  }
}

async function setupStorage() {
  console.log(`\n--- [4/5] Setting up Storage Buckets ---`);
  // journal_files: reference journals + repository thesis PDFs + SK scans.
  // NOTE: Appwrite free/starter plans allow only ONE bucket, so SK scans share
  // journal_files and are distinguished by the 'skscan_' filename prefix.
  await ensureBucket('journal_files', 'SPSM Documents & Journals');
}

// 5. Seed Baseline & Realistic Test Data
async function seedData() {
  console.log(`\n--- [5/5] Seeding Realistic Master & Initial Data ---`);

  // A. system_settings
  process.stdout.write('Seeding system_settings... ');
  const settingsDoc = {
    is_active: true,
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    academic_year: '2025/2026 Ganjil',
    min_sks: 100,
    required_title_count: 3,
    required_courses: ['Metodologi Penelitian', 'Kerja Praktik', 'Bahasa Inggris Ilmiah'],
  };
  await api(`/databases/${DATABASE_ID}/collections/system_settings/documents`, {
    method: 'POST',
    body: JSON.stringify({ documentId: 'global_settings', data: settingsDoc }),
  });
  console.log('✓ OK');

  // B. departments
  process.stdout.write('Seeding departments... ');
  const depts = [
    { code: 'TI', name: 'Teknik Informatika', faculty: 'Fakultas Ilmu Komputer', is_active: true },
    { code: 'SI', name: 'Sistem Informasi', faculty: 'Fakultas Ilmu Komputer', is_active: true },
    { code: 'BD', name: 'Bisnis Digital', faculty: 'Fakultas Ekonomi dan Bisnis', is_active: true },
    { code: 'TE', name: 'Teknik Elektro', faculty: 'Fakultas Teknik', is_active: true },
  ];
  for (const d of depts) {
    await api(`/databases/${DATABASE_ID}/collections/departments/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId: d.code, data: d }),
    });
  }
  console.log('✓ OK');

  // C. batch_years
  process.stdout.write('Seeding batch_years... ');
  const years = [
    { year: 2021, label: 'Angkatan 2021 (Tingkat Akhir)', is_active: true },
    { year: 2022, label: 'Angkatan 2022 (Reguler)', is_active: true },
    { year: 2023, label: 'Angkatan 2023', is_active: true },
    { year: 2024, label: 'Angkatan 2024', is_active: true },
  ];
  for (const y of years) {
    await api(`/databases/${DATABASE_ID}/collections/batch_years/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId: `batch_${y.year}`, data: y }),
    });
  }
  console.log('✓ OK');

  // D. lecturers
  process.stdout.write('Seeding lecturers... ');
  const lecturers = [
    {
      nip: '197805122003121001',
      name: 'Dr. Ir. Hendra Saputra, M.T.',
      email: 'hendra.saputra@univ.ac.id',
      department_id: 'TI',
      expertise: 'Kecerdasan Buatan, NLP, Computer Vision',
      quota: 8,
      current_students: 2,
      role: 'reviewer',
      is_active: true,
    },
    {
      nip: '198203152008122003',
      name: 'Dr. Ratna Dewi, S.Kom., M.Cs.',
      email: 'ratna.dewi@univ.ac.id',
      department_id: 'TI',
      expertise: 'Software Engineering, Cloud Computing, Microservices',
      quota: 10,
      current_students: 3,
      role: 'kaprodi',
      is_active: true,
    },
    {
      nip: '198511202010121002',
      name: 'Budi Santoso, S.T., M.Kom.',
      email: 'budi.santoso@univ.ac.id',
      department_id: 'TI',
      expertise: 'Mobile Application, IoT, Cyber Security',
      quota: 8,
      current_students: 1,
      role: 'lecturer',
      is_active: true,
    },
    {
      nip: '199002142018032001',
      name: 'Siti Rahmawati, S.Kom., M.T.',
      email: 'siti.rahmawati@univ.ac.id',
      department_id: 'SI',
      expertise: 'Data Warehouse, Enterprise Architecture, UI/UX',
      quota: 8,
      current_students: 0,
      role: 'lecturer',
      is_active: true,
    },
  ];
  for (const lec of lecturers) {
    await api(`/databases/${DATABASE_ID}/collections/lecturers/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId: lec.nip, data: lec }),
    });
  }
  console.log('✓ OK');

  // E. Seed test users (to test login across roles)
  process.stdout.write('Seeding test user profiles... ');
  const testUsers = [
    {
      user_id: 'student_test_1',
      name: 'Ahmad Faiz Pratama',
      email: 'ahmad.faiz@student.univ.ac.id',
      role: 'student',
      nim_or_nip: '21051204011',
      department: 'Teknik Informatika',
      batch_year: 2021,
      current_sks: 126,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'reviewer_test_1',
      name: 'Dr. Ir. Hendra Saputra, M.T.',
      email: 'hendra.saputra@univ.ac.id',
      role: 'lecturer',
      nim_or_nip: '197805122003121001',
      department: 'Teknik Informatika',
      batch_year: 2003,
      current_sks: 0,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'kaprodi_test_1',
      name: 'Dr. Ratna Dewi, S.Kom., M.Cs.',
      email: 'ratna.dewi@univ.ac.id',
      role: 'kaprodi',
      nim_or_nip: '198203152008122003',
      department: 'Teknik Informatika',
      batch_year: 2008,
      current_sks: 0,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'akademik_test_1',
      name: 'Biro Administrasi Akademik (TU)',
      email: 'akademik.fikom@univ.ac.id',
      role: 'akademik',
      nim_or_nip: '198904012015041001',
      department: 'Fakultas Ilmu Komputer',
      batch_year: 2015,
      current_sks: 0,
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'admin_test_1',
      name: 'Admin Sistem SPSM',
      email: 'ws.basithachmed@gmail.com',
      role: 'admin',
      nim_or_nip: 'ADM-001',
      department: 'Pusat Komputer',
      batch_year: 2020,
      current_sks: 0,
      created_at: new Date().toISOString(),
    },
  ];

  for (const u of testUsers) {
    await api(`/databases/${DATABASE_ID}/collections/users/documents`, {
      method: 'POST',
      body: JSON.stringify({ documentId: u.user_id, data: u }),
    });
  }
  console.log('✓ OK');
}

async function main() {
  const isReset = process.argv.includes('--reset') || process.argv.includes('--wipe');
  console.log('====================================================');
  console.log('       SPSM APPWRITE DATABASE INITIALIZATION        ');
  console.log('       Spesifikasi Teknis SPSM Blueprint v2.2       ');
  console.log('====================================================');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project:  ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}`);
  console.log(`Mode:     ${isReset ? 'CLEAN RESET (Delete All & Recreate)' : 'Standard Sync'}`);

  try {
    if (isReset) {
      await deleteAllCollections();
    }
    await ensureDatabase();
    await setupCollections();
    await setupStorage();
    await seedData();

    console.log('\n🎉 ALL DONE! Appwrite Database is 100% ready for testing with real data.');
  } catch (err) {
    console.error('\n❌ Initialization failed with error:', err);
    process.exit(1);
  }
}

main();
