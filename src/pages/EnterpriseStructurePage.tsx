import { useEffect, useState } from 'react';
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
  getLegalEntity,
  getPeriodStatus,
  listBusinessUnits,
  updateBusinessUnit,
  updateLegalEntity,
} from '../api/gl';
import type { BusinessUnit, LegalEntity } from '../types';
import { formatDate } from '../utils/format';

const ACCOUNTING_STANDARDS = ['IND_AS', 'IGAAP', 'IFRS', 'US_GAAP'];

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

interface LegalEntityEditForm {
  name: string;
  accountingStandard: string;
  tan: string;
}

interface BusinessUnitForm {
  code: string;
  name: string;
  stateCode: string;
  gstin: string;
}

const EMPTY_BU_FORM: BusinessUnitForm = { code: '', name: '', stateCode: '', gstin: '' };

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

export default function EnterpriseStructurePage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:enterprise:manage');

  const [legalEntity, setLegalEntity] = useState<LegalEntity | null>(null);
  const [fallbackName, setFallbackName] = useState<string | null>(null);
  const [loadingLE, setLoadingLE] = useState(true);
  const [errorLE, setErrorLE] = useState(false);
  const [showEditLE, setShowEditLE] = useState(false);

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loadingBUs, setLoadingBUs] = useState(true);
  const [errorBUs, setErrorBUs] = useState(false);

  const [showBUModal, setShowBUModal] = useState(false);
  const [editingBU, setEditingBU] = useState<BusinessUnit | null>(null);
  const [buForm, setBuForm] = useState<BusinessUnitForm>(EMPTY_BU_FORM);
  const [buErrors, setBuErrors] = useState<Partial<Record<keyof BusinessUnitForm, string>>>({});
  const [savingBU, setSavingBU] = useState(false);

  async function loadLegalEntity() {
    if (!user) return;
    setLoadingLE(true);
    setErrorLE(false);
    setFallbackName(null);
    try {
      const data = await getLegalEntity(user.legalEntityId);
      setLegalEntity(data);
    } catch {
      try {
        const periods = await getPeriodStatus(user.legalEntityId);
        if (periods[0]) {
          setFallbackName(periods[0].legalEntityName);
        } else {
          setErrorLE(true);
        }
      } catch {
        setErrorLE(true);
        showToast('Failed to load legal entity.', 'error');
      }
    } finally {
      setLoadingLE(false);
    }
  }

  async function loadBusinessUnits() {
    if (!user) return;
    setLoadingBUs(true);
    setErrorBUs(false);
    try {
      const data = await listBusinessUnits(user.legalEntityId);
      setBusinessUnits(Array.isArray(data) ? data : []);
    } catch {
      setErrorBUs(true);
      showToast('Failed to load business units.', 'error');
    } finally {
      setLoadingBUs(false);
    }
  }

  useEffect(() => {
    loadLegalEntity();
    loadBusinessUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    if (!user || !validateBU()) return;
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
          legalEntityId: user.legalEntityId,
          code: buForm.code.trim().toUpperCase(),
          name: buForm.name.trim(),
          gstin: buForm.gstin.trim() || undefined,
          stateCode: buForm.stateCode || undefined,
        });
        showToast('Business unit created successfully.', 'success');
      }
      setShowBUModal(false);
      await loadBusinessUnits();
    } catch {
      showToast('Failed to save business unit. Please try again.', 'error');
    } finally {
      setSavingBU(false);
    }
  };

  const displayName = legalEntity?.name ?? fallbackName;

  return (
    <AppLayout breadcrumb="Enterprise Structure">
      <h1 className="text-2xl font-bold text-navy">Enterprise Structure</h1>
      <p className="mt-1 text-sm text-slate">Legal entity and business unit hierarchy</p>

      <div className="mt-6">
        {loadingLE && <CardSkeleton count={1} />}

        {!loadingLE && errorLE && (
          <ErrorState message="Failed to load legal entity." onRetry={loadLegalEntity} />
        )}

        {!loadingLE && !errorLE && displayName && (
          <Card accent>
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                🏢 Legal Entity
              </p>
              {canManage && legalEntity && (
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setShowEditLE(true)}
                  aria-label="Edit legal entity"
                >
                  Edit
                </Button>
              )}
            </div>
            <p className="mt-1 text-xl font-bold text-navy">{displayName}</p>
            {legalEntity ? (
              <>
                <p className="mt-1 text-sm text-slate">Code: {legalEntity.code}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-slate">
                  <span>Standard: {legalEntity.accountingStandard}</span>
                  <span className="text-border">│</span>
                  <span>TAN: {legalEntity.tan || '—'}</span>
                  <span className="text-border">│</span>
                  <span>Status:</span>
                  <StatusBadge isActive={legalEntity.isActive} />
                </p>
                <p className="mt-2 text-xs text-slate">
                  Created: {formatDate(legalEntity.createdAt)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate">
                Limited legal entity details available.
              </p>
            )}
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Business Units</h2>
          {canManage && (
            <Button onClick={openAddBU} aria-label="Add new business unit">
              Add Business Unit
            </Button>
          )}
        </div>

        <div className="mt-4">
          {loadingBUs && <TableSkeleton rows={3} columns={7} />}

          {!loadingBUs && errorBUs && (
            <ErrorState message="Failed to load business units." onRetry={loadBusinessUnits} />
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

      {showEditLE && legalEntity && (
        <LegalEntityEditPanel
          legalEntity={legalEntity}
          onClose={() => setShowEditLE(false)}
          onSaved={(updated) => setLegalEntity(updated)}
        />
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
