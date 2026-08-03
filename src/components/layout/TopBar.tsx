import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPeriodStatus } from '../../api/gl';
import type { PeriodStatus } from '../../types';
import Button from '../ui/Button';

interface TopBarProps {
  breadcrumb: string;
  onMenuClick?: () => void;
  isMobileMenuOpen?: boolean;
}

export default function TopBar({ breadcrumb, onMenuClick, isMobileMenuOpen }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openPeriod, setOpenPeriod] = useState<PeriodStatus | null | undefined>(undefined);
  const [legalEntityName, setLegalEntityName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPeriodStatus(user.legalEntityId)
      .then((periods) => {
        if (cancelled) return;
        setOpenPeriod(periods.find((p) => p.status === 'OPEN') ?? null);
        setLegalEntityName(periods[0]?.legalEntityName ?? null);
      })
      .catch(() => {
        if (!cancelled) setOpenPeriod(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
          className="flex h-11 w-11 items-center justify-center rounded-md text-navy hover:bg-offwhite md:hidden"
        >
          <span className="flex flex-col gap-1">
            <span className="h-0.5 w-5 bg-navy" />
            <span className="h-0.5 w-5 bg-navy" />
            <span className="h-0.5 w-5 bg-navy" />
          </span>
        </button>
        <span className="text-sm font-medium text-slate">{breadcrumb}</span>
      </div>
      <div className="flex items-center gap-4">
        {openPeriod !== undefined &&
          (openPeriod ? (
            <span className="inline-flex items-center rounded-full bg-green-light px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-green">
              {openPeriod.periodName} (Open)
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-light px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-amber">
              No Open Period
            </span>
          ))}
        <div className="text-right leading-tight">
          <p className="text-sm text-navy">{user?.fullName}</p>
          {legalEntityName && <p className="text-xs text-slate">{legalEntityName}</p>}
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
