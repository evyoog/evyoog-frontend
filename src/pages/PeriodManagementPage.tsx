import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  closePeriod,
  getAccountingCalendar,
  getPeriodStatus,
  initialisePeriod,
  listAccountingPeriods,
  listLedgers,
  lockPeriod,
  openPeriod,
} from '../api/gl';
import type { AccountingCalendar, AccountingPeriod, Ledger, PeriodRow, PeriodStatusValue } from '../types';
import { formatDateTime } from '../utils/format';

type DisplayStatus = PeriodStatusValue | 'NOT_INITIALISED';

const STATUS_LABELS: Record<DisplayStatus, string> = {
  NOT_INITIALISED: 'Not Initialised',
  NOT_OPENED: 'Not Opened',
  FUTURE_ENTERABLE: 'Future Enterable',
  OPEN: 'Open',
  CLOSED: 'Closed',
  LOCKED: 'Locked',
};

const STATUS_CLASSES: Record<DisplayStatus, string> = {
  NOT_INITIALISED: 'bg-slate-100 text-slate',
  NOT_OPENED: 'bg-slate-100 text-slate',
  FUTURE_ENTERABLE: 'bg-blue-light text-blue-dark',
  OPEN: 'bg-green-light text-green',
  CLOSED: 'bg-amber-light text-amber',
  LOCKED: 'bg-red-50 text-red-600',
};

function displayStatus(row: PeriodRow): DisplayStatus {
  return row.status?.status ?? 'NOT_INITIALISED';
}

function StatusBadge({ row }: { row: PeriodRow }) {
  const status = displayStatus(row);
  const title =
    status === 'LOCKED' && row.status
      ? `Locked by ${row.status.lockedBy ?? '—'} at ${formatDateTime(row.status.lockedAt)}`
      : undefined;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Apr-Jun)',
  2: 'Q2 (Jul-Sep)',
  3: 'Q3 (Oct-Dec)',
  4: 'Q4 (Jan-Mar)',
};

function QuarterPill({ quarter, rows }: { quarter: number; rows: PeriodRow[] }) {
  const openCount = rows.filter((r) => r.status?.status === 'OPEN').length;
  const colorClass =
    openCount === rows.length && rows.length > 0
      ? 'bg-green-light text-green'
      : openCount > 0
        ? 'bg-amber-light text-amber'
        : 'bg-slate-100 text-slate';
  return (
    <div className={`flex-1 rounded-md px-4 py-3 text-center ${colorClass}`}>
      <p className="text-sm font-semibold">{QUARTER_LABELS[quarter]}</p>
      <p className="mt-0.5 text-xs">{openCount}/{rows.length} periods open</p>
    </div>
  );
}

export default function PeriodManagementPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:period:manage');

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [calendar, setCalendar] = useState<AccountingCalendar | null>(null);
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [initialiseId, setInitialiseId] = useState<string | null>(null);
  const [confirmActionId, setConfirmActionId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<PeriodRow | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const ledgers = await listLedgers(user.legalEntityId);
      const primaryLedger = ledgers[0] ?? null;
      setLedger(primaryLedger);
      if (!primaryLedger) {
        setCalendar(null);
        setRows([]);
        return;
      }

      const cal = await getAccountingCalendar(primaryLedger.id);
      setCalendar(cal);

      const [periods, statuses] = await Promise.all([
        listAccountingPeriods(cal.id),
        getPeriodStatus(user.legalEntityId),
      ]);

      const statusByPeriodId = new Map(statuses.map((s) => [s.accountingPeriodId, s]));
      const merged: PeriodRow[] = [...periods]
        .sort((a, b) => a.periodNumber - b.periodNumber)
        .map((period) => ({ period, status: statusByPeriodId.get(period.id) ?? null }));
      setRows(merged);
    } catch {
      showToast('Failed to load period data.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleInitialise = async (period: AccountingPeriod) => {
    if (!user) return;
    setActingId(period.id);
    setInitialiseId(null);
    try {
      await initialisePeriod(user.legalEntityId, period.id, user.email);
      showToast(`${period.name} initialised and opened successfully.`, 'success');
      await load();
    } catch {
      showToast('Failed to initialise period. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleOpen = async (statusId: string) => {
    if (!user) return;
    setActingId(statusId);
    setConfirmActionId(null);
    try {
      await openPeriod(statusId, user.email);
      showToast('Period opened successfully.', 'success');
      await load();
    } catch {
      showToast('Failed to open period. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleLock = async (statusId: string) => {
    if (!user) return;
    setActingId(statusId);
    setConfirmActionId(null);
    try {
      await lockPeriod(statusId, user.email);
      showToast('Period locked successfully.', 'success');
      await load();
    } catch {
      showToast('Failed to lock period. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleClose = async () => {
    if (!user || !closeTarget?.status) return;
    const statusId = closeTarget.status.id;
    setActingId(statusId);
    setCloseTarget(null);
    try {
      await closePeriod(statusId, user.email);
      showToast('Period closed successfully.', 'success');
      await load();
    } catch {
      showToast('Failed to close period. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const quarters = [1, 2, 3, 4].map((q) => ({
    quarter: q,
    rows: rows.filter((r) => r.period.quarterNumber === q),
  }));

  const fiscalYear = rows[0]?.period.fiscalYear ?? calendar?.currentFiscalYear ?? '';

  return (
    <AppLayout breadcrumb="Period Management">
      <h1 className="text-2xl font-bold text-navy">Period Management</h1>
      <p className="mt-1 text-sm text-slate">
        FY {fiscalYear} — Orbinox Valves India Pvt Ltd — {ledger?.ledgerName ?? 'Primary Ledger'}
      </p>

      {loading && (
        <Card className="mt-6">
          <LoadingSpinner />
        </Card>
      )}

      {!loading && rows.length === 0 && (
        <Card className="mt-6">
          <p className="py-10 text-center text-sm text-slate">
            No accounting calendar found for this legal entity.
          </p>
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="mt-6 flex gap-3">
            {quarters.map((q) => (
              <QuarterPill key={q.quarter} quarter={q.quarter} rows={q.rows} />
            ))}
          </div>

          <Card className="mt-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Period</th>
                  <th className="py-2 pr-2 font-medium">Quarter</th>
                  <th className="py-2 pr-2 font-medium">Dates</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 pr-2 font-medium">Opened By</th>
                  <th className="py-2 pr-2 font-medium">Opened At</th>
                  <th className="py-2 pr-2 font-medium">Closed By</th>
                  <th className="py-2 pr-2 font-medium">Closed At</th>
                  <th className="py-2 pr-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = displayStatus(row);
                  const busy = actingId === (row.status?.id ?? row.period.id);
                  return (
                    <tr key={row.period.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-2 font-mono text-navy">{row.period.name}</td>
                      <td className="py-2 pr-2">Q{row.period.quarterNumber}</td>
                      <td className="py-2 pr-2 text-xs text-slate">
                        {row.period.startDate} – {row.period.endDate}
                      </td>
                      <td className="py-2 pr-2">
                        <StatusBadge row={row} />
                      </td>
                      <td className="py-2 pr-2">{row.status?.openedBy ?? '—'}</td>
                      <td className="py-2 pr-2">{formatDateTime(row.status?.openedAt)}</td>
                      <td className="py-2 pr-2">{row.status?.closedBy ?? '—'}</td>
                      <td className="py-2 pr-2">{formatDateTime(row.status?.closedAt)}</td>
                      <td className="py-2 pr-2">
                        {!canManage ? null : status === 'NOT_INITIALISED' ? (
                          initialiseId === row.period.id ? (
                            <span className="flex items-center gap-2 text-xs">
                              Initialise {row.period.name}? This will open the period for journal
                              entry.
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => handleInitialise(row.period)}
                              >
                                Initialise
                              </Button>
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => setInitialiseId(null)}
                              >
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busy}
                              onClick={() => setInitialiseId(row.period.id)}
                            >
                              Initialise
                            </Button>
                          )
                        ) : status === 'CLOSED' ? (
                          confirmActionId === row.status?.id ? (
                            <span className="flex items-center gap-2 text-xs">
                              Lock this period?
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => row.status && handleLock(row.status.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => setConfirmActionId(null)}
                              >
                                No
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busy}
                              onClick={() => row.status && setConfirmActionId(row.status.id)}
                            >
                              Lock
                            </Button>
                          )
                        ) : status === 'OPEN' ? (
                          <Button
                            variant="amber"
                            className="px-2 py-1 text-xs"
                            disabled={busy}
                            onClick={() => setCloseTarget(row)}
                          >
                            Close
                          </Button>
                        ) : status === 'NOT_OPENED' || status === 'FUTURE_ENTERABLE' ? (
                          confirmActionId === row.status?.id ? (
                            <span className="flex items-center gap-2 text-xs">
                              Open this period?
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => row.status && handleOpen(row.status.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={busy}
                                onClick={() => setConfirmActionId(null)}
                              >
                                No
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={busy}
                              onClick={() => row.status && setConfirmActionId(row.status.id)}
                            >
                              Open
                            </Button>
                          )
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {closeTarget && (
        <Modal
          title={`Close ${closeTarget.period.name}?`}
          onClose={() => setCloseTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCloseTarget(null)}>
                Cancel
              </Button>
              <Button variant="amber" onClick={handleClose}>
                Close Period
              </Button>
            </>
          }
        >
          <p className="text-sm text-navy">
            Closing this period will prevent any further journal entries for{' '}
            {closeTarget.period.name}. Once closed, only a system administrator can reopen it.
          </p>
          <p className="mt-3 text-sm text-navy">Are you sure you want to close this period?</p>
        </Modal>
      )}
    </AppLayout>
  );
}
