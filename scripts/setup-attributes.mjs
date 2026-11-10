/**
 * Setup script — membuat attribute baru di Appwrite Database.
 *
 * Jalankan SEKALI dengan Appwrite API Key (bukan session user):
 *
 *   APPWRITE_API_KEY=xxxxxxx node scripts/setup-attributes.mjs
 *
 * Ambil API key dari Appwrite Console → Overview → API Keys.
 *
 * Yang dibuat:
 *  - submission_options: relevance_variable, relevance_methodology,
 *    relevance_note, journal_year
 *  - users: has_uploaded_thesis (boolean)
 */

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const DATABASE_ID = 'spsm_db';

const API_KEY = process.env.APPWRITE_API_KEY;
if (!API_KEY) {
  console.error('Set APPWRITE_API_KEY dulu. Contoh:');
  console.error('  APPWRITE_API_KEY=xxxx node scripts/setup-attributes.mjs');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 409 = attribute sudah ada -> anggap sukses
    if (res.status === 409) {
      console.log(`  ~ sudah ada, skip`);
      return { skipped: true };
    }
    throw new Error(`${method} ${path} -> ${res.status}: ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

const stringAttr = (key, size) => ({
  key,
  size,
  required: false,
  array: false,
});

const ATTRIBUTES = [
  {
    collection: 'submission_options',
    attrs: [
      stringAttr('relevance_variable', 1000),
      stringAttr('relevance_methodology', 1000),
      stringAttr('relevance_note', 2000),
      stringAttr('journal_year', 50),
    ],
  },
  {
    collection: 'users',
    attrs: [
      { key: 'has_uploaded_thesis', type: 'boolean', required: false },
    ],
  },
];

async function main() {
  for (const { collection, attrs } of ATTRIBUTES) {
    console.log(`\nCollection: ${collection}`);
    for (const attr of attrs) {
      const isBool = attr.type === 'boolean';
      const path = `/databases/${DATABASE_ID}/collections/${collection}/attributes/${isBool ? 'boolean' : 'string'}`;
      const body = isBool
        ? { key: attr.key, required: attr.required }
        : stringAttr(attr.key, attr.size);
      try {
        await api('POST', path, body);
        console.log(`  + ${attr.key} (${isBool ? 'boolean' : 'string'})`);
      } catch (e) {
        console.error(`  x ${attr.key}: ${e.message}`);
      }
    }
  }
  console.log('\nSelesai. Restart expo dengan: npx expo start -c');
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
