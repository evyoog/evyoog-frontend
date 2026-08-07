import { useCallback, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listJournals, getPeriodStatus } from '../api/gl';
import type { Journal, JournalStatus, PeriodStatus } from '../types';
import { formatINR, formatDate } from '../utils/format';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: (JournalStatus | 'ALL')[] = [
  'ALL',
  'DRAFT',
  'PENDING_APPROVAL',
  'POSTED',
  'REVERSED',
];

const SLA_DAYS = 2;

function waitMs(journal: Journal): number {
  return Date.now() - new Date(journal.createdAt).getTime();
}

function formatWait(journal: Journal): string {
  const hours = Math.floor(waitMs(journal) / (1000 * 60 * 60));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function JournalListingPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [pendingApprovals, setPendingApprovals] = useState<Journal[]>([]);
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [appliedPeriod, setAppliedPeriod] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPeriodStatus(user.legalEntityId)
      .then((data) => setPeriods(data))
      .catch(() => {
        /* period dropdown is a non-critical filter */
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    listJournals({
      legalEntityId: user.legalEntityId,
      page: 0,
      size: 20,
      status: 'PENDING_APPROVAL',
    })
      .then((result) => setPendingApprovals(Array.isArray(result?.content) ? result.content : []))
      .catch(() => {
        /* approval queue is a non-critical widget */
        setPendingApprovals([]);
      });
  }, [user]);

  const loadJournals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const result = await listJournals({
        legalEntityId: user.legalEntityId,
        page,
        size: PAGE_SIZE,
        status: appliedStatus !== 'ALL' ? appliedStatus : undefined,
        periodId: appliedPeriod || undefined,
      });
      setJournals(Array.isArray(result?.content) ? result.content : []);
      setTotalPages(result?.totalPages ?? 0);
      setTotalElements(result?.totalElements ?? 0);
      setLast(result?.last ?? true);
    } catch {
      setError(true);
      showToast('Failed to load journals. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, page, appliedStatus, appliedPeriod, showToast]);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const handleSearch = () => {
    setPage(0);
    setAppliedPeriod(periodFilter);
    setAppliedStatus(statusFilter);
  };

  const handleClear = () => {
    setPeriodFilter('');
    setStatusFilter('ALL');
    setAppliedPeriod('');
    setAppliedStatus('ALL');
    setPage(0);
  };

  return (
    <AppLayout breadcrumb="Journal Listing">
      <h1 className="text-2xl font-bold text-navy">Journal Listing</h1>
      <p className="mt-1 text-sm text-slate">All journal entries for the current legal entity</p>

      {pendingApprovals.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy">⏳ Approval Queue</h2>
            <span className="text-sm text-slate">{pendingApprovals.length} pending</span>
          </div>
          <div className="mt-3 space-y-2">
            {pendingApprovals.map((j) => {
              const breach = waitMs(j) > SLA_DAYS * 24 * 60 * 60 * 1000;
              return (
                <div
                  key={j.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-mono text-navy">{j.journalNumber}</span>
                  <span className="font-mono">{formatINR(j.totalDebit)}</span>
                  <span className="text-slate">Submitted {formatWait(j)}</span>
                  <span>{breach ? '⚠️' : '✅'}</span>
                  {hasPermission('gl:journal:approve') && (
                    <Button
                      variant="secondary"
                      className="ml-auto px-2 py-1 text-xs"
                      onClick={() => showToast('Approval workflow coming soon', 'info')}
                      aria-label={`Approve ${j.journalNumber}`}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate">⚠️ = waiting more than {SLA_DAYS} days (SLA breach)</p>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex items-end gap-3">
          <div className="w-64">
            <Select
              id="period-filter"
              label="Period"
              aria-label="Filter by period"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="">All periods</option>
              {periods.map((p) => (
                <option key={p.accountingPeriodId} value={p.accountingPeriodId}>
                  {p.periodName}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <Select
              id="status-filter"
              label="Status"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All statuses' : s.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleSearch} aria-label="Search journals">
            Search
          </Button>
          <Button variant="secondary" onClick={handleClear}>
            Clear
          </Button>
        </div>

        <div className="mt-6">
          {loading && <TableSkeleton rows={8} columns={8} />}

          {!loading && error && (
            <ErrorState message="Failed to load journals. Please try again." onRetry={loadJournals} />
          )}

          {!loading && !error && journals.length === 0 && (
            <EmptyState
              title="No journals found"
              message="Try adjusting your filters or create a new journal entry."
              action={{ label: 'New Journal Entry', href: '/journal-entry' }}
            />
          )}

          {!loading && !error && journals.length > 0 && (
            <>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                    <th className="py-2 pr-2 font-medium">Journal #</th>
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 pr-2 font-medium">Period</th>
                    <th className="py-2 pr-2 font-medium">Description</th>
                    <th className="py-2 pr-2 font-medium">Source</th>
                    <th className="py-2 pr-2 text-right font-medium">Debit</th>
                    <th className="py-2 pr-2 text-right font-medium">Credit</th>
                    <th className="py-2 pr-2 font-medium">Status</th>
                    <th className="py-2 pr-2 font-medium">Posted At</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.map((j) => (
                    <tr key={j.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                      <td className="py-2 pr-2 font-mono text-navy">{j.journalNumber}</td>
                      <td className="py-2 pr-2">{formatDate(j.glDate)}</td>
                      <td className="py-2 pr-2">{j.periodName}</td>
                      <td className="py-2 pr-2">{j.description}</td>
                      <td className="py-2 pr-2">{j.journalSourceCode}</td>
                      <td className="py-2 pr-2 text-right font-mono">{formatINR(j.totalDebit)}</td>
                      <td className="py-2 pr-2 text-right font-mono">{formatINR(j.totalCredit)}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Badge status={j.status} />
                          {j.status === 'POSTED' && (
                            <span className="inline-flex items-center rounded-full bg-green-light px-2 py-0.5 text-xs font-medium text-green">
                              ✓ Posted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        {j.status === 'POSTED' ? formatDate(j.postedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate">{totalElements} journal(s) found</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate">
                    Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={last}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
