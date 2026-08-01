import { useEffect, useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import {
  createDimensionValue,
  deactivateDimensionValue,
  listDimensionValues,
  updateDimensionValue,
} from '../api/gl';
import type { DimensionValue, FinanceDimension } from '../types';
import { formatDate } from '../utils/format';

const QUALIFIERS = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const NORMAL_BALANCES = ['DR', 'CR'];

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

interface ValueFormState {
  code: string;
  name: string;
  description: string;
  displayOrder: string;
  isPostable: boolean;
  parentValueId: string;
  accountQualifier: string;
  normalBalance: string;
  isSummary: boolean;
  gstApplicable: boolean;
  tdsApplicable: boolean;
  tdsSection: string;
  ccDepartment: string;
  ccManagerName: string;
  ccManagerEmail: string;
  validFrom: string;
  validTo: string;
  budgetControlled: boolean;
}

const EMPTY_FORM: ValueFormState = {
  code: '',
  name: '',
  description: '',
  displayOrder: '0',
  isPostable: true,
  parentValueId: '',
  accountQualifier: QUALIFIERS[0],
  normalBalance: NORMAL_BALANCES[0],
  isSummary: false,
  gstApplicable: false,
  tdsApplicable: false,
  tdsSection: '',
  ccDepartment: '',
  ccManagerName: '',
  ccManagerEmail: '',
  validFrom: '',
  validTo: '',
  budgetControlled: false,
};

interface DimensionValuesPanelProps {
  dimension: FinanceDimension;
  canManage: boolean;
  onClose: () => void;
  onValuesChanged?: () => void;
}

export default function DimensionValuesPanel({
  dimension,
  canManage,
  onClose,
  onValuesChanged,
}: DimensionValuesPanelProps) {
  const { showToast } = useToast();
  const isNaturalAccount = dimension.dimensionType === 'NATURAL_ACCOUNT';
  const isCostCentre = dimension.dimensionType === 'COST_CENTRE';

  const [visible, setVisible] = useState(false);
  const [values, setValues] = useState<DimensionValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DimensionValue | null>(null);
  const [form, setForm] = useState<ValueFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<'code' | 'name' | 'accountQualifier' | 'normalBalance', string>>
  >({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listDimensionValues(dimension.id);
      setValues(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load dimension values.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setVisible(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (v: DimensionValue) => {
    setEditing(v);
    setForm({
      code: v.code,
      name: v.name,
      description: v.description ?? '',
      displayOrder: String(v.displayOrder),
      isPostable: v.isPostable,
      parentValueId: v.parentValueId ?? '',
      accountQualifier: v.accountQualifier ?? QUALIFIERS[0],
      normalBalance: v.normalBalance ?? NORMAL_BALANCES[0],
      isSummary: v.isSummary,
      gstApplicable: v.gstApplicable,
      tdsApplicable: v.tdsApplicable,
      tdsSection: v.tdsSection ?? '',
      ccDepartment: v.ccDepartment ?? '',
      ccManagerName: v.ccManagerName ?? '',
      ccManagerEmail: v.ccManagerEmail ?? '',
      validFrom: v.validFrom ?? '',
      validTo: v.validTo ?? '',
      budgetControlled: v.budgetControlled,
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.name.trim()) next.name = 'Name is required';
    if (isNaturalAccount && !form.accountQualifier) next.accountQualifier = 'Qualifier is required';
    if (isNaturalAccount && !form.normalBalance) next.normalBalance = 'Normal balance is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    try {
      const body: Partial<DimensionValue> = {
        code,
        name,
        description: form.description.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
        isPostable: form.isPostable,
        parentValueId: form.parentValueId || null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        budgetControlled: form.budgetControlled,
      };
      if (isNaturalAccount) {
        body.accountQualifier = form.accountQualifier;
        body.normalBalance = form.normalBalance;
        body.isSummary = form.isSummary;
        body.gstApplicable = form.gstApplicable;
        body.tdsApplicable = form.tdsApplicable;
        body.tdsSection = form.tdsApplicable ? form.tdsSection.trim() || null : null;
      }
      if (isCostCentre) {
        body.ccDepartment = form.ccDepartment.trim() || null;
        body.ccManagerName = form.ccManagerName.trim() || null;
        body.ccManagerEmail = form.ccManagerEmail.trim() || null;
      }
      if (editing) {
        await updateDimensionValue(editing.id, body);
        showToast('Value updated successfully.', 'success');
      } else {
        await createDimensionValue({ financeDimensionId: dimension.id, code, name, ...body });
        showToast('Value created successfully.', 'success');
      }
      setShowModal(false);
      await load();
      onValuesChanged?.();
    } catch {
      showToast('Failed to save value. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (v: DimensionValue) => {
    setActingId(v.id);
    setConfirmId(null);
    try {
      await deactivateDimensionValue(v.id);
      showToast('Value deactivated.', 'success');
      await load();
      onValuesChanged?.();
    } catch {
      showToast('Failed to deactivate value. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const parentOptions = values.filter((v) => !editing || v.id !== editing.id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      <div
        className={`relative flex h-full w-[600px] max-w-full flex-col bg-white shadow-lg transition-transform duration-200 ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {dimension.name}{' '}
              <span className="text-sm font-normal text-slate">— {dimension.dimensionType}</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate">{values.length} values</p>
          </div>
          <div className="flex items-center gap-3">
            {canManage && <Button onClick={openAdd}>Add Value</Button>}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="text-slate hover:text-navy"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <LoadingSpinner />}

          {!loading && values.length === 0 && (
            <p className="py-10 text-center text-sm text-slate">
              No values found for this dimension.
            </p>
          )}

          {!loading && values.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Code</th>
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 pr-2 font-medium">Description</th>
                  {isNaturalAccount && (
                    <>
                      <th className="py-2 pr-2 font-medium">Qualifier</th>
                      <th className="py-2 pr-2 font-medium">Normal Balance</th>
                      <th className="py-2 pr-2 font-medium">GST</th>
                      <th className="py-2 pr-2 font-medium">TDS</th>
                    </>
                  )}
                  <th className="py-2 pr-2 font-medium">Status</th>
                  {canManage && <th className="py-2 pr-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {[...values]
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                      <td className="py-2 pr-2 font-mono text-navy">{v.code}</td>
                      <td className="py-2 pr-2">{v.name}</td>
                      <td className="py-2 pr-2 text-slate">{v.description ?? '—'}</td>
                      {isNaturalAccount && (
                        <>
                          <td className="py-2 pr-2">{v.accountQualifier ?? '—'}</td>
                          <td className="py-2 pr-2">{v.normalBalance ?? '—'}</td>
                          <td className="py-2 pr-2">{v.gstApplicable ? '✓' : '—'}</td>
                          <td className="py-2 pr-2">
                            {v.tdsApplicable ? `✓${v.tdsSection ? ` (${v.tdsSection})` : ''}` : '—'}
                          </td>
                        </>
                      )}
                      <td className="py-2 pr-2">
                        <StatusBadge isActive={v.isActive} />
                      </td>
                      {canManage && (
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openEdit(v)}
                            >
                              Edit
                            </Button>
                            {v.isActive &&
                              (confirmId === v.id ? (
                                <span className="flex items-center gap-1 text-xs">
                                  Deactivate this value? This may affect journals using this
                                  combination.
                                  <Button
                                    variant="danger"
                                    className="px-2 py-1 text-xs"
                                    disabled={actingId === v.id}
                                    onClick={() => handleDeactivate(v)}
                                  >
                                    Yes
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    className="px-2 py-1 text-xs"
                                    disabled={actingId === v.id}
                                    onClick={() => setConfirmId(null)}
                                  >
                                    No
                                  </Button>
                                </span>
                              ) : (
                                <Button
                                  variant="danger"
                                  className="px-2 py-1 text-xs"
                                  disabled={actingId === v.id}
                                  onClick={() => setConfirmId(v.id)}
                                >
                                  Deactivate
                                </Button>
                              ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Edit Value' : 'Add Value'}
          subtitle={
            editing
              ? `Created: ${formatDate(editing.createdAt)} · Last modified: ${formatDate(
                  editing.updatedAt,
                )}`
              : undefined
          }
          onClose={() => setShowModal(false)}
          widthClassName="max-w-2xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                Save
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="dv-code"
              label="Code *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              error={errors.code}
            />
            <Input
              id="dv-name"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <div className="col-span-2">
              <label htmlFor="dv-description" className="text-xs font-medium uppercase tracking-wide text-slate">
                Description
              </label>
              <textarea
                id="dv-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue"
              />
            </div>
            <Input
              id="dv-display-order"
              label="Display Order"
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            />

            {isNaturalAccount && (
              <>
                <Select
                  id="dv-qualifier"
                  label="Qualifier *"
                  value={form.accountQualifier}
                  onChange={(e) => setForm({ ...form, accountQualifier: e.target.value })}
                >
                  {QUALIFIERS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </Select>
                <Select
                  id="dv-normal-balance"
                  label="Normal Balance *"
                  value={form.normalBalance}
                  onChange={(e) => setForm({ ...form, normalBalance: e.target.value })}
                >
                  {NORMAL_BALANCES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
                <Select
                  id="dv-parent"
                  label="Parent Account"
                  value={form.parentValueId}
                  onChange={(e) => setForm({ ...form, parentValueId: e.target.value })}
                >
                  <option value="">None</option>
                  {parentOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </Select>
                {form.tdsApplicable && (
                  <Input
                    id="dv-tds-section"
                    label="TDS Section"
                    value={form.tdsSection}
                    onChange={(e) => setForm({ ...form, tdsSection: e.target.value })}
                  />
                )}
              </>
            )}

            {isCostCentre && (
              <>
                <Input
                  id="dv-cc-department"
                  label="Department"
                  value={form.ccDepartment}
                  onChange={(e) => setForm({ ...form, ccDepartment: e.target.value })}
                />
                <Input
                  id="dv-cc-manager-name"
                  label="Manager Name"
                  value={form.ccManagerName}
                  onChange={(e) => setForm({ ...form, ccManagerName: e.target.value })}
                />
                <Input
                  id="dv-cc-manager-email"
                  label="Manager Email"
                  type="email"
                  value={form.ccManagerEmail}
                  onChange={(e) => setForm({ ...form, ccManagerEmail: e.target.value })}
                />
              </>
            )}

            <Input
              id="dv-valid-from"
              label="Valid From"
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
            <Input
              id="dv-valid-to"
              label="Valid To"
              type="date"
              value={form.validTo}
              onChange={(e) => setForm({ ...form, validTo: e.target.value })}
            />

            <div className="col-span-2 flex flex-wrap gap-6 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.isPostable}
                  onChange={(e) => setForm({ ...form, isPostable: e.target.checked })}
                />
                Is Postable
              </label>
              {isNaturalAccount && (
                <>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={form.isSummary}
                      onChange={(e) => setForm({ ...form, isSummary: e.target.checked })}
                    />
                    Is Summary
                  </label>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={form.gstApplicable}
                      onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })}
                    />
                    GST Applicable
                  </label>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={form.tdsApplicable}
                      onChange={(e) => setForm({ ...form, tdsApplicable: e.target.checked })}
                    />
                    TDS Applicable
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.budgetControlled}
                  onChange={(e) => setForm({ ...form, budgetControlled: e.target.checked })}
                />
                Budget Controlled
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
