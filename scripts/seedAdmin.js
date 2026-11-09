const { Client, Account, Databases, ID, Query } = require('appwrite');

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6af1b3b200056ab6bc1d');

const account = new Account(client);
const databases = new Databases(client);

const ADMIN_EMAIL = 'ws.basithachmed@gmail.com';
const ADMIN_PASSWORD = '@Maulidia05';
const ADMIN_NAME = 'Admin Utama SPSM';

(async () => {
  try {
    let session;
    try {
      session = await account.createEmailPasswordSession(ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log('✅ Admin session authenticated. User ID:', session.userId);
    } catch (err) {
      console.log('⚠️ Could not create session directly, trying account create:', err.message);
      const user = await account.create(ID.unique(), ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME);
      session = await account.createEmailPasswordSession(ADMIN_EMAIL, ADMIN_PASSWORD);
      console.log('✅ Admin created and authenticated. User ID:', session.userId);
    }

    const userId = session.userId;

    // Check in users collection
    const userDoc = await databases.listDocuments('spsm_db', 'users', [
      Query.equal('user_id', userId),
    ]);
    console.log('Existing user documents found:', userDoc.documents.length);

    if (userDoc.documents.length === 0) {
      const created = await databases.createDocument('spsm_db', 'users', ID.unique(), {
        user_id: userId,
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        role: 'admin',
        nim_or_nip: 'ADMIN-001',
        department: 'TI',
        batch_year: 2026,
        avatar_url: null,
        created_at: new Date().toISOString(),
      });
      console.log('✅ Created user profile doc:', created['$id']);
    } else {
      console.log('ℹ️ User profile doc already exists:', userDoc.documents[0]['$id']);
    }

    // Check in lecturers collection
    const lecDoc = await databases.listDocuments('spsm_db', 'lecturers', [
      Query.equal('email', ADMIN_EMAIL),
    ]);
    console.log('Existing lecturer documents found:', lecDoc.documents.length);

    if (lecDoc.documents.length === 0) {
      const createdLec = await databases.createDocument('spsm_db', 'lecturers', ID.unique(), {
        user_id: userId,
        nip: 'ADMIN-001',
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        department_id: 'TI',
        expertise: 'Sistem Informasi & Manajemen Akademik',
        quota: 20,
        current_students: 0,
        role: 'admin',
        is_active: true,
      });
      console.log('✅ Created lecturer doc:', createdLec['$id']);
    } else {
      console.log('ℹ️ Lecturer doc already exists:', lecDoc.documents[0]['$id']);
    }

    console.log('🎉 Admin seeding successful and verified!');
  } catch (e) {
    console.error('❌ Error during seeding:', e.message || e);
  }
})();
