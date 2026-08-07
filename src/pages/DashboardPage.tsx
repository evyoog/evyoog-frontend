import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { listJournals, getPeriodStatus, getTrialBalance } from '../api/gl';
import api from '../api/axios';
import type { ApiResponse, Journal, PeriodStatus, TrialBalanceRow } from '../types';
import { formatINR, formatDate } from '../utils/format';

// Trial balance rows come back nested under `lines` at runtime even though
// the response is typed with `rows` — same normalization TrialBalancePage uses.
function normalizeTrialBalanceRows(raw: unknown): TrialBalanceRow[] {
  const obj = (raw ?? {}) as Record<string, unknown>;
  if (Array.isArray(obj.lines)) return obj.lines as TrialBalanceRow[];
  if (Array.isArray(obj.rows)) return obj.rows as TrialBalanceRow[];
  if (Array.isArray(raw)) return raw as TrialBalanceRow[];
  return [];
}

interface DashboardKPIs {
  revenue: number;
  expenses: number;
  netIncome: number;
  cash: number;
  receivables: number;
  payables: number;
  topExpenses: TrialBalanceRow[];
  periodName: string;
}

function computeKPIs(rows: TrialBalanceRow[], periodName: string): DashboardKPIs {
  const revenue = rows
    .filter((r) => r.accountQualifier === 'REVENUE')
    .reduce((sum, r) => sum + (r.periodToDateCr - r.periodToDateDr), 0);

  const expenses = rows
    .filter((r) => r.accountQualifier === 'EXPENSE')
    .reduce((sum, r) => sum + (r.periodToDateDr - r.periodToDateCr), 0);

  const cash = rows
    .filter((r) => ['1100', '1200'].includes(r.accountCode))
    .reduce((sum, r) => sum + r.endingBalance, 0);

  const receivables = rows.find((r) => r.accountCode === '1300')?.endingBalance ?? 0;
  const payables = Math.abs(rows.find((r) => r.accountCode === '2100')?.endingBalance ?? 0);

  const topExpenses = rows
    .filter((r) => r.accountQualifier === 'EXPENSE' && r.periodToDateDr - r.periodToDateCr > 0)
    .sort(
      (a, b) => b.periodToDateDr - b.periodToDateCr - (a.periodToDateDr - a.periodToDateCr),
    )
    .slice(0, 5);

  return {
    revenue,
    expenses,
    netIncome: revenue - expenses,
    cash,
    receivables,
    payables,
    topExpenses,
    periodName,
  };
}

interface KPICardProps {
  title: string;
  value: number | null;
  subtitle: string;
  indicator?: string;
  borderColor: string;
  indicatorColor?: string;
}

function KPICard({
  title,
  value,
  subtitle,
  indicator,
  borderColor,
  indicatorColor,
}: KPICardProps) {
  return (
    <div className={`rounded-lg border border-border bg-white p-4 border-l-4 ${borderColor} shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate">{title}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-navy">
        {value !== null ? formatINR(value) : '—'}
      </p>
      <p className="mt-1 text-xs text-slate">{subtitle}</p>
      {indicator && (
        <p className={`mt-2 text-xs font-medium ${indicatorColor || 'text-slate'}`}>{indicator}</p>
      )}
    </div>
  );
}

function ExpenseBar({ name, amount, total }: { name: string; amount: number; total: number }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 truncate text-sm text-navy">{name}</div>
      <div className="h-2 flex-1 rounded-full bg-offwhite">
        <div className="h-2 rounded-full bg-amber" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-right font-mono text-sm text-navy">{formatINR(amount)}</div>
      <div className="w-10 text-right text-xs text-slate">{pct}%</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [openPeriod, setOpenPeriod] = useState<PeriodStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pwdBannerDismissed, setPwdBannerDismissed] = useState(false);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loadingKPIs, setLoadingKPIs] = useState(true);
  const [gstTransactions, setGstTransactions] = useState<unknown[]>([]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const [journalPage, periods] = await Promise.all([
        listJournals({ legalEntityId: user.legalEntityId, page: 0, size: 100 }),
        getPeriodStatus(user.legalEntityId),
      ]);
      setJournals(journalPage.content);
      const currentOpenPeriod = periods.find((p) => p.status === 'OPEN') ?? null;
      setOpenPeriod(currentOpenPeriod);

      setLoadingKPIs(true);
      let matchedPeriod: PeriodStatus | null = null;
      try {
        // period-status rows don't guarantee balances exist for that period's
        // accountingPeriodId — try each until trial balance returns rows.
        let rows: TrialBalanceRow[] = [];
        for (const period of periods) {
          try {
            const raw = await getTrialBalance(user.legalEntityId, period.accountingPeriodId);
            const candidateRows = normalizeTrialBalanceRows(raw);
            if (candidateRows.length > 0) {
              rows = candidateRows;
              matchedPeriod = period;
              break;
            }
          } catch {
            continue;
          }
        }
        setKpis(matchedPeriod ? computeKPIs(rows, matchedPeriod.periodName) : null);
      } catch (err) {
        // KPI load failure is non-blocking — operational dashboard still renders.
        console.error('KPI load failed:', err);
        setKpis(null);
      } finally {
        setLoadingKPIs(false);
      }

      // GST compliance summary — non-blocking widget, independent of KPI success.
      try {
        const gstPeriodId = matchedPeriod?.accountingPeriodId ?? currentOpenPeriod?.accountingPeriodId;
        if (gstPeriodId) {
          const { data } = await api.get<ApiResponse<unknown[]>>('/api/v1/gl/gst/transactions', {
            params: { legalEntityId: user.legalEntityId, periodId: gstPeriodId },
          });
          setGstTransactions(Array.isArray(data.data) ? data.data : []);
        } else {
          setGstTransactions([]);
        }
      } catch {
        setGstTransactions([]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const pendingApprovals = journals.filter((j) => j.status === 'PENDING_APPROVAL').length;
  const draftJournals = journals.filter((j) => j.status === 'DRAFT').length;
  const now = new Date();
  const postedThisMonth = journals.filter((j) => {
    if (j.status !== 'POSTED') return false;
    const created = new Date(j.createdAt);
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const recentJournals = journals.slice(0, 5);

  return (
    <AppLayout breadcrumb="Dashboard">
      {user?.mustChangePwd && !pwdBannerDismissed && (
        <div className="mb-6 flex items-center justify-between rounded-md border-l-4 border-l-amber bg-amber-light px-4 py-3 text-sm text-amber">
          <span className="font-medium">
            Your password needs to be changed.{' '}
            <Link to="/change-password" className="underline hover:opacity-80">
              Change Password →
            </Link>{' '}
            or contact your system administrator.
          </span>
          <button
            type="button"
            onClick={() => setPwdBannerDismissed(true)}
            className="shrink-0 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <h1 className="text-2xl font-bold text-navy">Good morning, {user?.fullName}</h1>
      <p className="mt-1 text-sm text-slate">{user?.legalEntityId}</p>

      {loading ? (
        <>
          <div className="mt-6">
            <CardSkeleton count={6} />
          </div>
          <div className="mt-6">
            <CardSkeleton count={4} />
          </div>
          <div className="mt-6">
            <TableSkeleton rows={5} columns={7} />
          </div>
        </>
      ) : error ? (
        <ErrorState
          className="mt-6"
          message="Failed to load dashboard data."
          onRetry={loadDashboard}
        />
      ) : (
        <>
          {!openPeriod && (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber">
              ℹ️ No accounting period is currently open.{' '}
              <Link to="/period-management" className="underline hover:opacity-80">
                Open a period
              </Link>{' '}
              to start posting journal entries.
            </div>
          )}

          {loadingKPIs ? (
            <div className="mt-6">
              <CardSkeleton count={6} />
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KPICard
                  title="Revenue (PTD)"
                  value={kpis?.revenue ?? null}
                  subtitle={kpis?.periodName ?? '—'}
                  borderColor="border-l-blue"
                />
                <KPICard
                  title="Expenses (PTD)"
                  value={kpis?.expenses ?? null}
                  subtitle={kpis?.periodName ?? '—'}
                  borderColor="border-l-amber"
                />
                <KPICard
                  title="Net Income"
                  value={kpis?.netIncome ?? null}
                  subtitle={kpis?.periodName ?? '—'}
                  indicator={
                    kpis
                      ? `Margin: ${kpis.revenue > 0 ? Math.round((kpis.netIncome / kpis.revenue) * 100) : 0}% ${kpis.netIncome >= 0 ? '▲ Profitable' : '▼ Loss-making'}`
                      : undefined
                  }
                  indicatorColor={kpis && kpis.netIncome >= 0 ? 'text-green' : 'text-red-600'}
                  borderColor={kpis && kpis.netIncome < 0 ? 'border-l-red-500' : 'border-l-green'}
                />
                <KPICard
                  title="Cash Position"
                  value={kpis?.cash ?? null}
                  subtitle="Bank + Cash"
                  indicator={kpis ? '● Healthy' : undefined}
                  indicatorColor="text-green"
                  borderColor="border-l-green"
                />
                <KPICard
                  title="Receivables"
                  value={kpis?.receivables ?? null}
                  subtitle="Accounts Receivable"
                  indicator={kpis ? '● Current' : undefined}
                  indicatorColor="text-blue"
                  borderColor="border-l-blue"
                />
                <KPICard
                  title="Payables"
                  value={kpis?.payables ?? null}
                  subtitle="Accounts Payable"
                  indicator={kpis ? '● Manageable' : undefined}
                  indicatorColor="text-amber"
                  borderColor="border-l-amber"
                />
              </div>

              {kpis && kpis.topExpenses.length > 0 && (
                <Card className="mt-6">
                  <h2 className="mb-2 text-lg font-semibold text-navy">
                    Expense Breakdown — {kpis.periodName}
                  </h2>
                  {kpis.topExpenses.map((row) => (
                    <ExpenseBar
                      key={row.accountCode}
                      name={row.accountName}
                      amount={row.periodToDateDr - row.periodToDateCr}
                      total={kpis.expenses}
                    />
                  ))}
                </Card>
              )}

              <Card className="mt-6">
                <h2 className="mb-3 text-lg font-semibold text-navy">
                  GST Compliance — {kpis?.periodName ?? openPeriod?.periodName ?? '—'}
                </h2>
                {gstTransactions.length === 0 ? (
                  <p className="text-sm text-slate">
                    ✅ No GST transactions recorded for this period.
                  </p>
                ) : (
                  <p className="text-sm text-navy">
                    GST transactions: {gstTransactions.length}
                  </p>
                )}
              </Card>
            </>
          )}

          <div className="mt-6 grid grid-cols-4 gap-4">
            {hasPermission('gl:journal:approve') && (
              <Card accent>
                <p className="text-xs font-medium uppercase tracking-wide text-slate">
                  Pending Approvals
                </p>
                <p className="mt-2 font-mono text-2xl font-bold text-amber">{pendingApprovals}</p>
              </Card>
            )}
            <Card accent>
              <p className="text-xs font-medium uppercase tracking-wide text-slate">
                Draft Journals
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-blue">{draftJournals}</p>
            </Card>
            <Card accent>
              <p className="text-xs font-medium uppercase tracking-wide text-slate">
                Posted This Month
              </p>
              <p className="mt-2 font-mono text-2xl font-bold text-green">{postedThisMonth}</p>
            </Card>
            <Card accent>
              <p className="text-xs font-medium uppercase tracking-wide text-slate">
                Open Period
              </p>
              <p className="mt-2 text-lg font-bold text-navy">
                {openPeriod ? openPeriod.periodName : 'None'}
              </p>
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="mb-4 text-lg font-semibold text-navy">Recent Journals</h2>
            {recentJournals.length === 0 ? (
              <EmptyState
                title="No journals yet"
                message="Start recording your financial transactions."
                action={
                  hasPermission('gl:journal:create')
                    ? { label: 'Create Journal Entry', href: '/journals/new' }
                    : undefined
                }
              />
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                    <th className="py-2 pr-4 font-medium">Journal #</th>
                    <th className="py-2 pr-4 font-medium">Description</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 text-right font-medium">Debit</th>
                    <th className="py-2 pr-4 text-right font-medium">Credit</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Posted At</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJournals.map((j) => (
                    <tr key={j.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-mono text-navy">{j.journalNumber}</td>
                      <td className="py-2 pr-4">{j.description}</td>
                      <td className="py-2 pr-4">{formatDate(j.glDate)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{formatINR(j.totalDebit)}</td>
                      <td className="py-2 pr-4 text-right font-mono">{formatINR(j.totalCredit)}</td>
                      <td className="py-2 pr-4">
                        <Badge status={j.status} />
                      </td>
                      <td className="py-2 pr-4">
                        {j.status === 'POSTED' ? formatDate(j.postedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="mt-6 flex gap-3">
            {hasPermission('gl:journal:create') && (
              <Link to="/journals/new">
                <Button aria-label="Create new journal entry">New Journal Entry</Button>
              </Link>
            )}
            {hasPermission('gl:trial-balance:view') && (
              <Link to="/trial-balance">
                <Button variant="secondary" aria-label="View trial balance report">
                  View Trial Balance
                </Button>
              </Link>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
