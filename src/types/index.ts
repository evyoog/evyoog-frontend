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
  legalEntityName: string;
  ledgerName: string;
  periodName: string;
  journalSourceCode: string;
  journalCategoryCode: string;
  description: string;
  glDate: string;
  totalDebit: number;
  totalCredit: number;
  status: JournalStatus;
  financeModeSnapshot: string;
  postedAt: string | null;
  createdAt: string;
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
  isPostable?: boolean;
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
  id: string;
  legalEntityId: string;
  legalEntityName: string;
  accountingPeriodId: string;
  periodName: string;
  fiscalYear: string;
  status: PeriodStatusValue;
  openedAt: string | null;
  openedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
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
  last: boolean;
}

export interface BalanceSheetItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountQualifier: string;
  isSummary: boolean;
  isPostable: boolean;
  displayOrder: number;
  periodToDateDr: number;
  periodToDateCr: number;
  ytdDr: number;
  ytdCr: number;
  endingBalance: number;
  children: BalanceSheetItem[];
}

export interface BalanceSheetReport {
  legalEntityId: string;
  legalEntityName: string;
  legalEntityCode: string;
  accountingPeriodId: string;
  periodName: string;
  fiscalYear: string;
  financeMode: string;
  generatedAt: string;
  assetItems: BalanceSheetItem[];
  totalAssets: number;
  liabilityItems: BalanceSheetItem[];
  totalLiabilities: number;
  equityItems: BalanceSheetItem[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface AccountLedgerLine {
  lineId: string;
  journalHeaderId: string;
  journalNumber: string;
  glDate: string;
  accountingDate: string;
  journalDescription: string;
  lineDescription: string | null;
  journalSourceCode: string;
  journalCategoryCode: string;
  debitAmount: number | null;
  creditAmount: number | null;
  runningBalance: number;
  gstApplicable: boolean;
  tdsApplicable: boolean;
  createdAt: string;
}

export interface AccountLedgerReport {
  naturalAccountValueId: string;
  accountCode: string;
  accountName: string;
  accountQualifier: string;
  normalBalance: string;
  legalEntityId: string;
  legalEntityName: string;
  accountingPeriodId: string;
  periodName: string;
  fiscalYear: string;
  openingBalance: number;
  entries: AccountLedgerLine[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entryCount: number;
}

export interface CashFlowLineItem {
  description: string;
  amount: number;
  itemType: string;
}

export interface CashFlowSection {
  sectionCode: string;
  sectionName: string;
  items: CashFlowLineItem[];
  totalAmount: number;
}

export interface CashFlowReport {
  legalEntityId: string;
  legalEntityName: string;
  accountingPeriodId: string;
  periodName: string;
  fiscalYear: string;
  method: string;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
  isPositiveCashFlow: boolean;
}
