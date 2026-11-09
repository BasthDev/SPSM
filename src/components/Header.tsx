import React from 'react';
import { AppHeader } from './AppHeader';

type HeaderProps = {
  title: string;
  backHref?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  onRightAction?: () => void;
};

export const Header: React.FC<HeaderProps> = ({
  title,
  backHref,
  onBack,
  showBack,
  rightAction,
  onRightAction,
}) => {
  return (
    <AppHeader
      title={title}
      backHref={backHref}
      onBack={onBack}
      showBack={showBack !== undefined ? showBack : true}
      rightAction={rightAction}
      onRightAction={onRightAction}
    />
  );
};
