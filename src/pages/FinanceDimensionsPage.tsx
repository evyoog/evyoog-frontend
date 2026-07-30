import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createFinanceDimension,
  listFinanceDimensions,
  listLedgers,
  updateFinanceDimension,
} from '../api/gl';
import type { FinanceDimension } from '../types';
import { formatDate } from '../utils/format';

const DIMENSION_TYPES = [
  'NATURAL_ACCOUNT',
  'COST_CENTRE',
  'PROFIT_CENTRE',
  'INTERCOMPANY',
  'PRODUCT',
  'PROJECT',
  'CUSTOM',
];

const TYPE_CLASSES: Record<string, string> = {
  NATURAL_ACCOUNT: 'bg-navy/10 text-navy',
  COST_CENTRE: 'bg-blue-light text-blue-dark',
  PROFIT_CENTRE: 'bg-green-light text-green',
  INTERCOMPANY: 'bg-amber-light text-amber',
  CUSTOM: 'bg-slate-100 text-slate',
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        TYPE_CLASSES[type] ?? 'bg-slate-100 text-slate'
      }`}
    >
      {type.replace('_', ' ')}
    </span>
  );
}

function RequiredBadge({ isRequired }: { isRequired: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        isRequired ? 'bg-green-light text-green' : 'bg-slate-100 text-slate'
      }`}
    >
      {isRequired ? 'Required' : 'Optional'}
    </span>
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

interface DimensionFormState {
  code: string;
  name: string;
  dimensionType: string;
  description: string;
  displayOrder: string;
}

const EMPTY_FORM: DimensionFormState = {
  code: '',
  name: '',
  dimensionType: DIMENSION_TYPES[0],
  description: '',
  displayOrder: '0',
};

export default function FinanceDimensionsPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:dimension:manage');

  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<FinanceDimension[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FinanceDimension | null>(null);
  const [form, setForm] = useState<DimensionFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof DimensionFormState, string>>>({});
  const [saving, setSaving] = useState(false);

  async function load(lid: string) {
    setLoading(true);
    try {
      const data = await listFinanceDimensions(lid);
      setDimensions(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load finance dimensions.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listLedgers(user.legalEntityId)
      .then((ledgers) => {
        if (cancelled) return;
        const lid = ledgers[0]?.id ?? null;
        setLedgerId(lid);
        if (lid) load(lid);
        else setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          showToast('Failed to load ledger.', 'error');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (d: FinanceDimension) => {
    setEditing(d);
    setForm({
      code: d.code,
      name: d.name,
      dimensionType: d.dimensionType,
      description: d.description ?? '',
      displayOrder: String(d.displayOrder),
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const next: Partial<Record<keyof DimensionFormState, string>> = {};
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.dimensionType) next.dimensionType = 'Type is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!ledgerId || !validate()) return;
    setSaving(true);
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        dimensionType: form.dimensionType,
        description: form.description.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
      };
      if (editing) {
        await updateFinanceDimension(editing.id, body);
        showToast('Dimension updated successfully.', 'success');
      } else {
        await createFinanceDimension({ ledgerId, ...body });
        showToast('Dimension created successfully.', 'success');
      }
      setShowModal(false);
      await load(ledgerId);
    } catch {
      showToast('Failed to save dimension. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalCount = dimensions.length;
  const requiredCount = dimensions.filter((d) => d.isRequired).length;
  const activeCount = dimensions.filter((d) => d.isActive).length;

  return (
    <AppLayout breadcrumb="Finance Dimensions">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Finance Dimensions</h1>
          <p className="mt-1 text-sm text-slate">Dimensions defined for Primary Ledger</p>
        </div>
        {canManage && <Button onClick={openAdd}>Add Dimension</Button>}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate">Total Dimensions</p>
          <p className="mt-1 text-2xl font-bold text-navy">{totalCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate">Required</p>
          <p className="mt-1 text-2xl font-bold text-navy">{requiredCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate">Optional</p>
          <p className="mt-1 text-2xl font-bold text-navy">{totalCount - requiredCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate">Active</p>
          <p className="mt-1 text-2xl font-bold text-navy">{activeCount}</p>
        </Card>
      </div>

      <Card className="mt-6">
        {loading && <LoadingSpinner />}

        {!loading && dimensions.length === 0 && (
          <p className="py-10 text-center text-sm text-slate">
            No finance dimensions found for this ledger.
          </p>
        )}

        {!loading && dimensions.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                <th className="py-2 pr-2 font-medium">Order</th>
                <th className="py-2 pr-2 font-medium">Code</th>
                <th className="py-2 pr-2 font-medium">Name</th>
                <th className="py-2 pr-2 font-medium">Type</th>
                <th className="py-2 pr-2 font-medium">Required</th>
                <th className="py-2 pr-2 font-medium">Values</th>
                <th className="py-2 pr-2 font-medium">Status</th>
                {canManage && <th className="py-2 pr-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {[...dimensions]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                    <td className="py-2 pr-2">{d.displayOrder}</td>
                    <td className="py-2 pr-2 font-mono text-navy">{d.code}</td>
                    <td className="py-2 pr-2">{d.name}</td>
                    <td className="py-2 pr-2">
                      <TypeBadge type={d.dimensionType} />
                    </td>
                    <td className="py-2 pr-2">
                      <RequiredBadge isRequired={d.isRequired} />
                    </td>
                    <td className="py-2 pr-2">{d.valueCount}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge isActive={d.isActive} />
                    </td>
                    {canManage && (
                      <td className="py-2 pr-2">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => openEdit(d)}
                        >
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && (
        <Modal
          title={editing ? 'Edit Dimension' : 'Add Dimension'}
          subtitle={editing ? `Created: ${formatDate(editing.createdAt)}` : undefined}
          onClose={() => setShowModal(false)}
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
          <div className="flex flex-col gap-4">
            <Input
              id="dim-code"
              label="Code *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              error={errors.code}
            />
            <Input
              id="dim-name"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <Select
              id="dim-type"
              label="Type *"
              value={form.dimensionType}
              onChange={(e) => setForm({ ...form, dimensionType: e.target.value })}
            >
              {DIMENSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </Select>
            <Input
              id="dim-description"
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              id="dim-display-order"
              label="Display Order"
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
