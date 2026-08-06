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
  description?: string | null;
  requiresApproval?: boolean;
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

export interface Account {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentAccountId: string | null;
  parentAccountCode: string | null;
  parentAccountName: string | null;
  qualifier: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isSummary: boolean;
  isPostable: boolean;
  normalBalance: 'DR' | 'CR';
  gstApplicable: boolean;
  tdsApplicable: boolean;
  tdsSection: string | null;
  validFrom: string | null;
  validTo: string | null;
  budgetControlled: boolean;
  extendedAttributes: Record<string, unknown> | null;
  displayOrder: number;
  isActive: boolean;
  children: Account[];
  createdAt: string;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface ChartOfAccountsResponse {
  ledgerId: string;
  financeDimensionId: string;
  totalCount: number;
  postableCount: number;
  summaryCount: number;
  accounts: Account[];
}

export interface CoaImportResult {
  id: string;
  status: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
}

export interface FinanceDimension {
  id: string;
  ledgerId: string;
  ledgerName: string;
  code: string;
  name: string;
  description: string | null;
  dimensionType: string;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  valueCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DimensionValue {
  id: string;
  financeDimensionId: string;
  dimensionCode: string;
  dimensionName: string;
  dimensionType: string;
  code: string;
  name: string;
  description: string | null;
  parentValueId: string | null;
  parentValueCode: string | null;
  parentValueName: string | null;
  accountQualifier: string | null;
  isSummary: boolean;
  isPostable: boolean;
  normalBalance: string | null;
  gstApplicable: boolean;
  tdsApplicable: boolean;
  tdsSection: string | null;
  displayOrder: number;
  isActive: boolean;
  ccManagerName: string | null;
  ccManagerEmail: string | null;
  ccDepartment: string | null;
  validFrom: string | null;
  validTo: string | null;
  budgetControlled: boolean;
  extendedAttributes: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePwd: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserRoleAssignment {
  userRoleId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  legalEntityId: string;
  legalEntityCode: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  isActive: boolean;
  permissions: string[];
}

export interface ApprovalPolicy {
  id: string;
  legalEntityId: string;
  businessUnitId: string | null;
  inventoryOrgId: string | null;
  journalSourceCode: string;
  requiresApproval: boolean;
  approvalThresholdAmount: number | null;
  approverRoleCode: string | null;
  isActive: boolean;
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
  segmentFilters?: { costCentre: string | null; product: string | null };
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
  allowDynamicInsert?: boolean;
}

export interface AccountCombination {
  id: string;
  ledgerId: string;
  ledgerName: string;
  legalEntityId: string;
  legalEntityName: string;
  combination: Record<string, string>;
  combinationCode: string;
  description: string | null;
  isActive: boolean;
  isDynamic: boolean;
  firstUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface AccountingPeriod {
  id: string;
  accountingCalendarId: string;
  calendarName: string;
  name: string;
  periodNumber: number;
  fiscalYear: string;
  periodType: string;
  quarterNumber: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface AccountingCalendar {
  id: string;
  ledgerId: string;
  ledgerName: string;
  name: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  periodType: string;
  periodsPerYear: number;
  isActive: boolean;
  generatedPeriodCount: number;
  currentFiscalYear: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodRow {
  period: AccountingPeriod;
  status: PeriodStatus | null;
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

export interface PLBySegmentLine {
  accountCode: string;
  accountName: string;
  accountQualifier: string;
  segmentAmounts: Record<string, number>;
  total: number;
}

export interface PLBySegmentReport {
  legalEntityId: string;
  legalEntityName: string;
  accountingPeriodId: string;
  periodName: string;
  fiscalYear: string;
  segmentType: string;
  segments: string[];
  revenueLines: PLBySegmentLine[];
  expenseLines: PLBySegmentLine[];
  totalRevenue: Record<string, number>;
  totalExpenses: Record<string, number>;
  netIncome: Record<string, number>;
  generatedAt: string;
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
  accountCombination?: Record<string, string> | null;
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

export interface LegalEntity {
  id: string;
  businessGroupId: string;
  code: string;
  name: string;
  accountingStandard: string;
  tan: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessUnit {
  id: string;
  legalEntityId: string;
  code: string;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
