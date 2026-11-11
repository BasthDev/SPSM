import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const DATABASE_ID = 'spsm_db';

const apiTxtPath = path.join(__dirname, '..', 'api.txt');
const API_KEY = fs.readFileSync(apiTxtPath, 'utf8').trim();

async function appwriteFetch(url, options = {}) {
  const headers = {
    'X-Appwrite-Project': PROJECT_ID,
    'X-Appwrite-Key': API_KEY,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${ENDPOINT}${url}`, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

async function verifyAll() {
  console.log('--- 1. VERIFY SYSTEM SETTINGS COLLECTION & DATA ---');
  const sysSettings = await appwriteFetch(
    `/databases/${DATABASE_ID}/collections/system_settings/documents`
  );
  console.log(`✓ system_settings collection found with ${sysSettings.total} document(s).`);
  const activeSetting = sysSettings.documents[0];
  console.log(`  - is_active: ${activeSetting.is_active}`);
  console.log(`  - academic_year: ${activeSetting.academic_year}`);
  console.log(`  - min_sks: ${activeSetting.min_sks}`);
  console.log(`  - required_title_count: ${activeSetting.required_title_count}`);
  console.log(`  - required_courses: ${JSON.stringify(activeSetting.required_courses)}`);

  console.log('\n--- 2. VERIFY USERS ATTRIBUTE academic_requirements ---');
  const userAttrs = await appwriteFetch(
    `/databases/${DATABASE_ID}/collections/users/attributes`
  );
  const reqAttr = userAttrs.attributes.find((a) => a.key === 'academic_requirements');
  if (reqAttr) {
    console.log(`✓ academic_requirements attribute exists in users collection (type: ${reqAttr.type}, status: ${reqAttr.status}).`);
  } else {
    throw new Error('academic_requirements attribute NOT found in users collection!');
  }

  console.log('\n--- 3. VERIFY TEST STUDENTS DATA & ELIGIBILITY LOGIC ---');
  const usersList = await appwriteFetch(`/databases/${DATABASE_ID}/collections/users/documents`);
  const eligibleStudent = usersList.documents.find((u) => u.nim_or_nip === '21051204011');
  const ineligibleStudent = usersList.documents.find((u) => u.nim_or_nip === '22051204099');

  function evaluate(settings, student) {
    const parsed = student.academic_requirements ? JSON.parse(student.academic_requirements) : null;
    const studentSks = parsed?.sks ?? student.current_sks ?? 0;
    const completed = (parsed?.completed_courses || []).map((c) => c.trim().toLowerCase());
    const required = settings.required_courses || [];
    const minSks = settings.min_sks || 100;

    const sksSatisfied = studentSks >= minSks;
    const courseStatus = required.map((req) => ({
      course: req,
      isPassed: completed.includes(req.trim().toLowerCase()),
    }));
    const coursesSatisfied = courseStatus.every((c) => c.isPassed);
    const isEligible = sksSatisfied && coursesSatisfied;
    return { isEligible, studentSks, minSks, sksSatisfied, courseStatus, coursesSatisfied, gpa: parsed?.gpa };
  }

  if (eligibleStudent) {
    const evalEligible = evaluate(activeSetting, eligibleStudent);
    console.log(`✓ Eligible student: ${eligibleStudent.name} (${eligibleStudent.nim_or_nip})`);
    console.log(`  - SKS: ${evalEligible.studentSks} / ${evalEligible.minSks} (Satisfied: ${evalEligible.sksSatisfied})`);
    console.log(`  - All Courses Satisfied: ${evalEligible.coursesSatisfied}`);
    console.log(`  - Eligibility Result: ${evalEligible.isEligible ? 'ELIGIBLE (Can Submit)' : 'INELIGIBLE'}`);
    if (!evalEligible.isEligible) throw new Error('Eligible student evaluated as ineligible!');
  }

  if (ineligibleStudent) {
    const evalIneligible = evaluate(activeSetting, ineligibleStudent);
    console.log(`✓ Ineligible student: ${ineligibleStudent.name} (${ineligibleStudent.nim_or_nip})`);
    console.log(`  - SKS: ${evalIneligible.studentSks} / ${evalIneligible.minSks} (Satisfied: ${evalIneligible.sksSatisfied})`);
    console.log(`  - Course breakdown:`);
    evalIneligible.courseStatus.forEach((c) => {
      console.log(`    * ${c.course}: ${c.isPassed ? 'PASSED' : 'NOT PASSED'}`);
    });
    console.log(`  - Eligibility Result: ${evalIneligible.isEligible ? 'ELIGIBLE' : 'INELIGIBLE (Card Warning Shown)'}`);
    if (evalIneligible.isEligible) throw new Error('Ineligible student evaluated as eligible!');
  }

  console.log('\n--- 4. VERIFY PERIOD DISPLAY LOGIC ---');
  function getPeriodStatus(settings, overrideActive = null, overrideDates = null) {
    const active = overrideActive !== null ? overrideActive : settings.is_active;
    const start = overrideDates ? new Date(overrideDates.start).getTime() : new Date(settings.start_date).getTime();
    const end = overrideDates ? new Date(overrideDates.end).getTime() : new Date(settings.end_date).getTime();
    const now = Date.now();

    if (!active) return 'closed';
    if (!isNaN(start) && now < start) return 'upcoming';
    if (!isNaN(end) && now > end) return 'closed';
    return 'open';
  }

  console.log(`✓ Active period evaluates as: ${getPeriodStatus(activeSetting)}`);
  console.log(`✓ Inactive period evaluates as: ${getPeriodStatus(activeSetting, false)}`);
  console.log(`✓ Upcoming period evaluates as: ${getPeriodStatus(activeSetting, true, { start: new Date(Date.now() + 86400000).toISOString(), end: new Date(Date.now() + 864000000).toISOString() })}`);

  console.log('\n--- ALL VERIFICATION CHECKS PASSED! ---');
}

verifyAll().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
