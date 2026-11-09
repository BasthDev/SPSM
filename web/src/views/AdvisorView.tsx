import React, { useState, useEffect } from 'react';
import { submissionService } from '../services/submissionService';
import { lecturerService } from '../services/lecturerService';
import { StatusBadge } from '../components/StatusBadge';
import type { ThesisSubmission, Lecturer } from '../types';
import { UserCheck, BookOpen, GraduationCap, Calendar, Users, ExternalLink } from 'lucide-react';

interface Props {
  advisorName: string;
}

export const AdvisorView: React.FC<Props> = ({ advisorName }) => {
  const [submissions, setSubmissions] = useState<ThesisSubmission[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, lecs] = await Promise.all([
        submissionService.getAllSubmissions('approved'),
        lecturerService.getLecturers(),
      ]);
      setSubmissions(subs);
      setLecturers(lecs);
    } catch (err) {
      console.error('Failed to load advisor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubs = submissions.filter((s) => {
    if (selectedLecturerId === 'all') return true;
    return s.advisor_id === selectedLecturerId;
  });

  return (
    <div className="advisor-container">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Monitoring Dosen Pembimbing</h1>
          <p className="page-desc">
            Daftar mahasiswa yang judul skripsinya telah disahkan dan resmi dibimbing oleh Dosen Pembimbing.
          </p>
        </div>

        {/* Filter Lecturer */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Pilih Dosen:</label>
          <select
            value={selectedLecturerId}
            onChange={(e) => setSelectedLecturerId(e.target.value)}
            className="filter-select"
          >
            <option value="all">Semua Dosen Pembimbing</option>
            {lecturers.map((lec) => (
              <option key={lec.$id} value={lec.$id}>
                {lec.name} ({lec.current_students || 0}/{lec.quota} mhs)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Supervised Students */}
      <div className="supervised-grid mt-6">
        {filteredSubs.length === 0 ? (
          <div className="empty-box col-span-full">
            <Users size={36} color="#94A3B8" />
            <h4 className="text-slate-700 font-semibold mt-2">Belum ada mahasiswa bimbingan</h4>
            <p className="text-xs text-muted max-w-sm">
              Mahasiswa yang telah diverifikasi oleh Reviewer dan disahkan oleh Kaprodi akan otomatis muncul di sini.
            </p>
          </div>
        ) : (
          filteredSubs.map((sub) => {
            const chosen =
              sub.options?.find((o) => o.is_selected_by_lecturer) || sub.options?.[0];
            const fileUrl = chosen?.journal_file_id
              ? submissionService.getFileViewUrl(chosen.journal_file_id)
              : null;

            return (
              <div key={sub.$id} className="student-card">
                <div className="student-card-header">
                  <div>
                    <div className="font-bold text-slate-800 text-base">
                      {sub.student?.name || 'Mahasiswa'}
                    </div>
                    <div className="text-xs text-muted font-mono">
                      NIM: {sub.student?.nim_or_nip || sub.student_id} • {sub.student?.department} (
                      {sub.student?.batch_year})
                    </div>
                  </div>
                  <StatusBadge status={sub.status} size="sm" />
                </div>

                <div className="student-thesis-box">
                  <div className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                    <BookOpen size={13} />
                    <span>Judul Skripsi Disahkan:</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">{chosen?.title}</h4>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3">{chosen?.background}</p>
                </div>

                <div className="student-advisor-footer">
                  <div className="advisor-pill">
                    <GraduationCap size={14} color="#0A4C8F" />
                    <span>Pembimbing: {sub.advisor?.name || 'Belum diplot'}</span>
                  </div>
                  {fileUrl && fileUrl !== '#' && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-icon-link"
                      title="Lihat Jurnal Acuan"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
