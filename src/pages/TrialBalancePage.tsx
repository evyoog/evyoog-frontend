import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { getTrialBalance, listPeriods } from '../api/gl';
import type { Period, TrialBalanceReport, TrialBalanceRow } from '../types';
import { formatINR } from '../utils/format';

const QUALIFIER_ORDER = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expense'];

function groupByQualifier(rows: TrialBalanceRow[]) {
  const groups = new Map<string, TrialBalanceRow[]>();
  for (const row of rows) {
    const key = row.accountQualifier || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    const ai = QUALIFIER_ORDER.indexOf(a[0]);
    const bi = QUALIFIER_ORDER.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return ordered;
}

function exportCsv(report: TrialBalanceReport) {
  const header = [
    'Account',
    'Name',
    'Qualifier',
    'Period DR',
    'Period CR',
    'YTD DR',
    'YTD CR',
    'Balance',
  ];
  const rows = report.rows.map((r) => [
    r.accountCode,
    r.accountName,
    r.accountQualifier,
    r.periodDebit,
    r.periodCredit,
    r.ytdDebit,
    r.ytdCredit,
    r.endingBalance,
  ]);
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trial-balance.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function TrialBalancePage() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listPeriods(user.legalEntityId)
      .then((data) => {
        if (cancelled) return;
        setPeriods(data);
        const open = data.find((p) => p.status === 'OPEN');
        if (open) setPeriodId(open.id);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load periods.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPeriods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const runReport = async () => {
    if (!user || !periodId) return;
    setRunning(true);
    setError('');
    try {
      const data = await getTrialBalance(user.legalEntityId, periodId);
      setReport(data);
    } catch {
      setError('Failed to load trial balance. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  const groups = report ? groupByQualifier(report.rows) : [];

  return (
    <AppLayout breadcrumb="Trial Balance">
      <h1 className="text-2xl font-bold text-navy">Trial Balance</h1>
      <p className="mt-1 text-sm text-slate">Period-to-date and year-to-date balances</p>

      <Card className="mt-6">
        <div className="flex items-end gap-3">
          <div className="w-64">
            <Select
              id="period"
              label="Period"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              disabled={loadingPeriods}
            >
              <option value="">Select a period</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.periodName}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={runReport} loading={running} disabled={!periodId}>
            Run Report
          </Button>
          {report && (
            <Button variant="secondary" onClick={() => exportCsv(report)}>
              Export CSV
            </Button>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6">
          {running && <LoadingSpinner />}

          {!running && !report && !error && (
            <p className="py-10 text-center text-sm text-slate">
              Select a period and click Run Report to view the trial balance.
            </p>
          )}

          {!running && report && report.rows.length === 0 && (
            <p className="py-10 text-center text-sm text-slate">
              No trial balance data for this period.
            </p>
          )}

          {!running && report && report.rows.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Account</th>
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 pr-2 text-right font-medium">Period DR</th>
                  <th className="py-2 pr-2 text-right font-medium">Period CR</th>
                  <th className="py-2 pr-2 text-right font-medium">YTD DR</th>
                  <th className="py-2 pr-2 text-right font-medium">YTD CR</th>
                  <th className="py-2 pr-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([qualifier, rows]) => {
                  const subtotal = rows.reduce(
                    (acc, r) => ({
                      periodDebit: acc.periodDebit + r.periodDebit,
                      periodCredit: acc.periodCredit + r.periodCredit,
                      ytdDebit: acc.ytdDebit + r.ytdDebit,
                      ytdCredit: acc.ytdCredit + r.ytdCredit,
                      endingBalance: acc.endingBalance + r.endingBalance,
                    }),
                    { periodDebit: 0, periodCredit: 0, ytdDebit: 0, ytdCredit: 0, endingBalance: 0 },
                  );
                  return (
                    <Fragment key={qualifier}>
                      <tr className="bg-offwhite">
                        <td
                          colSpan={7}
                          className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy"
                        >
                          {qualifier}
                        </td>
                      </tr>
                      {rows.map((row) => (
                        <tr key={row.accountCode} className="border-b border-border">
                          <td className="py-2 pr-2 font-mono text-navy">{row.accountCode}</td>
                          <td className="py-2 pr-2">{row.accountName}</td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.periodDebit)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.periodCredit)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.ytdDebit)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.ytdCredit)}
                          </td>
                          <td
                            className={`py-2 pr-2 text-right font-mono ${row.endingBalance < 0 ? 'text-red-600' : 'text-green'}`}
                          >
                            {formatINR(row.endingBalance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b border-border font-medium">
                        <td className="py-2 pr-2" colSpan={2}>
                          Subtotal — {qualifier}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.periodDebit)}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.periodCredit)}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.ytdDebit)}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.ytdCredit)}
                        </td>
                        <td
                          className={`py-2 pr-2 text-right font-mono ${subtotal.endingBalance < 0 ? 'text-red-600' : 'text-green'}`}
                        >
                          {formatINR(subtotal.endingBalance)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="border-t-2 border-navy font-semibold text-navy">
                  <td className="py-3 pr-2" colSpan={2}>
                    Grand Total
                  </td>
                  <td className="py-3 pr-2 text-right font-mono" colSpan={2}>
                    {formatINR(report.totalDebit)}
                  </td>
                  <td className="py-3 pr-2 text-right font-mono" colSpan={2}>
                    {formatINR(report.totalCredit)}
                  </td>
                  <td
                    className={`py-3 pr-2 text-right ${report.isBalanced ? 'text-green' : 'text-red-600'}`}
                  >
                    {report.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
