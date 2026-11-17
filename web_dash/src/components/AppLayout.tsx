import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, Database, FolderOpen, BarChart3,
  Settings, LogOut, GraduationCap, Menu, X, ChevronDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth';
import { Avatar } from '@/components/ui';
import { onRealtimeEvent, disconnectRealtime } from '@/services/realtimeService';
interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'kaprodi', 'akademik', 'reviewer', 'lecturer'], end: true },
  { to: '/submissions', label: 'Pengajuan Skripsi', icon: <FileText size={18} />, roles: ['admin', 'kaprodi', 'akademik', 'reviewer', 'lecturer'] },
  { to: '/lecturers', label: 'Dosen & Pembimbing', icon: <Users size={18} />, roles: ['admin', 'kaprodi'] },
  { to: '/master-data', label: 'Master Data', icon: <Database size={18} />, roles: ['admin'] },
  { to: '/repo', label: 'Repository', icon: <FolderOpen size={18} />, roles: ['admin', 'kaprodi', 'akademik', 'reviewer', 'lecturer'] },
  { to: '/reports', label: 'Laporan', icon: <BarChart3 size={18} />, roles: ['admin', 'kaprodi', 'akademik'] },
  { to: '/settings', label: 'Pengaturan', icon: <Settings size={18} />, roles: ['admin'] },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  kaprodi: 'Kaprodi',
  akademik: 'Bagian Akademik',
  reviewer: 'Reviewer',
  lecturer: 'Dosen Pembimbing',
  student: 'Mahasiswa',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const qc = useQueryClient();

  // Realtime: invalidate query cache saat ada perubahan di backend
  // Jika auth_error (token expired) → redirect ke login otomatis
  useEffect(() => {
    const unsub = onRealtimeEvent((event) => {
      if (event.type === 'auth_error') {
        // Token sudah tidak valid — paksa logout & redirect
        disconnectRealtime();
        void logout().finally(() => navigate('/login'));
        return;
      }
      const col = event.collection || '';
      if (event.type === 'settings' || col === 'system_settings' || col === 'systemSettings') {
        void qc.invalidateQueries({ queryKey: ['settings'] });
      } else if (col === 'departments') {
        void qc.invalidateQueries({ queryKey: ['departments'] });
      } else if (col === 'batch_years' || col === 'batchYears') {
        void qc.invalidateQueries({ queryKey: ['batchYears'] });
      } else if (col === 'lecturers') {
        void qc.invalidateQueries({ queryKey: ['lecturers'] });
      } else if (col === 'users') {
        void qc.invalidateQueries({ queryKey: ['lecturers'] });
        void qc.invalidateQueries({ queryKey: ['submissions'] });
      } else if (
        col === 'thesis_submissions' ||
        col === 'submissions' ||
        col === 'submission_options' ||
        col === 'options' ||
        col === 'approval_logs' ||
        col === 'approvalLogs' ||
        col === 'surat'
      ) {
        void qc.invalidateQueries({ queryKey: ['submissions'] });
        if (col === 'surat') void qc.invalidateQueries({ queryKey: ['repo-files'] });
      }
    });
    return () => {
      unsub();
    };
  }, [qc, logout, navigate]);

  const role = user?.role || 'lecturer';
  const items = NAV.filter((n) => n.roles.includes(role) || user?.isAdmin);
  const displayName =
    user?.lecturer?.name || user?.profile?.name || user?.account?.name || 'Pengguna';
  const roleLabel = user?.isAdmin && role !== 'admin' ? 'Administrator' : (ROLE_LABEL[role] || role);

  const handleLogout = async () => {
    disconnectRealtime();
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-950 text-ink-300">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 shadow-lg shadow-brand-900/40">
          <GraduationCap size={22} className="text-white" />
        </div>
        <div>
          <p className="text-[15px] font-extrabold tracking-tight text-white">SPSM Portal</p>
          <p className="text-[11px] font-medium text-ink-400">Manajemen Skripsi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-900/60 text-white shadow-inner'
                  : 'text-ink-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <Avatar name={displayName} src={user?.avatarUrl} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">{displayName}</p>
            <p className="truncate text-[11px] text-ink-400">{roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-in">{sidebar}</aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-200/70 bg-white/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <button className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-ink-100"
            >
              <Avatar name={displayName} src={user?.avatarUrl} size={34} />
              <div className="hidden text-left sm:block">
                <p className="max-w-[160px] truncate text-[13px] font-bold text-ink-900">{displayName}</p>
                <p className="text-[11px] font-medium text-ink-400">{roleLabel}</p>
              </div>
              <ChevronDown size={15} className="text-ink-400" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 animate-fade-in rounded-xl border border-ink-200 bg-white p-1.5 shadow-xl">
                  <div className="px-3 py-2">
                    <p className="truncate text-[13px] font-bold text-ink-900">{displayName}</p>
                    <p className="truncate text-[11px] text-ink-400">{user?.account?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={15} /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div key={location.pathname} className="animate-fade-in mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-ink-200/60 px-8 py-4 text-center text-[11px] text-ink-400">
          © {new Date().getFullYear()} SPSM Portal — Sarana Pengajuan Skripsi Mahasiswa
        </footer>
      </div>
    </div>
  );
}
