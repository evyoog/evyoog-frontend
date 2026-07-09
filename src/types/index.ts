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
  accountCombination: Record<string, string>;
  description: string;
  debitAmount: number | null;
  creditAmount: number | null;
}

export interface CreateJournalRequest {
  legalEntityId: string;
  description: string;
  accountingDate: string;
  source: string;
  submitForApproval: boolean;
  lines: JournalLine[];
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountQualifier: string;
  periodDebit: number;
  periodCredit: number;
  ytdDebit: number;
  ytdCredit: number;
  endingBalance: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface Period {
  id: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface Ledger {
  id: string;
  ledgerName: string;
  currency: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
