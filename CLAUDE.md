# eVyoog Frontend — CLAUDE.md

## Backend API — Key field names (do not guess these)

### Journal Creation POST /api/v1/gl/journals
- glDate (not accountingDate)
- journalSourceId (UUID — not journalSourceCode string)
- journalCategoryId (UUID — required)
- legalEntityId (UUID — from AuthContext)
- lines[].naturalAccountValueId (UUID — required)
- lines[].accountCombination (Map<String,String>)
- lines[].debitAmount / lines[].creditAmount (BigDecimal)

### API response shape — all endpoints
{ "success": true, "data": { ... }, "message": null, "errors": null }
Always access response.data.data not response.data

### Key endpoints
- POST /api/v1/auth/login
- GET  /api/v1/auth/me
- GET  /api/v1/gl/journal-sources
- GET  /api/v1/gl/journal-categories
- GET  /api/v1/gl/chart-of-accounts?legalEntityId={id}
- GET  /api/v1/gl/period-status?legalEntityId={id}  (NOT /api/v1/gl/periods)
- POST /api/v1/gl/journals
- GET  /api/v1/gl/journals?legalEntityId={id}
- GET  /api/v1/gl/reports/trial-balance?legalEntityId={id}&periodId={id}

## Codespaces
- Backend runs on port 8080 (must be set to Public)
- Frontend runs on port 5173
- axios baseURL points to the Codespaces backend public URL
- Update src/api/axios.ts baseURL when backend Codespace URL changes

## Tech stack
- React + TypeScript + Vite
- Tailwind CSS v4 (uses @theme in CSS, NOT tailwind.config.ts)
- axios for API calls
- react-router-dom for routing

## P&L Statement API
GET /api/v1/gl/reports/profit-and-loss?legalEntityId={id}&periodId={id}
Response: revenueItems[], totalRevenue, expenseItems[], totalExpenses,
grossProfit, netIncome, isProfitable
PLItem fields: accountCode, accountName, periodToDateDr, periodToDateCr,
ytdDr, ytdCr, netAmount, children[]

## Trial Balance API  
GET /api/v1/gl/reports/trial-balance?legalEntityId={id}&periodId={id}
Response: lines[] (key is "lines" not "rows")
Row fields: accountCode, accountName, accountQualifier, normalBalance,
periodToDateDr, periodToDateCr, yearToDateDr, yearToDateCr, endingBalance,
totalDebit, totalCredit, isBalanced (at root level)

## Account Ledger API
GET /api/v1/gl/reports/account-ledger
Params: legalEntityId, accountingPeriodId (NOT periodId), naturalAccountValueId (NOT accountId)
Response key for lines: "entries" (NOT "lines")
Entry fields: lineId, journalHeaderId, journalNumber, glDate, accountingDate,
  journalDescription, lineDescription, debitAmount, creditAmount, runningBalance,
  journalSourceCode, journalCategoryCode, gstApplicable, tdsApplicable, createdAt
Report fields: openingBalance, totalDebits, totalCredits, closingBalance, entryCount

## Foundation Layer (July 22, 2026)
- Toast system: useToast() from src/context/ToastContext.tsx
- formatDate/formatDateTime: src/utils/format.ts — returns DD-MMM-YYYY
- Silent JWT refresh: axios.ts handles 401 with refresh before redirect
- Session timeout: SessionTimeoutWarning.tsx — 5 min warning before JWT expiry
- TopBar: legalEntityName from getPeriodStatus()[0].legalEntityName (NOT from /auth/me)
- mustChangePwd: amber banner on Dashboard — no change-password endpoint yet
- useAuth: MUST be named function declaration (not arrow function) for Vite HMR

## User Management + Role Management (July 2026)
- User type named AppUser (not User — conflicts with AuthContext User type)
- API functions in src/api/users.ts (NOT gl.ts) — clean separation
- Permission catalog in src/utils/permissions.ts — grouped by category with labels
- UserRolesPanel.tsx — slide-over for role assignments per user
- GET /api/v1/auth/users/{id}/roles — backend bug, returns 500 (GET not registered)
  Frontend handles gracefully with toast error — fix needed on backend
- System roles (isSystemRole: true) — read-only, cannot deactivate, code fixed

## Period Management Enhancement (PM-01/PM-02/PM-03 — August 2026)
- GET /api/v1/gl/accounting-calendars?ledgerId returns single object (NOT array)
  Use data.data directly — NOT data.data[0]
- GET /api/v1/gl/accounting-calendars/{calendarId}/periods returns all 12 periods
- Merge strategy: Map<accountingPeriodId, PeriodStatus> — periods without
  status row show as NOT_INITIALISED with Initialise button
- Button.tsx has new amber variant for destructive-but-not-red actions
- Close period uses proper Modal (PM-02) not inline Yes/No
- Locked-by/at surfaced via tooltip on LOCKED badge (PM-03)

## Change Password (August 2026)
- Backend error response uses {status, code, message, field, timestamp} envelope
  NOT the standard {success, data, message, errors} envelope
  Branch on error.response.data.code: INVALID_CURRENT_PASSWORD | WEAK_PASSWORD
- clearMustChangePwd restored in AuthContext — clears mustChangePwd flag after success
- Dashboard amber banner updated with "Change Password →" React Router Link

## P1 Retrofit Layer 3 — Listing Screens (August 2026) deviations
- lodash is NOT installed in this project (no lodash/lodash-es in package.json).
  Did not add it as a new dependency. ChartOfAccountsPage already had a working
  300ms debounce via useEffect+setTimeout (no lodash) — left as-is, no changes needed.
- JournalListingPage and UserManagementPage have no free-text search input in the
  original code, so the "debounce search input" requirement was N/A for both —
  did not add a new search feature (out of scope for a UI-states-only retrofit).
- JournalListingPage has no summary/stat cards — CardSkeleton was skipped there
  (TableSkeleton only). All other 6 listing screens use CardSkeleton(count=4).
- PeriodManagementPage: openedAt/closedAt/lockedAt now use formatIST()
  (was formatDateTime()) per the Layer 3 spec.
- Permission-gated EmptyState actions use the existing `hasPermission('code')`
  pattern from useAuth() (the codebase's real convention) — NOT the unused
  src/hooks/usePermission.ts hook, which has zero call sites.

## P1 Retrofit Layer 3 deviations (August 2026)
- lodash is NOT installed — use native debounce pattern (setTimeout/clearTimeout)
- usePermission hook is dead code — use hasPermission() directly
- Chart of Accounts already had a working 300ms debounce (non-lodash) — left untouched
