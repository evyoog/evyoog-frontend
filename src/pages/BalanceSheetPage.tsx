import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { ReportSkeleton, ErrorState, EmptyState, TreeRows, useTreeExpand } from '../components/ui';
import type { TreeTableColumn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBalanceSheet, getPeriodStatus } from '../api/gl';
import type { BalanceSheetItem, BalanceSheetReport, PeriodStatus } from '../types';
import { formatINR } from '../utils/format';

const bsGetChildren = (item: BalanceSheetItem) => item.children ?? [];
const bsGetId = (item: BalanceSheetItem) => item.accountId ?? item.accountCode;
const bsIsSummary = (item: BalanceSheetItem) => item.isSummary;

const BS_COLUMNS: TreeTableColumn<BalanceSheetItem>[] = [
  {
    header: 'Account Code',
    render: (item) => <span className="font-mono text-navy">{item.accountCode}</span>,
  },
  { header: 'Account Name', render: (item) => item.accountName },
  { header: 'Ending Balance', align: 'right', render: (item) => formatINR(item.endingBalance) },
];

// Normalise defensively — same approach as Trial Balance — in case the
// backend shape drifts (missing arrays, isBalanced omitted, etc).
function normalizeReport(raw: unknown): BalanceSheetReport {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const arr = (key: string) => (Array.isArray(obj[key]) ? (obj[key] as BalanceSheetItem[]) : []);
  const num = (key: string) => (typeof obj[key] === 'number' ? (obj[key] as number) : 0);
  if (!Array.isArray(obj.assetItems) && !Array.isArray(obj.liabilityItems)) {
    console.log('Unexpected balance sheet shape:', obj);
  }
  return {
    legalEntityId: typeof obj.legalEntityId === 'string' ? obj.legalEntityId : '',
    legalEntityName: typeof obj.legalEntityName === 'string' ? obj.legalEntityName : '',
    legalEntityCode: typeof obj.legalEntityCode === 'string' ? obj.legalEntityCode : '',
    accountingPeriodId: typeof obj.accountingPeriodId === 'string' ? obj.accountingPeriodId : '',
    periodName: typeof obj.periodName === 'string' ? obj.periodName : '',
    fiscalYear: typeof obj.fiscalYear === 'string' ? obj.fiscalYear : '',
    financeMode: typeof obj.financeMode === 'string' ? obj.financeMode : '',
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : '',
    assetItems: arr('assetItems'),
    totalAssets: num('totalAssets'),
    liabilityItems: arr('liabilityItems'),
    totalLiabilities: num('totalLiabilities'),
    equityItems: arr('equityItems'),
    totalEquity: num('totalEquity'),
    totalLiabilitiesAndEquity: num('totalLiabilitiesAndEquity'),
    isBalanced: typeof obj.isBalanced === 'boolean' ? obj.isBalanced : false,
  };
}

function flatten(
  items: BalanceSheetItem[],
  depth = 0,
): { item: BalanceSheetItem; depth: number }[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flatten(bsGetChildren(item), depth + 1),
  ]);
}

function exportCsv(report: BalanceSheetReport) {
  const header = ['Section', 'Account Code', 'Account Name', 'Depth', 'Is Summary', 'Ending Balance'];
  const toRow =
    (section: string) =>
    ({ item, depth }: { item: BalanceSheetItem; depth: number }) => [
      section,
      item.accountCode,
      item.accountName,
      depth,
      item.isSummary,
      item.endingBalance,
    ];
  const rows = [
    ...flatten(report.assetItems).map(toRow('Assets')),
    ...flatten(report.liabilityItems).map(toRow('Liabilities')),
    ...flatten(report.equityItems).map(toRow('Equity')),
  ];
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'balance-sheet.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function BSSection({ title, items, total }: { title: string; items: BalanceSheetItem[]; total: number }) {
  const expand = useTreeExpand({
    nodes: items,
    getChildren: bsGetChildren,
    getId: bsGetId,
    isSummary: bsIsSummary,
  });
  return (
    <Fragment>
      <tr className="bg-offwhite">
        <td colSpan={3} className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy">
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
        columns={BS_COLUMNS}
        getChildren={bsGetChildren}
        getId={bsGetId}
        isSummary={bsIsSummary}
        expand={expand}
        treeColumnIndex={1}
      />
      <tr className="border-b border-border font-medium">
        <td className="py-2 pr-2" colSpan={2}>
          Total {title}
        </td>
        <td className="py-2 pr-2 text-right font-mono">{formatINR(total)}</td>
      </tr>
    </Fragment>
  );
}

export default function BalanceSheetPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
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
      const data = await getBalanceSheet(user.legalEntityId, periodId);
      setReport(normalizeReport(data));
    } catch {
      setError(true);
      showToast('Failed to load balance sheet. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout breadcrumb="Balance Sheet">
      <h1 className="text-2xl font-bold text-navy">Balance Sheet</h1>
      <p className="mt-1 text-sm text-slate">Assets, liabilities, and equity as of period end</p>

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
              message="Failed to load balance sheet data. Please try again."
              onRetry={runReport}
            />
          )}

          {!loadingPeriods && !running && !error && !report && (
            <EmptyState
              title="No balance sheet data"
              message="Select a period and click Run Report."
            />
          )}

          {!loadingPeriods && !running && !error && report && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Account Code</th>
                  <th className="py-2 pr-2 font-medium">Account Name</th>
                  <th className="py-2 pr-2 text-right font-medium">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                <BSSection title="Assets" items={report.assetItems} total={report.totalAssets} />
                <BSSection
                  title="Liabilities"
                  items={report.liabilityItems}
                  total={report.totalLiabilities}
                />
                <BSSection title="Equity" items={report.equityItems} total={report.totalEquity} />
                <tr className="border-t-2 border-navy font-semibold text-navy">
                  <td className="py-3 pr-2" colSpan={2}>
                    Total Liabilities + Equity
                  </td>
                  <td className="py-3 pr-2 text-right font-mono">
                    {formatINR(report.totalLiabilitiesAndEquity)}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-3 pr-2 text-navy" colSpan={2}>
                    Status
                  </td>
                  <td
                    className={`py-3 pr-2 text-right ${report.isBalanced ? 'text-green' : 'text-red-600'}`}
                  >
                    {report.isBalanced ? '✓ Assets = Liabilities + Equity' : '✗ Unbalanced'}
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
