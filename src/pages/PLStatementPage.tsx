import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { ReportSkeleton, ErrorState, EmptyState, TreeRows, useTreeExpand } from '../components/ui';
import type { TreeTableColumn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getProfitAndLoss,
  getPLBySegment,
  getPeriodStatus,
  listLegalEntityLedgers,
  listFinanceDimensions,
} from '../api/gl';
import type {
  PeriodStatus,
  PLItem,
  PLStatementReport,
  PLBySegmentLine,
  PLBySegmentReport,
} from '../types';
import { formatINR } from '../utils/format';

// PLItem has no `isSummary` flag (unlike BalanceSheetItem / the hierarchical
// trial balance line) — a node with children is treated as a summary node.
const plIsSummary = (item: PLItem) => (item.children?.length ?? 0) > 0;
const plGetChildren = (item: PLItem) => item.children ?? [];
const plGetId = (item: PLItem) => item.accountCode;

const PL_COLUMNS: TreeTableColumn<PLItem>[] = [
  {
    header: 'Account Code',
    render: (item) => <span className="font-mono text-navy">{item.accountCode}</span>,
  },
  { header: 'Account Name', render: (item) => item.accountName },
  { header: 'Period', align: 'right', render: (item) => formatINR(item.netAmount) },
  { header: 'YTD', align: 'right', render: (item) => formatINR(item.ytdCr - item.ytdDr) },
];

type ViewMode = 'standard' | 'by-segment';

interface SegmentOption {
  value: string;
  label: string;
}

function cell(amount: number) {
  return amount === 0 ? '—' : formatINR(amount);
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function flattenPL(items: PLItem[], depth = 0): { item: PLItem; depth: number }[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flattenPL(plGetChildren(item), depth + 1),
  ]);
}

function exportStandardCsv(report: PLStatementReport) {
  const header = [
    'Account Code',
    'Account Name',
    'Qualifier',
    'Depth',
    'Is Summary',
    'Period Net',
    'YTD Net',
  ];
  const toRow = ({ item, depth }: { item: PLItem; depth: number }) => [
    item.accountCode,
    item.accountName,
    item.accountQualifier,
    depth,
    plIsSummary(item),
    item.netAmount,
    item.ytdCr - item.ytdDr,
  ];
  const rows = [
    ...flattenPL(report.revenueItems).map(toRow),
    ...flattenPL(report.expenseItems).map(toRow),
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

function exportSegmentCsv(report: PLBySegmentReport) {
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

function PLSection({ title, items, total }: { title: string; items: PLItem[]; total: number }) {
  const expand = useTreeExpand({
    nodes: items,
    getChildren: plGetChildren,
    getId: plGetId,
    isSummary: plIsSummary,
  });
  return (
    <Fragment>
      <tr className="bg-offwhite">
        <td colSpan={4} className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy">
          <div className="flex items-center justify-between">
            <span>{title}</span>
            <span className="flex gap-3 text-[10px] normal-case tracking-normal text-blue">
              <button type="button" onClick={expand.expandAll} className="underline">
                Expand All
              </button>
              <button type="button" onClick={expand.collapseAll} className="underline">
                Collapse All
              </button>
            </span>
          </div>
        </td>
      </tr>
      <TreeRows
        nodes={items}
        columns={PL_COLUMNS}
        getChildren={plGetChildren}
        getId={plGetId}
        isSummary={plIsSummary}
        expand={expand}
        treeColumnIndex={1}
      />
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

function StandardPLTable({ report }: { report: PLStatementReport }) {
  return (
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
          <PLSection title="Expenses" items={report.expenseItems} total={report.totalExpenses} />
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
  );
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

function SegmentPLTable({ report }: { report: PLBySegmentReport }) {
  const netTotal = report.netIncome.total ?? 0;
  return (
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
          <TotalRow label="Total Revenue" totals={report.totalRevenue} segments={report.segments} />

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
          <TotalRow label="Total Expenses" totals={report.totalExpenses} segments={report.segments} />

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
  );
}

export default function PLStatementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [segmentOptions, setSegmentOptions] = useState<SegmentOption[]>([]);
  const [segmentType, setSegmentType] = useState('');
  const [standardReport, setStandardReport] = useState<PLStatementReport | null>(null);
  const [segmentReport, setSegmentReport] = useState<PLBySegmentReport | null>(null);
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listLegalEntityLedgers(user.legalEntityId)
      .then((links) => {
        const active = links.filter((l) => l.isActive);
        const link = active.find((l) => l.ledgerCategory === 'PRIMARY') ?? active[0];
        if (!link) return [];
        return listFinanceDimensions(link.ledgerId);
      })
      .then((dims) => {
        if (cancelled || !dims) return;
        const options = dims
          .filter((d) => d.dimensionType !== 'NATURAL_ACCOUNT')
          .map((d) => ({ value: d.dimensionType, label: d.name }));
        setSegmentOptions(options);
        setSegmentType((prev) => (options.some((o) => o.value === prev) ? prev : (options[0]?.value ?? '')));
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load segment dimensions.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setStandardReport(null);
    setSegmentReport(null);
    setError(false);
  };

  const handleRunReport = async () => {
    if (!user || !periodId) return;
    if (viewMode === 'by-segment' && !segmentType) return;
    setRunning(true);
    setError(false);
    try {
      if (viewMode === 'standard') {
        const data = await getProfitAndLoss(user.legalEntityId, periodId);
        setStandardReport(data);
        setSegmentReport(null);
      } else {
        const data = await getPLBySegment(user.legalEntityId, periodId, segmentType);
        setSegmentReport(data);
        setStandardReport(null);
      }
    } catch {
      setError(true);
      showToast('Failed to load P&L data. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleExportCsv = () => {
    if (viewMode === 'standard' && standardReport) {
      exportStandardCsv(standardReport);
    } else if (viewMode === 'by-segment' && segmentReport) {
      exportSegmentCsv(segmentReport);
    }
  };

  const hasReport = viewMode === 'standard' ? !!standardReport : !!segmentReport;

  return (
    <AppLayout breadcrumb="P&L Statement">
      <h1 className="text-2xl font-bold text-navy">P&L Statement</h1>
      <p className="mt-1 text-sm text-slate">
        {viewMode === 'standard'
          ? 'Period-to-date and year-to-date profit and loss'
          : `Profit and loss breakdown by ${
              segmentOptions.find((o) => o.value === segmentType)?.label ?? 'Segment'
            }`}
      </p>

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

          <div className="flex overflow-hidden rounded-md border border-gray-300">
            <button
              type="button"
              onClick={() => handleViewModeChange('standard')}
              className={
                viewMode === 'standard'
                  ? 'bg-blue-600 px-4 py-2 text-sm font-medium text-white'
                  : 'bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
              }
              aria-pressed={viewMode === 'standard'}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('by-segment')}
              className={
                viewMode === 'by-segment'
                  ? 'bg-blue-600 px-4 py-2 text-sm font-medium text-white'
                  : 'bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
              }
              aria-pressed={viewMode === 'by-segment'}
            >
              By Segment
            </button>
          </div>

          {viewMode === 'by-segment' && (
            <div className="w-48">
              <Select
                id="segment-type"
                label="Segment Type"
                aria-label="Select segment type"
                value={segmentType}
                onChange={(e) => setSegmentType(e.target.value)}
              >
                {segmentOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Button
            onClick={handleRunReport}
            loading={running}
            disabled={running || !periodId || (viewMode === 'by-segment' && !segmentType)}
            aria-busy={running}
            aria-label="Run report for selected period"
          >
            {running ? 'Loading...' : 'Run Report'}
          </Button>
          {hasReport && (
            <Button variant="secondary" onClick={handleExportCsv} aria-label="Export report as CSV">
              Export CSV
            </Button>
          )}
        </div>

        <div className="mt-6">
          {loadingPeriods && <ReportSkeleton />}

          {!loadingPeriods && running && <ReportSkeleton />}

          {!loadingPeriods && !running && error && (
            <ErrorState message="Failed to load P&L data. Please try again." onRetry={handleRunReport} />
          )}

          {!loadingPeriods && !running && !error && !hasReport && (
            <EmptyState
              title="No report data"
              message={
                viewMode === 'standard'
                  ? 'Select a period and click Run Report.'
                  : 'Select a period and segment type, then click Run Report.'
              }
            />
          )}

          {!loadingPeriods && !running && !error && viewMode === 'standard' && standardReport && (
            <StandardPLTable report={standardReport} />
          )}

          {!loadingPeriods && !running && !error && viewMode === 'by-segment' && segmentReport && (
            <SegmentPLTable report={segmentReport} />
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
