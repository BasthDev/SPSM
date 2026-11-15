/**
 * Pass-2 FK fix-up: Appwrite ids are NOT doc ids —
 *  - student_id / actor_id  -> Appwrite account user id (users.user_id di dump)
 *  - advisor_*_id           -> lecturer NIP
 *  - lecturers.department_id -> department CODE
 * Also populates users.appwrite_user_id (legacy Appwrite account id).
 */
import PocketBase from 'pocketbase';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP = (n) => readFileSync(join(__dirname, '.awdump', `aw_${n}.jsonl`), 'utf8')
  .trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

const pb = new PocketBase(process.env.POCKETBASE_URL || 'https://spsm.basthstudio.my.id');
await pb.collection('_superusers').authWithPassword(
  process.env.POCKETBASE_ADMIN_EMAIL,
  process.env.POCKETBASE_ADMIN_PASSWORD
);

// --- Build lookup maps from dumps + PB records ---
const usersDump = DUMP('users');
const pbUsers = await pb.collection('users').getFullList();
const pbUserByAppwriteDocId = new Map(pbUsers.map((u) => [u.appwrite_id, u.id]));
// old account user_id -> PB user record id
const accountToPbUser = new Map();
for (const d of usersDump) {
  const pbId = pbUserByAppwriteDocId.get(d._uid);
  if (pbId && d.user_id) accountToPbUser.set(d.user_id, pbId);
}
console.log('account->pbUser map:', accountToPbUser.size);

// lecturer nip -> PB lecturer id
const pbLecturers = await pb.collection('lecturers').getFullList();
const nipToPbLect = new Map(pbLecturers.map((l) => [String(l.nip || '').trim(), l.id]));

// department code -> PB department id
const pbDepts = await pb.collection('departments').getFullList();
const codeToPbDept = new Map(pbDepts.map((d) => [String(d.code || '').trim(), d.id]));

// submission _uid -> PB id (already migrated)
const subsDump = DUMP('thesis_submissions');
const pbSubs = await pb.collection('thesis_submissions').getFullList();
const subDocToPb = new Map(pbSubs.map((s) => [s.appwrite_id, s.id]));

// --- 1. Populate users.appwrite_user_id ---
{
  let n = 0;
  for (const d of usersDump) {
    const pbId = pbUserByAppwriteDocId.get(d._uid);
    if (pbId && d.user_id) {
      await pb.collection('users').update(pbId, { appwrite_user_id: d.user_id });
      n++;
    }
  }
  console.log(`users.appwrite_user_id populated: ${n}`);
}

// --- 2. thesis_submissions FKs ---
{
  const items = await pb.collection('thesis_submissions').getFullList();
  let n = 0;
  for (const r of items) {
    const patch = {};
    const oldStudent = r.student_id;
    if (oldStudent && accountToPbUser.has(oldStudent)) patch.student_id = accountToPbUser.get(oldStudent);
    for (const f of ['advisor_1_id', 'advisor_2_id', 'preferred_advisor_1_id', 'preferred_advisor_2_id']) {
      const v = r[f];
      if (v && nipToPbLect.has(String(v).trim())) patch[f] = nipToPbLect.get(String(v).trim());
    }
    // advisor_id CSV of nips
    if (r.advisor_id) {
      const mapped = String(r.advisor_id).split(',')
        .map((p) => nipToPbLect.get(p.trim()) || accountToPbUser.get(p.trim()) || p.trim())
        .join(',');
      if (mapped !== r.advisor_id) patch.advisor_id = mapped;
    }
    if (Object.keys(patch).length) {
      await pb.collection('thesis_submissions').update(r.id, patch);
      n++;
    }
  }
  console.log(`thesis_submissions FK-fixed: ${n}`);
}

// --- 3. approval_logs.actor_id ---
{
  const items = await pb.collection('approval_logs').getFullList();
  let n = 0;
  for (const r of items) {
    const m = accountToPbUser.get(r.actor_id) || nipToPbLect.get(String(r.actor_id).trim());
    if (m && m !== r.actor_id) {
      await pb.collection('approval_logs').update(r.id, { actor_id: m });
      n++;
    }
  }
  console.log(`approval_logs.actor_id fixed: ${n}`);
}

// --- 4. lecturers.department_id (code -> id) ---
{
  const items = await pb.collection('lecturers').getFullList();
  let n = 0;
  for (const r of items) {
    const code = String(r.department_id || '').trim();
    if (code && codeToPbDept.has(code)) {
      await pb.collection('lecturers').update(r.id, { department_id: codeToPbDept.get(code) });
      n++;
    }
  }
  console.log(`lecturers.department_id fixed: ${n}`);
}

console.log('done');
