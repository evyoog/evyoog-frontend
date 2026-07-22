import api from './axios';
import type {
  AccountLedgerReport,
  ApiResponse,
  BalanceSheetReport,
  CashFlowReport,
  ChartOfAccountsResponse,
  CreateJournalRequest,
  Journal,
  JournalCategory,
  JournalSource,
  Ledger,
  Page,
  PeriodStatus,
  PLStatementReport,
  TrialBalanceReport,
} from '../types';

export interface JournalListParams {
  legalEntityId: string;
  status?: string;
  periodId?: string;
  page?: number;
  size?: number;
}

export async function listJournals({ periodId, ...rest }: JournalListParams) {
  const params: Record<string, string | number> = { ...rest };
  if (periodId) params.accountingPeriodId = periodId;
  const { data } = await api.get<ApiResponse<Page<Journal>>>('/api/v1/gl/journals', {
    params,
  });
  return data.data;
}

export async function createJournal(payload: CreateJournalRequest) {
  const { data } = await api.post<ApiResponse<Journal>>('/api/v1/gl/journals', payload);
  return data.data;
}

export async function getTrialBalance(legalEntityId: string, periodId: string) {
  const { data } = await api.get<ApiResponse<TrialBalanceReport>>(
    '/api/v1/gl/reports/trial-balance',
    { params: { legalEntityId, periodId } },
  );
  return data.data;
}

export async function getProfitAndLoss(legalEntityId: string, periodId: string) {
  const { data } = await api.get<ApiResponse<PLStatementReport>>(
    '/api/v1/gl/reports/profit-and-loss',
    { params: { legalEntityId, periodId } },
  );
  return data.data;
}

export async function getPeriodStatus(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<PeriodStatus[]>>('/api/v1/gl/period-status', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function openPeriod(periodStatusId: string, actionBy: string) {
  const { data } = await api.post<ApiResponse<PeriodStatus>>(
    `/api/v1/gl/period-status/${periodStatusId}/open`,
    { actionBy },
  );
  return data.data;
}

export async function closePeriod(periodStatusId: string, actionBy: string) {
  const { data } = await api.post<ApiResponse<PeriodStatus>>(
    `/api/v1/gl/period-status/${periodStatusId}/close`,
    { actionBy },
  );
  return data.data;
}

export async function lockPeriod(periodStatusId: string, actionBy: string) {
  const { data } = await api.post<ApiResponse<PeriodStatus>>(
    `/api/v1/gl/period-status/${periodStatusId}/lock`,
    { actionBy },
  );
  return data.data;
}

export async function listLedgers(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<Ledger[]>>('/api/v1/gl/ledgers', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function listJournalSources() {
  const { data } = await api.get<ApiResponse<JournalSource[]>>('/api/v1/gl/journal-sources');
  return data.data;
}

export async function listJournalCategories() {
  const { data } = await api.get<ApiResponse<JournalCategory[]>>('/api/v1/gl/journal-categories');
  return data.data;
}

export async function listChartOfAccounts(legalEntityId: string, ledgerId: string) {
  const { data } = await api.get<ApiResponse<ChartOfAccountsResponse>>(
    '/api/v1/gl/chart-of-accounts',
    { params: { legalEntityId, ledgerId } },
  );
  return data.data.accounts;
}

export async function getBalanceSheet(legalEntityId: string, periodId: string) {
  const { data } = await api.get<ApiResponse<BalanceSheetReport>>(
    '/api/v1/gl/reports/balance-sheet',
    { params: { legalEntityId, periodId } },
  );
  return data.data;
}

export async function getAccountLedger(
  legalEntityId: string,
  periodId: string,
  accountId: string,
) {
  const { data } = await api.get<ApiResponse<AccountLedgerReport>>(
    '/api/v1/gl/reports/account-ledger',
    { params: { legalEntityId, accountingPeriodId: periodId, naturalAccountValueId: accountId } },
  );
  return data.data;
}

export async function getCashFlow(legalEntityId: string, periodId: string) {
  const { data } = await api.get<ApiResponse<CashFlowReport>>('/api/v1/gl/reports/cash-flow', {
    params: { legalEntityId, periodId },
  });
  return data.data;
}
