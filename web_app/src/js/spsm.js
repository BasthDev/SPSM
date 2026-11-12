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
    if (_lecCache.has('all')) return _lecCache.get('all');
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        [Query.orderAsc('name'), Query.limit(100)]
      );
      _lecCache.set('all', res.documents);
      return res.documents;
    } catch {
      return [];
    }
  },

  invalidateLecturerCache() {
    _lecCache.clear();
  },

  async syncStudentCount(lecturerId) {
    this.invalidateLecturerCache();
    if (!lecturerId) return;
    try {
      const allApproved = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        [Query.equal('status', 'approved'), Query.limit(100)]
      );

      const count = allApproved.documents.filter((sub) => {
        const parts = [
          sub.advisor_1_id,
          sub.advisor_2_id,
          ...(sub.advisor_id ? sub.advisor_id.split(',') : []),
        ].filter(Boolean).map((p) => p.trim());
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
    this.invalidateLecturerCache();
    return await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      lecturerId,
      { role }
    );
  },

  async createLecturer(data) {
    this.invalidateLecturerCache();
    return await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      ID.unique(),
      data
    );
  },

  async updateLecturer(id, data) {
    this.invalidateLecturerCache();
    return await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      id,
      data
    );
  },

  async deleteLecturer(id) {
    this.invalidateLecturerCache();
    return await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      id
    );
  },
};

// ============ MEMOIZATION LAYER ============
// Cache hasil fetch berat (submissions ter-hydrate & lecturers) per kombinasi argumen.
// Invalidasi manual via lecturerService.invalidateLecturerCache() dan
// submissionService.invalidateSubmissionsCache() — dipanggil otomatis oleh method mutasi.
const _lecCache = new Map(); // key: 'all' | '' -> documents
let _subsCache = new Map(); // key: `${statusFilter}|${advisorIdFilter || ''}` -> hydrated docs

export const submissionService = {
  invalidateSubmissionsCache() {
    _subsCache = new Map();
  },

  getFileViewUrl(fileId) {
    if (!fileId) return '#';
    return storage.getFileView(APPWRITE_CONFIG.storageBucketId, fileId).toString();
  },

  async getAllSubmissions(statusFilter, advisorIdFilter) {
    const cacheKey = `${statusFilter || 'all'}|${advisorIdFilter || 'all'}`;
    if (_subsCache.has(cacheKey)) {
      return _subsCache.get(cacheKey);
    }

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
          const parts = [
            sub.advisor_1_id,
            sub.advisor_2_id,
            ...(sub.advisor_id ? sub.advisor_id.split(',') : []),
          ].filter(Boolean).map((s) => s.trim());
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
            const a1Id = sub.advisor_1_id || (sub.advisor_id ? sub.advisor_id.split(',')[0]?.trim() : null);
            const a2Id = sub.advisor_2_id || (sub.advisor_id ? sub.advisor_id.split(',')[1]?.trim() : null);
            try {
              if (a1Id) {
                advisor = await databases.getDocument(
                  APPWRITE_CONFIG.databaseId,
                  APPWRITE_CONFIG.collections.lecturers,
                  a1Id
                );
              }
              if (a2Id) {
                advisor2 = await databases.getDocument(
                  APPWRITE_CONFIG.databaseId,
                  APPWRITE_CONFIG.collections.lecturers,
                  a2Id
                );
              }
            } catch {}

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

            let suratDoc = null;
            try {
              const surRes = await databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.surat || 'surat',
                [Query.equal('submission_id', sub.$id), Query.limit(1)]
              );
              if (surRes.documents.length > 0) {
                suratDoc = surRes.documents[0];
                nomorSurat = suratDoc.nomor_surat;
                urutanSurat = String(suratDoc.urutan);
                skGeneratedAt = suratDoc.created_at;
              }
            } catch {}

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

      _subsCache.set(cacheKey, hydrated);
      return hydrated;
    } catch (err) {
      console.error('getAllSubmissions failed', err);
      return [];
    }
  },

  async reviewAndSelectTitle(submissionId, selectedOptionId, advisor1Id, advisor2Id, reviewerName, notes) {
    this.invalidateSubmissionsCache();
    const combinedAdvisorId = advisor2Id ? `${advisor1Id.trim()},${advisor2Id.trim()}` : advisor1Id.trim();

    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'waiting_kaprodi',
        advisor_id: combinedAdvisorId,
        advisor_1_id: advisor1Id ? advisor1Id.trim() : null,
        advisor_2_id: advisor2Id ? advisor2Id.trim() : null,
        reviewer_notes: notes || '',
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
          {
            is_selected: opt.$id === selectedOptionId,
          }
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

  async ensureSuratGenerated(submissionId) {
    try {
      const col = APPWRITE_CONFIG.collections.surat || 'surat';
      const existing = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        col,
        [Query.equal('submission_id', submissionId), Query.limit(1)]
      );
      if (existing.documents.length > 0) return existing.documents[0];

      const subDoc = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        submissionId
      );

      let prodiCode = 'TI';
      let angkatan = '21';
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

      const year = new Date().getFullYear();
      const allSurat = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        col,
        [Query.orderDesc('urutan'), Query.limit(100)]
      );
      const currentYearSurat = allSurat.documents.filter((s) => (s.nomor_surat || '').endsWith(String(year)));
      const nextUrutan = (currentYearSurat[0]?.urutan || 0) + 1;
      const { nomor_surat } = formatNomorSurat(nextUrutan, prodiCode, angkatan, year);
      const no_dokumen = `SPSM-${submissionId.toUpperCase().slice(-8)}-${Date.now().toString(16).toUpperCase()}`;

      const newSurat = await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        col,
        ID.unique(),
        {
          submission_id: submissionId,
          nomor_surat,
          urutan: nextUrutan,
          no_dokumen,
          created_at: new Date().toISOString(),
        }
      );
      return newSurat;
    } catch (err) {
      console.warn('ensureSuratGenerated warning:', err);
      return null;
    }
  },

  async processDekanSignature(submissionId, staffName) {
    this.invalidateSubmissionsCache();
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      { status: 'sk_process' }
    );

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: staffName || 'Tata Usaha (Akademik)',
        action: 'PROSES_TTD_DEKAN',
        notes: 'Draf SK telah dicetak fisik dan sedang dalam proses tanda tangan Dekan.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async uploadSignedSk(submissionId, file, staffName) {
    this.invalidateSubmissionsCache();
    const uploaded = await storage.createFile(
      APPWRITE_CONFIG.storageBucketId,
      ID.unique(),
      file
    );

    const col = APPWRITE_CONFIG.collections.surat || 'surat';
    const suratRes = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      col,
      [Query.equal('submission_id', submissionId), Query.limit(1)]
    );

    if (suratRes.documents.length > 0) {
      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        col,
        suratRes.documents[0].$id,
        { scanned_sk_id: uploaded.$id }
      );
    }

    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      { status: 'sk_issued' }
    );

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: staffName || 'Tata Usaha (Akademik)',
        action: 'SK_RESMI_TERBIT',
        notes: `Scan PDF SK resmi ber-TTD basah Dekan berhasil diunggah (File ID: ${uploaded.$id}). SK resmi diterbitkan.`,
        created_at: new Date().toISOString(),
      }
    );

    return uploaded;
  },

  async kaprodiApprove(submissionId, advisor1Id, advisor2Id, kaprodiName, notes) {
    this.invalidateSubmissionsCache();
    const a1 = (advisor1Id || '').trim();
    const a2 = (advisor2Id || '').trim();
    const combinedAdvisorId = a2 ? `${a1},${a2}` : a1;

    // 1. Status -> waiting_akademik (Blueprint v2.2)
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'waiting_akademik',
        advisor_id: combinedAdvisorId,
        advisor_1_id: a1,
        advisor_2_id: a2,
      }
    );

    // 2. Increment quotas
    if (a1) await lecturerService.syncStudentCount(a1);
    if (a2 && a2 !== a1) await lecturerService.syncStudentCount(a2);

    // 3. Generate Surat record
    const surat = await this.ensureSuratGenerated(submissionId);

    // 4. Log
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: kaprodiName,
        action: 'DISAHKAN_KAPRODI',
        notes: JSON.stringify({
          nomor_surat: surat?.nomor_surat,
          urutan: surat?.urutan,
          text: notes || 'Judul dan Dosen Pembimbing resmi disahkan oleh Kaprodi (Tahap Pleno). Menunggu administrasi SK.',
          generated_at: new Date().toISOString(),
        }),
        created_at: new Date().toISOString(),
      }
    );
    return surat;
  },

  /**
   * Catatan bisa berbentuk string biasa atau object {opt1, opt2, opt3, general}.
   * Format output mengikuti web lama: "Catatan Revisi per Judul:\nJudul 1: ..."
   * agar mobile app bisa parse revision_note per opsi.
   */
  _buildStructuredNotes(kind, notes) {
    if (typeof notes === 'string') return notes;
    if (!notes || typeof notes !== 'object') return '';
    const label = kind === 'revisi' ? 'Catatan Revisi per Judul' : 'Catatan Penolakan per Judul';
    const fallback = kind === 'revisi' ? 'Perlu perbaikan rumusan masalah.' : 'Tidak memenuhi kualifikasi penelitian.';
    let text = `${label}:\n`;
    text += `Judul 1: ${notes.opt1 || fallback}\n`;
    text += `Judul 2: ${notes.opt2 || fallback}\n`;
    text += `Judul 3: ${notes.opt3 || fallback}`;
    if (notes.general) text += `\n\nCatatan Tambahan: ${notes.general}`;
    return text;
  },

  async requestRevision(submissionId, actorName, notes) {
    this.invalidateSubmissionsCache();
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
        notes: this._buildStructuredNotes('revisi', notes) || 'Proposal memerlukan perbaikan dari mahasiswa.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async rejectSubmission(submissionId, actorName, notes, advisorId) {
    this.invalidateSubmissionsCache();
    // Unmark semua opsi terpilih
    try {
      const optRes = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.submissionOptions,
        [Query.equal('submission_id', submissionId)]
      );
      for (const opt of optRes.documents) {
        if (opt.is_selected_by_lecturer) {
          await databases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.submissionOptions,
            opt.$id,
            { is_selected_by_lecturer: false }
          );
        }
      }
    } catch {}

    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      { status: 'rejected' }
    );

    if (advisorId) {
      const parts = advisorId.split(',').map((s) => s.trim()).filter(Boolean);
      for (const adv of parts) {
        await lecturerService.syncStudentCount(adv);
      }
    }

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'DITOLAK',
        notes: this._buildStructuredNotes('tolak', notes) || 'Pengajuan judul ditolak.',
        created_at: new Date().toISOString(),
      }
    );
  },
};

export const settingsService = {
  async getSettings() {
    const DEFAULTS = {
      is_active: true,
      start_date: '',
      end_date: '',
      academic_year: '2025/2026 Ganjil',
      min_sks: 100,
      required_title_count: 3,
      required_courses: [],
    };
    try {
      // 1. Coba collection system_settings khusus
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        'system_settings',
        [Query.limit(1)]
      );
      if (res.documents.length > 0) {
        const doc = res.documents[0];
        return {
          is_active: Boolean(doc.is_active),
          start_date: doc.start_date || DEFAULTS.start_date,
          end_date: doc.end_date || DEFAULTS.end_date,
          academic_year: doc.academic_year || DEFAULTS.academic_year,
          min_sks: typeof doc.min_sks === 'number' ? doc.min_sks : DEFAULTS.min_sks,
          required_title_count: typeof doc.required_title_count === 'number' ? doc.required_title_count : DEFAULTS.required_title_count,
          required_courses: Array.isArray(doc.required_courses) ? doc.required_courses : DEFAULTS.required_courses,
        };
      }
    } catch {}

    // 2. Fallback: dokumen SETTINGS_SYS di collection departments
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.departments,
        [Query.equal('code', 'SETTINGS_SYS'), Query.limit(1)]
      );
      if (res.documents.length > 0) {
        try {
          const parsed = JSON.parse(res.documents[0].name);
          return {
            is_active: Boolean(parsed.is_active),
            start_date: parsed.start_date || DEFAULTS.start_date,
            end_date: parsed.end_date || DEFAULTS.end_date,
            academic_year: parsed.academic_year || DEFAULTS.academic_year,
            min_sks: typeof parsed.min_sks === 'number' ? parsed.min_sks : DEFAULTS.min_sks,
            required_title_count: typeof parsed.required_title_count === 'number' ? parsed.required_title_count : DEFAULTS.required_title_count,
            required_courses: Array.isArray(parsed.required_courses) ? parsed.required_courses : DEFAULTS.required_courses,
          };
        } catch {
          return DEFAULTS;
        }
      }
      // Buat dokumen default jika belum ada
      await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.departments,
        ID.unique(),
        {
          name: JSON.stringify(DEFAULTS),
          code: 'SETTINGS_SYS',
          faculty: 'SYSTEM',
          is_active: true,
        }
      );
      return DEFAULTS;
    } catch (err) {
      console.warn('getSettings failed, using defaults:', err);
      return DEFAULTS;
    }
  },

  async updateSettings(settings) {
    // 1. Update system_settings jika collection ada
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        'system_settings',
        [Query.limit(1)]
      );
      if (res.documents.length > 0) {
        await databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          'system_settings',
          res.documents[0].$id,
          settings
        );
      }
    } catch {}

    // 2. Simpan ke dokumen SETTINGS_SYS di departments (sumber utama mobile app)
    const res = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      [Query.equal('code', 'SETTINGS_SYS'), Query.limit(1)]
    );
    if (res.documents.length > 0) {
      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.departments,
        res.documents[0].$id,
        {
          name: JSON.stringify(settings),
          is_active: Boolean(settings.is_active),
        }
      );
    } else {
      await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.departments,
        ID.unique(),
        {
          name: JSON.stringify(settings),
          code: 'SETTINGS_SYS',
          faculty: 'SYSTEM',
          is_active: Boolean(settings.is_active),
        }
      );
    }
    return settings;
  },
};

export const repoService = {
  async listAllFiles() {
    const files = [];
    let cursor;
    for (let page = 0; page < 20; page++) {
      const queries = [Query.limit(50), Query.orderDesc('$createdAt')];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const res = await storage.listFiles(APPWRITE_CONFIG.storageBucketId, queries);
      const docs = res.files || [];
      if (docs.length === 0) break;
      files.push(...docs);
      if (docs.length < 50) break;
      cursor = docs[docs.length - 1].$id;
    }
    return files;
  },

  getFileViewUrl(fileId) {
    if (!fileId) return '#';
    try {
      return storage.getFileView(APPWRITE_CONFIG.storageBucketId, fileId).toString();
    } catch {
      return '#';
    }
  },

  getFileDownloadUrl(fileId) {
    if (!fileId) return '#';
    try {
      return storage.getFileDownload(APPWRITE_CONFIG.storageBucketId, fileId).toString();
    } catch {
      return '#';
    }
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

  async createDepartment(data) {
    return await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      ID.unique(),
      data
    );
  },

  async updateDepartment(id, data) {
    return await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      id,
      data
    );
  },

  async deleteDepartment(id) {
    return await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      id
    );
  },

  async createBatchYear(data) {
    return await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.batchYears,
      ID.unique(),
      data
    );
  },

  async updateBatchYear(id, data) {
    return await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.batchYears,
      id,
      data
    );
  },

  async deleteBatchYear(id) {
    return await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.batchYears,
      id
    );
  },
};
