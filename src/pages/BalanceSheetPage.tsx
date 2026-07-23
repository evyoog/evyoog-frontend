import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBalanceSheet, getPeriodStatus } from '../api/gl';
import type { BalanceSheetItem, BalanceSheetReport, PeriodStatus } from '../types';
import { formatINR } from '../utils/format';

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

function flatten(items: BalanceSheetItem[]): BalanceSheetItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

function exportCsv(report: BalanceSheetReport) {
  const header = ['Section', 'Account Code', 'Account Name', 'Ending Balance'];
  const toRow = (section: string) => (item: BalanceSheetItem) => [
    section,
    item.accountCode,
    item.accountName,
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
  return (
    <Fragment>
      <tr className="bg-offwhite">
        <td colSpan={3} className="py-2 pr-2 text-xs font-semibold uppercase tracking-wide text-navy">
          {title}
        </td>
      </tr>
      {items.map((item) => (
        <tr key={item.accountId ?? item.accountCode} className="border-b border-border">
          <td className="py-2 pr-2 font-mono text-navy">{item.accountCode}</td>
          <td className="py-2 pr-2">{item.accountName}</td>
          <td className="py-2 pr-2 text-right font-mono">{formatINR(item.endingBalance)}</td>
        </tr>
      ))}
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
    try {
      const data = await getBalanceSheet(user.legalEntityId, periodId);
      setReport(normalizeReport(data));
    } catch {
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
          <Button onClick={runReport} loading={running} disabled={!periodId}>
            Run Report
          </Button>
          {report && (
            <Button variant="secondary" onClick={() => exportCsv(report)}>
              Export CSV
            </Button>
          )}
        </div>

        <div className="mt-6">
          {running && <LoadingSpinner />}

          {!running && !report && (
            <p className="py-10 text-center text-sm text-slate">
              Select a period and click Run Report to view the balance sheet.
            </p>
          )}

          {!running && report && (
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
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
