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

## LE↔Ledger Assignment moved to Enterprise Structure (August 2026)
- LE↔Ledger assignment is now a single-owner flow: created/edited only from
  Enterprise Structure Tab 1 ("Assign Ledger" on each Legal Entity card).
  LedgerSetupPage.tsx's "Assign to Legal Entity" button/modal
  (`AssignToLegalEntityModal`, `assignLELedger` state,
  `ASSIGN_LEDGER_CATEGORIES` constant, the `linkLegalEntityLedger` import)
  were removed entirely. The ledger card's assignment section is now
  read-only: 0 links → grey "Not assigned to any Legal Entity", 1 link →
  "Assigned to: {name}", 2+ → "Assigned to: {count} Legal Entities" (no
  per-name list, per the build ask). `listLegalEntityLedgers` is still
  called per Legal Entity (unchanged aggregation pattern) purely to
  render this read-only status — `LedgerCard` takes `leLinks:
  LegalEntityLedger[]` instead of a single `leLink`. The now-unused
  `legalEntities`/`listLegalEntities` fetch on this page was removed too
  (it existed only to populate the deleted modal's LE dropdown).
- EnterpriseStructurePage.tsx Tab 1 gained the inverse action: an "Assign
  Ledger" button on every LE card, opening `AssignLedgerModal` (Ledger
  dropdown + Ledger Category dropdown, POST via the same
  `linkLegalEntityLedger`). The Ledger dropdown is sourced from
  `listLedgers()` called with **no** `legalEntityId` — `gl.ts`'s
  `listLedgers` signature changed from `(legalEntityId: string)` to
  `(legalEntityId?: string)` (params omitted when absent) so this one
  call can return every ledger in the system for the assign picker,
  while every existing scoped caller is unaffected. Loaded once on mount
  into an `allLedgers` state, independent of `selectedLEId`.
  `ledgerDisplayName()`/`ledgerCurrency()` helpers (reading
  `ledger.name ?? ledger.ledgerName` / `functionalCurrency ?? currency`)
  are duplicated here from LedgerSetupPage.tsx, matching this codebase's
  existing per-file small-helper convention.
- Each Tab 1 LE card also now shows "Assigned Ledger: {code} {name}" (or
  an amber-dot "Not assigned" indicator) sourced from a new
  `leLedgerLinks: Record<legalEntityId, LegalEntityLedger[]>` map,
  populated inside `loadLegalEntities()` via
  `Promise.all(data.map(le => listLegalEntityLedgers(le.id)))` right
  after the LE list loads (same shape as LedgerSetupPage's aggregation).
  Only the first link is shown on the card (singular "Assigned Ledger"
  per the build ask); `onAssigned` on the new modal re-runs
  `loadLegalEntities()` so both the LE list and this map refresh
  together.
- Tab 2's "No Ledger Assigned" empty state now carries two distinct
  pieces of guidance rather than one: the literal instructional line
  ("No Ledger assigned. Assign a Ledger from the Legal Entities tab.")
  plus the pre-existing `/ledger-setup` link, reworded to "Create a
  Ledger in Ledger Setup →". These serve different cases — assigning an
  *existing* ledger (now a Tab 1 action) vs. creating a brand new one
  (still only possible in Ledger Setup) — so both were kept on the same
  card instead of picking one.
- Verified via `tsc -b` (clean), `vite build` (clean), `oxlint` (no
  warnings), and boot checks on both `/enterprise` and `/ledger-setup`
  (200). No backend was running, so the live assign/unassign round trip
  wasn't exercised against real data.

## Enterprise Structure — Selected LE context fix (August 2026)
- EnterpriseStructurePage.tsx already had a `selectedLEId` state (default
  `user?.legalEntityId`) driving Tab 2/3 loads — the actual bug was that
  only the small "View Details" button set it, not the LE card itself, so
  clicking a card without pressing that button left Tab 2 showing stale
  data. Fixed by adding `onClick={() => setSelectedLEId(le.id)}` to the
  whole Card, with `e.stopPropagation()` on the card's inner
  buttons/links (View Details, Edit, View Ledger →, View Business Units →)
  so they keep their own behavior without double-triggering.
- Selected-card highlight is `ring-2 ring-blue` (in addition to the
  existing `accent` left-border) since the left-border accent alone read
  as too subtle for a "this is the active context" indicator across a
  grid of cards.
- Tab 2 gained an explicit `Ledger & Calendar — {selectedLE.name}` header
  (Tab 3's `Business Units — {selectedLE.name}` header already existed).
- Ledger/Calendar creation now lives only in Ledger Setup
  ([[Ledger Setup Screen]] section above) — `CreateLedgerModal` and
  `CreateCalendarModal` (plus their now-unused form state/constants:
  `showCreateLedgerModal`, `showCreateCalendarModal`, `FINANCE_MODES`,
  `LEDGER_CATEGORIES`, `CURRENCIES`, `PERIOD_TYPES`, `MONTHS`, and the
  `createLedger`/`linkLegalEntityLedger`/`createCalendar`/
  `generateInitialPeriods` imports) were deleted from this page entirely.
  The "No Ledger Assigned" / "No Calendar Configured" empty states now
  render a `<Link to="/ledger-setup">` guidance link instead of an
  in-page create button. "Generate Next FY" was left in place (it extends
  an *existing* calendar rather than creating one, and wasn't part of the
  removal ask).
- Verified via `tsc -b` (clean), `vite build` (clean), `oxlint` (no
  warnings), and a dev-server boot check (`GET /enterprise` → 200). No
  backend was running, so the live card-click → Tab 2 refresh flow was
  not exercised end-to-end against real data.

## Dimension Values Screen (August 2026)
- DimensionValuesPage.tsx (/dimension-values) — tab-per-dimension screen
  driven by `getCoaStructureByLedger(ledgerId)` (ledger resolved from
  `listLedgers(user.legalEntityId)[0]`), with segments sorted by
  `segmentNumber` as the tab order. `CoaSegmentSummary.id` is used directly
  as `financeDimensionId` for `listDimensionValues`, per the confirmed API
  shape.
- Deviated from the build spec's literal "lazy load only the active tab"
  instruction: on initial load, values for **all** dimensions are fetched
  in parallel (`Promise.all`) rather than one at a time on tab click. This
  was necessary because the spec's own summary cards (Total Values /
  Postable Values / Summary Values) require a sum **across all
  dimensions**, and `CoaSegmentSummary` has no isSummary/isPostable
  breakdown — only a per-dimension `valueCount`. With a small, fixed
  dimension count (Natural Account/Cost Centre/Product today), eager
  parallel loading keeps the summary cards accurate and makes tab
  switching instant (no per-tab skeleton), traded off against the spec's
  literal lazy-load-on-click UX. TableSkeleton still covers the single
  initial page load.
- Tab labels use `dimensionTypeLabel()` from `src/utils/coaStructure.ts`
  (already shared with CoaStructurePage) rather than a new helper.
- Add/Edit Value modal exposes **Parent Value** for every dimension type
  (not just Natural Account, unlike the old FinanceDimensionsPage panel)
  per this spec's explicit "ALL types" field list. `validFrom`/`validTo`/
  `budgetControlled` from the old panel were dropped — not in this spec's
  field list, so not carried over (avoids scope creep beyond the ask).
- Tree View: NATURAL_ACCOUNT groups by `accountQualifier` in a fixed
  ASSET→LIABILITY→EQUITY→REVENUE→EXPENSE order, each group header
  literally labelled "{QUALIFIER} (Summary)" per the spec's mockup (this
  is a synthetic grouping label, not a real DimensionValue row). For
  other dimension types, groups by `parentValueId`/`parentValueCode` if
  any value has a parent set; since seed data has no hierarchy yet
  (`parentValueId=null` for all), Tree View falls back to the same flat
  table render with a "No hierarchy defined yet" note, exactly as the
  spec anticipates.
- "Set/Clear Default" and the Default column are gated on
  `!activeDimension.isRequired` (data-driven), not hardcoded to
  "Cost Centre/Product" as the spec's parenthetical example suggested —
  matches the existing convention from the old DimensionValuesPanel.
- **DimensionValuesPanel.tsx deleted** (was only ever used from
  FinanceDimensionsPage.tsx's now-removed "Manage Values" button/slide-
  over) — its field logic was carried into DimensionValuesPage.tsx's
  modal instead of being kept as dead code.
- FinanceDimensionsPage.tsx: "Manage Values" button + slide-over replaced
  with a "Manage dimension values in the Dimension Values screen →" link
  to `/dimension-values` (shown when `gl:dimension:view` is granted); its
  Actions column is now Edit-only (`canManage`), since value management
  moved off this page entirely.
- Sidebar.tsx: "Dimension Values" added under Accounting Configuration
  (right after COA Structure); "Chart of Accounts" removed from the
  sidebar per the build spec, but the route/page were intentionally left
  in App.tsx (not deleted) since COA Structure + Dimension Values now
  supersede it in the nav only, not in code.
- Verified via `tsc -b` (clean), `vite build` (clean), `oxlint` (no new
  warnings), and dev-server boot checks (`/dimension-values` and
  `/finance-dimensions` both → 200). No backend was running in this
  environment, so the live tab/add/edit/tree-view/set-default flows
  against real API data were not exercised — same limitation noted on
  every other screen built this way (see Enterprise Structure, COA
  Structure, Ledger Setup sections above).

## Dimension Values Screen (August 2026)
- Route: /dimension-values
- Loads dimensions from getCoaStructureByLedger() — tab per segment
- All dimension values eager-loaded in parallel (not lazy) for summary cards
- Tree View groups NATURAL_ACCOUNT by accountQualifier
- Set/Clear Default only shown for optional dimensions (isRequired=false)
- DimensionValuesPanel.tsx deleted — logic moved to DimensionValuesPage.tsx
- Chart of Accounts removed from sidebar (route kept in App.tsx)
- Finance Dimensions — Manage Values panel removed, link to /dimension-values added

## V30a Balancing Segment UI (August 2026)
- Config-only (display + set/clear flags). No PostingEngine enforcement —
  that's V30b. Backend confirmed CoaSegmentSummary now returns isBalancing
  (boolean) + balancingSequence (2 | 3 | null) per segment.
- CoaSegmentSummary and FinanceDimension types both extended with these
  fields (FinanceDimension's are optional since not every caller of
  listFinanceDimensions cares about balancing).
- updateFinanceDimension's body type extended with isBalancing/
  balancingSequence — used by CoaStructureEditPanel's new Set/Clear
  Balancing controls in the Segment Manager (max 2 secondary balancing
  segments per structure: sequence 2 + 3; "Set as Balancing" only offers
  sequences not already taken elsewhere on the structure; NATURAL_ACCOUNT
  never gets the toggle — it's the account-type segment, not balancing).
- balancingBadge() (2nd Balancing/purple, 3rd Balancing/indigo) added to
  src/utils/coaStructure.ts, shared by CoaStructurePage, the edit panel's
  Segment Manager, and DimensionValuesPage's tab-content header.
- getBalancingDimensions() added to gl.ts per the build spec's required
  API list but has no UI call site (same "added for parity, not wired to
  a screen" pattern as getLedger — see Ledger Setup section above).
- CoaStructurePage card: static "Legal Entity is always the primary
  balancing segment (implicit)" line + a derived "Balancing Segments:
  Legal Entity (primary) + X (secondary)" summary line (Legal Entity
  itself is never a finance_dimension row, so this is not sourced from
  segments — only the "+ X" part is).
- DimensionValuesPage: ⚖ appended to a tab label when that dimension's
  isBalancing=true; purple/indigo info banner shown above the table/tree
  only on the active tab when it's balancing, explicitly noting
  "PostingEngine enforcement: coming in V30b".
- Verified via `tsc -b` (clean), `vite build` (clean), `oxlint` (no new
  warnings), and dev-server boot checks on `/coa-structure` and
  `/dimension-values` (both → 200). No backend was running in this
  environment, so the live Set/Clear Balancing round trip against real
  API data was not exercised — same limitation as prior COA/Enterprise
  Structure builds.
- Follow-up: Set/Clear Balancing buttons in CoaStructureEditPanel.tsx are
  disabled (native `title` tooltip: "Cannot change balancing configuration
  after journals are posted.") once the ledger's legal entity has any
  POSTED journal — checked via `listJournals({ legalEntityId,
  status: 'POSTED', size: 1 })` on panel mount, using the existing
  `listJournals`/`Page<T>` from gl.ts (no new API function added/
  redeclared). An amber warning banner ("⚠️ Balancing configuration is
  locked — journals have been posted to this ledger. This setting cannot
  be changed after posting.") renders at the top of the Segment Manager
  section whenever `isLocked` is true. `legalEntityId` is a required prop
  on `CoaStructureEditPanel`; CoaStructurePage.tsx only renders the panel
  when both `editingStructure` and `user` are present (`user &&`), so it
  can pass `user.legalEntityId` without a non-null assertion. The check
  fails soft — an error leaves `isLocked=false` (buttons enabled),
  matching this codebase's other fail-soft lookups (GST card, KPI
  trial-balance) rather than blocking the panel.

## V30a Balancing Segment UI (August 2026)
- COA Structure: balancing badges (purple=2nd, indigo=3rd) per segment
- Edit Panel: Set/Clear Balancing locked when ledger has posted journals
- Lock check: listJournals POSTED size=1 → content.length > 0 = locked
- Amber warning banner when locked, disabled buttons with tooltip
- DimensionValuesPage: ⚖ icon on tab + purple banner when isBalancing=true
- Legal Entity always shown as implicit primary (not a finance_dimension row)
- NATURAL_ACCOUNT excluded from balancing toggle (account type, not balancing)

## V30b Balancing Segment Journal Entry Warning (August 2026)
- JournalEntryPage.tsx: on mount (inside the existing lookups useEffect,
  after finance dimensions/dim values load), fetches
  `getCoaStructureByLedger(ledger.id)` → `getBalancingDimensions(coaStructure.id)`
  into a new `balancingDimensions: FinanceDimension[]` state, wrapped in its
  own inner try/catch (fail-soft — a failure here never blocks the rest of
  page load or sets the page-level lookup error, same pattern as the
  KPI/GST fail-soft fetches on DashboardPage).
- `balancingError: string | null` state holds the backend's literal message
  when `POST /gl/journals` fails with `error.response.data.code ===
  'BALANCING_SEGMENT_CROSSED'` — shown as a purple/indigo banner below the
  totals bar (not a generic toast). Any other error code still falls
  through to the existing generic toast. Cleared on every `updateLine()`
  call (any line edit) and at the start of every `handleSave()` attempt.
- Client-side `detectBalancingCrossing()` is a best-effort pre-submission
  check only (real enforcement is server-side PostingEngine Rule 11): for
  each dimension in `balancingDimensions`, collects the distinct
  costCentreCode/productCode across lines that have an account selected,
  and returns a warning string if more than one distinct value is found.
  Rendered as an amber (not red/purple) warning below the totals bar,
  suppressed whenever `balancingError` is already showing (avoids showing
  both an amber pre-check warning and a purple confirmed-rejection banner
  at once).
- Info note ("⚖ Balancing segments active: …") rendered above the lines
  table only when `balancingDimensions.length > 0` — empty for ledgers
  with no balancing segments configured (e.g. Orbinox), matching the
  no-balancing-dims fallback used throughout the V30a UI work.

## V30b Balancing Segment Journal Entry Warning (August 2026)
- BALANCING_SEGMENT_CROSSED error code → purple banner (not generic toast)
- balancingError state: cleared on line edit + on each save attempt
- balancingDimensions: loaded via getCoaStructureByLedger + getBalancingDimensions
- Pre-submission warning: amber (client-side, best-effort)
- Post-submission error: purple (authoritative, from backend)
- Info note: shown above lines table only when balancing dims configured
- All 3 changes hidden for Orbinox (balancingDimensions=[])
- getBalancingDimensions fail-soft — never breaks page load

## GitHub Repository (August 2026)
- Transferred from prashantha-vyoog to evyoog org
- Backend:  https://github.com/evyoog/evyoog-gl
- Frontend: https://github.com/evyoog/evyoog-frontend

## V31 WHO Columns UI Fix (August 2026) deviations
- updateRole / updateApprovalPolicy kept their existing, already-working
  HTTP method and endpoint (PUT /api/v1/auth/roles/{id} and
  PUT /api/v1/auth/approval-policies/{id}, both already wired up and used
  elsewhere in this file, e.g. deleteApprovalPolicy's plural path) —
  did NOT switch to the build spec's stated "PATCH .../roles/{id}" or the
  singular "PATCH .../approval-policy/{id}", since neither was confirmed
  and both existing endpoints already work. Only `updatedBy: string` was
  added to each request body type + call site.
- updateApprovalPolicy's body keeps the real, already-used field names
  (journalSourceCode, requiresApproval, businessUnitId, inventoryOrgId,
  approvalThresholdAmount, approverRoleCode) — did NOT adopt the build
  spec's suggested { minAmount, requiredRoleCode, isActive } shape, which
  doesn't match the `ApprovalPolicy` type or any existing caller and
  looks like a guessed/wrong field set for this endpoint (see CLAUDE.md's
  standing rule not to guess backend field names).
- updateUser is genuinely new (no prior update-user call existed on
  UserManagementPage.tsx — only createUser/deactivateUser/
  resetUserPassword). Added `updateUser` (PATCH /api/v1/auth/users/{id},
  body { fullName?, isActive?, updatedBy }) to users.ts, plus a new "Edit"
  button + modal (Full Name, Active checkbox) on UserManagementPage.tsx,
  since editing a user's fullName/isActive had no UI entry point before.
  Left the existing separate Deactivate button/deactivateUser endpoint
  untouched — Edit is an additive flow, not a replacement.
- `Role`, `ApprovalPolicy`, and `AppUser` types extended with optional
  `updatedBy?: string | null` and `updatedAt?: string | null`. Only
  `updated_by` was confirmed added to these tables by the V31 backend
  migration per the build spec; `updatedAt` was added alongside it as a
  reasonable pairing (WHO display needs a timestamp to show next to the
  email) rather than a separately confirmed field — worth confirming
  against a live backend response.
- WHO display only shows "Last updated by {email} on {date}" (gated on
  `updatedBy` being truthy) — did NOT add a "Created by" line, since no
  `createdBy` field was confirmed added to Role/ApprovalPolicy by this
  migration (`AppUser` already had `createdAt` but never had `createdBy`).
- Verified via `tsc -b` (clean), `oxlint` (clean), and `vite build`
  (clean). No backend was running in this environment, so the live
  updatedBy round trip (PATCH /users/{id}, and the updatedBy field
  actually coming back on GET responses) was not exercised against real
  API data — same limitation noted on every other screen built this way.

## V31 WHO Columns Frontend (August 2026)
- updatedBy: user?.email ?? 'SYSTEM' passed in Role + ApprovalPolicy updates
- New updateUser() in users.ts → PATCH /api/v1/auth/users/{id}
- New Edit User modal in UserManagementPage (fullName + isActive)
- "Last updated by [email] on [date]" shown in edit panels when updatedBy present
- updatedBy/updatedAt added as optional to Role, ApprovalPolicy, AppUser types
- Kept existing PUT endpoints (not PATCH) — matched real API

## AIE Excel/CSV Import UI (August 2026)
- AieImportPage.tsx (/aie-import) — Configuration card (Period/Source/
  Download Template) → Upload card (drag-drop or click-to-browse .xlsx,
  10MB cap) → Result card (Success/Partial/Failed, branched on
  `AieImportResponse.status` + `errorLines`), per the build spec's 3-step
  layout. Permission-gated on `gl:journal:create` (same as Journal Entry),
  added to Sidebar.tsx under Finance right after Journal Listing.
- New types (`AieImportResponse`, `AieLineError`, `BatchStatus`) added to
  types/index.ts and new API functions (`downloadAieTemplate`,
  `importAieExcel`, `getBatchStatus`, `getBatchErrors`) added to gl.ts per
  the spec's confirmed-live shapes. `resubmitBatch` (POST
  /aie/batches/{id}/resubmit) was also added for API-surface parity with
  the documented endpoint list, but — like `getBalancingDimensions`/
  `getLedger` before it — has no UI call site on this screen (Phase 1
  scope only covers upload → result, not batch retry).
- Legal Entity + Ledger resolved the same way as JournalEntryPage:
  `user.legalEntityId` from AuthContext, then `listLedgers(legalEntityId)[0]`.
  Open periods use the same `getPeriodStatus(legalEntityId).filter(p =>
  p.status === 'OPEN')` pattern already established there — did NOT add a
  second call to `listAccountingPeriods`/`getAccountingCalendar` since
  `PeriodStatus` already carries `periodName` + `accountingPeriodId`,
  which is all this screen's dropdown needs.
- Per the build spec's explicit "Phase 1" note, Import History/batch-list
  was skipped entirely (no "list all batches" endpoint exists) — the
  screen only ever shows the current session's single import result, not
  a persisted history list. `getBatchStatus`/`getBatchErrors` were added
  to gl.ts per the confirmed API list but have no call site yet (would
  back a Phase 2 history/retry view).
- "View Journal →" navigates to `/journals?search={journalNumber}` as the
  spec asks, but JournalListingPage never had a search feature (confirmed
  in the P1 Retrofit Layer 3 section above — "no free-text search input
  ... N/A"). Rather than invent a backend search/filter param (against
  CLAUDE.md's standing rule not to guess backend contracts),
  JournalListingPage.tsx was given a small additive enhancement: it now
  reads a `search` query param via `useSearchParams`, shows a dismissible
  "Showing journal {number} from import" banner, and highlights the
  matching row (by `journalNumber`) with a blue ring/background — purely
  client-side against whatever page of results already loaded, with no
  new API call. If the imported journal isn't on the currently loaded
  page, the highlight simply won't find a match; no pagination-jump logic
  was added (out of scope for this build).
- File validation (`.xlsx` extension + 10MB cap) is client-side only, via
  `validateAndSetFile()` — shown as an inline amber warning (not a toast),
  per spec. Drag-and-drop (`onDragOver`/`onDragLeave`/`onDrop`) is newly
  built for this screen; no existing drag-drop component/pattern existed
  elsewhere in the codebase to reuse (ChartOfAccountsPage's importer uses
  a plain `<input type="file">`, no drag-drop).
- Verified via `tsc -b` (clean), `oxlint` (no new warnings), `vite build`
  (clean), and dev-server boot checks on `/aie-import` and `/journals`
  (both → 200). No backend was running in this environment, so the live
  template-download / upload-and-import round trip against real API data
  was not exercised — same limitation as every other screen built this
  way (see Enterprise Structure, COA Structure, Ledger Setup sections
  above).

## Opening Balance Import UI (September 2026)
- OpeningBalanceImportPage.tsx (/opening-balance-import) — Config → Upload →
  Preview → Result, following the same drag-drop/period-dropdown pattern as
  AieImportPage.tsx. Permission: gl:journal:create. Sidebar: Finance section,
  right after Journal Import.
- Two-step flow is enforced in the UI: POST /opening-balances/preview always
  runs first (Preview Balances button), and POST /opening-balances/import
  (Post Opening Balances button) only appears/enables once
  `preview.isBalanced && preview.errorLines === 0` — never auto-posts.
- The same `File` object in state is reused for both the preview and import
  calls (no re-upload prompt between steps), per the build spec.
- New API functions `downloadObTemplate`, `previewOpeningBalances`,
  `importOpeningBalances` added to gl.ts; new types
  `OpeningBalancePreviewLine`, `OpeningBalancePreviewResponse`,
  `OpeningBalanceImportResponse` added to types/index.ts.
- Qualifier badge colors (ASSET=blue, LIABILITY=amber, EQUITY=green,
  REVENUE=purple, EXPENSE=red) and DR/CR badge colors (DR=navy, CR=slate)
  match the build spec exactly.
- "View Journal →" reuses the existing `/journals?search={journalNumber}`
  + JournalListingPage highlight pattern from AIE Import — no new wiring
  needed there.
- Verified via `tsc -b` (clean), `oxlint` (clean), `vite build` (clean), and
  dev-server boot checks on `/opening-balance-import` and `/journals` (both
  → 200). No backend was running in this environment, so the live
  preview/post round trip against real API data was not exercised — same
  limitation noted on every other screen built this way.

## AIE Excel Import Screen (August 2026)
- Route: /aie-import — Permission: gl:journal:create
- Sidebar: Finance section after Journal Listing
- 3-step flow: Config → Upload → Result
- Template download: GET /api/v1/aie/excel/template (blob download)
- Upload: POST /api/v1/aie/excel/import (multipart/form-data)
- Query params: legalEntityId, ledgerId, accountingPeriodId, createdBy, sourceSystem
- Only OPEN periods shown in period dropdown
- File validation: .xlsx only, max 10MB — inline error (not toast)
- Result: POSTED=green, PARTIAL=amber, FAILED=red
- Error table: Line# | Error Code | Error Message | Field
- CSV error export: client-side blob download
- View Journal: navigates to /journals?search={journalNumber}
- JournalListingPage: added search query param + client-side row highlight
- Import History: Phase 2 (no list-batches endpoint yet)
- getBatchStatus/getBatchErrors/resubmitBatch: added to gl.ts, unused Phase 1
