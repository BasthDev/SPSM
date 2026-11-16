import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { AppLayout } from '@/components/AppLayout';
import { Spinner } from '@/components/ui';
import { LoginView } from '@/views/LoginView';
import { DashboardView } from '@/views/DashboardView';
import { SubmissionsView } from '@/views/SubmissionsView';
import { LecturersView } from '@/views/LecturersView';
import { MasterDataView } from '@/views/MasterDataView';
import { RepoView } from '@/views/RepoView';
import { ReportsView } from '@/views/ReportsView';
import { SettingsView } from '@/views/SettingsView';
import { GraduationCap } from 'lucide-react';

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-900 shadow-xl shadow-brand-900/30">
        <GraduationCap size={28} className="text-white" />
      </div>
      <Spinner />
      <p className="text-[13px] font-semibold text-ink-400">Memeriksa sesi…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <BootScreen />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginView />}
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/submissions" element={<SubmissionsView />} />
        <Route path="/lecturers" element={<LecturersView />} />
        <Route path="/master-data" element={<MasterDataView />} />
        <Route path="/repo" element={<RepoView />} />
        <Route path="/reports" element={<ReportsView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
