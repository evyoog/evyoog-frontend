import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createBusinessUnit,
  createLegalEntity,
  generateNextYearPeriods,
  getAccountingCalendar,
  getPeriodStatus,
  linkLegalEntityLedger,
  listAccountingPeriods,
  listBusinessUnits,
  listLedgers,
  listLegalEntities,
  listLegalEntityLedgers,
  updateBusinessUnit,
  updateLegalEntity,
} from '../api/gl';
import type {
  AccountingCalendar,
  BusinessUnit,
  Ledger,
  LegalEntity,
  LegalEntityLedger,
  PeriodRow,
  PeriodStatusValue,
} from '../types';
import { formatDate } from '../utils/format';

const BUSINESS_GROUP_ID = 'c1338b23-c1e6-4f4e-9d87-8e60b49bb432';

const ACCOUNTING_STANDARDS = ['IND_AS', 'IGAAP', 'IFRS', 'US_GAAP'];
const LEDGER_CATEGORIES = ['PRIMARY', 'SECONDARY', 'REPORTING', 'ENCUMBRANCE'];

function ledgerDisplayName(l: Ledger): string {
  return l.name ?? l.ledgerName;
}

function ledgerCurrency(l: Ledger): string {
  return l.functionalCurrency ?? l.currency;
}

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

const STATE_NAME_BY_CODE = Object.fromEntries(INDIAN_STATES.map((s) => [s.code, s.name]));

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

type DisplayPeriodStatus = PeriodStatusValue | 'NOT_INITIALISED';

const STATUS_LABELS: Record<DisplayPeriodStatus, string> = {
  NOT_INITIALISED: 'Not Initialised',
  NOT_OPENED: 'Not Opened',
  FUTURE_ENTERABLE: 'Future Enterable',
  OPEN: 'Open',
  CLOSED: 'Closed',
  LOCKED: 'Locked',
};

const STATUS_CLASSES: Record<DisplayPeriodStatus, string> = {
  NOT_INITIALISED: 'bg-slate-100 text-slate',
  NOT_OPENED: 'bg-slate-100 text-slate',
  FUTURE_ENTERABLE: 'bg-blue-light text-blue-dark',
  OPEN: 'bg-green-light text-green',
  CLOSED: 'bg-amber-light text-amber',
  LOCKED: 'bg-red-50 text-red-600',
};

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Apr-Jun)',
  2: 'Q2 (Jul-Sep)',
  3: 'Q3 (Oct-Dec)',
  4: 'Q4 (Jan-Mar)',
};

function periodDisplayStatus(row: PeriodRow): DisplayPeriodStatus {
  return row.status?.status ?? 'NOT_INITIALISED';
}

function stateLabel(stateCode: string | null) {
  if (!stateCode) return '—';
  return STATE_NAME_BY_CODE[stateCode] ?? stateCode;
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

type TabKey = 'LE' | 'LEDGER' | 'BU';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'LE', label: '🏢 Legal Entities' },
  { key: 'LEDGER', label: '📒 Ledger & Calendar' },
  { key: 'BU', label: '🏭 Business Units' },
];

interface LegalEntityEditForm {
  name: string;
  accountingStandard: string;
  tan: string;
}

function LegalEntityEditPanel({
  legalEntity,
  onClose,
  onSaved,
}: {
  legalEntity: LegalEntity;
  onClose: () => void;
  onSaved: (updated: LegalEntity) => void;
}) {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState<LegalEntityEditForm>({
    name: legalEntity.name,
    accountingStandard: legalEntity.accountingStandard,
    tan: legalEntity.tan ?? '',
  });
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
    if (!form.name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      const updated = await updateLegalEntity(legalEntity.id, {
        name: form.name.trim(),
        accountingStandard: form.accountingStandard,
        tan: form.tan.trim() || undefined,
      });
      showToast('Legal entity updated successfully.', 'success');
      onSaved(updated);
      handleClose();
    } catch {
      showToast('Failed to update legal entity. Please try again.', 'error');
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
            <h2 className="text-lg font-bold text-navy">Edit Legal Entity</h2>
            <p className="mt-0.5 text-xs text-slate">{legalEntity.code}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-slate hover:text-navy"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            <Input
              id="le-name"
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={nameError}
            />
            <Select
              id="le-standard"
              label="Accounting Standard"
              required
              value={form.accountingStandard}
              onChange={(e) => setForm({ ...form, accountingStandard: e.target.value })}
            >
              {ACCOUNTING_STANDARDS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input
              id="le-tan"
              label="TAN"
              maxLength={10}
              value={form.tan}
              onChange={(e) => setForm({ ...form, tan: e.target.value.toUpperCase() })}
            />

            <div className="mt-2 border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">
                Record Info
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate">
                <div>Created: {formatDate(legalEntity.createdAt)}</div>
                <div>Updated: {formatDate(legalEntity.updatedAt)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AddLEForm {
  code: string;
  name: string;
  accountingStandard: string;
  tan: string;
}

const EMPTY_LE_FORM: AddLEForm = { code: '', name: '', accountingStandard: 'IND_AS', tan: '' };

function AddLegalEntityModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (le: LegalEntity) => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<AddLEForm>(EMPTY_LE_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof AddLEForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.code.trim()) next.code = 'Code is required';
    else if (form.code.length > 50) next.code = 'Code must be 50 characters or fewer';
    if (!form.name.trim()) next.name = 'Name is required';
    else if (form.name.length > 200) next.name = 'Name must be 200 characters or fewer';
    if (form.tan.trim() && form.tan.length > 10) next.tan = 'TAN must be 10 characters or fewer';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const created = await createLegalEntity({
        businessGroupId: BUSINESS_GROUP_ID,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        accountingStandard: form.accountingStandard,
        tan: form.tan.trim() || undefined,
      });
      showToast(`${created.name} created successfully. Set up a Ledger to start posting.`, 'success');
      onCreated(created);
      onClose();
    } catch {
      showToast('Failed to create legal entity. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add Legal Entity"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Create Legal Entity
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          id="new-le-code"
          label="Code"
          required
          maxLength={50}
          placeholder="LE-KARNATAKA"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          error={errors.code}
        />
        <Input
          id="new-le-name"
          label="Name"
          required
          maxLength={200}
          placeholder="Orbinox Valves Karnataka Pvt Ltd"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />
        <Select
          id="new-le-standard"
          label="Accounting Standard"
          required
          value={form.accountingStandard}
          onChange={(e) => setForm({ ...form, accountingStandard: e.target.value })}
        >
          {ACCOUNTING_STANDARDS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Input
          id="new-le-tan"
          label="TAN"
          maxLength={10}
          value={form.tan}
          onChange={(e) => setForm({ ...form, tan: e.target.value.toUpperCase() })}
          error={errors.tan}
        />
      </div>
    </Modal>
  );
}

function AssignLedgerModal({
  legalEntity,
  ledgers,
  onClose,
  onAssigned,
}: {
  legalEntity: LegalEntity;
  ledgers: Ledger[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { showToast } = useToast();
  const [ledgerId, setLedgerId] = useState('');
  const [ledgerCategory, setLedgerCategory] = useState('PRIMARY');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ledgerId) return;
    setSaving(true);
    try {
      await linkLegalEntityLedger({ legalEntityId: legalEntity.id, ledgerId, ledgerCategory });
      showToast('Ledger assigned successfully', 'success');
      onAssigned();
      onClose();
    } catch {
      showToast('Failed to assign ledger. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Assign Ledger to ${legalEntity.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!ledgerId}>
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          id="assign-ledger-select"
          label="Ledger"
          required
          value={ledgerId}
          onChange={(e) => setLedgerId(e.target.value)}
        >
          <option value="">Select a ledger</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code ?? '—'} — {ledgerDisplayName(l)} ({l.financeMode ?? '—'} · {ledgerCurrency(l)})
            </option>
          ))}
        </Select>
        <Select
          id="assign-ledger-category"
          label="Ledger Category"
          required
          value={ledgerCategory}
          onChange={(e) => setLedgerCategory(e.target.value)}
        >
          {LEDGER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
    </Modal>
  );
}

interface BusinessUnitForm {
  code: string;
  name: string;
  stateCode: string;
  gstin: string;
}

const EMPTY_BU_FORM: BusinessUnitForm = { code: '', name: '', stateCode: '', gstin: '' };

function SetupBanner({
  hasLE,
  hasLedger,
  hasCalendar,
  hasPeriods,
  periodCount,
  hasBU,
}: {
  hasLE: boolean;
  hasLedger: boolean;
  hasCalendar: boolean;
  hasPeriods: boolean;
  periodCount: number;
  hasBU: boolean;
}) {
  const items: { label: string; done: boolean }[] = [
    { label: 'Legal Entity', done: hasLE },
    { label: 'Ledger', done: hasLedger },
    { label: 'Calendar', done: hasCalendar },
    { label: hasPeriods ? `${periodCount} Periods` : 'Periods', done: hasPeriods },
    { label: 'Business Unit', done: hasBU },
  ];
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span>{item.done ? '✅' : '⬜'}</span>
            <span className={item.done ? 'text-navy' : 'text-slate'}>{item.label}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

export default function EnterpriseStructurePage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:enterprise:manage');

  const [activeTab, setActiveTab] = useState<TabKey>('LE');

  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [loadingLEs, setLoadingLEs] = useState(true);
  const [errorLEs, setErrorLEs] = useState(false);
  const [selectedLEId, setSelectedLEId] = useState<string | null>(null);
  const [expandedLEId, setExpandedLEId] = useState<string | null>(null);
  const [showAddLEModal, setShowAddLEModal] = useState(false);
  const [editingLE, setEditingLE] = useState<LegalEntity | null>(null);
  const [leLedgerLinks, setLeLedgerLinks] = useState<Record<string, LegalEntityLedger[]>>({});
  const [allLedgers, setAllLedgers] = useState<Ledger[]>([]);
  const [assigningLedgerLE, setAssigningLedgerLE] = useState<LegalEntity | null>(null);

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [errorLedger, setErrorLedger] = useState(false);

  const [calendar, setCalendar] = useState<AccountingCalendar | null>(null);
  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([]);
  const [showGenerateNextConfirm, setShowGenerateNextConfirm] = useState(false);
  const [generatingNext, setGeneratingNext] = useState(false);

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loadingBUs, setLoadingBUs] = useState(false);
  const [errorBUs, setErrorBUs] = useState(false);

  const [showBUModal, setShowBUModal] = useState(false);
  const [editingBU, setEditingBU] = useState<BusinessUnit | null>(null);
  const [buForm, setBuForm] = useState<BusinessUnitForm>(EMPTY_BU_FORM);
  const [buErrors, setBuErrors] = useState<Partial<Record<keyof BusinessUnitForm, string>>>({});
  const [savingBU, setSavingBU] = useState(false);

  const selectedLE = legalEntities.find((le) => le.id === selectedLEId) ?? null;

  async function loadLegalEntities(preferredId?: string) {
    setLoadingLEs(true);
    setErrorLEs(false);
    try {
      const data = await listLegalEntities(BUSINESS_GROUP_ID);
      setLegalEntities(data);
      setSelectedLEId((current) => {
        const wanted = preferredId ?? current ?? user?.legalEntityId ?? null;
        if (wanted && data.some((le) => le.id === wanted)) return wanted;
        return data[0]?.id ?? null;
      });

      const linksNested = await Promise.all(
        data.map((le) => listLegalEntityLedgers(le.id).catch(() => [])),
      );
      setLeLedgerLinks(Object.fromEntries(data.map((le, i) => [le.id, linksNested[i]])));
    } catch {
      setErrorLEs(true);
      showToast('Failed to load legal entities.', 'error');
    } finally {
      setLoadingLEs(false);
    }
  }

  async function loadLedgerAndCalendar(legalEntityId: string) {
    setLoadingLedger(true);
    setErrorLedger(false);
    setCalendar(null);
    setPeriodRows([]);
    try {
      const ledgers = await listLedgers(legalEntityId);
      const primary = ledgers[0] ?? null;
      setLedger(primary);
      if (!primary) return;

      try {
        const cal = await getAccountingCalendar(primary.id);
        setCalendar(cal);
        const [periods, statuses] = await Promise.all([
          listAccountingPeriods(cal.id),
          getPeriodStatus(legalEntityId),
        ]);
        const statusByPeriodId = new Map(statuses.map((s) => [s.accountingPeriodId, s]));
        const merged: PeriodRow[] = [...periods]
          .sort((a, b) => a.periodNumber - b.periodNumber)
          .map((period) => ({ period, status: statusByPeriodId.get(period.id) ?? null }));
        setPeriodRows(merged);
      } catch {
        setCalendar(null);
        setPeriodRows([]);
      }
    } catch {
      setErrorLedger(true);
      showToast('Failed to load ledger.', 'error');
    } finally {
      setLoadingLedger(false);
    }
  }

  async function loadBusinessUnits(legalEntityId: string) {
    setLoadingBUs(true);
    setErrorBUs(false);
    try {
      const data = await listBusinessUnits(legalEntityId);
      setBusinessUnits(Array.isArray(data) ? data : []);
    } catch {
      setErrorBUs(true);
      showToast('Failed to load business units.', 'error');
    } finally {
      setLoadingBUs(false);
    }
  }

  useEffect(() => {
    loadLegalEntities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    listLedgers()
      .then(setAllLedgers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLEId) {
      setLedger(null);
      setCalendar(null);
      setPeriodRows([]);
      setBusinessUnits([]);
      return;
    }
    loadLedgerAndCalendar(selectedLEId);
    loadBusinessUnits(selectedLEId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLEId]);

  const goToTab = (tab: TabKey, legalEntityId?: string) => {
    if (legalEntityId) setSelectedLEId(legalEntityId);
    setActiveTab(tab);
  };

  const openAddBU = () => {
    setEditingBU(null);
    setBuForm(EMPTY_BU_FORM);
    setBuErrors({});
    setShowBUModal(true);
  };

  const openEditBU = (bu: BusinessUnit) => {
    setEditingBU(bu);
    setBuForm({
      code: bu.code,
      name: bu.name,
      stateCode: bu.stateCode ?? '',
      gstin: bu.gstin ?? '',
    });
    setBuErrors({});
    setShowBUModal(true);
  };

  const validateBU = () => {
    const next: typeof buErrors = {};
    if (!editingBU && !buForm.code.trim()) next.code = 'Code is required';
    if (!editingBU && buForm.code.length > 50) next.code = 'Code must be 50 characters or fewer';
    if (!buForm.name.trim()) next.name = 'Name is required';
    if (buForm.name.length > 200) next.name = 'Name must be 200 characters or fewer';
    if (buForm.gstin.trim() && !GSTIN_PATTERN.test(buForm.gstin.trim())) {
      next.gstin = 'Enter a valid 15-character GSTIN (e.g. 29AABCE1234F1Z5)';
    }
    setBuErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveBU = async () => {
    if (!selectedLEId || !validateBU()) return;
    setSavingBU(true);
    try {
      if (editingBU) {
        await updateBusinessUnit(editingBU.id, {
          name: buForm.name.trim(),
          gstin: buForm.gstin.trim() || undefined,
          stateCode: buForm.stateCode || undefined,
        });
        showToast('Business unit updated successfully.', 'success');
      } else {
        await createBusinessUnit({
          legalEntityId: selectedLEId,
          code: buForm.code.trim().toUpperCase(),
          name: buForm.name.trim(),
          gstin: buForm.gstin.trim() || undefined,
          stateCode: buForm.stateCode || undefined,
        });
        showToast('Business unit created successfully.', 'success');
      }
      setShowBUModal(false);
      await loadBusinessUnits(selectedLEId);
    } catch {
      showToast('Failed to save business unit. Please try again.', 'error');
    } finally {
      setSavingBU(false);
    }
  };

  const handleGenerateNext = async () => {
    if (!calendar) return;
    setGeneratingNext(true);
    try {
      await generateNextYearPeriods(calendar.id);
      showToast('Next fiscal year periods generated successfully.', 'success');
      setShowGenerateNextConfirm(false);
      if (selectedLEId) await loadLedgerAndCalendar(selectedLEId);
    } catch {
      showToast('Failed to generate next year periods. Please try again.', 'error');
    } finally {
      setGeneratingNext(false);
    }
  };

  const hasLE = legalEntities.length > 0;
  const hasLedger = !!ledger;
  const hasCalendar = !!calendar;
  const hasPeriods = periodRows.length > 0;
  const hasBU = businessUnits.length > 0;

  return (
    <AppLayout breadcrumb="Enterprise Structure">
      <h1 className="text-2xl font-bold text-navy">Enterprise Structure</h1>
      <p className="mt-1 text-sm text-slate">
        Legal entity, ledger, calendar, and business unit setup
      </p>

      <div className="mt-6">
        {!loadingLEs && !errorLEs && (
          <SetupBanner
            hasLE={hasLE}
            hasLedger={hasLedger}
            hasCalendar={hasCalendar}
            hasPeriods={hasPeriods}
            periodCount={periodRows.length}
            hasBU={hasBU}
          />
        )}

        <div className="mb-6 flex gap-2 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue text-blue'
                  : 'border-transparent text-slate hover:text-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'LE' && (
          <div>
            {loadingLEs && <CardSkeleton count={3} />}
            {!loadingLEs && errorLEs && (
              <ErrorState message="Failed to load legal entities." onRetry={() => loadLegalEntities()} />
            )}
            {!loadingLEs && !errorLEs && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {legalEntities.map((le) => {
                  const isExpanded = expandedLEId === le.id;
                  const isSelected = selectedLEId === le.id;
                  const assignedLedger = leLedgerLinks[le.id]?.[0] ?? null;
                  return (
                    <Card
                      key={le.id}
                      accent={isSelected}
                      onClick={() => setSelectedLEId(le.id)}
                      className={`flex cursor-pointer flex-col transition-colors ${
                        isSelected ? 'ring-2 ring-blue' : 'hover:border-blue/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                          🏢 Legal Entity
                        </p>
                        <StatusBadge isActive={le.isActive} />
                      </div>
                      <p className="mt-1 text-lg font-bold text-navy">{le.name}</p>
                      <p className="mt-1 text-sm text-slate">Code: {le.code}</p>
                      <p className="mt-1 text-sm text-slate">Standard: {le.accountingStandard}</p>
                      <div className="mt-1 text-sm">
                        {assignedLedger ? (
                          <p className="text-slate">
                            Assigned Ledger:{' '}
                            <span className="font-medium text-navy">
                              {assignedLedger.ledgerCode} {assignedLedger.ledgerName}
                            </span>
                          </p>
                        ) : (
                          <p className="flex items-center gap-1.5 text-amber">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                            Not assigned
                          </p>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 border-t border-border pt-3 text-sm text-slate">
                          <p className="mb-2">
                            TAN: {le.tan || '—'} · Created: {formatDate(le.createdAt)}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              className="text-left text-blue hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToTab('LEDGER', le.id);
                              }}
                            >
                              View Ledger →
                            </button>
                            <button
                              type="button"
                              className="text-left text-blue hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToTab('BU', le.id);
                              }}
                            >
                              View Business Units →
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLEId(le.id);
                            setExpandedLEId(isExpanded ? null : le.id);
                          }}
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </Button>
                        {canManage && (
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLE(le);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigningLedgerLE(le);
                            }}
                          >
                            Assign Ledger
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAddLEModal(true)}
                    className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-5 text-center text-slate transition-colors hover:border-blue hover:text-blue"
                  >
                    <span className="text-2xl">➕</span>
                    <span className="mt-2 text-sm font-medium">Add Legal Entity</span>
                    <span className="mt-1 text-xs">
                      Click to create a new legal entity under this business group
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'LEDGER' && (
          <div className="flex flex-col gap-6">
            {!hasLE && !loadingLEs && (
              <EmptyState title="Create a Legal Entity first" message="You need a legal entity before configuring a ledger and calendar." />
            )}

            {selectedLE && (
              <>
                <h2 className="text-lg font-bold text-navy">Ledger & Calendar — {selectedLE.name}</h2>

                {loadingLedger && <CardSkeleton count={1} />}

                {!loadingLedger && errorLedger && (
                  <ErrorState
                    message="Failed to load ledger."
                    onRetry={() => loadLedgerAndCalendar(selectedLE.id)}
                  />
                )}

                {!loadingLedger && !errorLedger && !ledger && (
                  <Card>
                    <p className="text-sm font-semibold text-navy">📒 No Ledger Assigned</p>
                    <p className="mt-2 text-sm text-slate">
                      No Ledger assigned. Assign a Ledger from the Legal Entities tab.
                    </p>
                    {canManage && (
                      <Link to="/ledger-setup" className="mt-4 inline-block text-sm text-blue hover:underline">
                        Create a Ledger in Ledger Setup →
                      </Link>
                    )}
                  </Card>
                )}

                {!loadingLedger && !errorLedger && ledger && (
                  <Card accent>
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                        📒 {ledger.ledgerCategory ?? 'Primary'} Ledger
                      </p>
                      <StatusBadge isActive={ledger.isActive ?? true} />
                    </div>
                    <p className="mt-1 text-lg font-bold text-navy">{ledger.ledgerName}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate">
                      <span>Code: {ledger.code ?? '—'}</span>
                      <span className="text-border">│</span>
                      <span>Finance Mode: {ledger.financeMode ?? '—'}</span>
                      <span className="text-border">│</span>
                      <span>Currency: {ledger.currency}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate">
                      <span>Standard: {ledger.accountingStandard ?? '—'}</span>
                      <span className="text-border">│</span>
                      <span>
                        Dynamic Insert: {ledger.allowDynamicInsert ? '● ON' : '● OFF'}
                      </span>
                    </p>
                  </Card>
                )}

                {ledger && !loadingLedger && !errorLedger && (
                  <>
                    {!calendar && (
                      <Card>
                        <p className="text-sm font-semibold text-navy">📅 No Calendar Configured</p>
                        <p className="mt-2 text-sm text-slate">
                          An accounting calendar defines the fiscal year structure and periods
                          for this ledger.
                        </p>
                        {canManage && (
                          <Link to="/ledger-setup" className="mt-4 inline-block text-sm text-blue hover:underline">
                            Set up a Calendar in Ledger Setup →
                          </Link>
                        )}
                      </Card>
                    )}

                    {calendar && (
                      <Card accent>
                        <div className="flex items-start justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                            📅 {calendar.name}
                          </p>
                          {canManage && (
                            <Button
                              variant="secondary"
                              className="px-3 py-1.5 text-xs"
                              onClick={() => setShowGenerateNextConfirm(true)}
                            >
                              Generate Next FY →
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-slate">
                          Period Type: {calendar.periodType} ({calendar.periodsPerYear} periods/year)
                        </p>
                        <p className="mt-1 text-sm text-slate">
                          Current FY: {calendar.currentFiscalYear}
                        </p>
                        <p className="mt-1 text-sm text-slate">
                          Generated: {calendar.generatedPeriodCount} periods
                        </p>
                      </Card>
                    )}

                    {calendar && (
                      <Card>
                        <h3 className="text-sm font-bold text-navy">Period Summary</h3>
                        <div className="mt-3">
                          {periodRows.length === 0 ? (
                            <p className="text-sm text-slate">No periods generated yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                                    <th className="py-2 pr-2 font-medium">Period</th>
                                    <th className="py-2 pr-2 font-medium">Quarter</th>
                                    <th className="py-2 pr-2 font-medium">Dates</th>
                                    <th className="py-2 pr-2 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {periodRows.map((row) => {
                                    const status = periodDisplayStatus(row);
                                    return (
                                      <tr
                                        key={row.period.id}
                                        className="border-b border-border last:border-0 hover:bg-offwhite"
                                      >
                                        <td className="py-2 pr-2 font-medium text-navy">
                                          {row.period.name}
                                        </td>
                                        <td className="py-2 pr-2">
                                          {QUARTER_LABELS[row.period.quarterNumber] ??
                                            row.period.quarterNumber}
                                        </td>
                                        <td className="py-2 pr-2">
                                          {formatDate(row.period.startDate)} –{' '}
                                          {formatDate(row.period.endDate)}
                                        </td>
                                        <td className="py-2 pr-2">
                                          <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_CLASSES[status]}`}
                                          >
                                            {STATUS_LABELS[status]}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'BU' && (
          <div>
            {!hasLE && !loadingLEs && (
              <EmptyState title="Create a Legal Entity first" message="You need a legal entity before adding business units." />
            )}

            {selectedLE && (
              <Card>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-navy">
                    Business Units — {selectedLE.name}
                  </h2>
                  {canManage && (
                    <Button onClick={openAddBU} aria-label="Add new business unit">
                      Add Business Unit
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  {loadingBUs && <TableSkeleton rows={3} columns={7} />}

                  {!loadingBUs && errorBUs && (
                    <ErrorState
                      message="Failed to load business units."
                      onRetry={() => loadBusinessUnits(selectedLE.id)}
                    />
                  )}

                  {!loadingBUs && !errorBUs && businessUnits.length === 0 && (
                    <EmptyState
                      title="No business units defined"
                      message="Add a business unit to define operational segments under this legal entity."
                      action={canManage ? { label: 'Add Business Unit', onClick: openAddBU } : undefined}
                    />
                  )}

                  {!loadingBUs && !errorBUs && businessUnits.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                            <th className="py-2 pr-2 font-medium">Code</th>
                            <th className="py-2 pr-2 font-medium">Name</th>
                            <th className="py-2 pr-2 font-medium">State</th>
                            <th className="py-2 pr-2 font-medium">GSTIN</th>
                            <th className="py-2 pr-2 font-medium">Status</th>
                            <th className="py-2 pr-2 font-medium">Created</th>
                            <th className="py-2 pr-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {businessUnits.map((bu) => (
                            <tr key={bu.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                              <td className="py-2 pr-2 font-mono text-navy">{bu.code}</td>
                              <td className="py-2 pr-2">{bu.name}</td>
                              <td className="py-2 pr-2">{stateLabel(bu.stateCode)}</td>
                              <td className="py-2 pr-2 font-mono">{bu.gstin || 'Not set'}</td>
                              <td className="py-2 pr-2">
                                <StatusBadge isActive={bu.isActive} />
                              </td>
                              <td className="py-2 pr-2">{formatDate(bu.createdAt)}</td>
                              <td className="py-2 pr-2">
                                {canManage && (
                                  <Button
                                    variant="secondary"
                                    className="px-2 py-1 text-xs"
                                    onClick={() => openEditBU(bu)}
                                    aria-label={`Edit ${bu.name}`}
                                  >
                                    Edit
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {editingLE && (
        <LegalEntityEditPanel
          legalEntity={editingLE}
          onClose={() => setEditingLE(null)}
          onSaved={(updated) =>
            setLegalEntities((prev) => prev.map((le) => (le.id === updated.id ? updated : le)))
          }
        />
      )}

      {showAddLEModal && (
        <AddLegalEntityModal
          onClose={() => setShowAddLEModal(false)}
          onCreated={(created) => loadLegalEntities(created.id)}
        />
      )}

      {assigningLedgerLE && (
        <AssignLedgerModal
          legalEntity={assigningLedgerLE}
          ledgers={allLedgers}
          onClose={() => setAssigningLedgerLE(null)}
          onAssigned={() => loadLegalEntities()}
        />
      )}

      {showGenerateNextConfirm && calendar && (
        <Modal
          title="Generate Next Fiscal Year"
          onClose={() => setShowGenerateNextConfirm(false)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowGenerateNextConfirm(false)}
                disabled={generatingNext}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerateNext} loading={generatingNext}>
                Yes, Generate
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate">
            Generate periods for the next fiscal year on calendar "{calendar.name}"?
          </p>
        </Modal>
      )}

      {showBUModal && (
        <Modal
          title={editingBU ? 'Edit Business Unit' : 'Add Business Unit'}
          onClose={() => setShowBUModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowBUModal(false)} disabled={savingBU}>
                Cancel
              </Button>
              <Button onClick={handleSaveBU} loading={savingBU}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              id="bu-code"
              label="Code"
              required
              maxLength={50}
              disabled={!!editingBU}
              value={buForm.code}
              onChange={(e) => setBuForm({ ...buForm, code: e.target.value.toUpperCase() })}
              error={buErrors.code}
            />
            <Input
              id="bu-name"
              label="Name"
              required
              maxLength={200}
              value={buForm.name}
              onChange={(e) => setBuForm({ ...buForm, name: e.target.value })}
              error={buErrors.name}
            />
            <Select
              id="bu-state"
              label="State"
              value={buForm.stateCode}
              onChange={(e) => setBuForm({ ...buForm, stateCode: e.target.value })}
            >
              <option value="">Select a state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              id="bu-gstin"
              label="GSTIN"
              placeholder="29AABCE1234F1Z5"
              value={buForm.gstin}
              onChange={(e) => setBuForm({ ...buForm, gstin: e.target.value.toUpperCase() })}
              error={buErrors.gstin}
            />

            {editingBU && (
              <div className="mt-2 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">
                  Record Info
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate">
                  <div>Created: {formatDate(editingBU.createdAt)}</div>
                  <div>Last Modified: {formatDate(editingBU.updatedAt)}</div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
