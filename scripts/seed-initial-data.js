const { Client, Databases, ID } = require('appwrite');

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6af1b3b200056ab6bc1d';
const DATABASE_ID = 'spsm_db';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
const databases = new Databases(client);

const initialDepartments = [
  { name: 'Teknik Informatika', code: 'TI', faculty: 'Fakultas Teknik', is_active: true },
  { name: 'Sistem Informasi', code: 'SI', faculty: 'Fakultas Ilmu Komputer', is_active: true },
  { name: 'Teknik Elektro', code: 'TE', faculty: 'Fakultas Teknik', is_active: true },
  { name: 'Teknik Mesin', code: 'TM', faculty: 'Fakultas Teknik', is_active: true },
  { name: 'Teknik Sipil', code: 'TS', faculty: 'Fakultas Teknik', is_active: true },
  { name: 'Manajemen', code: 'MN', faculty: 'Fakultas Ekonomi & Bisnis', is_active: true },
  { name: 'Akuntansi', code: 'AK', faculty: 'Fakultas Ekonomi & Bisnis', is_active: true },
];

const initialBatchYears = [
  { year: 2024, label: 'Angkatan 2024 (Letting 24)', is_active: true },
  { year: 2023, label: 'Angkatan 2023 (Letting 23)', is_active: true },
  { year: 2022, label: 'Angkatan 2022 (Letting 22)', is_active: true },
  { year: 2021, label: 'Angkatan 2021 (Letting 21)', is_active: true },
  { year: 2020, label: 'Angkatan 2020 (Letting 20)', is_active: true },
  { year: 2019, label: 'Angkatan 2019 (Letting 19)', is_active: true },
];

const initialLecturers = [
  {
    nip: '197508122003121001',
    name: 'Dr. Ir. Ahmad Sudrajat, M.Kom.',
    email: 'ahmad.sudrajat@spsm.ac.id',
    department_id: 'TI',
    expertise: 'Machine Learning, Computer Vision, Data Science',
    quota: 10,
    current_students: 2,
    role: 'reviewer',
    is_active: true,
  },
  {
    nip: '198204152008122002',
    name: 'Prof. Dr. Siti Aminah, S.T., M.T.',
    email: 'siti.aminah@spsm.ac.id',
    department_id: 'TI',
    expertise: 'Software Engineering, Web & Mobile Architecture, Cloud',
    quota: 12,
    current_students: 4,
    role: 'kaprodi',
    is_active: true,
  },
  {
    nip: '198906232015041003',
    name: 'Budi Santoso, M.Cs.',
    email: 'budi.santoso@spsm.ac.id',
    department_id: 'TI',
    expertise: 'Cyber Security, Network Infrastructure, IoT',
    quota: 8,
    current_students: 1,
    role: 'lecturer',
    is_active: true,
  },
  {
    nip: '199101102019032004',
    name: 'Rina Wahyuni, M.T.I.',
    email: 'rina.wahyuni@spsm.ac.id',
    department_id: 'SI',
    expertise: 'Enterprise Information Systems, UI/UX, IT Governance',
    quota: 10,
    current_students: 3,
    role: 'reviewer',
    is_active: true,
  },
  {
    nip: '198509172010121005',
    name: 'Hendra Wijaya, Ph.D.',
    email: 'hendra.wijaya@spsm.ac.id',
    department_id: 'SI',
    expertise: 'Data Warehousing, Business Intelligence, Big Data',
    quota: 10,
    current_students: 2,
    role: 'lecturer',
    is_active: true,
  },
];

async function seed() {
  console.log('--- Seeding Initial Data for SPSM ---');

  // 1. Seed departments
  console.log('Seeding departments...');
  for (const dept of initialDepartments) {
    try {
      await databases.createDocument(DATABASE_ID, 'departments', ID.unique(), dept);
      console.log(`  + Dept: ${dept.name} (${dept.code})`);
    } catch (e) {
      console.log(`  ! Skipped ${dept.code}: ${e.message}`);
    }
  }

  // 2. Seed batch years
  console.log('Seeding batch years...');
  for (const by of initialBatchYears) {
    try {
      await databases.createDocument(DATABASE_ID, 'batch_years', ID.unique(), by);
      console.log(`  + Batch Year: ${by.label}`);
    } catch (e) {
      console.log(`  ! Skipped ${by.year}: ${e.message}`);
    }
  }

  // 3. Seed lecturers
  console.log('Seeding lecturers...');
  for (const lec of initialLecturers) {
    try {
      await databases.createDocument(DATABASE_ID, 'lecturers', ID.unique(), lec);
      console.log(`  + Lecturer: ${lec.name} (${lec.role})`);
    } catch (e) {
      console.log(`  ! Skipped ${lec.name}: ${e.message}`);
    }
  }

  console.log('--- Seeding Completed! 🎉 ---');
}

seed().catch(console.error);
