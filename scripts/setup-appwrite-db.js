const fs = require('fs');
const path = require('path');

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const API_KEY = fs.readFileSync(path.join(__dirname, '..', 'api.txt'), 'utf8').trim();

const DATABASE_ID = 'spsm_db';
const BUCKET_ID = 'journal_files';

const headers = {
  'Content-Type': 'application/json',
  'X-Appwrite-Project': PROJECT_ID,
  'X-Appwrite-Key': API_KEY,
};

async function api(path, options = {}) {
  const url = `${ENDPOINT}${path}`;
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

  if (!res.ok && res.status !== 409) {
    throw new Error(`API Error [${res.status}] ${path}: ${json.message || JSON.stringify(json)}`);
  }

  return { status: res.status, data: json };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createDatabase() {
  console.log(`Checking if database '${DATABASE_ID}' exists...`);
  try {
    const existing = await api(`/databases/${DATABASE_ID}`);
    if (existing.status === 200) {
      console.log(`Database '${DATABASE_ID}' already exists and is ready.`);
      return;
    }
  } catch {
    // Database does not exist, proceed to create
  }

  console.log(`Creating database '${DATABASE_ID}'...`);
  const res = await api('/databases', {
    method: 'POST',
    body: JSON.stringify({
      databaseId: DATABASE_ID,
      name: 'SPSM Database',
      enabled: true,
    }),
  });
  if (res.status === 409 || res.status === 403) {
    console.log(`Database '${DATABASE_ID}' already exists or limit reached.`);
  } else {
    console.log(`Database '${DATABASE_ID}' created successfully.`);
  }
}

async function createCollection(collectionId, name, permissions) {
  console.log(`Creating collection '${collectionId}' (${name})...`);
  const res = await api(`/databases/${DATABASE_ID}/collections`, {
    method: 'POST',
    body: JSON.stringify({
      collectionId,
      name,
      permissions: permissions || [
        'read("any")',
        'create("any")',
        'update("any")',
        'delete("any")',
      ],
      documentSecurity: false,
      enabled: true,
    }),
  });
  if (res.status === 409) {
    console.log(`Collection '${collectionId}' already exists.`);
  } else {
    console.log(`Collection '${collectionId}' created.`);
  }
}

async function createStringAttribute(collectionId, key, size, required = false, defaultValue = null) {
  const payload = { key, size, required };
  if (!required && defaultValue !== null) {
    payload.default = defaultValue;
  }
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/string`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    console.log(`  Attribute '${key}' already exists.`);
  } else {
    console.log(`  Attribute '${key}' (string) created.`);
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
  if (res.status === 409) {
    console.log(`  Attribute '${key}' already exists.`);
  } else {
    console.log(`  Attribute '${key}' (integer) created.`);
  }
}

async function createBooleanAttribute(collectionId, key, required = false, defaultValue = false) {
  const payload = { key, required, default: defaultValue };
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes/boolean`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    console.log(`  Attribute '${key}' already exists.`);
  } else {
    console.log(`  Attribute '${key}' (boolean) created.`);
  }
}

async function waitForAttributes(collectionId) {
  console.log(`Waiting for attributes in '${collectionId}' to become available...`);
  for (let i = 0; i < 20; i++) {
    const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/attributes`);
    const attrs = res.data.attributes || [];
    const pending = attrs.filter((a) => a.status !== 'available');
    if (pending.length === 0) {
      console.log(`All attributes in '${collectionId}' are available.`);
      return;
    }
    await sleep(1000);
  }
}

async function createIndex(collectionId, key, type, attributes) {
  console.log(`Creating index '${key}' on '${collectionId}'...`);
  const res = await api(`/databases/${DATABASE_ID}/collections/${collectionId}/indexes`, {
    method: 'POST',
    body: JSON.stringify({
      key,
      type,
      attributes,
    }),
  });
  if (res.status === 409) {
    console.log(`  Index '${key}' already exists.`);
  } else {
    console.log(`  Index '${key}' created.`);
  }
}

async function createStorageBucket() {
  console.log(`Checking storage bucket '${BUCKET_ID}'...`);
  try {
    const existing = await api(`/storage/buckets/${BUCKET_ID}`);
    if (existing.status === 200) {
      console.log(`Storage bucket '${BUCKET_ID}' already exists and is ready.`);
      return;
    }
  } catch {
    // proceed
  }

  console.log(`Creating storage bucket '${BUCKET_ID}'...`);
  const res = await api('/storage/buckets', {
    method: 'POST',
    body: JSON.stringify({
      bucketId: BUCKET_ID,
      name: 'Journal Files',
      permissions: [
        'read("any")',
        'create("any")',
        'update("any")',
        'delete("any")',
      ],
      fileSecurity: false,
      enabled: true,
      allowedFileExtensions: ['pdf', 'doc', 'docx'],
    }),
  });
  if (res.status === 409) {
    console.log(`Storage bucket '${BUCKET_ID}' already exists.`);
  } else {
    console.log(`Storage bucket '${BUCKET_ID}' created.`);
  }
}

async function main() {
  try {
    console.log('--- SPSM Appwrite Setup Starting ---');

    // 1. Database
    await createDatabase();

    // 2. Collection: users
    await createCollection('users', 'Users');
    await createStringAttribute('users', 'user_id', 255, true);
    await createStringAttribute('users', 'name', 255, true);
    await createStringAttribute('users', 'email', 255, true);
    await createStringAttribute('users', 'role', 50, false, 'student');
    await createStringAttribute('users', 'nim_or_nip', 50, true);
    await createStringAttribute('users', 'department', 100, true);
    await createIntegerAttribute('users', 'batch_year', true);
    await createStringAttribute('users', 'created_at', 100, false);
    await waitForAttributes('users');
    await createIndex('users', 'idx_user_id', 'key', ['user_id']);

    // 3. Collection: thesis_submissions
    await createCollection('thesis_submissions', 'Thesis Submissions');
    await createStringAttribute('thesis_submissions', 'student_id', 255, true);
    await createStringAttribute('thesis_submissions', 'advisor_id', 255, false);
    await createStringAttribute('thesis_submissions', 'status', 50, false, 'pending_lecturer');
    await createStringAttribute('thesis_submissions', 'submitted_at', 100, true);
    await waitForAttributes('thesis_submissions');
    await createIndex('thesis_submissions', 'idx_student_id', 'key', ['student_id']);
    await createIndex('thesis_submissions', 'idx_status', 'key', ['status']);

    // 4. Collection: submission_options
    await createCollection('submission_options', 'Submission Options');
    await createStringAttribute('submission_options', 'submission_id', 255, true);
    await createIntegerAttribute('submission_options', 'option_number', true);
    await createStringAttribute('submission_options', 'title', 1000, true);
    await createStringAttribute('submission_options', 'background', 5000, true);
    await createStringAttribute('submission_options', 'journal_title', 1000, false);
    await createStringAttribute('submission_options', 'journal_author', 255, false);
    await createStringAttribute('submission_options', 'journal_file_id', 255, false);
    await createBooleanAttribute('submission_options', 'is_selected_by_lecturer', false, false);
    await waitForAttributes('submission_options');
    await createIndex('submission_options', 'idx_submission_id', 'key', ['submission_id']);

    // 5. Collection: approval_logs
    await createCollection('approval_logs', 'Approval Logs');
    await createStringAttribute('approval_logs', 'submission_id', 255, true);
    await createStringAttribute('approval_logs', 'actor_id', 255, true);
    await createStringAttribute('approval_logs', 'action', 100, true);
    await createStringAttribute('approval_logs', 'notes', 2000, false);
    await createStringAttribute('approval_logs', 'created_at', 100, true);
    await waitForAttributes('approval_logs');
    await createIndex('approval_logs', 'idx_log_submission_id', 'key', ['submission_id']);

    // 6. Storage Bucket: journal_files
    await createStorageBucket();

    console.log('--- SPSM Appwrite Setup Complete! 🎉 ---');
  } catch (err) {
    console.error('Fatal error during setup:', err);
    process.exit(1);
  }
}

main();
