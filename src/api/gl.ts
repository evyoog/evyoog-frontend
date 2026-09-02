import api from './axios';
import type {
  Account,
  AccountCombination,
  AccountingCalendar,
  AccountingPeriod,
  AccountLedgerReport,
  AieImportResponse,
  AieLineError,
  ApiResponse,
  BalanceSheetReport,
  BatchStatus,
  BusinessUnit,
  CashFlowReport,
  ChartOfAccountsResponse,
  CoaImportResult,
  CoaStructure,
  CreateJournalRequest,
  DimensionValue,
  FinanceDimension,
  HierarchicalTrialBalanceResponse,
  Journal,
  JournalCategory,
  JournalSource,
  Ledger,
  LegalEntity,
  LegalEntityLedger,
  OpeningBalanceImportResponse,
  OpeningBalancePreviewResponse,
  Page,
  PeriodStatus,
  PLBySegmentReport,
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

export async function getTrialBalance(
  legalEntityId: string,
  periodId: string,
  costCentre?: string,
  product?: string,
) {
  const params: Record<string, string> = { legalEntityId, periodId };
  if (costCentre) params.costCentre = costCentre;
  if (product) params.product = product;
  const { data } = await api.get<ApiResponse<TrialBalanceReport>>(
    '/api/v1/gl/reports/trial-balance',
    { params },
  );
  return data.data;
}

export async function getHierarchicalTrialBalance(params: {
  legalEntityId: string;
  periodId: string;
  unitCode?: string;
  costCentreCode?: string;
}) {
  const { data } = await api.get<ApiResponse<HierarchicalTrialBalanceResponse>>(
    '/api/v1/gl/reports/hierarchical-trial-balance',
    { params },
  );
  return data.data;
}

export async function getPLBySegment(
  legalEntityId: string,
  periodId: string,
  segmentType: 'COST_CENTRE' | 'PRODUCT',
  includeZeroBalances?: boolean,
) {
  const { data } = await api.get<ApiResponse<PLBySegmentReport>>(
    '/api/v1/gl/reports/pl-by-segment',
    { params: { legalEntityId, periodId, segmentType, includeZeroBalances } },
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

export async function listLedgers(legalEntityId?: string) {
  const { data } = await api.get<ApiResponse<Ledger[]>>('/api/v1/gl/ledgers', {
    params: legalEntityId ? { legalEntityId } : undefined,
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
    isBalancing: boolean;
    balancingSequence: number | null;
  }>,
) {
  const { data } = await api.put<ApiResponse<FinanceDimension>>(
    `/api/v1/gl/finance-dimensions/${id}`,
    body,
  );
  return data.data;
}

export async function getBalancingDimensions(coaStructureId: string) {
  const { data } = await api.get<ApiResponse<FinanceDimension[]>>(
    '/api/v1/gl/finance-dimensions/balancing',
    { params: { coaStructureId } },
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

export async function setDimensionValueDefault(id: string) {
  const { data } = await api.post<ApiResponse<DimensionValue>>(
    `/api/v1/gl/dimension-values/${id}/set-default`,
  );
  return data.data;
}

export async function clearDimensionValueDefault(id: string) {
  const { data } = await api.post<ApiResponse<DimensionValue>>(
    `/api/v1/gl/dimension-values/${id}/clear-default`,
  );
  return data.data;
}

export async function searchDimensionValues(ledgerId: string, code: string) {
  const { data } = await api.get<ApiResponse<DimensionValue[]>>(
    '/api/v1/gl/dimension-values/search',
    { params: { ledgerId, code } },
  );
  return data.data;
}

export async function listLegalEntities(businessGroupId: string) {
  const { data } = await api.get<ApiResponse<LegalEntity[]>>('/api/v1/gl/legal-entities', {
    params: { businessGroupId },
  });
  return data.data;
}

export async function getLegalEntity(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<LegalEntity>>(
    `/api/v1/gl/legal-entities/${legalEntityId}`,
  );
  return data.data;
}

export async function createLegalEntity(body: {
  businessGroupId: string;
  code: string;
  name: string;
  accountingStandard?: string;
  tan?: string;
}) {
  const { data } = await api.post<ApiResponse<LegalEntity>>('/api/v1/gl/legal-entities', body);
  return data.data;
}

export async function updateLegalEntity(
  legalEntityId: string,
  body: { name: string; accountingStandard: string; tan?: string },
) {
  const { data } = await api.patch<ApiResponse<LegalEntity>>(
    `/api/v1/gl/legal-entities/${legalEntityId}`,
    body,
  );
  return data.data;
}

export async function getLedger(ledgerId: string) {
  const { data } = await api.get<ApiResponse<Ledger>>(`/api/v1/gl/ledgers/${ledgerId}`);
  return data.data;
}

export async function updateLedger(ledgerId: string, body: { name: string; description?: string }) {
  const { data } = await api.put<ApiResponse<Ledger>>(`/api/v1/gl/ledgers/${ledgerId}`, body);
  return data.data;
}

export async function listLegalEntityLedgers(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<LegalEntityLedger[]>>(
    '/api/v1/gl/legal-entity-ledgers',
    { params: { legalEntityId } },
  );
  return data.data;
}

export async function updateCalendar(
  calendarId: string,
  body: { name: string; description?: string },
) {
  const { data } = await api.put<ApiResponse<AccountingCalendar>>(
    `/api/v1/gl/accounting-calendars/${calendarId}`,
    body,
  );
  return data.data;
}

export async function createLedger(body: {
  code: string;
  name: string;
  description?: string;
  financeMode: string;
  ledgerCategory?: string;
  functionalCurrency?: string;
  accountingStandard?: string;
}) {
  const { data } = await api.post<ApiResponse<Ledger>>('/api/v1/gl/ledgers', body);
  return data.data;
}

export async function linkLegalEntityLedger(body: {
  legalEntityId: string;
  ledgerId: string;
  ledgerCategory?: string;
}) {
  const { data } = await api.post<ApiResponse<unknown>>('/api/v1/gl/legal-entity-ledgers', body);
  return data.data;
}

export async function createCalendar(body: {
  ledgerId: string;
  name: string;
  description?: string;
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
  periodType?: string;
  initialFiscalYear?: number;
}) {
  const { data } = await api.post<ApiResponse<AccountingCalendar>>(
    '/api/v1/gl/accounting-calendars',
    body,
  );
  return data.data;
}

export async function generateInitialPeriods(calendarId: string) {
  const { data } = await api.post<ApiResponse<unknown>>(
    `/api/v1/gl/accounting-calendars/${calendarId}/periods/generate`,
  );
  return data.data;
}

export async function generateNextYearPeriods(calendarId: string) {
  const { data } = await api.post<ApiResponse<unknown>>(
    `/api/v1/gl/accounting-calendars/${calendarId}/periods/generate-next`,
  );
  return data.data;
}

export async function listCalendars() {
  const { data } = await api.get<ApiResponse<AccountingCalendar[]>>(
    '/api/v1/gl/accounting-calendars',
  );
  return data.data;
}

export async function deleteCalendar(calendarId: string) {
  await api.delete(`/api/v1/gl/accounting-calendars/${calendarId}`);
}

export async function listBusinessUnits(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<BusinessUnit[]>>('/api/v1/gl/business-units', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function createBusinessUnit(body: {
  legalEntityId: string;
  code: string;
  name: string;
  gstin?: string;
  stateCode?: string;
}) {
  const { data } = await api.post<ApiResponse<BusinessUnit>>('/api/v1/gl/business-units', body);
  return data.data;
}

export async function updateBusinessUnit(
  id: string,
  body: { name: string; gstin?: string; stateCode?: string },
) {
  const { data } = await api.patch<ApiResponse<BusinessUnit>>(
    `/api/v1/gl/business-units/${id}`,
    body,
  );
  return data.data;
}

export async function listAccountCombinations(
  ledgerId: string,
  legalEntityId: string,
  costCentre?: string,
  product?: string,
  isActive?: boolean,
) {
  const params: Record<string, string | boolean> = { ledgerId, legalEntityId };
  if (costCentre) params.costCentre = costCentre;
  if (product) params.product = product;
  if (isActive !== undefined) params.isActive = isActive;
  const { data } = await api.get<ApiResponse<AccountCombination[]>>(
    '/api/v1/gl/account-combinations',
    { params },
  );
  return data.data;
}

export async function createAccountCombination(body: {
  ledgerId: string;
  legalEntityId: string;
  combination: Record<string, string>;
  description?: string;
}) {
  const { data } = await api.post<ApiResponse<AccountCombination>>(
    '/api/v1/gl/account-combinations',
    body,
  );
  return data.data;
}

export async function updateAccountCombination(
  id: string,
  body: { description?: string; isActive?: boolean },
) {
  const { data } = await api.put<ApiResponse<AccountCombination>>(
    `/api/v1/gl/account-combinations/${id}`,
    body,
  );
  return data.data;
}

export async function deactivateAccountCombination(id: string) {
  const { data } = await api.post<ApiResponse<unknown>>(
    `/api/v1/gl/account-combinations/${id}/deactivate`,
  );
  return data;
}

export async function toggleDynamicInsert(
  ledgerId: string,
  allowDynamicInsert: boolean,
  updatedBy: string,
) {
  const { data } = await api.patch<ApiResponse<Ledger>>(
    `/api/v1/gl/ledgers/${ledgerId}/dynamic-insert`,
    { allowDynamicInsert, updatedBy },
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

export async function listCoaStructures(businessGroupId: string) {
  const { data } = await api.get<ApiResponse<CoaStructure[]>>('/api/v1/gl/coa-structures', {
    params: { businessGroupId },
  });
  return data.data;
}

export async function getCoaStructure(id: string) {
  const { data } = await api.get<ApiResponse<CoaStructure>>(`/api/v1/gl/coa-structures/${id}`);
  return data.data;
}

export async function getCoaStructureByLedger(ledgerId: string) {
  const { data } = await api.get<ApiResponse<CoaStructure>>(
    `/api/v1/gl/coa-structures/by-ledger/${ledgerId}`,
  );
  return data.data;
}

export async function getCoaCombinationFormat(id: string) {
  const { data } = await api.get<ApiResponse<string>>(
    `/api/v1/gl/coa-structures/${id}/combination-format`,
  );
  return data.data;
}

export interface CreateCoaSegmentRequest {
  code: string;
  name: string;
  dimensionType: string;
  segmentNumber: number;
  isRequired: boolean;
}

export async function createCoaStructure(body: {
  businessGroupId: string;
  code: string;
  name: string;
  description?: string;
  separator?: string;
  segments: CreateCoaSegmentRequest[];
}) {
  const { data } = await api.post<ApiResponse<CoaStructure>>('/api/v1/gl/coa-structures', body);
  return data.data;
}

export async function updateCoaStructure(
  id: string,
  body: { name: string; description?: string; isActive?: boolean },
) {
  const { data } = await api.put<ApiResponse<CoaStructure>>(`/api/v1/gl/coa-structures/${id}`, body);
  return data.data;
}

export async function addCoaSegment(id: string, body: CreateCoaSegmentRequest) {
  const { data } = await api.post<ApiResponse<CoaStructure>>(
    `/api/v1/gl/coa-structures/${id}/segments`,
    body,
  );
  return data.data;
}

export async function removeCoaSegment(id: string, financeDimensionId: string) {
  const { data } = await api.delete<ApiResponse<CoaStructure>>(
    `/api/v1/gl/coa-structures/${id}/segments/${financeDimensionId}`,
  );
  return data.data;
}

export async function assignCoaStructureToLedger(id: string, ledgerId: string) {
  const { data } = await api.post<ApiResponse<CoaStructure>>(
    `/api/v1/gl/coa-structures/${id}/assign-ledger`,
    { ledgerId },
  );
  return data.data;
}

export async function downloadAieTemplate(ledgerId: string) {
  const res = await api.get('/api/v1/aie/excel/template', {
    params: { ledgerId },
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function importAieExcel(
  file: File,
  params: {
    legalEntityId: string;
    ledgerId: string;
    accountingPeriodId: string;
    createdBy: string;
    sourceSystem?: string;
  },
) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiResponse<AieImportResponse>>(
    '/api/v1/aie/excel/import',
    formData,
    { params, headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function getBatchStatus(batchId: string) {
  const { data } = await api.get<ApiResponse<BatchStatus>>(`/api/v1/aie/batches/${batchId}`);
  return data.data;
}

export async function getBatchErrors(batchId: string) {
  const { data } = await api.get<ApiResponse<AieLineError[]>>(
    `/api/v1/aie/batches/${batchId}/errors`,
  );
  return data.data;
}

export async function resubmitBatch(batchId: string) {
  const { data } = await api.post<ApiResponse<AieImportResponse>>(
    `/api/v1/aie/batches/${batchId}/resubmit`,
  );
  return data.data;
}

export async function downloadObTemplate(ledgerId: string) {
  const res = await api.get('/api/v1/gl/opening-balances/template', {
    params: { ledgerId },
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function previewOpeningBalances(
  file: File,
  params: { legalEntityId: string; ledgerId: string; accountingPeriodId: string },
) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiResponse<OpeningBalancePreviewResponse>>(
    '/api/v1/gl/opening-balances/preview',
    formData,
    { params, headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function importOpeningBalances(
  file: File,
  params: {
    legalEntityId: string;
    ledgerId: string;
    accountingPeriodId: string;
    createdBy: string;
  },
) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiResponse<OpeningBalanceImportResponse>>(
    '/api/v1/gl/opening-balances/import',
    formData,
    { params, headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}
