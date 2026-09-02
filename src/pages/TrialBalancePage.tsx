import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { TableSkeleton, ErrorState, EmptyState, TreeTable } from '../components/ui';
import type { TreeTableColumn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getTrialBalance,
  getHierarchicalTrialBalance,
  getPeriodStatus,
  listLedgers,
  listFinanceDimensions,
  listDimensionValues,
} from '../api/gl';
import type {
  DimensionValue,
  HierarchicalTrialBalanceLine,
  HierarchicalTrialBalanceResponse,
  PeriodStatus,
  TrialBalanceReport,
  TrialBalanceRow,
} from '../types';
import { formatINR } from '../utils/format';

const QUALIFIER_ORDER = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expense'];

type ViewMode = 'standard' | 'hierarchical';

const QUALIFIER_BADGE: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-amber-100 text-amber-800',
  EQUITY: 'bg-green-100 text-green-800',
  REVENUE: 'bg-purple-100 text-purple-800',
  EXPENSE: 'bg-red-100 text-red-800',
};

function QualifierBadge({ qualifier }: { qualifier: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        QUALIFIER_BADGE[qualifier] ?? 'bg-slate-100 text-slate-800'
      }`}
    >
      {qualifier}
    </span>
  );
}

function groupByQualifier(rows: TrialBalanceRow[]) {
  const groups = new Map<string, TrialBalanceRow[]>();
  const safeRows = Array.isArray(rows) ? rows : [];
  for (const row of safeRows) {
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

// The trial balance response nests rows under `lines`. Normalize whatever
// comes back so the rest of the page can assume a valid TrialBalanceReport.
function normalizeReport(raw: unknown): TrialBalanceReport {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(obj.lines)
    ? (obj.lines as TrialBalanceRow[])
    : Array.isArray(obj.rows)
      ? (obj.rows as TrialBalanceRow[])
      : Array.isArray(obj.accounts)
        ? (obj.accounts as TrialBalanceRow[])
        : Array.isArray(raw)
          ? (raw as TrialBalanceRow[])
          : [];
  return {
    rows,
    totalDebit: typeof obj.totalDebit === 'number' ? obj.totalDebit : 0,
    totalCredit: typeof obj.totalCredit === 'number' ? obj.totalCredit : 0,
    isBalanced: typeof obj.isBalanced === 'boolean' ? obj.isBalanced : false,
  };
}

function exportCsv(report: TrialBalanceReport) {
  const header = [
    'Account Code',
    'Account Name',
    'Qualifier',
    'Period DR',
    'Period CR',
    'YTD DR',
    'YTD CR',
    'Ending Balance',
  ];
  const rows = report.rows.map((r) => [
    r.accountCode,
    r.accountName,
    r.accountQualifier,
    r.periodToDateDr,
    r.periodToDateCr,
    r.yearToDateDr,
    r.yearToDateCr,
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

function flattenHierarchy(
  lines: HierarchicalTrialBalanceLine[],
  depth = 0,
): (HierarchicalTrialBalanceLine & { depth: number })[] {
  return lines.flatMap((line) => [
    { ...line, depth },
    ...flattenHierarchy(line.children ?? [], depth + 1),
  ]);
}

function exportHierarchicalCsv(report: HierarchicalTrialBalanceResponse) {
  const header = [
    'Account Code',
    'Account Name',
    'Qualifier',
    'Depth',
    'Is Summary',
    'Beg Balance',
    'PTD DR',
    'PTD CR',
    'YTD DR',
    'YTD CR',
    'Ending Balance',
    'Debit Balance',
    'Credit Balance',
  ];
  const rows = flattenHierarchy(report.lines).map((line) => [
    line.accountCode,
    line.accountName,
    line.accountQualifier,
    line.depth,
    line.isSummary,
    line.beginningBalance,
    line.periodToDateDr,
    line.periodToDateCr,
    line.yearToDateDr,
    line.yearToDateCr,
    line.endingBalance,
    line.debitBalance,
    line.creditBalance,
  ]);
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hierarchical-trial-balance.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const TREE_COLUMNS: TreeTableColumn<HierarchicalTrialBalanceLine>[] = [
  {
    header: 'Account Code',
    render: (node) => <span className="font-mono text-navy">{node.accountCode}</span>,
  },
  {
    header: 'Account Name',
    render: (node) => (
      <span className="inline-flex items-center gap-2">
        {node.accountName}
        <QualifierBadge qualifier={node.accountQualifier} />
      </span>
    ),
  },
  { header: 'Beg Balance', align: 'right', render: (node) => formatINR(node.beginningBalance) },
  { header: 'PTD Debit', align: 'right', render: (node) => formatINR(node.periodToDateDr) },
  { header: 'PTD Credit', align: 'right', render: (node) => formatINR(node.periodToDateCr) },
  { header: 'YTD Debit', align: 'right', render: (node) => formatINR(node.yearToDateDr) },
  { header: 'YTD Credit', align: 'right', render: (node) => formatINR(node.yearToDateCr) },
  { header: 'Debit Balance', align: 'right', render: (node) => formatINR(node.debitBalance) },
  { header: 'Credit Balance', align: 'right', render: (node) => formatINR(node.creditBalance) },
];

export default function TrialBalancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [hierarchicalReport, setHierarchicalReport] = useState<HierarchicalTrialBalanceResponse | null>(
    null,
  );

  const [costCentreFilter, setCostCentreFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [costCentreValues, setCostCentreValues] = useState<DimensionValue[]>([]);
  const [productValues, setProductValues] = useState<DimensionValue[]>([]);

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
    listLedgers(user.legalEntityId)
      .then(async (ledgers) => {
        const ledgerId = ledgers[0]?.id;
        if (!ledgerId) return;
        const dims = await listFinanceDimensions(ledgerId);
        if (cancelled) return;
        const costCtrDim = dims.find((d) => d.dimensionType === 'COST_CENTRE');
        const productDim = dims.find((d) => d.dimensionType === 'PRODUCT');
        if (costCtrDim) {
          const vals = await listDimensionValues(costCtrDim.id);
          if (!cancelled) setCostCentreValues(vals.filter((v) => v.isActive));
        }
        if (productDim) {
          const vals = await listDimensionValues(productDim.id);
          if (!cancelled) setProductValues(vals.filter((v) => v.isActive));
        }
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load segment filters.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const clearFilters = () => {
    setCostCentreFilter('');
    setProductFilter('');
  };

  const runReport = async () => {
    if (!user || !periodId) return;
    setRunning(true);
    setError(false);
    try {
      if (viewMode === 'standard') {
        const data = await getTrialBalance(
          user.legalEntityId,
          periodId,
          costCentreFilter || undefined,
          productFilter || undefined,
        );
        setReport(normalizeReport(data));
        setHierarchicalReport(null);
      } else {
        const data = await getHierarchicalTrialBalance({
          legalEntityId: user.legalEntityId,
          periodId,
          costCentreCode: costCentreFilter || undefined,
        });
        setHierarchicalReport(data);
        setReport(null);
      }
    } catch {
      setError(true);
      showToast('Failed to load trial balance. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setReport(null);
    setHierarchicalReport(null);
    setError(false);
  };

  const groups = report ? groupByQualifier(report.rows) : [];
  const hasReport = viewMode === 'standard' ? !!report : !!hierarchicalReport;

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
              onClick={() => handleViewModeChange('hierarchical')}
              className={
                viewMode === 'hierarchical'
                  ? 'bg-blue-600 px-4 py-2 text-sm font-medium text-white'
                  : 'bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
              }
              aria-pressed={viewMode === 'hierarchical'}
            >
              Hierarchical
            </button>
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
          {viewMode === 'standard' && report && (
            <Button
              variant="secondary"
              onClick={() => exportCsv(report)}
              aria-label="Export report as CSV"
            >
              Export CSV
            </Button>
          )}
          {viewMode === 'hierarchical' && hierarchicalReport && (
            <Button
              variant="secondary"
              onClick={() => exportHierarchicalCsv(hierarchicalReport)}
              aria-label="Export report as CSV"
            >
              Export CSV
            </Button>
          )}
        </div>

        {periodId && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="w-56">
              <Select
                id="cost-centre-filter"
                aria-label="Filter by Cost Centre"
                value={costCentreFilter}
                onChange={(e) => setCostCentreFilter(e.target.value)}
              >
                <option value="">All Cost Centres</option>
                {costCentreValues.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </Select>
            </div>
            {viewMode === 'standard' && (
              <div className="w-56">
                <Select
                  id="product-filter"
                  aria-label="Filter by Product"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                >
                  <option value="">All Products</option>
                  {productValues.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {(costCentreFilter || productFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-slate underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="mt-6">
          {(costCentreFilter || (viewMode === 'standard' && productFilter)) && hasReport && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700">
              Filtered by: {costCentreFilter && `Cost Centre: ${costCentreFilter}`}
              {costCentreFilter && productFilter && viewMode === 'standard' && ' · '}
              {viewMode === 'standard' && productFilter && `Product: ${productFilter}`}
            </div>
          )}

          {loadingPeriods && <TableSkeleton rows={8} columns={6} />}

          {!loadingPeriods && running && <TableSkeleton rows={8} columns={6} />}

          {!loadingPeriods && !running && error && (
            <ErrorState
              message="Failed to load trial balance. Please try again."
              onRetry={runReport}
            />
          )}

          {!loadingPeriods && !running && !error && !hasReport && (
            <EmptyState
              title="No trial balance data"
              message="Select a period and click Run Report."
            />
          )}

          {!loadingPeriods && !running && !error && viewMode === 'hierarchical' && hierarchicalReport && (
            hierarchicalReport.lines.length === 0 ? (
              <EmptyState
                title="No trial balance data"
                message="No trial balance data for this period."
              />
            ) : (
              <TreeTable
                nodes={hierarchicalReport.lines}
                columns={TREE_COLUMNS}
                getChildren={(node) => node.children ?? []}
                getId={(node) => node.accountId}
                isSummary={(node) => node.isSummary}
                treeColumnIndex={1}
                footer={
                  <tr className="border-t-2 border-navy font-semibold text-navy">
                    <td className="py-3 pr-2" colSpan={3}>
                      Grand Total
                    </td>
                    <td className="py-3 pr-2 text-right font-mono" colSpan={2}>
                      {formatINR(hierarchicalReport.totalDebit)}
                    </td>
                    <td className="py-3 pr-2 text-right font-mono" colSpan={2}>
                      {formatINR(hierarchicalReport.totalCredit)}
                    </td>
                    <td
                      className={`py-3 pr-2 text-right ${hierarchicalReport.isBalanced ? 'text-green' : 'text-red-600'}`}
                      colSpan={2}
                    >
                      {hierarchicalReport.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                    </td>
                  </tr>
                }
              />
            )
          )}

          {!loadingPeriods && !running && !error && viewMode === 'standard' && report && report.rows.length === 0 && (
            <EmptyState
              title="No trial balance data"
              message="No trial balance data for this period."
            />
          )}

          {!loadingPeriods && !running && !error && viewMode === 'standard' && report && report.rows.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Account Code</th>
                  <th className="py-2 pr-2 font-medium">Account Name</th>
                  <th className="py-2 pr-2 text-right font-medium">Period DR</th>
                  <th className="py-2 pr-2 text-right font-medium">Period CR</th>
                  <th className="py-2 pr-2 text-right font-medium">YTD DR</th>
                  <th className="py-2 pr-2 text-right font-medium">YTD CR</th>
                  <th className="py-2 pr-2 text-right font-medium">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([qualifier, rows]) => {
                  const subtotal = rows.reduce(
                    (acc, r) => ({
                      periodToDateDr: acc.periodToDateDr + r.periodToDateDr,
                      periodToDateCr: acc.periodToDateCr + r.periodToDateCr,
                      yearToDateDr: acc.yearToDateDr + r.yearToDateDr,
                      yearToDateCr: acc.yearToDateCr + r.yearToDateCr,
                      endingBalance: acc.endingBalance + r.endingBalance,
                    }),
                    {
                      periodToDateDr: 0,
                      periodToDateCr: 0,
                      yearToDateDr: 0,
                      yearToDateCr: 0,
                      endingBalance: 0,
                    },
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
                            {formatINR(row.periodToDateDr)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.periodToDateCr)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.yearToDateDr)}
                          </td>
                          <td className="py-2 pr-2 text-right font-mono">
                            {formatINR(row.yearToDateCr)}
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
                          {formatINR(subtotal.periodToDateDr)}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.periodToDateCr)}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.yearToDateDr)}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono">
                          {formatINR(subtotal.yearToDateCr)}
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
            </div>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
