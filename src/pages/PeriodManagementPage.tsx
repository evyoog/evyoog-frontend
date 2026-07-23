import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getPeriodStatus, openPeriod, closePeriod, lockPeriod } from '../api/gl';
import type { PeriodStatus, PeriodStatusValue } from '../types';

type Action = 'open' | 'close' | 'lock';

const NEXT_ACTION: Partial<Record<PeriodStatusValue, { action: Action; label: string }>> = {
  NOT_OPENED: { action: 'open', label: 'Open' },
  FUTURE_ENTERABLE: { action: 'open', label: 'Open' },
  OPEN: { action: 'close', label: 'Close' },
  CLOSED: { action: 'lock', label: 'Lock' },
};

const STATUS_CLASSES: Record<PeriodStatusValue, string> = {
  NOT_OPENED: 'bg-slate-100 text-slate',
  FUTURE_ENTERABLE: 'bg-blue-light text-blue-dark',
  OPEN: 'bg-green-light text-green',
  CLOSED: 'bg-amber-light text-amber',
  LOCKED: 'bg-red-50 text-red-600',
};

function StatusBadge({ status }: { status: PeriodStatusValue }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

const ACTION_FN = { open: openPeriod, close: closePeriod, lock: lockPeriod };

export default function PeriodManagementPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const canManage = hasPermission('gl:period:manage');

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getPeriodStatus(user.legalEntityId);
      setPeriods(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load periods.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleConfirm = async (id: string, action: Action) => {
    if (!user) return;
    setActingId(id);
    setConfirmId(null);
    try {
      await ACTION_FN[action](id, user.email);
      showToast('Period status updated successfully.', 'success');
      await load();
    } catch {
      showToast('Failed to update period status. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  return (
    <AppLayout breadcrumb="Period Management">
      <h1 className="text-2xl font-bold text-navy">Period Management</h1>
      <p className="mt-1 text-sm text-slate">
        Open, close and lock accounting periods for Orbinox Valves India Pvt Ltd
      </p>

      <Card className="mt-6">
        {loading && <LoadingSpinner />}

        {!loading && periods.length === 0 && (
          <p className="py-10 text-center text-sm text-slate">
            No periods found for this legal entity.
          </p>
        )}

        {!loading && periods.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                <th className="py-2 pr-2 font-medium">Period</th>
                <th className="py-2 pr-2 font-medium">Fiscal Year</th>
                <th className="py-2 pr-2 font-medium">Status</th>
                <th className="py-2 pr-2 font-medium">Opened By</th>
                <th className="py-2 pr-2 font-medium">Closed By</th>
                <th className="py-2 pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const next = NEXT_ACTION[p.status];
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-2 font-mono text-navy">{p.periodName}</td>
                    <td className="py-2 pr-2">{p.fiscalYear}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-2 pr-2">{p.openedBy ?? '—'}</td>
                    <td className="py-2 pr-2">{p.closedBy ?? '—'}</td>
                    <td className="py-2 pr-2">
                      {canManage && next ? (
                        confirmId === p.id ? (
                          <span className="flex items-center gap-2 text-xs">
                            Are you sure?
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={actingId === p.id}
                              onClick={() => handleConfirm(p.id, next.action)}
                            >
                              Yes
                            </Button>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={actingId === p.id}
                              onClick={() => setConfirmId(null)}
                            >
                              No
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={actingId === p.id}
                            onClick={() => setConfirmId(p.id)}
                          >
                            {next.label}
                          </Button>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </AppLayout>
  );
}
