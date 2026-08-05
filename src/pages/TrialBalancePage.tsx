import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getTrialBalance,
  getPeriodStatus,
  listLedgers,
  listFinanceDimensions,
  listDimensionValues,
} from '../api/gl';
import type { DimensionValue, PeriodStatus, TrialBalanceReport, TrialBalanceRow } from '../types';
import { formatINR } from '../utils/format';

const QUALIFIER_ORDER = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expense'];

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

export default function TrialBalancePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);

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
      const data = await getTrialBalance(
        user.legalEntityId,
        periodId,
        costCentreFilter || undefined,
        productFilter || undefined,
      );
      setReport(normalizeReport(data));
    } catch {
      setError(true);
      showToast('Failed to load trial balance. Please try again.', 'error');
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
          {(costCentreFilter || productFilter) && report && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-700">
              Filtered by: {costCentreFilter && `Cost Centre: ${costCentreFilter}`}
              {costCentreFilter && productFilter && ' · '}
              {productFilter && `Product: ${productFilter}`}
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

          {!loadingPeriods && !running && !error && !report && (
            <EmptyState
              title="No trial balance data"
              message="Select a period and click Run Report."
            />
          )}

          {!loadingPeriods && !running && !error && report && report.rows.length === 0 && (
            <EmptyState
              title="No trial balance data"
              message="No trial balance data for this period."
            />
          )}

          {!loadingPeriods && !running && !error && report && report.rows.length > 0 && (
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
