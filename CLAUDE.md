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

## Analytics Enhancements — Period Closing / Approval SLA / GST (August 2026)
- PeriodManagementPage: CloseChecklist reads entirely from the existing `rows`
  (PeriodRow[]) state — no new API calls. "Next period initialised" is found
  by `periodNumber + 1` within the same `rows` array (not a separate periods
  fetch); shows "—" (na) when there is no next period defined at all.
- JournalListingPage: Approval Queue does a second, independent
  listJournals({status:'PENDING_APPROVAL', size:20}) fetch on mount — kept
  separate from the paginated/filtered `loadJournals` so the SLA widget
  doesn't get reset by the page's own filters/pagination. Fails silently to
  an empty array (non-critical widget, matches the period-dropdown pattern
  already on this page). Section renders nothing when there are 0 pending
  approvals. "Approve" button (gated on `gl:journal:approve`) just shows a
  toast — no approval endpoint/flow exists yet.
- SLA breach threshold is 2 days, computed from `journal.createdAt`.
- DashboardPage GST Compliance card: there is no GST report endpoint in
  gl.ts, so this calls `GET /api/v1/gl/gst/transactions` directly via the
  shared `api` axios instance (not added to gl.ts as a typed wrapper, since
  the actual response field shape is unknown/undocumented — CLAUDE.md's
  standing rule is not to guess backend field names). Only `.length` is
  used (transaction count / empty-state check); no CGST/SGST/IGST breakdown
  is rendered since those field names aren't confirmed.
- GST fetch uses the same matchedPeriod resolved by the KPI trial-balance
  loop (falls back to the current OPEN period if KPIs found no balances) —
  reuses loadDashboard's existing period-fallback logic rather than adding
  a second one.
- GST fetch failure is caught independently and only clears gstTransactions
  to [] — never touches the page-level `error` state.

## Analytics Enhancements (August 2026)
- Period Closing Tracker: CloseChecklist in PeriodManagementPage — uses existing rows state, no new API calls
- Journal Approval SLA: Approval Queue in JournalListingPage — hidden when no pending approvals (correct behavior)
- GST Compliance: card in DashboardPage — GET /api/v1/gl/gst/transactions (NOT /api/v1/gl/reports/gst)
  Response shape not typed — kept as raw count (response shape unconfirmed)

## V29 Default Dimension Value (August 2026)
- isDefault field added to DimensionValue type
- setDimensionValueDefault / clearDimensionValueDefault in gl.ts
- DimensionValuesPanel shows Default column + Set/Clear buttons for optional dims only
- NATURAL_ACCOUNT and required dimensions excluded from default buttons
- JournalEntryPage pre-selects default values on addLine()
- Dropdown shows "(default)" hint next to default option

## Enterprise Structure — Full Setup Screen (August 2026)
- EnterpriseStructurePage.tsx rebuilt as a 3-tab screen (Legal Entities /
  Ledger & Calendar / Business Units) with create flows for Legal Entity,
  Ledger, and Accounting Calendar, plus a setup-completeness banner.
- BUSINESS_GROUP_ID hardcoded in the page ('c1338b23-c1e6-4f4e-9d87-8e60b49bb432')
  for Phase 1 single-tenant — Tab 1 lists all Legal Entities under this
  business group via new `listLegalEntities(businessGroupId)`.
- No Tabs component existed in src/components/ui — built as a plain inline
  button tab-bar (border-bottom active-state), not extracted to a shared
  component since this is the only tabbed screen so far.
- `Ledger` type (src/types/index.ts) extended with optional fields
  (legalEntityId, code, description, financeMode, ledgerCategory,
  accountingStandard, isActive, createdAt, updatedAt) beyond the previously
  typed { id, ledgerName, currency, allowDynamicInsert }. All new fields are
  optional so the 5 existing pages that only read `.id`/`.ledgerName`/
  `.allowDynamicInsert` off listLedgers() are unaffected.
- CreateLedgerRequest body key is `functionalCurrency` (per build spec) but
  the Ledger GET response field remains `currency` (already consumed by
  ChartOfAccountsPage, AccountLedgerPage, TrialBalancePage,
  FinanceDimensionsPage, PeriodManagementPage) — the ledger card renders
  `ledger.currency`, not `functionalCurrency`.
- Ledger creation is 2 steps (createLedger, then linkLegalEntityLedger). The
  link body hardcodes `ledgerCategory: "PRIMARY"` per the build spec's
  literal example, even though the Ledger's own "Ledger Category" field in
  the create modal may be set to SECONDARY/REPORTING/ENCUMBRANCE — that
  value is stored on the ledger entity itself; only the LE↔ledger link
  defaults to PRIMARY. If ledger creation succeeds but the link fails, the
  ledger is kept (not deleted) and an error toast is shown, per spec.
- Calendar creation auto-calls `generateInitialPeriods`; if that fails the
  calendar itself is kept (not deleted) — a warning toast tells the user to
  retry period generation from this screen (no retry-generate button was
  built since the create-calendar happy path already covers the demo flow).
- `updateLegalEntity` switched from PUT to PATCH per the build spec's
  explicit note — no other callers depended on PUT.
- Tab 2/3 operate on a `selectedLEId`, not always the logged-in user's own
  legal entity: it defaults to `user.legalEntityId` (or the first LE in the
  business group's list if that ID isn't present) and can be changed via
  "View Details" → "View Ledger →" / "View Business Units →" quick links on
  a Legal Entity card in Tab 1.
- LE "Detail view" is an inline expand/collapse on the card itself (no
  separate route), since Option B didn't specify a dedicated detail screen.
- getAccountingCalendar 404 (no calendar yet for a ledger) is treated as a
  "No Calendar Configured" empty state, not a page-level error — same
  fail-soft pattern used elsewhere (GST card, KPI trial-balance lookup).
- Demo flow (create LE → Ledger → Calendar → BU) was verified via `tsc -b`
  (clean), `vite build` (clean), and `oxlint` (no new warnings) only — the
  backend wasn't running and no browser-automation tool was available in
  this environment, so the actual click-through was not exercised live.

## COA Structure Screen (August 2026)
- CoaStructurePage.tsx (/coa-structure) — card-based list of CoaStructure
  records for BUSINESS_GROUP_ID ('c1338b23-c1e6-4f4e-9d87-8e60b49bb432',
  same Phase 1 constant as EnterpriseStructurePage), Add COA Structure
  modal, and an Edit slide-over with an inline Segment Manager.
- New shared helpers in src/utils/coaStructure.ts: OPTIONAL_DIMENSION_TYPES
  (all segment dimension types except NATURAL_ACCOUNT, which is always
  Segment 1), dimensionTypeLabel, autoSegmentCode, dimensionTypeBadgeClass,
  buildCombinationPreview. Shared between CoaStructurePage.tsx and
  CoaStructureEditPanel.tsx so segment-code/label generation can't drift
  between the create and edit flows.
- Combination format (`[NAT-ACCT].[COST-CTR].[PRODUCT]`) is fetched per
  structure via GET /coa-structures/{id}/combination-format after the list
  loads (Promise.all, keyed by structure id in a `formats` map). If that
  call fails for a given structure, the format falls back to a locally
  built preview from that structure's own segments/separator rather than
  leaving the field blank.
- The Add COA Structure modal is a single scrollable form (structure
  details + segment builder together), not a literal two-step wizard —
  consistent with every other "Add X" modal already in this codebase
  (e.g. AccountCombinationsPage, DimensionValuesPanel), none of which use
  a multi-step Modal component. Segment 1 (Natural Account) is pre-filled
  and locked; "+ Add Segment" appends the next unused dimension type from
  OPTIONAL_DIMENSION_TYPES and auto-fills its code/name (user-editable
  after); the button disables once all 12 optional types are in use.
- CoaStructureEditPanel.tsx (src/components/, not src/pages/) follows the
  same slide-over shell as DimensionValuesPanel.tsx (fixed inset-0 +
  translate-x transition). Code, separator, and dimension type are
  read-only after creation per spec; only name/description/isActive are
  editable via a "Save Changes" button. Segment add/remove act directly
  through addCoaSegment/removeCoaSegment and then refetch the structure
  (getCoaStructure) to stay in sync — not optimistic local state — since
  segmentNumber and valueCount are backend-derived.
- Removing a segment is blocked in the UI for dimensionType ===
  'NATURAL_ACCOUNT' (no Remove button rendered) since Segment 1 can never
  be removed; all other segments get the same inline Yes/No confirmation
  pattern used elsewhere (AccountCombinationsPage deactivate,
  DimensionValuesPanel set-default).
- assignCoaStructureToLedger was added to gl.ts per the spec's required
  API list but has no UI entry point on this screen — the build spec's
  card mockup only *displays* assignedLedgerCount, it doesn't wire up an
  "Assign to Ledger" action, so no button was added (avoids scope creep
  beyond the documented layout).
- Verified via `tsc -b` (clean), `vite build` (clean), `oxlint` (no
  warnings), and a dev-server boot check that GET /coa-structure returns
  200. The backend wasn't running in this environment, so the live
  create/edit/segment-manager flows against real API data were not
  exercised — same limitation as the Enterprise Structure build above.

## Ledger Setup Screen (August 2026)
- LedgerSetupPage.tsx (/ledger-setup) — card-based list of Ledgers for
  `user.legalEntityId`, each showing Finance Mode/Currency/Standard/
  Category, COA Structure assignment, Dynamic Insert toggle, Calendar
  status, and Legal Entity assignment, plus a 3-step "Add Ledger" wizard
  (Details → Assign COA Structure → Create Calendar, steps 2/3 skippable).
- This build's spec asserted the live GET /ledgers response uses `name`/
  `functionalCurrency`/`coaStructureId`, which conflicts with the `Ledger`
  type's existing required `ledgerName`/`currency` fields (confirmed live
  and already consumed by 3 pages — see Enterprise Structure section
  above). Rather than trust one spec over the other and risk breaking
  existing consumers, `Ledger` was extended with new **optional** fields
  (`name`, `functionalCurrency`, `coaStructureId`) alongside the existing
  ones. New display code reads `ledger.name ?? ledger.ledgerName` and
  `ledger.functionalCurrency ?? ledger.currency` via helpers
  `ledgerDisplayName()`/`ledgerCurrency()` in LedgerSetupPage.tsx, so the
  page works regardless of which field name the backend actually sends.
  Worth re-confirming against a live backend and collapsing to one field
  name once verified.
- "Assigned to Legal Entity" has no reverse-lookup-by-ledger endpoint (only
  GET /legal-entity-ledgers?legalEntityId, scoped to one LE). To correctly
  show assignment for ledgers linked to *any* legal entity (not just the
  logged-in user's own LE — needed for the documented demo flow, which
  assigns a newly created ledger to a different LE), loadAll() fetches
  listLegalEntityLedgers for every Legal Entity in the business group
  (Promise.all) and flattens the results into one lookup map keyed by
  ledgerId, rather than a single call scoped to `user.legalEntityId`.
- Calendar creation (wizard step 3 and the inline "Create Calendar" modal)
  only collects Name / Fiscal Year Start Month / Period Type / Initial
  Fiscal Year, per this spec's field list — `fiscalYearStartDay` is not a
  form field here (unlike Enterprise Structure's calendar modal) and is
  hardcoded to `1`.
- Period Type options are MONTHLY/QUARTERLY only for this screen (per
  spec), narrower than Enterprise Structure's calendar modal which also
  offers FISCAL_4_4_5 — each page keeps its own local constant.
- Calendar card display omits a computed "April 1 → March 31" date range
  (shown in the build spec's mockup) since `AccountingCalendar` has no
  end-date field — only `fiscalYearStartMonth`/`fiscalYearStartDay` are
  known, and deriving an end date would require guessing day-of-month
  math. Shows Period Type / periods-per-year / current FY / generated
  count instead, matching the existing Enterprise Structure calendar card.
- "Generate Next FY" confirm dialog uses the calendar's `name` in its
  confirmation text ("periods on calendar '{name}'?") rather than
  computing/guessing the next fiscal year label, since
  `AccountingCalendar.currentFiscalYear`'s exact string format isn't
  confirmed — same wording already used in Enterprise Structure's confirm.
- Dynamic Insert toggle reuses AccountCombinationsPage's exact
  confirm-before-OFF pattern (turn ON is immediate, turn OFF requires an
  inline Yes/No), condensed into a single handler prop
  (`onRequestToggleOff`) that sets the confirm flag on first click and
  performs the toggle on the second (confirming) click.
- `getLedger` was added to gl.ts per convention (mirrors `getCoaStructure`)
  but has no call site on this screen — the page only ever needs the list
  response; kept for parity/future use, not wired to a route.
- Verified via `tsc -b` (clean), `vite build` (clean), `oxlint` (no
  warnings), and a dev-server boot check that GET /ledger-setup returns
  200. The backend wasn't running in this environment (curl to :8080
  returned no response), so the live wizard/assign/toggle/calendar flows
  against real API data were not exercised — same limitation as the
  Enterprise Structure and COA Structure builds above.
