import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const DATABASE_ID = 'spsm_db';
const API_KEY = fs.readFileSync(path.join(__dirname, '..', 'api.txt'), 'utf8').trim();

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

async function main() {
  console.log('=== Adding academic_requirements attribute to users collection ===');

  // 1. Create string attribute academic_requirements on users collection
  const attrKey = 'academic_requirements';
  console.log(`Checking attribute '${attrKey}' in 'users'...`);
  const createAttrRes = await api(`/databases/${DATABASE_ID}/collections/users/attributes/string`, {
    method: 'POST',
    body: JSON.stringify({
      key: attrKey,
      size: 2000,
      required: false,
    }),
  });

  if (createAttrRes.ok) {
    console.log(`✓ Attribute '${attrKey}' requested.`);
  } else if (createAttrRes.status === 409) {
    console.log(`~ Attribute '${attrKey}' already exists.`);
  } else {
    console.log(`✗ Error creating attribute: ${createAttrRes.data.message}`);
  }

  // 2. Wait for attribute to be available
  process.stdout.write(`Waiting for attribute '${attrKey}' to be available... `);
  for (let i = 0; i < 20; i++) {
    const res = await api(`/databases/${DATABASE_ID}/collections/users/attributes`);
    const attrs = res.data.attributes || [];
    const attr = attrs.find((a) => a.key === attrKey);
    if (attr && attr.status === 'available') {
      console.log('✓ Available!');
      break;
    }
    await sleep(1000);
  }

  // 3. Update student_test_1 with eligible requirements
  console.log('Updating student_test_1 with eligible academic requirements...');
  const eligibleData = {
    sks: 126,
    completed_courses: ['Metodologi Penelitian', 'Kerja Praktik', 'Bahasa Inggris Ilmiah'],
    gpa: 3.52,
    passed_prerequisites: true,
  };

  await api(`/databases/${DATABASE_ID}/collections/users/documents/student_test_1`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        academic_requirements: JSON.stringify(eligibleData),
        current_sks: 126,
      },
    }),
  });
  console.log('✓ student_test_1 updated (SKS: 126, all required courses passed).');

  // 4. Create or update an ineligible student account for testing
  console.log('Creating/updating student_ineligible_1 for testing warning card...');
  const ineligibleData = {
    sks: 85,
    completed_courses: ['Kerja Praktik'],
    gpa: 2.85,
    passed_prerequisites: false,
  };

  const ineligCheck = await api(`/databases/${DATABASE_ID}/collections/users/documents/student_ineligible_1`);
  if (ineligCheck.ok) {
    await api(`/databases/${DATABASE_ID}/collections/users/documents/student_ineligible_1`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          academic_requirements: JSON.stringify(ineligibleData),
          current_sks: 85,
        },
      }),
    });
  } else {
    await api(`/databases/${DATABASE_ID}/collections/users/documents`, {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'student_ineligible_1',
        data: {
          user_id: 'student_ineligible_1',
          name: 'Rian Hidayat (Mahasiswa Belum Cukup SKS)',
          email: 'rian.hidayat@student.univ.ac.id',
          role: 'student',
          nim_or_nip: '22051204099',
          department: 'Teknik Informatika',
          batch_year: 2022,
          current_sks: 85,
          academic_requirements: JSON.stringify(ineligibleData),
          created_at: new Date().toISOString(),
        },
      }),
    });
  }
  console.log('✓ student_ineligible_1 created (SKS: 85 < min 100, missing Metodologi Penelitian).');

  console.log('\n🎉 Attribute and test data setup completed successfully!');
}

main().catch(console.error);
