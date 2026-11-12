import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const DATABASE_ID = 'spsm_db';

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

async function main() {
  console.log('=== Adding submission_options attributes (is_selected_by_lecturer) ===');

  // 1. Create boolean attribute is_selected_by_lecturer on submission_options
  const attrKey = 'is_selected_by_lecturer';
  console.log(`Checking attribute '${attrKey}' in 'submission_options'...`);
  const createAttrRes = await api(
    `/databases/${DATABASE_ID}/collections/submission_options/attributes/boolean`,
    {
      method: 'POST',
      body: JSON.stringify({
        key: attrKey,
        required: false,
        default: false,
      }),
    }
  );

  if (createAttrRes.ok) {
    console.log(`✓ Attribute '${attrKey}' requested.`);
  } else if (createAttrRes.status === 409) {
    console.log(`~ Attribute '${attrKey}' already exists.`);
  } else {
    console.log(`✗ Error creating attribute: ${createAttrRes.data.message}`);
  }

  // 2. Wait for attribute to be available
  process.stdout.write(`Waiting for attribute '${attrKey}' to be available... `);
  for (let i = 0; i < 30; i++) {
    const res = await api(
      `/databases/${DATABASE_ID}/collections/submission_options/attributes`
    );
    const attrs = res.data.attributes || [];
    const attr = attrs.find((a) => a.key === attrKey);
    if (attr && attr.status === 'available') {
      console.log('✓ Available!');
      break;
    }
    await sleep(1000);
  }

  // 3. Backfill: mirror is_selected -> is_selected_by_lecturer for existing docs
  console.log('Backfilling is_selected_by_lecturer from is_selected...');
  const listRes = await api(
    `/databases/${DATABASE_ID}/collections/submission_options/documents?limit=5000`
  );
  const docs = listRes.data.documents || [];
  let updated = 0;
  for (const doc of docs) {
    if (doc.is_selected && !doc.is_selected_by_lecturer) {
      await api(
        `/databases/${DATABASE_ID}/collections/submission_options/documents/${doc.$id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            data: { is_selected_by_lecturer: true },
          }),
        }
      );
      updated++;
    }
  }
  console.log(`✓ Backfilled ${updated} option document(s).`);

  console.log('\n🎉 submission_options attributes setup completed successfully!');
}

main().catch(console.error);
