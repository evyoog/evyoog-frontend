import { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../components/layout/AppLayout';
import { Card, Button, Input, Select, Modal, CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  listLedgers,
  createLedger,
  updateLedger,
  getAccountingCalendar,
  createCalendar,
  generateInitialPeriods,
  generateNextYearPeriods,
  toggleDynamicInsert,
  assignCoaStructureToLedger,
  listLegalEntityLedgers,
  listCoaStructures,
  listLegalEntities,
} from '../api/gl';
import type { Ledger, AccountingCalendar, LegalEntityLedger, CoaStructure } from '../types';
import { formatDate } from '../utils/format';
import { buildCombinationPreview } from '../utils/coaStructure';

const BUSINESS_GROUP_ID = 'c1338b23-c1e6-4f4e-9d87-8e60b49bb432';

const FINANCE_MODE_OPTIONS = [
  { value: 'THICK', description: 'Full GL posting with account balances (recommended)' },
  { value: 'THIN', description: 'Summary posting only' },
  { value: 'EVENT_ONLY', description: 'Event capture without GL posting' },
];
const LEDGER_CATEGORIES = ['PRIMARY', 'SECONDARY', 'REPORTING', 'ENCUMBRANCE'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'];
const ACCOUNTING_STANDARDS = ['IND_AS', 'IGAAP', 'IFRS', 'US_GAAP'];
const PERIOD_TYPES = ['MONTHLY', 'QUARTERLY'];
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

function ledgerDisplayName(l: Ledger): string {
  return l.name ?? l.ledgerName;
}

function ledgerCurrency(l: Ledger): string {
  return l.functionalCurrency ?? l.currency;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const message = axios.isAxiosError(err)
    ? (err.response?.data as { message?: string } | undefined)?.message
    : undefined;
  return message || fallback;
}

function coaStructureLabel(s: CoaStructure): string {
  return `${s.code} — ${s.name} (${s.segmentCount} segments)`;
}

function coaStructurePreview(s: CoaStructure): string {
  return buildCombinationPreview(
    s.segments.map((seg) => seg.code),
    s.separator,
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        isActive ? 'bg-green-light text-green' : 'bg-slate-100 text-slate'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Ledger — 3-step wizard
// ---------------------------------------------------------------------------

interface LedgerDetailsForm {
  code: string;
  name: string;
  description: string;
  financeMode: string;
  ledgerCategory: string;
  functionalCurrency: string;
  accountingStandard: string;
}

const EMPTY_LEDGER_DETAILS: LedgerDetailsForm = {
  code: '',
  name: '',
  description: '',
  financeMode: 'THICK',
  ledgerCategory: 'PRIMARY',
  functionalCurrency: 'INR',
  accountingStandard: 'IND_AS',
};

interface WizardCalendarForm {
  name: string;
  fiscalYearStartMonth: number;
  periodType: string;
  initialFiscalYear: number;
}

function emptyWizardCalendarForm(): WizardCalendarForm {
  return { name: '', fiscalYearStartMonth: 4, periodType: 'MONTHLY', initialFiscalYear: new Date().getFullYear() };
}

function AddLedgerWizard({
  coaStructures,
  onClose,
  onCreated,
}: {
  coaStructures: CoaStructure[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [details, setDetails] = useState<LedgerDetailsForm>(EMPTY_LEDGER_DETAILS);
  const [detailErrors, setDetailErrors] = useState<Partial<Record<keyof LedgerDetailsForm, string>>>({});
  const [coaStructureId, setCoaStructureId] = useState('');
  const [calendarForm, setCalendarForm] = useState<WizardCalendarForm>(emptyWizardCalendarForm());
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const activeCoaStructures = coaStructures.filter((s) => s.isActive);
  const selectedCoaStructure = activeCoaStructures.find((s) => s.id === coaStructureId) ?? null;

  const validateStep1 = () => {
    const next: typeof detailErrors = {};
    if (!details.code.trim()) next.code = 'Code is required';
    else if (details.code.length > 30) next.code = 'Code must be 30 characters or fewer';
    if (!details.name.trim()) next.name = 'Name is required';
    else if (details.name.length > 255) next.name = 'Name must be 255 characters or fewer';
    setDetailErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFinish = async (includeCalendar: boolean) => {
    setSubmitError('');
    setSaving(true);
    try {
      const newLedger = await createLedger({
        code: details.code.trim().toUpperCase(),
        name: details.name.trim(),
        description: details.description.trim() || undefined,
        financeMode: details.financeMode,
        ledgerCategory: details.ledgerCategory,
        functionalCurrency: details.functionalCurrency,
        accountingStandard: details.accountingStandard,
      });

      if (coaStructureId) {
        try {
          await assignCoaStructureToLedger(coaStructureId, newLedger.id);
        } catch {
          showToast('Ledger created, but assigning the COA Structure failed. You can retry from the ledger card.', 'error');
        }
      }

      if (includeCalendar && calendarForm.name.trim()) {
        try {
          const cal = await createCalendar({
            ledgerId: newLedger.id,
            name: calendarForm.name.trim(),
            fiscalYearStartMonth: calendarForm.fiscalYearStartMonth,
            fiscalYearStartDay: 1,
            periodType: calendarForm.periodType,
            initialFiscalYear: calendarForm.initialFiscalYear,
          });
          try {
            await generateInitialPeriods(cal.id);
          } catch {
            showToast('Calendar created, but period generation failed. You can retry from the ledger card.', 'error');
          }
        } catch {
          showToast('Ledger created, but calendar creation failed. You can retry from the ledger card.', 'error');
        }
      }

      showToast(`Ledger "${ledgerDisplayName(newLedger)}" created successfully.`, 'success');
      onCreated();
      onClose();
    } catch (err) {
      setSubmitError(apiErrorMessage(err, 'Failed to create ledger. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      {step > 1 && (
        <Button variant="secondary" onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={saving}>
          ← Back
        </Button>
      )}
      <span className="flex-1" />
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      {step === 1 && (
        <Button
          onClick={() => {
            if (validateStep1()) setStep(2);
          }}
        >
          Next →
        </Button>
      )}
      {step === 2 && (
        <>
          <Button variant="secondary" onClick={() => setStep(3)} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={() => setStep(3)}>Next →</Button>
        </>
      )}
      {step === 3 && (
        <>
          <Button variant="secondary" onClick={() => handleFinish(false)} loading={saving}>
            Skip for now
          </Button>
          <Button onClick={() => handleFinish(true)} loading={saving}>
            Create Ledger
          </Button>
        </>
      )}
    </>
  );

  return (
    <Modal title="Add Ledger" subtitle={`Step ${step} of 3`} onClose={onClose} widthClassName="max-w-xl" footer={footer}>
      {submitError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-navy">Ledger Details</p>
          <Input
            id="wiz-code"
            label="Code"
            required
            maxLength={30}
            placeholder="PRIM-KA-01"
            value={details.code}
            onChange={(e) => setDetails({ ...details, code: e.target.value.toUpperCase() })}
            error={detailErrors.code}
          />
          <Input
            id="wiz-name"
            label="Name"
            required
            maxLength={255}
            placeholder="Primary Ledger Karnataka"
            value={details.name}
            onChange={(e) => setDetails({ ...details, name: e.target.value })}
            error={detailErrors.name}
          />
          <div>
            <label htmlFor="wiz-description" className="mb-1 block text-sm font-medium text-navy">
              Description
            </label>
            <textarea
              id="wiz-description"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue focus:outline-none"
              rows={2}
              value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })}
            />
          </div>
          <Select
            id="wiz-finance-mode"
            label="Finance Mode"
            required
            value={details.financeMode}
            onChange={(e) => setDetails({ ...details, financeMode: e.target.value })}
          >
            {FINANCE_MODE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.value} — {m.description}
              </option>
            ))}
          </Select>
          <Select
            id="wiz-ledger-category"
            label="Ledger Category"
            value={details.ledgerCategory}
            onChange={(e) => setDetails({ ...details, ledgerCategory: e.target.value })}
          >
            {LEDGER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            id="wiz-currency"
            label="Functional Currency"
            required
            value={details.functionalCurrency}
            onChange={(e) => setDetails({ ...details, functionalCurrency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            id="wiz-standard"
            label="Accounting Standard"
            required
            value={details.accountingStandard}
            onChange={(e) => setDetails({ ...details, accountingStandard: e.target.value })}
          >
            {ACCOUNTING_STANDARDS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-navy">Assign COA Structure</p>
          <p className="text-sm text-slate">
            Choose the Chart of Accounts structure this ledger will use. You can also assign this later
            from the ledger card.
          </p>
          <Select
            id="wiz-coa-structure"
            label="COA Structure"
            value={coaStructureId}
            onChange={(e) => setCoaStructureId(e.target.value)}
          >
            <option value="">Not assigned — skip for now</option>
            {activeCoaStructures.map((s) => (
              <option key={s.id} value={s.id}>
                {coaStructureLabel(s)}
              </option>
            ))}
          </Select>
          {selectedCoaStructure && (
            <div className="rounded-md border border-border bg-offwhite px-3 py-2 text-sm">
              <span className="text-slate">Combination format: </span>
              <span className="font-mono text-navy">{coaStructurePreview(selectedCoaStructure)}</span>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-navy">Create Calendar (optional but recommended)</p>
          <Input
            id="wiz-cal-name"
            label="Name"
            placeholder="FY Calendar 2025-26"
            value={calendarForm.name}
            onChange={(e) => setCalendarForm({ ...calendarForm, name: e.target.value })}
          />
          <Select
            id="wiz-cal-month"
            label="Fiscal Year Start Month"
            value={calendarForm.fiscalYearStartMonth}
            onChange={(e) => setCalendarForm({ ...calendarForm, fiscalYearStartMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select
            id="wiz-cal-period-type"
            label="Period Type"
            value={calendarForm.periodType}
            onChange={(e) => setCalendarForm({ ...calendarForm, periodType: e.target.value })}
          >
            {PERIOD_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Input
            id="wiz-cal-fy"
            label="Initial Fiscal Year"
            type="number"
            value={calendarForm.initialFiscalYear}
            onChange={(e) => setCalendarForm({ ...calendarForm, initialFiscalYear: Number(e.target.value) })}
          />
          <p className="text-xs text-slate">For Apr 2025 – Mar 2026, enter 2025.</p>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Inline action modals
// ---------------------------------------------------------------------------

function AssignCoaStructureModal({
  ledger,
  coaStructures,
  onClose,
  onAssigned,
}: {
  ledger: Ledger;
  coaStructures: CoaStructure[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState(ledger.coaStructureId ?? '');
  const [saving, setSaving] = useState(false);
  const activeCoaStructures = coaStructures.filter((s) => s.isActive);
  const selected = activeCoaStructures.find((s) => s.id === selectedId) ?? null;

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await assignCoaStructureToLedger(selectedId, ledger.id);
      showToast('COA Structure assigned successfully.', 'success');
      onAssigned();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to assign COA Structure. Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Assign COA Structure"
      subtitle={ledgerDisplayName(ledger)}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!selectedId}>
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          id="assign-coa-structure"
          label="COA Structure"
          required
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a structure</option>
          {activeCoaStructures.map((s) => (
            <option key={s.id} value={s.id}>
              {coaStructureLabel(s)}
            </option>
          ))}
        </Select>
        {selected && (
          <div className="rounded-md border border-border bg-offwhite px-3 py-2 text-sm">
            <span className="text-slate">Combination format: </span>
            <span className="font-mono text-navy">{coaStructurePreview(selected)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateCalendarModal({
  ledger,
  onClose,
  onCreated,
}: {
  ledger: Ledger;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<WizardCalendarForm>(emptyWizardCalendarForm());
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      const cal = await createCalendar({
        ledgerId: ledger.id,
        name: form.name.trim(),
        fiscalYearStartMonth: form.fiscalYearStartMonth,
        fiscalYearStartDay: 1,
        periodType: form.periodType,
        initialFiscalYear: form.initialFiscalYear,
      });
      try {
        await generateInitialPeriods(cal.id);
        showToast(
          `Calendar created with periods for FY ${form.initialFiscalYear}-${form.initialFiscalYear + 1}.`,
          'success',
        );
      } catch {
        showToast('Calendar created, but period generation failed. You can retry from this screen.', 'error');
      }
      onCreated();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to create calendar. Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create Accounting Calendar"
      subtitle={ledgerDisplayName(ledger)}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Create Calendar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          id="cal-name"
          label="Name"
          required
          placeholder="FY Calendar 2025-26"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={nameError}
        />
        <Select
          id="cal-month"
          label="Fiscal Year Start Month"
          required
          value={form.fiscalYearStartMonth}
          onChange={(e) => setForm({ ...form, fiscalYearStartMonth: Number(e.target.value) })}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select
          id="cal-period-type"
          label="Period Type"
          required
          value={form.periodType}
          onChange={(e) => setForm({ ...form, periodType: e.target.value })}
        >
          {PERIOD_TYPES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Input
          id="cal-fy"
          label="Initial Fiscal Year"
          type="number"
          required
          value={form.initialFiscalYear}
          onChange={(e) => setForm({ ...form, initialFiscalYear: Number(e.target.value) })}
        />
        <p className="text-xs text-slate">For Apr 2025 – Mar 2026, enter 2025.</p>
      </div>
    </Modal>
  );
}

function EditLedgerPanel({
  ledger,
  canManage,
  onClose,
  onSaved,
}: {
  ledger: Ledger;
  canManage: boolean;
  onClose: () => void;
  onSaved: (updated: Ledger) => void;
}) {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(ledgerDisplayName(ledger));
  const [description, setDescription] = useState(ledger.description ?? '');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      const updated = await updateLedger(ledger.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      showToast('Ledger updated successfully.', 'success');
      onSaved({ ...ledger, ...updated });
      handleClose();
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to update ledger. Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      <div
        className={`relative flex h-full w-[480px] max-w-full flex-col bg-white shadow-lg transition-transform duration-200 ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Edit Ledger</h2>
            <p className="mt-0.5 text-xs text-slate">{ledger.code}</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-slate hover:text-navy">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            <Input
              id="edit-ledger-name"
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              disabled={!canManage}
            />
            <div>
              <label htmlFor="edit-ledger-description" className="mb-1 block text-sm font-medium text-navy">
                Description
              </label>
              <textarea
                id="edit-ledger-description"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue focus:outline-none disabled:bg-offwhite disabled:text-slate"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canManage}
              />
            </div>

            <div className="mt-2 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Read-only Details</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate">
                <div>Code: {ledger.code ?? '—'}</div>
                <div>Finance Mode: {ledger.financeMode ?? '—'}</div>
                <div>Currency: {ledgerCurrency(ledger)}</div>
                <div>Standard: {ledger.accountingStandard ?? '—'}</div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Record Info</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate">
                <div>Created: {ledger.createdAt ? formatDate(ledger.createdAt) : '—'}</div>
                <div>Updated: {ledger.updatedAt ? formatDate(ledger.updatedAt) : '—'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          {canManage && (
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger card
// ---------------------------------------------------------------------------

function LedgerCard({
  ledger,
  calendar,
  leLinks,
  coaStructure,
  canManage,
  confirmingToggleOff,
  toggling,
  onRequestToggleOff,
  onCancelToggleOff,
  onToggleOn,
  onAssignCoa,
  onCreateCalendar,
  onGenerateNext,
  onEdit,
}: {
  ledger: Ledger;
  calendar: AccountingCalendar | null;
  leLinks: LegalEntityLedger[];
  coaStructure: CoaStructure | null;
  canManage: boolean;
  confirmingToggleOff: boolean;
  toggling: boolean;
  onRequestToggleOff: () => void;
  onCancelToggleOff: () => void;
  onToggleOn: () => void;
  onAssignCoa: () => void;
  onCreateCalendar: () => void;
  onGenerateNext: () => void;
  onEdit: () => void;
}) {
  return (
    <Card accent className="flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">
            {ledger.code ?? '—'}
          </p>
          <p className="mt-0.5 text-lg font-bold text-navy">{ledgerDisplayName(ledger)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge isActive={ledger.isActive ?? true} />
          {canManage && (
            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-slate">
        <span>Finance Mode: {ledger.financeMode ?? '—'}</span>
        <span className="text-border">│</span>
        <span>Currency: {ledgerCurrency(ledger)}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate">
        <span>Standard: {ledger.accountingStandard ?? '—'}</span>
        <span className="text-border">│</span>
        <span>Category: {ledger.ledgerCategory ?? '—'}</span>
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        {coaStructure ? (
          <p className="text-sm text-slate">
            COA Structure: <span className="font-medium text-navy">{coaStructure.code}</span>
          </p>
        ) : (
          <p className="text-sm text-slate">COA Structure: Not assigned</p>
        )}
        {canManage && leLinks.length === 0 && (
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onAssignCoa}>
            {coaStructure ? 'Change' : '+ Assign COA Structure'}
          </Button>
        )}
      </div>
      {canManage && leLinks.length > 0 && (
        <p className="text-xs text-slate">
          COA Structure is locked once a Ledger is assigned to a Legal Entity
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <p className="text-sm text-slate">
          Dynamic Insert: {ledger.allowDynamicInsert ? '● ON' : '● OFF'}
        </p>
        {canManage &&
          (confirmingToggleOff ? (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              Only pre-approved combinations can be posted after this. Sure?
              <Button
                variant="amber"
                className="px-2 py-1 text-xs"
                disabled={toggling}
                onClick={onRequestToggleOff}
              >
                Yes, turn off
              </Button>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                disabled={toggling}
                onClick={onCancelToggleOff}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <Button
              variant={ledger.allowDynamicInsert ? 'amber' : 'secondary'}
              className="px-3 py-1.5 text-xs"
              loading={toggling}
              onClick={ledger.allowDynamicInsert ? onRequestToggleOff : onToggleOn}
            >
              Toggle
            </Button>
          ))}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {calendar ? (
          <>
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-navy">📅 Calendar: {calendar.name}</p>
              {canManage && (
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onGenerateNext}>
                  Generate Next FY →
                </Button>
              )}
            </div>
            <p className="mt-1 text-sm text-slate">
              {calendar.periodType} · {calendar.periodsPerYear} periods · FY {calendar.currentFiscalYear} ·{' '}
              {calendar.generatedPeriodCount} generated
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate">📅 No Calendar configured</p>
            {canManage && (
              <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onCreateCalendar}>
                + Create Calendar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {leLinks.length === 0 && <p className="text-sm text-slate">🏢 Not assigned to any Legal Entity</p>}
        {leLinks.length === 1 && (
          <p className="text-sm text-slate">
            🏢 Assigned to: <span className="font-medium text-navy">{leLinks[0].legalEntityName}</span>
          </p>
        )}
        {leLinks.length > 1 && (
          <p className="text-sm text-slate">
            🏢 Assigned to: <span className="font-medium text-navy">{leLinks.length} Legal Entities</span>
          </p>
        )}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-xs text-slate">
        Created: {ledger.createdAt ? formatDate(ledger.createdAt) : '—'}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LedgerSetupPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:ledger:manage');

  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [calendarsByLedgerId, setCalendarsByLedgerId] = useState<Record<string, AccountingCalendar | null>>({});
  const [leLinks, setLeLinks] = useState<LegalEntityLedger[]>([]);
  const [coaStructures, setCoaStructures] = useState<CoaStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showWizard, setShowWizard] = useState(false);
  const [assignCoaLedger, setAssignCoaLedger] = useState<Ledger | null>(null);
  const [createCalendarLedger, setCreateCalendarLedger] = useState<Ledger | null>(null);
  const [generateNextLedger, setGenerateNextLedger] = useState<Ledger | null>(null);
  const [generatingNext, setGeneratingNext] = useState(false);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);
  const [confirmToggleOffId, setConfirmToggleOffId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const [ledgerList, coaList, leList] = await Promise.all([
        listLedgers(user.legalEntityId),
        listCoaStructures(BUSINESS_GROUP_ID),
        listLegalEntities(BUSINESS_GROUP_ID),
      ]);
      setLedgers(ledgerList);
      setCoaStructures(coaList);

      const [calendarEntries, leLinksNested] = await Promise.all([
        Promise.all(
          ledgerList.map(async (l) => {
            try {
              return [l.id, await getAccountingCalendar(l.id)] as const;
            } catch {
              return [l.id, null] as const;
            }
          }),
        ),
        Promise.all(
          leList.map(async (le) => {
            try {
              return await listLegalEntityLedgers(le.id);
            } catch {
              return [];
            }
          }),
        ),
      ]);
      setCalendarsByLedgerId(Object.fromEntries(calendarEntries));
      setLeLinks(leLinksNested.flat());
    } catch {
      setError(true);
      showToast('Failed to load ledgers.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleToggleDynamicInsert = async (ledger: Ledger, nextValue: boolean) => {
    if (!user) return;
    setTogglingId(ledger.id);
    setConfirmToggleOffId(null);
    try {
      const updated = await toggleDynamicInsert(ledger.id, nextValue, user.email);
      setLedgers((prev) =>
        prev.map((l) => (l.id === ledger.id ? { ...l, allowDynamicInsert: updated?.allowDynamicInsert ?? nextValue } : l)),
      );
      showToast(`Dynamic Insert turned ${nextValue ? 'on' : 'off'}.`, 'success');
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to update Dynamic Insert setting. Please try again.'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleGenerateNext = async () => {
    if (!generateNextLedger) return;
    const calendar = calendarsByLedgerId[generateNextLedger.id];
    if (!calendar) return;
    setGeneratingNext(true);
    try {
      await generateNextYearPeriods(calendar.id);
      showToast('Next fiscal year periods generated successfully.', 'success');
      setGenerateNextLedger(null);
      await loadAll();
    } catch (err) {
      showToast(apiErrorMessage(err, 'Failed to generate next year periods. Please try again.'), 'error');
    } finally {
      setGeneratingNext(false);
    }
  };

  const leLinksByLedgerId = new Map<string, LegalEntityLedger[]>();
  for (const link of leLinks) {
    const existing = leLinksByLedgerId.get(link.ledgerId);
    if (existing) existing.push(link);
    else leLinksByLedgerId.set(link.ledgerId, [link]);
  }
  const coaStructureById = new Map(coaStructures.map((s) => [s.id, s]));

  return (
    <AppLayout breadcrumb="Ledger Setup">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Ledger Setup</h1>
          <p className="mt-1 text-sm text-slate">Manage accounting ledgers, their structure and calendar</p>
        </div>
        {canManage && !loading && !error && (
          <Button onClick={() => setShowWizard(true)} aria-label="Add new ledger">
            Add Ledger
          </Button>
        )}
      </div>

      <div className="mt-4 rounded-md border border-blue-light bg-blue-light/40 px-4 py-3 text-sm text-blue-dark">
        A Ledger is defined by its COA Structure, Calendar and Currency. Create a Ledger first, then assign a
        COA Structure and Calendar, then link it to a Legal Entity.
      </div>

      <div className="mt-6">
        {loading && <CardSkeleton count={2} />}

        {!loading && error && <ErrorState message="Failed to load ledgers." onRetry={loadAll} />}

        {!loading && !error && ledgers.length === 0 && (
          <EmptyState
            title="No ledgers configured"
            message="Create a ledger to define an accounting book — its Chart of Accounts, currency, and finance mode."
            action={canManage ? { label: 'Add Ledger', onClick: () => setShowWizard(true) } : undefined}
          />
        )}

        {!loading && !error && ledgers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ledgers.map((ledger) => (
              <LedgerCard
                key={ledger.id}
                ledger={ledger}
                calendar={calendarsByLedgerId[ledger.id] ?? null}
                leLinks={leLinksByLedgerId.get(ledger.id) ?? []}
                coaStructure={ledger.coaStructureId ? coaStructureById.get(ledger.coaStructureId) ?? null : null}
                canManage={canManage}
                confirmingToggleOff={confirmToggleOffId === ledger.id}
                toggling={togglingId === ledger.id}
                onRequestToggleOff={() =>
                  confirmToggleOffId === ledger.id
                    ? handleToggleDynamicInsert(ledger, false)
                    : setConfirmToggleOffId(ledger.id)
                }
                onCancelToggleOff={() => setConfirmToggleOffId(null)}
                onToggleOn={() => handleToggleDynamicInsert(ledger, true)}
                onAssignCoa={() => setAssignCoaLedger(ledger)}
                onCreateCalendar={() => setCreateCalendarLedger(ledger)}
                onGenerateNext={() => setGenerateNextLedger(ledger)}
                onEdit={() => setEditingLedger(ledger)}
              />
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <AddLedgerWizard
          coaStructures={coaStructures}
          onClose={() => setShowWizard(false)}
          onCreated={loadAll}
        />
      )}

      {assignCoaLedger && (
        <AssignCoaStructureModal
          ledger={assignCoaLedger}
          coaStructures={coaStructures}
          onClose={() => setAssignCoaLedger(null)}
          onAssigned={loadAll}
        />
      )}

      {createCalendarLedger && (
        <CreateCalendarModal
          ledger={createCalendarLedger}
          onClose={() => setCreateCalendarLedger(null)}
          onCreated={loadAll}
        />
      )}

      {generateNextLedger && (
        <Modal
          title="Generate Next Fiscal Year"
          onClose={() => setGenerateNextLedger(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setGenerateNextLedger(null)} disabled={generatingNext}>
                Cancel
              </Button>
              <Button onClick={handleGenerateNext} loading={generatingNext}>
                Yes, Generate
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate">
            Generate periods for the next fiscal year on calendar "
            {calendarsByLedgerId[generateNextLedger.id]?.name}"?
          </p>
        </Modal>
      )}

      {editingLedger && (
        <EditLedgerPanel
          ledger={editingLedger}
          canManage={canManage}
          onClose={() => setEditingLedger(null)}
          onSaved={(updated) =>
            setLedgers((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
          }
        />
      )}
    </AppLayout>
  );
}
