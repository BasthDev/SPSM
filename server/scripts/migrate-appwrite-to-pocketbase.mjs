/**
 * Migrate data from Appwrite (self-hosted) to PocketBase.
 * - Preserves data via `appwrite_id` field; PB generates its own ids.
 * - Two-pass: create records, then rewrite foreign-key references.
 * - Auth users collection is `users` (type=auth); passwords are NOT migrated
 *   (Google OAuth only for now).
 *
 * Env:
 *   APPWRITE_ENDPOINT   e.g. http://localhost:18080/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY
 *   APPWRITE_DATABASE_ID (default spsm_db)
 *   POCKETBASE_URL
 *   POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD
 *   MIGRATE_FILES=1     also copy storage files (default off)
 */
import PocketBase from 'pocketbase';
import { randomBytes } from 'crypto';

const AW = {
  endpoint: process.env.APPWRITE_ENDPOINT,
  projectId: process.env.APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY,
  databaseId: process.env.APPWRITE_DATABASE_ID || 'spsm_db',
};
const pb = new PocketBase(process.env.POCKETBASE_URL || 'https://spsm.basthstudio.my.id');
await pb.collection('_superusers').authWithPassword(
  process.env.POCKETBASE_ADMIN_EMAIL,
  process.env.POCKETBASE_ADMIN_PASSWORD
);

// ---------- Appwrite dump loader (postgres row_to_json JSONL) ----------
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = join(__dirname, '.awdump');

function listAllDocs(collectionId) {
  const file = join(DUMP_DIR, `aw_${collectionId}.jsonl`);
  const text = readFileSync(file, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/).map((l) => JSON.parse(l));
}

// ---------- Field mapping ----------
// Appwrite doc -> PB record body. Returns null to skip.
const stripNull = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

function mapUser(d) {
  const password = randomBytes(12).toString('hex') + 'aA1!';
  return stripNull({
    user_id: '', // set in pass 2 to the new PB id (self-reference for lookups)
    name: d.name || '',
    email: (d.email || '').toLowerCase(),
    role: d.role || 'student',
    nim_or_nip: d.nim_or_nip || d.nim || '',
    department: d.department || '',
    batch_year: num(d.batch_year),
    current_sks: num(d.current_sks),
    academic_requirements: d.academic_requirements || '',
    avatar_url: d.avatar_url || '',
    phone: d.phone || '',
    has_uploaded_thesis: !!(d.has_uploaded_thesis ?? d.thesis_uploaded),
    push_token: d.push_token || '',
    appwrite_id: d._uid,
    external_id: '',
    password,
    passwordConfirm: password,
  });
}
function num(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }

function mapSubmission(d) {
  return stripNull({
    student_id: d.student_id || '',
    advisor_1_id: d.advisor_1_id || '',
    advisor_2_id: d.advisor_2_id || '',
    advisor_id: d.advisor_id || '',
    preferred_advisor_1_id: d.preferred_advisor_1_id || '',
    preferred_advisor_2_id: d.preferred_advisor_2_id || '',
    status: d.status || 'drafting',
    submitted_at: d.submitted_at || d._createdAt || '',
    reviewer_notes: d.reviewer_notes || '',
    kaprodi_notes: d.kaprodi_notes || '',
    appwrite_id: d._uid,
  });
}

function mapOption(d) {
  return stripNull({
    submission_id: d.submission_id || '',
    option_number: num(d.option_number),
    title: d.title || '',
    background: d.background || '',
    relevance_table: d.relevance_table || '',
    relevance_variable: d.relevance_variable || '',
    relevance_methodology: d.relevance_methodology || '',
    relevance_note: d.relevance_note || '',
    journal_title: d.journal_title || '',
    journal_author: d.journal_author || '',
    journal_year: d.journal_year || '',
    journal_file_id: d.journal_file_id || '',
    is_selected: !!d.is_selected,
    is_selected_by_lecturer: !!(d.is_selected_by_lecturer ?? d.is_selected),
    lecturer_notes: d.lecturer_notes || d.review_notes || '',
    review_notes: d.review_notes || '',
    appwrite_id: d._uid,
  });
}

function mapLog(d) {
  return stripNull({
    submission_id: d.submission_id || '',
    actor_id: d.actor_id || '',
    action: d.action || '',
    notes: d.notes || '',
    created_at: d.created_at || d._createdAt || '',
    appwrite_id: d._uid,
  });
}

function mapSurat(d) {
  return stripNull({
    submission_id: d.submission_id || '',
    nomor_surat: d.nomor_surat || '',
    urutan: num(d.urutan),
    no_dokumen: d.no_dokumen || '',
    template_sk_id: d.template_sk_id || '',
    scanned_sk_id: d.scanned_sk_id || d.file_id || '',
    created_at: d.created_at || d._createdAt || '',
    appwrite_id: d._uid,
  });
}

function mapLecturer(d) {
  return stripNull({
    user_id: d.user_id || '',
    nip: d.nip || '',
    name: d.name || '',
    email: (d.email || '').toLowerCase(),
    phone: d.phone || '',
    department_id: d.department_id || '',
    expertise: d.expertise || '',
    quota: num(d.quota ?? d.max_advisee_quota) || 10,
    current_students: num(d.current_students ?? d.current_advisee_count),
    role: d.role || 'lecturer',
    is_active: d.is_active ?? true,
    appwrite_id: d._uid,
  });
}

function mapDepartment(d) {
  return stripNull({
    name: d.name || '', code: d.code || '', faculty: d.faculty || '',
    is_active: d.is_active ?? true, appwrite_id: d._uid,
  });
}

function mapBatchYear(d) {
  return stripNull({
    year: num(d.year), label: d.label || '', is_active: d.is_active ?? true, appwrite_id: d._uid,
  });
}

function mapSettings(d) {
  return stripNull({
    academic_year: d.academic_year || '',
    is_active: d.is_active ?? true,
    start_date: d.start_date || '',
    end_date: d.end_date || '',
    min_sks: num(d.min_sks),
    required_title_count: num(d.required_title_count),
    required_courses: Array.isArray(d.required_courses) ? d.required_courses : [],
    appwrite_id: d._uid,
  });
}

// ---------- Migration engine ----------
// idMap: appwrite collection name -> Map(oldId -> newPbId)
const idMap = {};
const stats = {};

async function migrate(collectionName, awCollectionId, mapper, { fkPass = true } = {}) {
  const docs = await listAllDocs(awCollectionId);
  const map = new Map();
  idMap[collectionName] = map;
  // Idempotency: muat appwrite_id yang sudah ada
  const existing = await pb.collection(collectionName).getFullList({ fields: 'id,appwrite_id' });
  const byAppwriteId = new Map(existing.map((r) => [r.appwrite_id, r.id]));
  let ok = 0, fail = 0, skip = 0;
  for (const d of docs) {
    const body = mapper(d);
    if (!body) continue;
    if (byAppwriteId.has(d._uid)) {
      map.set(d._uid, byAppwriteId.get(d._uid));
      skip++;
      continue;
    }
    try {
      const rec = await pb.collection(collectionName).create(body);
      map.set(d._uid, rec.id);
      ok++;
    } catch (e) {
      fail++;
      console.error(`  [${collectionName}] FAIL ${d._uid}: ${e.message || e}`);
    }
  }
  stats[collectionName] = { total: docs.length, ok, fail, skip };
  console.log(`${collectionName}: ${ok} migrated, ${skip} skipped, ${fail} failed (of ${docs.length})`);
}

// Resolve an Appwrite id to the new PB id using the right map.
// Advisors may live in `lecturers` or `users` — try lecturers first, then users.
function resolve(ref, awId) {
  if (!awId) return '';
  if (idMap[ref]?.has(awId)) return idMap[ref].get(awId);
  // fallback across known collections
  for (const m of Object.values(idMap)) if (m?.has(awId)) return m.get(awId);
  return '';
}

// ---------- Run ----------
const order = [
  ['departments', 'departments', mapDepartment],
  ['batch_years', 'batch_years', mapBatchYear],
  ['users', 'users', mapUser],
  ['lecturers', 'lecturers', mapLecturer],
  ['system_settings', 'system_settings', mapSettings],
  ['thesis_submissions', 'thesis_submissions', mapSubmission],
  ['submission_options', 'submission_options', mapOption],
  ['approval_logs', 'approval_logs', mapLog],
  ['surat', 'surat', mapSurat],
];

for (const [pbName, awName, mapper] of order) {
  await migrate(pbName, awName, mapper);
}

// ---------- Pass 2: rewrite FK references ----------
console.log('\nRewriting foreign keys...');

async function rewrite(collection, field, awToPb) {
  const items = await pb.collection(collection).getFullList();
  let n = 0;
  for (const r of items) {
    const old = r[field];
    const mapped = old ? (awToPb.get(old) ?? resolve('*', old)) : '';
    if (mapped && mapped !== old) {
      await pb.collection(collection).update(r.id, { [field]: mapped });
      n++;
    }
  }
  console.log(`  ${collection}.${field}: ${n} updated`);
}

// lecturer user_id -> users
await rewrite('lecturers', 'user_id', idMap.users || new Map());
// users.user_id self-reference -> own PB id (so getUserProfileByUserId works)
{
  const items = await pb.collection('users').getFullList();
  for (const r of items) {
    await pb.collection('users').update(r.id, { user_id: r.id });
  }
  console.log(`  users.user_id self-linked: ${items.length}`);
}
// submissions
await rewrite('thesis_submissions', 'student_id', idMap.users || new Map());
for (const f of ['advisor_1_id', 'advisor_2_id', 'advisor_id', 'preferred_advisor_1_id', 'preferred_advisor_2_id']) {
  // advisor_id may be CSV of two ids
  const items = await pb.collection('thesis_submissions').getFullList();
  for (const r of items) {
    const v = r[f];
    if (!v) continue;
    const parts = String(v).split(',');
    const mapped = parts.map((p) => resolve('lecturers', p.trim()) || resolve('users', p.trim()) || p.trim()).join(',');
    if (mapped !== v) await pb.collection('thesis_submissions').update(r.id, { [f]: mapped });
  }
  console.log(`  thesis_submissions.${f} done`);
}
// options / logs / surat submission_id
await rewrite('submission_options', 'submission_id', idMap.thesis_submissions || new Map());
await rewrite('approval_logs', 'submission_id', idMap.thesis_submissions || new Map());
await rewrite('surat', 'submission_id', idMap.thesis_submissions || new Map());
// approval_logs.actor_id -> users (or lecturers)
{
  const items = await pb.collection('approval_logs').getFullList();
  for (const r of items) {
    if (!r.actor_id) continue;
    const m = resolve('users', r.actor_id) || resolve('lecturers', r.actor_id);
    if (m) await pb.collection('approval_logs').update(r.id, { actor_id: m });
  }
  console.log('  approval_logs.actor_id done');
}
// departments/batch_years ids referenced by lecturers.department_id?
await rewrite('lecturers', 'department_id', idMap.departments || new Map());

console.log('\nMigration complete.');
console.log(JSON.stringify(stats, null, 2));
