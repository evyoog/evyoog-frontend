import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { ReportSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getPLBySegment, getPeriodStatus } from '../api/gl';
import type { PeriodStatus, PLBySegmentLine, PLBySegmentReport } from '../types';
import { formatINR } from '../utils/format';

const SEGMENT_TYPES: { value: 'COST_CENTRE' | 'PRODUCT'; label: string }[] = [
  { value: 'COST_CENTRE', label: 'Cost Centre' },
  { value: 'PRODUCT', label: 'Product' },
];

function cell(amount: number) {
  return amount === 0 ? '—' : formatINR(amount);
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(report: PLBySegmentReport) {
  const header = ['Account Code', 'Account Name', ...report.segments, 'Total'];
  const lineRow = (line: PLBySegmentLine) => [
    line.accountCode,
    line.accountName,
    ...report.segments.map((s) => String(line.segmentAmounts[s] ?? 0)),
    String(line.total),
  ];
  const totalRow = (label: string, totals: Record<string, number>) => [
    label,
    '',
    ...report.segments.map((s) => String(totals[s] ?? 0)),
    String(totals.total ?? 0),
  ];
  const rows: string[][] = [
    header,
    ['--- REVENUE ---', ...Array(report.segments.length + 1).fill('')],
    ...report.revenueLines.map(lineRow),
    totalRow('Total Revenue', report.totalRevenue),
    ['--- EXPENSES ---', ...Array(report.segments.length + 1).fill('')],
    ...report.expenseLines.map(lineRow),
    totalRow('Total Expenses', report.totalExpenses),
    totalRow('Net Income', report.netIncome),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pl-by-segment.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function LineRow({ line, segments }: { line: PLBySegmentLine; segments: string[] }) {
  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-2 font-mono text-navy">{line.accountCode}</td>
      <td className="py-2 pr-2">{line.accountName}</td>
      {segments.map((s) => (
        <td key={s} className="py-2 pr-2 text-right font-mono">
          {cell(line.segmentAmounts[s] ?? 0)}
        </td>
      ))}
      <td className="py-2 pr-2 text-right font-mono">{formatINR(line.total)}</td>
    </tr>
  );
}

function TotalRow({
  label,
  totals,
  segments,
}: {
  label: string;
  totals: Record<string, number>;
  segments: string[];
}) {
  return (
    <tr className="border-b border-border font-semibold">
      <td className="py-2 pr-2" colSpan={2}>
        {label}
      </td>
      {segments.map((s) => (
        <td key={s} className="py-2 pr-2 text-right font-mono">
          {formatINR(totals[s] ?? 0)}
        </td>
      ))}
      <td className="py-2 pr-2 text-right font-mono">{formatINR(totals.total ?? 0)}</td>
    </tr>
  );
}

export default function PLBySegmentPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [segmentType, setSegmentType] = useState<'COST_CENTRE' | 'PRODUCT'>('COST_CENTRE');
  const [report, setReport] = useState<PLBySegmentReport | null>(null);
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
      const data = await getPLBySegment(user.legalEntityId, periodId, segmentType);
      setReport(data);
    } catch {
      setError(true);
      showToast('Failed to load P&L by segment. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const netTotal = report?.netIncome.total ?? 0;

  return (
    <AppLayout breadcrumb="P&L by Segment">
      <h1 className="text-2xl font-bold text-navy">P&L by Segment</h1>
      <p className="mt-1 text-sm text-slate">Profit and loss breakdown by dimension segment</p>

      <Card className="mt-6">
        <div className="flex flex-wrap items-end gap-3">
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
          <div className="w-48">
            <Select
              id="segment-type"
              label="Segment Type"
              aria-label="Select segment type"
              value={segmentType}
              onChange={(e) => setSegmentType(e.target.value as 'COST_CENTRE' | 'PRODUCT')}
            >
              {SEGMENT_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            onClick={runReport}
            loading={running}
            disabled={running || !periodId}
            aria-busy={running}
            aria-label="Run report for selected period and segment type"
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
              message="Failed to load P&L by segment. Please try again."
              onRetry={runReport}
            />
          )}

          {!loadingPeriods && !running && !error && !report && (
            <EmptyState
              title="No P&L by segment data"
              message="Select a period and segment type, then click Run Report."
            />
          )}

          {!loadingPeriods && !running && !error && report && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                    <th className="py-2 pr-2 font-medium">Account Code</th>
                    <th className="py-2 pr-2 font-medium">Account Name</th>
                    {report.segments.map((s) => (
                      <th key={s} className="py-2 pr-2 text-right font-medium">
                        {s}
                      </th>
                    ))}
                    <th className="py-2 pr-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-offwhite">
                    <td
                      colSpan={report.segments.length + 3}
                      className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy"
                    >
                      Revenue
                    </td>
                  </tr>
                  {report.revenueLines.map((line) => (
                    <LineRow key={line.accountCode} line={line} segments={report.segments} />
                  ))}
                  <TotalRow
                    label="Total Revenue"
                    totals={report.totalRevenue}
                    segments={report.segments}
                  />

                  <tr className="bg-offwhite">
                    <td
                      colSpan={report.segments.length + 3}
                      className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy"
                    >
                      Expenses
                    </td>
                  </tr>
                  {report.expenseLines.map((line) => (
                    <LineRow key={line.accountCode} line={line} segments={report.segments} />
                  ))}
                  <TotalRow
                    label="Total Expenses"
                    totals={report.totalExpenses}
                    segments={report.segments}
                  />

                  <tr className={netTotal >= 0 ? 'bg-green-light' : 'bg-red-50'}>
                    <td className="py-3 pr-2 font-bold text-navy" colSpan={2}>
                      Net Income
                    </td>
                    {report.segments.map((s) => {
                      const amt = report.netIncome[s] ?? 0;
                      return (
                        <td
                          key={s}
                          className={`py-3 pr-2 text-right font-mono font-bold ${
                            amt < 0 ? 'text-red-600' : amt > 0 ? 'text-green' : ''
                          }`}
                        >
                          {cell(amt)}
                        </td>
                      );
                    })}
                    <td
                      className={`py-3 pr-2 text-right font-mono font-bold ${
                        netTotal < 0 ? 'text-red-600' : 'text-green'
                      }`}
                    >
                      {formatINR(netTotal)}
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
