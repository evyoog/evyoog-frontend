export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  errors: string[] | null;
}

export interface User {
  userId: string;
  email: string;
  fullName: string;
  legalEntityId: string;
  permissions: string[];
  mustChangePwd: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  email: string;
  fullName: string;
  legalEntityId: string;
  permissions: string[];
  mustChangePwd: boolean;
}

export interface MeResponse {
  userId: string;
  email: string;
  fullName: string;
  legalEntityId: string;
  roles: string[];
  permissions: string[];
}

export type JournalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'REVERSED'
  | 'CANCELLED';

export interface Journal {
  id: string;
  journalNumber: string;
  status: JournalStatus;
  description: string;
  accountingDate: string;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  createdBy: string;
}

export interface JournalLine {
  lineNumber: number;
  naturalAccountValueId: string;
  accountCombination: Record<string, string>;
  description: string;
  debitAmount: number | null;
  creditAmount: number | null;
}

export interface CreateJournalRequest {
  legalEntityId: string;
  description: string;
  glDate: string;
  journalSourceId: string;
  journalCategoryId: string;
  submitForApproval: boolean;
  lines: JournalLine[];
}

export interface JournalSource {
  id: string;
  code: string;
  name: string;
}

export interface JournalCategory {
  id: string;
  code: string;
  name: string;
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
}

export interface ChartOfAccountsResponse {
  ledgerId: string;
  totalCount: number;
  postableCount: number;
  accounts: ChartOfAccount[];
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountQualifier: string;
  normalBalance: string;
  beginningBalance: number;
  periodToDateDr: number;
  periodToDateCr: number;
  yearToDateDr: number;
  yearToDateCr: number;
  endingBalance: number;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export type PeriodStatusValue = 'NOT_OPENED' | 'FUTURE_ENTERABLE' | 'OPEN' | 'CLOSED' | 'LOCKED';

export interface PeriodStatus {
  accountingPeriodId: string;
  periodName: string;
  status: PeriodStatusValue;
}

export interface Ledger {
  id: string;
  ledgerName: string;
  currency: string;
}

export interface PLItem {
  accountCode: string;
  accountName: string;
  accountQualifier: string;
  periodToDateDr: number;
  periodToDateCr: number;
  ytdDr: number;
  ytdCr: number;
  netAmount: number;
  children: PLItem[];
}

export interface PLStatementReport {
  legalEntityName: string;
  periodName: string;
  fiscalYear: string;
  revenueItems: PLItem[];
  totalRevenue: number;
  expenseItems: PLItem[];
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
  isProfitable: boolean;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
