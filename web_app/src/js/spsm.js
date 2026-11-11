import { account, databases, storage, APPWRITE_CONFIG, Query, ID, OAuthProvider } from './appwrite.js';

export function extractProdiCode(dept) {
  if (!dept) return 'TI';
  const clean = dept.trim().toUpperCase();
  if (clean.includes('BISNIS DIGITAL') || clean.startsWith('BD')) return 'BD';
  if (clean.includes('INFORMATIKA') || clean.startsWith('TI')) return 'TI';
  if (clean.includes('SISTEM INFORMASI') || clean.startsWith('SI')) return 'SI';
  if (clean.includes('ELEKTRO') || clean.startsWith('TE')) return 'TE';
  if (clean.includes('MESIN') || clean.startsWith('TM')) return 'TM';
  if (clean.includes('SIPIL') || clean.startsWith('TS')) return 'TS';
  if (clean.includes('MANAJEMEN') || clean.startsWith('MN')) return 'MN';
  if (clean.includes('AKUNTANSI') || clean.startsWith('AK')) return 'AK';
  if (clean.length <= 4) return clean;
  return clean.split(' ').map((w) => w[0]).join('').slice(0, 4) || 'TI';
}

export function extractAngkatan(batchYear) {
  if (!batchYear) return '23';
  const str = String(batchYear).trim();
  return str.length >= 2 ? str.slice(-2) : str.padStart(2, '0');
}

export function formatNomorSurat(urutanNum, prodiCode, angkatan, year = new Date().getFullYear()) {
  const urutan = String(urutanNum).padStart(2, '0');
  const nomor_surat = `${urutan}/SPSM/${prodiCode}/${angkatan}/${year}`;
  return { nomor_surat, urutan };
}

export function formatDateShort(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export const authService = {
  loginWithGoogle() {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/[^/]*$/, '/');
    const successUrl = origin + path + 'index.html';
    const failureUrl = origin + path + 'signin.html?error=oauth_failed';

    account.createOAuth2Session(OAuthProvider.Google, successUrl, failureUrl);
  },

  async loginWithEmail(email, pass) {
    try {
      return await account.createEmailPasswordSession(email.trim(), pass);
    } catch (err) {
      throw new Error(err.message || 'Gagal masuk dengan email & password.');
    }
  },

  async logout() {
    try {
      await account.deleteSession('current');
    } catch (e) {
      console.warn('Logout error', e);
    }
    const path = window.location.pathname.replace(/\/[^/]*$/, '/');
    window.location.href = path + 'signin.html';
  },

  async getCurrentUser() {
    try {
      const acct = await account.get();
      if (!acct || !acct.$id) return null;

      const acctEmail = (acct.email || '').toLowerCase();
      const isAdminEmail = acctEmail === 'ws.basithachmed@gmail.com';

      // 1. Fetch UserProfile
      let profile = null;
      try {
        const userRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('user_id', acct.$id), Query.limit(1)]
        );
        if (userRes.documents.length > 0) {
          profile = userRes.documents[0];
        }
      } catch (e) {
        console.warn('No user profile found', e);
      }

      // 2. Fetch Lecturer record
      let lecturer = null;
      try {
        const emailQueries = [Query.equal('email', acctEmail), Query.limit(1)];
        let lecRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.lecturers,
          emailQueries
        );

        if (lecRes.documents.length === 0 && acct.email) {
          lecRes = await databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.lecturers,
            [Query.equal('email', acct.email), Query.limit(1)]
          );
        }

        if (lecRes.documents.length === 0) {
          lecRes = await databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.lecturers,
            [Query.equal('user_id', acct.$id), Query.limit(1)]
          );
        }

        if (lecRes.documents.length > 0) {
          lecturer = lecRes.documents[0];
        }
      } catch (e) {
        console.warn('Lecturer search error', e);
      }

      // Auto-register Google login as lecturer if new
      if (!isAdminEmail && !lecturer) {
        try {
          const autoNip = acct.phone || `G-${Date.now().toString().slice(-6)}`;
          lecturer = await databases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.lecturers,
            ID.unique(),
            {
              nip: autoNip,
              name: acct.name || 'Dosen Pembimbing',
              email: acctEmail,
              department_id: 'TI',
              expertise: 'Komputer & Sistem',
              quota: 10,
              current_students: 0,
              role: 'lecturer',
              is_active: true,
              user_id: acct.$id,
            }
          );
        } catch (err) {
          console.warn('Auto-create lecturer failed', err);
        }
      }

      let role = 'student';
      if (isAdminEmail) {
        role = 'admin';
      } else if (lecturer) {
        role = lecturer.role || 'lecturer';
      } else if (profile) {
        role = profile.role || 'student';
      }

      const avatarUrl =
        acct.prefs?.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(acct.name || 'User')}&background=204B76&color=fff&bold=true`;

      return {
        account: acct,
        profile,
        lecturer,
        role,
        isAdmin: isAdminEmail || role === 'admin',
        avatarUrl,
      };
    } catch {
      return null;
    }
  },
};

export const lecturerService = {
  async getLecturers() {
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        [Query.orderAsc('name'), Query.limit(100)]
      );
      return res.documents;
    } catch {
      return [];
    }
  },

  async syncStudentCount(lecturerId) {
    if (!lecturerId) return;
    try {
      const allApproved = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        [Query.equal('status', 'approved'), Query.limit(100)]
      );

      const count = allApproved.documents.filter((sub) => {
        if (!sub.advisor_id) return false;
        const parts = sub.advisor_id.split(',').map((p) => p.trim());
        return parts.includes(lecturerId);
      }).length;

      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        lecturerId,
        { current_students: count }
      );
    } catch (e) {
      console.warn('syncStudentCount failed', e);
    }
  },

  async updateRole(lecturerId, role) {
    return await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      lecturerId,
      { role }
    );
  },

  async createLecturer(data) {
    return await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      ID.unique(),
      data
    );
  },

  async updateLecturer(id, data) {
    return await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      id,
      data
    );
  },

  async deleteLecturer(id) {
    return await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      id
    );
  },
};

export const submissionService = {
  getFileViewUrl(fileId) {
    if (!fileId) return '#';
    return storage.getFileView(APPWRITE_CONFIG.storageBucketId, fileId).toString();
  },

  async getAllSubmissions(statusFilter, advisorIdFilter) {
    try {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
      if (statusFilter && statusFilter !== 'all') {
        queries.push(Query.equal('status', statusFilter));
      }

      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        queries
      );

      let submissions = res.documents;

      if (advisorIdFilter && advisorIdFilter !== 'all') {
        submissions = submissions.filter((sub) => {
          if (!sub.advisor_id) return false;
          const parts = sub.advisor_id.split(',').map((s) => s.trim());
          return parts.includes(advisorIdFilter);
        });
      }

      // Hydrate with options, student, advisors, logs
      const hydrated = await Promise.all(
        submissions.map(async (sub) => {
          try {
            const [optRes, logRes] = await Promise.all([
              databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.submissionOptions,
                [Query.equal('submission_id', sub.$id), Query.orderAsc('option_number')]
              ),
              databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.approvalLogs,
                [Query.equal('submission_id', sub.$id), Query.orderAsc('$createdAt')]
              ),
            ]);

            let student = null;
            if (sub.student_id) {
              try {
                const sRes = await databases.listDocuments(
                  APPWRITE_CONFIG.databaseId,
                  APPWRITE_CONFIG.collections.users,
                  [Query.equal('user_id', sub.student_id), Query.limit(1)]
                );
                if (sRes.documents.length > 0) student = sRes.documents[0];
              } catch {}
            }

            let advisor = null;
            let advisor2 = null;
            if (sub.advisor_id) {
              const advisorIds = sub.advisor_id.split(',').map((id) => id.trim());
              try {
                if (advisorIds[0]) {
                  advisor = await databases.getDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.lecturers,
                    advisorIds[0]
                  );
                }
                if (advisorIds[1]) {
                  advisor2 = await databases.getDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.lecturers,
                    advisorIds[1]
                  );
                }
              } catch {}
            }

            // Parse log untuk nomor SK & usulan pembimbing mahasiswa
            let nomorSurat = null;
            let urutanSurat = null;
            let skGeneratedAt = null;
            let preferredAdvisor1 = null;
            let preferredAdvisor2 = null;

            const studentLog = (logRes.documents || []).find(
              (l) => l.action === 'PENGAJUAN_MAHASISWA'
            );
            if (studentLog && studentLog.notes) {
              try {
                const parsed = JSON.parse(studentLog.notes);
                if (parsed.pref1_name || parsed.pref1) {
                  preferredAdvisor1 = {
                    $id: parsed.pref1 || '',
                    name: parsed.pref1_name || `Dosen ID: ${parsed.pref1}`,
                  };
                }
                if (parsed.pref2_name || parsed.pref2) {
                  preferredAdvisor2 = {
                    $id: parsed.pref2 || '',
                    name: parsed.pref2_name || `Dosen ID: ${parsed.pref2}`,
                  };
                }
              } catch {}
            }

            const kaprodiLog = [...(logRes.documents || [])]
              .reverse()
              .find((l) => l.action === 'DISAHKAN_KAPRODI');
            if (kaprodiLog && kaprodiLog.notes) {
              try {
                if (kaprodiLog.notes.trim().startsWith('{')) {
                  const parsed = JSON.parse(kaprodiLog.notes);
                  nomorSurat = parsed.nomor_surat || null;
                  urutanSurat = parsed.urutan || null;
                  skGeneratedAt = parsed.generated_at || kaprodiLog.created_at;
                  if (parsed.text) kaprodiLog.notes = parsed.text;
                }
              } catch {}
            }

            return {
              ...sub,
              student,
              advisor,
              advisor2,
              preferredAdvisor1,
              preferredAdvisor2,
              nomor_surat: nomorSurat,
              urutan_surat: urutanSurat,
              sk_generated_at: skGeneratedAt,
              options: optRes.documents,
              logs: logRes.documents,
            };
          } catch {
            return sub;
          }
        })
      );

      return hydrated;
    } catch (err) {
      console.error('getAllSubmissions failed', err);
      return [];
    }
  },

  async reviewAndSelectTitle(submissionId, selectedOptionId, advisor1Id, advisor2Id, reviewerName, notes) {
    const combinedAdvisorId = advisor2Id ? `${advisor1Id.trim()},${advisor2Id.trim()}` : advisor1Id.trim();

    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'waiting_kaprodi',
        advisor_id: combinedAdvisorId,
      }
    );

    // Update options selection
    const optRes = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.submissionOptions,
      [Query.equal('submission_id', submissionId)]
    );

    await Promise.all(
      optRes.documents.map((opt) =>
        databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.submissionOptions,
          opt.$id,
          { is_selected_by_lecturer: opt.$id === selectedOptionId }
        )
      )
    );

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: reviewerName,
        action: 'VERIFIKASI_DOSEN_PENILAI',
        notes: notes || 'Proposal disetujui Dosen Penilai dan diajukan ke Kaprodi.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async kaprodiApprove(submissionId, advisor1Id, advisor2Id, kaprodiName, notes) {
    const combinedAdvisorId = advisor2Id ? `${advisor1Id.trim()},${advisor2Id.trim()}` : advisor1Id.trim();

    // 1. Status -> approved
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'approved',
        advisor_id: combinedAdvisorId,
      }
    );

    // 2. Increment quotas
    if (advisor1Id) await lecturerService.syncStudentCount(advisor1Id.trim());
    if (advisor2Id && advisor2Id.trim() !== advisor1Id.trim()) {
      await lecturerService.syncStudentCount(advisor2Id.trim());
    }

    // 3. Generate Nomor Surat: URUTAN/SPSM/PRODI/ANGKATAN/TAHUN
    const currentYear = new Date().getFullYear();
    let approvedCount = 0;
    try {
      const approvedRes = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        [Query.equal('status', 'approved'), Query.limit(100)]
      );
      approvedCount = approvedRes.documents.filter((doc) => {
        try {
          return new Date(doc.$createdAt).getFullYear() === currentYear;
        } catch {
          return true;
        }
      }).length;
    } catch {}

    // Ambil prodi & angkatan dari profil mahasiswa
    let prodiCode = 'TI';
    let angkatan = '23';
    try {
      const subDoc = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        submissionId
      );
      if (subDoc.student_id) {
        const userRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('user_id', subDoc.student_id), Query.limit(1)]
        );
        if (userRes.documents.length > 0) {
          const u = userRes.documents[0];
          prodiCode = extractProdiCode(u.department);
          angkatan = extractAngkatan(u.batch_year);
        }
      }
    } catch {}

    const urutanNum = approvedCount || 1;
    const { nomor_surat, urutan } = formatNomorSurat(urutanNum, prodiCode, angkatan, currentYear);

    // 4. Log dengan payload JSON (nomor_surat disimpan di sini karena
    //    kolom nomor_surat tidak ada di tabel thesis_submissions)
    const logPayload = {
      nomor_surat,
      urutan,
      text: notes || 'Judul dan Dosen Pembimbing resmi disahkan oleh Kaprodi.',
      generated_at: new Date().toISOString(),
    };

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: kaprodiName,
        action: 'DISAHKAN_KAPRODI',
        notes: JSON.stringify(logPayload),
        created_at: new Date().toISOString(),
      }
    );
  },

  async requestRevision(submissionId, actorName, notes) {
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      { status: 'revision' }
    );

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'MINTA_REVISI',
        notes: notes || 'Proposal memerlukan perbaikan dari mahasiswa.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async rejectSubmission(submissionId, actorName, notes) {
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      { status: 'rejected' }
    );

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'DITOLAK',
        notes: notes || 'Pengajuan judul ditolak.',
        created_at: new Date().toISOString(),
      }
    );
  },
};

export const masterDataService = {
  async getDepartments() {
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.departments,
        [Query.orderAsc('name'), Query.limit(100)]
      );
      return res.documents.filter(
        (d) =>
          d.code !== 'SETTINGS_SYS' &&
          d.$id !== 'SETTINGS_SYS' &&
          !d.code?.toUpperCase().includes('SETTINGS') &&
          !(d.name || '').trim().startsWith('{') &&
          d.faculty !== 'SYSTE'
      );
    } catch {
      return [];
    }
  },

  async getBatchYears() {
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.batchYears,
        [Query.orderDesc('year'), Query.limit(100)]
      );
      return res.documents;
    } catch {
      return [];
    }
  },
};
