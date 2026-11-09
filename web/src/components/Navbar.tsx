import React from 'react';
import type { UserRole } from '../types';
import {
  GraduationCap,
  ShieldCheck,
  FileCheck,
  Award,
  UserCheck,
  LogOut,
  User,
} from 'lucide-react';

interface Props {
  currentRole: UserRole;
  userRole: UserRole;
  isAdmin: boolean;
  onRoleChange: (role: UserRole) => void;
  activeUserName: string;
  activeUserEmail?: string;
  activeAvatarUrl?: string | null;
  onLogout: () => void;
}

export const Navbar: React.FC<Props> = ({
  currentRole,
  userRole,
  isAdmin,
  onRoleChange,
  activeUserName,
  activeUserEmail,
  activeAvatarUrl,
  onLogout,
}) => {
  const allRoles: { id: UserRole; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'admin',
      label: 'Admin Portal',
      icon: <ShieldCheck size={15} />,
      color: '#0A4C8F',
    },
    {
      id: 'reviewer',
      label: 'Dosen Reviewer',
      icon: <FileCheck size={15} />,
      color: '#D97706',
    },
    {
      id: 'kaprodi',
      label: 'Kaprodi',
      icon: <Award size={15} />,
      color: '#059669',
    },
    {
      id: 'lecturer',
      label: 'Dosen Pembimbing',
      icon: <UserCheck size={15} />,
      color: '#7C3AED',
    },
  ];

  // If user is Admin, they can switch to any view.
  // Otherwise, filter to only show their own role tab.
  const visibleRoles = isAdmin
    ? allRoles
    : allRoles.filter((r) => r.id === userRole);

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'reviewer':
        return 'Dosen Penilai / Reviewer';
      case 'kaprodi':
        return 'Ketua Program Studi';
      case 'lecturer':
        return 'Dosen Pembimbing';
      default:
        return 'Pengguna';
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="navbar-brand">
          <div className="brand-icon">
            <GraduationCap size={24} color="#FFFFFF" />
          </div>
          <div>
            <div className="brand-title">SPSM PORTAL</div>
            <div className="brand-subtitle">Sarana Pengajuan Skripsi Mahasiswa</div>
          </div>
        </div>

        {/* Role Selector Tabs (Visible to Admin or Multi-role) */}
        {visibleRoles.length > 1 ? (
          <div className="role-selector">
            <span className="role-selector-label">Navigasi Peran:</span>
            <div className="role-pills">
              {visibleRoles.map((r) => {
                const isActive = currentRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => onRoleChange(r.id)}
                    className={`role-pill ${isActive ? 'active' : ''}`}
                    style={{
                      backgroundColor: isActive ? r.color : 'transparent',
                      color: isActive ? '#FFFFFF' : '#475569',
                      borderColor: isActive ? r.color : '#E2E8F0',
                    }}
                  >
                    {r.icon}
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="single-role-indicator">
            <span className="single-role-pill">
              {allRoles.find((r) => r.id === currentRole)?.icon}
              <span>{getRoleDisplayName(currentRole)}</span>
            </span>
          </div>
        )}

        {/* User Profile & Logout */}
        <div className="navbar-user">
          <div className="user-info">
            <span className="user-name">{activeUserName}</span>
            <span className="user-role-badge">{getRoleDisplayName(userRole)}</span>
          </div>
          <div className="user-avatar" title={activeUserEmail || activeUserName}>
            {activeAvatarUrl ? (
              <img
                src={activeAvatarUrl}
                alt={activeUserName}
                className="user-avatar-img"
              />
            ) : (
              activeUserName.charAt(0).toUpperCase()
            )}
          </div>
          <button
            onClick={onLogout}
            className="btn-logout"
            title="Keluar dari Akun"
          >
            <LogOut size={16} />
            <span className="logout-text">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
