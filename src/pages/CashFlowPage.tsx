import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { ReportSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getCashFlow, getPeriodStatus } from '../api/gl';
import type { CashFlowLineItem, CashFlowReport, CashFlowSection, PeriodStatus } from '../types';
import { formatINR } from '../utils/format';

function exportCsv(report: CashFlowReport) {
  const header = ['Section', 'Description', 'Amount'];
  const toRow = (section: CashFlowSection) => (item: CashFlowLineItem) => [
    section.sectionName,
    item.description,
    item.amount,
  ];
  const rows = [
    ...report.operatingActivities.items.map(toRow(report.operatingActivities)),
    ...report.investingActivities.items.map(toRow(report.investingActivities)),
    ...report.financingActivities.items.map(toRow(report.financingActivities)),
  ];
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cash-flow.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function CFSection({ section }: { section: CashFlowSection }) {
  return (
    <Fragment>
      <tr className="bg-offwhite">
        <td colSpan={2} className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy">
          {section.sectionName}
        </td>
      </tr>
      {section.items.map((item, i) => (
        <tr key={`${section.sectionCode}-${i}`} className="border-b border-border">
          <td className="py-2 pr-2">{item.description}</td>
          <td
            className={`py-2 pr-2 text-right font-mono ${item.amount < 0 ? 'text-red-600' : 'text-green'}`}
          >
            {formatINR(item.amount)}
          </td>
        </tr>
      ))}
      <tr className="border-b border-border font-medium">
        <td className="py-2 pr-2">Total {section.sectionName}</td>
        <td className="py-2 pr-2 text-right font-mono">{formatINR(section.totalAmount)}</td>
      </tr>
    </Fragment>
  );
}

export default function CashFlowPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState<CashFlowReport | null>(null);
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
      const data = await getCashFlow(user.legalEntityId, periodId);
      setReport(data);
    } catch {
      setError(true);
      showToast('Failed to load cash flow statement. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout breadcrumb="Cash Flow">
      <h1 className="text-2xl font-bold text-navy">Cash Flow Statement</h1>
      <p className="mt-1 text-sm text-slate">Operating, investing, and financing activities</p>

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
              message="Failed to load cash flow data. Please try again."
              onRetry={runReport}
            />
          )}

          {!loadingPeriods && !running && !error && !report && (
            <EmptyState title="No cash flow data" message="Select a period and click Run Report." />
          )}

          {!loadingPeriods && !running && !error && report && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Description</th>
                  <th className="py-2 pr-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <CFSection section={report.operatingActivities} />
                <CFSection section={report.investingActivities} />
                <CFSection section={report.financingActivities} />
                <tr className="border-t-2 border-navy font-semibold text-navy">
                  <td className="py-3 pr-2">Net Change in Cash</td>
                  <td className="py-3 pr-2 text-right font-mono">
                    {formatINR(report.netCashChange)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-2 text-navy">Opening Cash Balance</td>
                  <td className="py-2 pr-2 text-right font-mono">
                    {formatINR(report.openingCashBalance)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2 pr-2 text-navy">Closing Cash Balance</td>
                  <td
                    className={`py-2 pr-2 text-right font-mono ${report.isPositiveCashFlow ? 'text-green' : 'text-red-600'}`}
                  >
                    {formatINR(report.closingCashBalance)}
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
