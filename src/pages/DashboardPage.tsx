import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listJournals, getPeriodStatus } from '../api/gl';
import type { Journal, PeriodStatus } from '../types';
import { formatINR, formatDate } from '../utils/format';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [openPeriod, setOpenPeriod] = useState<PeriodStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [journalPage, periods] = await Promise.all([
          listJournals({ legalEntityId: user!.legalEntityId, page: 0, size: 100 }),
          getPeriodStatus(user!.legalEntityId),
        ]);
        if (cancelled) return;
        setJournals(journalPage.content);
        setOpenPeriod(periods.find((p) => p.status === 'OPEN') ?? null);
      } catch {
        if (!cancelled) showToast('Failed to load dashboard data. Please try again.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
      <h1 className="text-2xl font-bold text-navy">Good morning, {user?.fullName}</h1>
      <p className="mt-1 text-sm text-slate">{user?.legalEntityId}</p>

      {loading && <LoadingSpinner />}

      {!loading && (
        <>
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
              <p className="py-8 text-center text-sm text-slate">No journals found yet.</p>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="mt-6 flex gap-3">
            {hasPermission('gl:journal:create') && (
              <Link to="/journals/new">
                <Button>New Journal Entry</Button>
              </Link>
            )}
            {hasPermission('gl:trial-balance:view') && (
              <Link to="/trial-balance">
                <Button variant="secondary">View Trial Balance</Button>
              </Link>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
