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

## P1 Retrofit Layer 3 deviations (August 2026)
- lodash is NOT installed — use native debounce pattern (setTimeout/clearTimeout)
- usePermission hook is dead code — use hasPermission() directly
- Chart of Accounts already had a working 300ms debounce (non-lodash) — left untouched

## P1 Retrofit Layer 4 — Journal Entry (August 2026) deviations
- JournalEntryPage is create-only (route /journals/new) — there is no
  getJournalById/postJournal/reverseJournal API and no /journals/:id route.
  So two spec items don't apply and were skipped rather than faked:
  - No "immutable POSTED/REVERSED/CANCELLED" banner or Reverse Journal button
    (no such journal state ever reaches this page).
  - "FormSkeleton on journal load" was reinterpreted as FormSkeleton over the
    existing `loadingLookups` state (sources/categories/accounts fetch), the
    closest real loading state this page has, instead of a nonexistent
    edit-mode journal fetch.
- Inline field errors reuse the existing `error` prop already built into
  Input.tsx/Select.tsx (renders message + aria-invalid/aria-describedby)
  rather than hand-rolled `<p role="alert">` blocks per field.
- Required-field asterisk rendering was added directly to the shared
  Input.tsx/Select.tsx label (`required` prop now renders a red `*`) instead
  of one-off markup in JournalEntryPage, since no page previously relied on
  `required` for anything but native HTML validation. Benefits all forms.
- No React Router `useBlocker` — App.tsx uses `<BrowserRouter>`, not a data
  router (`createBrowserRouter`), so `useBlocker` isn't available. Unsaved-
  changes protection is `window.onbeforeunload` only, per the spec's documented
  fallback. Note this only fires on real browser unload/refresh, not on
  in-app `<Link>`/`navigate()` clicks (e.g. sidebar nav) — a known limitation
  of the onbeforeunload-only approach.
- GL Date "must be within open period" validates against the month/year of
  the currently OPEN period from getPeriodStatus() (PeriodStatus has no
  explicit start/end date fields, only `periodName` like "AUG-2026") — range
  is derived as the first/last calendar day of that month.

## P1 Retrofit Layer 4 deviations (August 2026)
- JournalEntryPage is create-only — no journal-by-id fetch, no POSTED/immutable banner
- useBlocker not available (BrowserRouter) — unsaved changes uses window.onbeforeunload only
- Input.tsx and Select.tsx updated to support required prop → asterisk display

## P1 Retrofit Layer 4 deviations (August 2026)
- JournalEntryPage is create-only — no journal-by-id fetch, no POSTED/immutable banner
- useBlocker not available (BrowserRouter) — unsaved changes uses window.onbeforeunload only
- Input.tsx and Select.tsx updated to support required prop → asterisk display

## P1 Retrofit Layer 5 (August 2026)
- accountCombination added to AccountLedgerLine type (optional Record<string,string>)
- Backend fix required: AccountLedgerEntry DTO now includes accountCombination field
- Asset accounts show Cost Centre only (no Product) — correct behavior
- Revenue accounts show Cost Centre + Product — correct behavior

## P1 Retrofit Sprint Complete (August 2026)
- All 16 screens meet P1 Frontend Production Standard
- Layers 1-7 applied: shared components, report screens, listing screens,
  Journal Entry, WHO columns, Login, Dashboard
- SkeletonLoader, ErrorState, EmptyState available in src/components/ui/index.ts
- formatIST available in src/utils/format.ts

## Segment Reporting Frontend (August 2026)
- PLStatementPage.tsx unified — Standard + By Segment view modes
- PLBySegmentPage.tsx deleted — merged into PLStatementPage
- /pl-by-segment route removed — use /pl-statement with toggle
- Trial Balance enhanced with optional costCentre + product filter params
- Pivot table columns driven dynamically from report.segments[]
- Zero segment amounts display as "—" not "0.00"

## Journal Entry — Multi-Segment Account Selector (August 2026)
- Each journal line now has Natural Account + Cost Centre + Product selectors
  (was Natural Account only). Cost Centre/Product dims loaded from
  listFinanceDimensions(ledgerId) + listDimensionValues(dimensionId) —
  already existed in gl.ts, no new API functions added.
- Cost Centre / Product columns only render if the ledger actually has that
  FinanceDimension (dims.find by dimensionType) — screen degrades to
  Natural-Account-only for ledgers with no extra dimensions configured.
- accountCombination is built via buildAccountCombination(accountCode,
  costCentreCode, productCode) — keys are DimensionType enum names
  (NATURAL_ACCOUNT/COST_CENTRE/PRODUCT), optional keys omitted when empty.
- Cost Centre required-ness is driven by FinanceDimension.isRequired (per
  ledger config), not hardcoded — validated per line + gates linesReady.
- Did NOT add the spec's suggested mobile-stacked-flex layout for dimension
  selectors — kept the single table + overflow-x-auto pattern already used
  by this page (and the rest of the app) instead of introducing a second,
  breakpoint-specific layout for just this table.

## CFO Executive Dashboard KPIs (August 2026)
- DashboardPage.tsx now derives 6 financial KPI cards + a top-5 expense
  breakdown from the trial balance report, in addition to keeping all prior
  sections (GL Operations cards, Recent Journals table) unchanged.
- A period-status row's accountingPeriodId does not guarantee trial balance
  has rows for that period (backend can 404 NO_BALANCES_FOUND even for the
  "current" period). loadDashboard tries getTrialBalance() against each
  period from getPeriodStatus() in order and uses the first one that comes
  back with rows — NOT just periods[0]. The periodName shown on the KPI
  cards/expense breakdown is the matched period's, which may differ from
  the Open Period card above it.
- TrialBalanceReport is typed with `rows` but the backend actually nests
  rows under `lines` at runtime (see TrialBalancePage.tsx's normalizeReport).
  DashboardPage.tsx has its own local normalizeTrialBalanceRows() doing the
  same lines/rows/array fallback — not extracted to a shared util since only
  two pages need it and the existing pattern is already page-local.
- KPI fetch (getTrialBalance) is nested inside loadDashboard's try block, in
  its own inner try/catch: a KPI failure (e.g. 404 — no balances yet) only
  clears kpis to null (cards render "—", no expense breakdown) and never
  sets the page-level `error` state — the operational dashboard always
  still renders.
- accountQualifier comparisons use the uppercase enum values (REVENUE,
  EXPENSE) per the Account type / P&L API convention documented above —
  not the 'Revenue'/'Expense' capitalized strings TrialBalancePage's
  groupByQualifier sorts against (a pre-existing, unrelated quirk on that
  page, not touched here).
- formatINR() is used as-is with no manual ₹ prefix, matching every other
  amount display in the app (Recent Journals table, Trial Balance, etc.) —
  did not add a ₹ symbol despite the mockup in the build prompt showing one.
- No chart library added — expense breakdown bars are plain CSS width%
  divs (ExpenseBar), consistent with "no new dependencies" throughout this
  project.

## Account Combinations (August 2026)
- GET /api/v1/gl/account-combinations?ledgerId&legalEntityId
- combination key = DimensionType enum name (COST_CENTRE, NATURAL_ACCOUNT, PRODUCT)
- Display order: NATURAL_ACCOUNT → COST_CENTRE → PRODUCT
- isDynamic=true = auto-registered, false = manually pre-approved
- Client-side filtering (bounded list — matches ChartOfAccountsPage pattern)
- Dynamic Insert toggle: PATCH /api/v1/gl/ledgers/{id}/dynamic-insert
- Ledger type extended with optional allowDynamicInsert field
