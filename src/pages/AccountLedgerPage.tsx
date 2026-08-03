import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getAccountLedger, getPeriodStatus, listChartOfAccounts, listLedgers } from '../api/gl';
import type { AccountLedgerReport, ChartOfAccount, PeriodStatus } from '../types';
import { formatINR, formatDate } from '../utils/format';

function exportCsv(report: AccountLedgerReport) {
  const header = ['Journal #', 'Date', 'Description', 'Debit', 'Credit', 'Running Balance'];
  const rows = (report.entries ?? []).map((l) => [
    l.journalNumber,
    l.glDate,
    l.journalDescription,
    l.debitAmount ?? '',
    l.creditAmount ?? '',
    l.runningBalance,
  ]);
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'account-ledger.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountLedgerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [report, setReport] = useState<AccountLedgerReport | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadOptions() {
      try {
        const [periodData, ledgers] = await Promise.all([
          getPeriodStatus(user!.legalEntityId),
          listLedgers(user!.legalEntityId),
        ]);
        if (cancelled) return;
        setPeriods(periodData);
        const open = periodData.find((p) => p.status === 'OPEN');
        if (open) setPeriodId(open.accountingPeriodId);

        const ledgerId = ledgers[0]?.id;
        if (ledgerId) {
          const accountList = await listChartOfAccounts(user!.legalEntityId, ledgerId);
          if (cancelled) return;
          // isPostable may be absent on some backend responses — only
          // exclude accounts explicitly marked non-postable.
          setAccounts(accountList.filter((a) => a.isPostable !== false));
        }
      } catch {
        if (!cancelled) showToast('Failed to load periods or accounts.', 'error');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const runReport = async () => {
    if (!user || !periodId || !accountId) return;
    setRunning(true);
    setError(false);
    try {
      const data = await getAccountLedger(user.legalEntityId, periodId, accountId);
      setReport(data);
    } catch {
      setError(true);
      showToast('Failed to load account ledger. Please try again.', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout breadcrumb="Account Ledger">
      <h1 className="text-2xl font-bold text-navy">Account Ledger</h1>
      <p className="mt-1 text-sm text-slate">Transaction detail and running balance for an account</p>

      <Card className="mt-6">
        <div className="flex items-end gap-3">
          <div className="w-64">
            <Select
              id="period"
              label="Period"
              aria-label="Select accounting period"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">Select a period</option>
              {periods.map((p) => (
                <option key={p.accountingPeriodId} value={p.accountingPeriodId}>
                  {p.periodName}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-72">
            <Select
              id="account"
              label="Account"
              aria-label="Select account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">Select an account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            onClick={runReport}
            loading={running}
            disabled={running || !periodId || !accountId}
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
          {loadingOptions && <TableSkeleton rows={6} columns={6} />}

          {!loadingOptions && running && <TableSkeleton rows={6} columns={6} />}

          {!loadingOptions && !running && error && (
            <ErrorState
              message="Failed to load account ledger. Please try again."
              onRetry={runReport}
            />
          )}

          {!loadingOptions && !running && !error && !report && (
            <EmptyState
              title="No ledger entries"
              message="Select a period and account, then click Run Report."
            />
          )}

          {!loadingOptions && !running && !error && report && (
            <>
              <p className="mb-4 text-sm font-medium text-navy">
                Opening Balance: <span className="font-mono">{formatINR(report.openingBalance)}</span>
              </p>
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                    <th className="py-2 pr-2 font-medium">Journal #</th>
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 pr-2 font-medium">Description</th>
                    <th className="py-2 pr-2 text-right font-medium">Debit</th>
                    <th className="py-2 pr-2 text-right font-medium">Credit</th>
                    <th className="py-2 pr-2 text-right font-medium">Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries?.map((line) => (
                    <tr key={line.journalHeaderId} className="border-b border-border">
                      <td className="py-2 pr-2 font-mono text-navy">{line.journalNumber}</td>
                      <td className="py-2 pr-2">{formatDate(line.glDate)}</td>
                      <td className="py-2 pr-2">{line.journalDescription}</td>
                      <td className="py-2 pr-2 text-right font-mono">
                        {line.debitAmount != null ? formatINR(line.debitAmount) : ''}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono">
                        {line.creditAmount != null ? formatINR(line.creditAmount) : ''}
                      </td>
                      <td
                        className={`py-2 pr-2 text-right font-mono ${line.runningBalance < 0 ? 'text-red-600' : 'text-green'}`}
                      >
                        {formatINR(line.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-navy font-semibold text-navy">
                    <td className="py-3 pr-2" colSpan={3}>
                      Totals
                    </td>
                    <td className="py-3 pr-2 text-right font-mono">
                      {formatINR(report.totalDebits)}
                    </td>
                    <td className="py-3 pr-2 text-right font-mono">
                      {formatINR(report.totalCredits)}
                    </td>
                    <td className="py-3 pr-2 text-right font-mono">
                      {formatINR(report.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
