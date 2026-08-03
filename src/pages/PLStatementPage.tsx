import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { ReportSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProfitAndLoss, getPeriodStatus } from '../api/gl';
import type { PeriodStatus, PLItem, PLStatementReport } from '../types';
import { formatINR } from '../utils/format';

function exportCsv(report: PLStatementReport) {
  const header = ['Account Code', 'Account Name', 'Qualifier', 'Period Net', 'YTD Net'];
  const toRow = (item: PLItem) => [
    item.accountCode,
    item.accountName,
    item.accountQualifier,
    item.netAmount,
    item.ytdCr - item.ytdDr,
  ];
  const rows = [
    ...report.revenueItems.map(toRow),
    ...report.expenseItems.map(toRow),
  ];
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pl-statement.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function PLSection({ title, items, total }: { title: string; items: PLItem[]; total: number }) {
  return (
    <Fragment>
      <tr className="bg-offwhite">
        <td colSpan={4} className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy">
          {title}
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.accountCode} className="border-b border-border">
          <td className="py-2 pr-2 font-mono text-navy">{item.accountCode}</td>
          <td className="py-2 pr-2">{item.accountName}</td>
          <td className="py-2 pr-2 text-right font-mono">{formatINR(item.netAmount)}</td>
          <td className="py-2 pr-2 text-right font-mono">
            {formatINR(item.ytdCr - item.ytdDr)}
          </td>
        </tr>
      ))}
      <tr className="border-b border-border font-medium">
        <td className="py-2 pr-2" colSpan={2}>
          Total {title}
        </td>
        <td className="py-2 pr-2 text-right font-mono" colSpan={2}>
          {formatINR(total)}
        </td>
      </tr>
    </Fragment>
  );
}

export default function PLStatementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState<PLStatementReport | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPeriodStatus(user.legalEntityId)
      .then((data) => {
        if (cancelled) return;
        setPeriods(data);
        const open = data.find((p) => p.status === 'OPEN');
        if (open) setPeriodId(open.accountingPeriodId);
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load periods.', 'error');
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
    setError(false);
    try {
      const data = await getProfitAndLoss(user.legalEntityId, periodId);
      setReport(data);
    } catch {
      setError(true);
      showToast('Failed to load P&L statement. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout breadcrumb="P&L Statement">
      <h1 className="text-2xl font-bold text-navy">P&L Statement</h1>
      <p className="mt-1 text-sm text-slate">Period-to-date and year-to-date profit and loss</p>

      <Card className="mt-6">
        <div className="flex items-end gap-3">
          <div className="w-64">
            <Select
              id="period"
              label="Period"
              aria-label="Select accounting period"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              disabled={loadingPeriods}
            >
              <option value="">Select a period</option>
              {periods.map((p) => (
                <option key={p.accountingPeriodId} value={p.accountingPeriodId}>
                  {p.periodName}
                </option>
              ))}
            </Select>
          </div>
          <Button
            onClick={runReport}
            loading={running}
            disabled={running || !periodId}
            aria-busy={running}
            aria-label="Run report for selected period"
          >
            {running ? 'Loading...' : 'Run Report'}
          </Button>
          {report && (
            <Button
              variant="secondary"
              onClick={() => exportCsv(report)}
              aria-label="Export report as CSV"
            >
              Export CSV
            </Button>
          )}
        </div>

        <div className="mt-6">
          {loadingPeriods && <ReportSkeleton />}

          {!loadingPeriods && running && <ReportSkeleton />}

          {!loadingPeriods && !running && error && (
            <ErrorState
              message="Failed to load P&L data. Please try again."
              onRetry={runReport}
            />
          )}

          {!loadingPeriods && !running && !error && !report && (
            <EmptyState title="No P&L data" message="Select a period and click Run Report." />
          )}

          {!loadingPeriods && !running && !error && report && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Account Code</th>
                  <th className="py-2 pr-2 font-medium">Account Name</th>
                  <th className="py-2 pr-2 text-right font-medium">Period</th>
                  <th className="py-2 pr-2 text-right font-medium">YTD</th>
                </tr>
              </thead>
              <tbody>
                <PLSection title="Revenue" items={report.revenueItems} total={report.totalRevenue} />
                <PLSection
                  title="Expenses"
                  items={report.expenseItems}
                  total={report.totalExpenses}
                />
                <tr className="border-t-2 border-navy font-semibold text-navy">
                  <td className="py-3 pr-2" colSpan={2}>
                    Gross Profit
                  </td>
                  <td className="py-3 pr-2 text-right font-mono" colSpan={2}>
                    {formatINR(report.grossProfit)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-3 pr-2 text-navy" colSpan={2}>
                    Net Income
                  </td>
                  <td
                    className={`py-3 pr-2 text-right font-mono ${
                      report.isProfitable ? 'text-green' : 'text-red-600'
                    }`}
                    colSpan={2}
                  >
                    {formatINR(report.netIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
