import React from 'react';
import type { SubmissionStatus } from '../types';
import { Clock, CheckCircle2, AlertCircle, XCircle, RotateCcw, FileEdit } from 'lucide-react';

interface Props {
  status: SubmissionStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const configs: Record<
    SubmissionStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    drafting: {
      label: 'Draf',
      bg: '#F1F5F9',
      text: '#475569',
      border: '#CBD5E1',
      icon: <FileEdit size={size === 'sm' ? 12 : 13} />,
    },
    pending_lecturer: {
      label: 'Menunggu Review',
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#FDE68A',
      icon: <Clock size={size === 'sm' ? 12 : 13} />,
    },
    waiting_kaprodi: {
      label: 'Pleno Kaprodi',
      bg: '#EFF6FF',
      text: '#1D4ED8',
      border: '#BFDBFE',
      icon: <Clock size={size === 'sm' ? 12 : 13} />,
    },
    waiting_akademik: {
      label: 'Menunggu Administrasi TU',
      bg: '#F5F3FF',
      text: '#6D28D9',
      border: '#DDD6FE',
      icon: <Clock size={size === 'sm' ? 12 : 13} />,
    },
    sk_process: {
      label: 'Proses TTD Dekan',
      bg: '#FFF7ED',
      text: '#C2410C',
      border: '#FED7AA',
      icon: <Clock size={size === 'sm' ? 12 : 13} />,
    },
    sk_issued: {
      label: 'SK Resmi Terbit',
      bg: '#ECFDF5',
      text: '#065F46',
      border: '#A7F3D0',
      icon: <CheckCircle2 size={size === 'sm' ? 12 : 13} />,
    },
    approved: {
      label: 'SK Resmi Terbit',
      bg: '#ECFDF5',
      text: '#065F46',
      border: '#A7F3D0',
      icon: <CheckCircle2 size={size === 'sm' ? 12 : 13} />,
    },
    revision: {
      label: 'Perlu Revisi',
      bg: '#FFF7ED',
      text: '#C2410C',
      border: '#FFEDD5',
      icon: <RotateCcw size={size === 'sm' ? 12 : 13} />,
    },
    rejected: {
      label: 'Ditolak',
      bg: '#FEF2F2',
      text: '#991B1B',
      border: '#FECACA',
      icon: <XCircle size={size === 'sm' ? 12 : 13} />,
    },
  };

  const current = configs[status] || {
    label: status.replace(/_/g, ' '),
    bg: '#F8FAFC',
    text: '#475569',
    border: '#E2E8F0',
    icon: <AlertCircle size={size === 'sm' ? 12 : 13} />,
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: size === 'sm' ? '3px 8px' : '4px 11px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {current.icon}
      {current.label}
    </span>
  );
};
