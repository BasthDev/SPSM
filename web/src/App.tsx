import React, { useState, useEffect } from 'react';
import type { UserRole } from './types';
import { Navbar } from './components/Navbar';
import { AdminView } from './views/AdminView';
import { ReviewerView } from './views/ReviewerView';
import { KaprodiView } from './views/KaprodiView';
import { AdvisorView } from './views/AdvisorView';
import { LoginView } from './views/LoginView';
import { authService, type AuthState } from './services/authService';
import { GraduationCap } from 'lucide-react';

export const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');

  const checkSession = async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentUser();
      setAuthState(user);
      if (user) {
        setCurrentRole(user.role);
      }
    } catch (err) {
      console.error('Session check failed:', err);
      setAuthState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari SPSM Portal?')) {
      await authService.logout();
      setAuthState(null);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    // Only admin can switch roles freely
    if (authState?.isAdmin) {
      setCurrentRole(role);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-crest">
          <GraduationCap size={44} color="#0A4C8F" />
        </div>
        <div className="spinner mt-4" />
        <p className="loading-text">Memeriksa Sesi & Memuat Portal SPSM...</p>
      </div>
    );
  }

  // If not authenticated, show Login / Registration View
  if (!authState) {
    return <LoginView onLoginSuccess={checkSession} />;
  }

  const activeName =
    authState.lecturer?.name ||
    authState.profile?.name ||
    authState.account?.name ||
    (authState.isAdmin ? 'Admin Utama SPSM' : 'Dosen');

  const activeEmail = authState.account?.email;

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        userRole={authState.role}
        isAdmin={authState.isAdmin}
        onRoleChange={handleRoleChange}
        activeUserName={activeName}
        activeUserEmail={activeEmail}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {currentRole === 'admin' && <AdminView />}
        {currentRole === 'reviewer' && (
          <ReviewerView reviewerName={activeName} />
        )}
        {currentRole === 'kaprodi' && (
          <KaprodiView kaprodiName={activeName} />
        )}
        {currentRole === 'lecturer' && (
          <AdvisorView
            advisorName={activeName}
            currentLecturerId={authState.lecturer?.$id}
            isAdmin={authState.isAdmin}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div>
          © {new Date().getFullYear()} SPSM Portal — Sarana Pengajuan Skripsi Mahasiswa. Terhubung Resmi ke Appwrite Cloud.
        </div>
      </footer>
    </div>
  );
};

export default App;
