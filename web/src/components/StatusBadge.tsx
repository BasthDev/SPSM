import React from 'react';
import type { SubmissionStatus } from '../types';
import { Clock, CheckCircle2, AlertCircle, XCircle, RotateCcw } from 'lucide-react';

interface Props {
  status: SubmissionStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const configs: Record<
    SubmissionStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    pending_lecturer: {
      label: 'Menunggu Review Dosen',
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#FDE68A',
      icon: <Clock size={size === 'sm' ? 12 : 14} />,
    },
    waiting_kaprodi: {
      label: 'Menunggu Pengesahan Kaprodi',
      bg: '#E0E7FF',
      text: '#3730A3',
      border: '#C7D2FE',
      icon: <Clock size={size === 'sm' ? 12 : 14} />,
    },
    approved: {
      label: 'Disetujui',
      bg: '#D1FAE5',
      text: '#065F46',
      border: '#A7F3D0',
      icon: <CheckCircle2 size={size === 'sm' ? 12 : 14} />,
    },
    revision: {
      label: 'Perlu Revisi',
      bg: '#FFEDD5',
      text: '#9A3412',
      border: '#FED7AA',
      icon: <RotateCcw size={size === 'sm' ? 12 : 14} />,
    },
    rejected: {
      label: 'Ditolak',
      bg: '#FEE2E2',
      text: '#991B1B',
      border: '#FECACA',
      icon: <XCircle size={size === 'sm' ? 12 : 14} />,
    },
  };

  const current = configs[status] || {
    label: status,
    bg: '#F3F4F6',
    text: '#374151',
    border: '#E5E7EB',
    icon: <AlertCircle size={size === 'sm' ? 12 : 14} />,
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: size === 'sm' ? '3px 8px' : '5px 12px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {current.icon}
      {current.label}
    </span>
  );
};
