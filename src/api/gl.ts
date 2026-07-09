import api from './axios';
import type {
  ApiResponse,
  CreateJournalRequest,
  Journal,
  Ledger,
  Page,
  Period,
  TrialBalanceReport,
} from '../types';

export interface JournalListParams {
  legalEntityId: string;
  status?: string;
  page?: number;
  size?: number;
}

export async function listJournals(params: JournalListParams) {
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

export async function listPeriods(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<Period[]>>('/api/v1/gl/periods', {
    params: { legalEntityId },
  });
  return data.data;
}

export async function listLedgers(legalEntityId: string) {
  const { data } = await api.get<ApiResponse<Ledger[]>>('/api/v1/gl/ledgers', {
    params: { legalEntityId },
  });
  return data.data;
}
