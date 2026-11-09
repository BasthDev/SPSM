import React, { useState } from 'react';
import type { UserRole } from './types';
import { Navbar } from './components/Navbar';
import { AdminView } from './views/AdminView';
import { ReviewerView } from './views/ReviewerView';
import { KaprodiView } from './views/KaprodiView';
import { AdvisorView } from './views/AdvisorView';

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');

  // Simulated active user names for role previews
  const roleUserNames: Record<UserRole, string> = {
    admin: 'Admin Utama SPSM',
    reviewer: 'Dr. Ir. Ahmad Sudrajat, M.Kom.',
    kaprodi: 'Prof. Dr. Siti Aminah, S.T., M.T.',
    lecturer: 'Budi Santoso, M.Cs.',
    student: 'Mahasiswa',
  };

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeUserName={roleUserNames[currentRole]}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {currentRole === 'admin' && <AdminView />}
        {currentRole === 'reviewer' && (
          <ReviewerView reviewerName={roleUserNames.reviewer} />
        )}
        {currentRole === 'kaprodi' && (
          <KaprodiView kaprodiName={roleUserNames.kaprodi} />
        )}
        {currentRole === 'lecturer' && (
          <AdvisorView advisorName={roleUserNames.lecturer} />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div>
          © {new Date().getFullYear()} SPSM - Sarana Pengajuan Skripsi Mahasiswa. Terhubung ke Appwrite Cloud.
        </div>
      </footer>
    </div>
  );
};

export default App;
