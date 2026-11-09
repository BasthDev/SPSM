import React from 'react';
import type { UserRole } from '../types';
import { GraduationCap, ShieldCheck, FileCheck, Award, UserCheck, Bell } from 'lucide-react';

interface Props {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeUserName: string;
}

export const Navbar: React.FC<Props> = ({ currentRole, onRoleChange, activeUserName }) => {
  const roles: { id: UserRole; label: string; icon: React.ReactNode; color: string }[] = [
    {
      id: 'admin',
      label: 'Admin Portal',
      icon: <ShieldCheck size={16} />,
      color: '#0A4C8F',
    },
    {
      id: 'reviewer',
      label: 'Dosen Reviewer',
      icon: <FileCheck size={16} />,
      color: '#D97706',
    },
    {
      id: 'kaprodi',
      label: 'Kaprodi',
      icon: <Award size={16} />,
      color: '#059669',
    },
    {
      id: 'lecturer',
      label: 'Dosen Pembimbing',
      icon: <UserCheck size={16} />,
      color: '#7C3AED',
    },
  ];

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <div className="navbar-brand">
          <div className="brand-icon">
            <GraduationCap size={24} color="#FFFFFF" />
          </div>
          <div>
            <div className="brand-title">SPSM Portal</div>
            <div className="brand-subtitle">Dosen, Kaprodi & Admin</div>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="role-selector">
          <span className="role-selector-label">Mode Peran:</span>
          <div className="role-pills">
            {roles.map((r) => {
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

        {/* User Profile */}
        <div className="navbar-user">
          <div className="user-info">
            <span className="user-name">{activeUserName}</span>
            <span className="user-role-badge">
              {currentRole === 'admin'
                ? 'Administrator'
                : currentRole === 'reviewer'
                ? 'Dosen Penilai'
                : currentRole === 'kaprodi'
                ? 'Ketua Program Studi'
                : 'Dosen Pembimbing'}
            </span>
          </div>
          <div className="user-avatar">
            {activeUserName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};
