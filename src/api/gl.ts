import api from './axios';
import type {
  Account,
  AccountingCalendar,
  AccountingPeriod,
  AccountLedgerReport,
  ApiResponse,
  BalanceSheetReport,
  CashFlowReport,
  ChartOfAccountsResponse,
  CoaImportResult,
  CreateJournalRequest,
  DimensionValue,
  FinanceDimension,
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

export async function getAccountingCalendar(ledgerId: string) {
  const { data } = await api.get<ApiResponse<AccountingCalendar>>(
    '/api/v1/gl/accounting-calendars',
    { params: { ledgerId } },
  );
  return data.data;
}

export async function listAccountingPeriods(calendarId: string) {
  const { data } = await api.get<ApiResponse<AccountingPeriod[]>>(
    `/api/v1/gl/accounting-calendars/${calendarId}/periods`,
  );
  return data.data;
}

export async function initialisePeriod(
  legalEntityId: string,
  accountingPeriodId: string,
  openedBy: string,
) {
  const { data } = await api.post<ApiResponse<PeriodStatus>>('/api/v1/gl/period-status', {
    legalEntityId,
    accountingPeriodId,
    openedBy,
  });
  return data.data;
}

export async function listJournalSources(legalEntityId?: string) {
  const { data } = await api.get<ApiResponse<JournalSource[]>>('/api/v1/gl/journal-sources', {
    params: legalEntityId ? { legalEntityId } : undefined,
  });
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

export async function listFinanceDimensions(ledgerId: string) {
  const { data } = await api.get<ApiResponse<FinanceDimension[]>>(
    '/api/v1/gl/finance-dimensions',
    { params: { ledgerId } },
  );
  return data.data;
}

export async function createFinanceDimension(body: {
  ledgerId: string;
  code: string;
  name: string;
  description: string | null;
  dimensionType: string;
  displayOrder: number;
}) {
  const { data } = await api.post<ApiResponse<FinanceDimension>>(
    '/api/v1/gl/finance-dimensions',
    body,
  );
  return data.data;
}

export async function updateFinanceDimension(
  id: string,
  body: Partial<{
    code: string;
    name: string;
    description: string | null;
    dimensionType: string;
    displayOrder: number;
  }>,
) {
  const { data } = await api.put<ApiResponse<FinanceDimension>>(
    `/api/v1/gl/finance-dimensions/${id}`,
    body,
  );
  return data.data;
}

export async function getChartOfAccounts(legalEntityId: string, ledgerId: string) {
  const { data } = await api.get<ApiResponse<ChartOfAccountsResponse>>(
    '/api/v1/gl/chart-of-accounts',
    { params: { legalEntityId, ledgerId } },
  );
  return data.data;
}

export async function searchChartOfAccounts(ledgerId: string, query: string) {
  const { data } = await api.get<ApiResponse<Account[]>>('/api/v1/gl/chart-of-accounts/search', {
    params: { ledgerId, query },
  });
  return data.data;
}

export async function createAccount(
  body: Partial<Account> & { ledgerId: string; legalEntityId: string },
) {
  const { data } = await api.post<ApiResponse<Account>>('/api/v1/gl/chart-of-accounts', body);
  return data.data;
}

export async function updateAccount(accountId: string, body: Partial<Account>) {
  const { data } = await api.put<ApiResponse<Account>>(
    `/api/v1/gl/chart-of-accounts/${accountId}`,
    body,
  );
  return data.data;
}

export async function listDimensionValues(financeDimensionId: string) {
  const { data } = await api.get<ApiResponse<DimensionValue[]>>('/api/v1/gl/dimension-values', {
    params: { financeDimensionId },
  });
  return data.data;
}

export async function createDimensionValue(
  body: Partial<DimensionValue> & { financeDimensionId: string; code: string; name: string },
) {
  const { data } = await api.post<ApiResponse<DimensionValue>>('/api/v1/gl/dimension-values', body);
  return data.data;
}

export async function updateDimensionValue(id: string, body: Partial<DimensionValue>) {
  const { data } = await api.put<ApiResponse<DimensionValue>>(
    `/api/v1/gl/dimension-values/${id}`,
    body,
  );
  return data.data;
}

export async function deactivateDimensionValue(id: string) {
  const { data } = await api.delete<ApiResponse<unknown>>(`/api/v1/gl/dimension-values/${id}`);
  return data;
}

export async function searchDimensionValues(ledgerId: string, code: string) {
  const { data } = await api.get<ApiResponse<DimensionValue[]>>(
    '/api/v1/gl/dimension-values/search',
    { params: { ledgerId, code } },
  );
  return data.data;
}

export async function importChartOfAccounts(
  legalEntityId: string,
  ledgerId: string,
  file: File,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('legalEntityId', legalEntityId);
  formData.append('ledgerId', ledgerId);
  const { data } = await api.post<ApiResponse<CoaImportResult>>(
    '/api/v1/gl/coa-import-jobs',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}
