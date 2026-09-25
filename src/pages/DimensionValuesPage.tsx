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
  clearDimensionValueDefault,
  createDimensionValue,
  deactivateDimensionValue,
  getCoaStructureByLedger,
  listDimensionValues,
  getPrimaryLedgerId,
  setDimensionValueDefault,
  updateDimensionValue,
} from '../api/gl';
import type { CoaSegmentSummary, CoaStructure, DimensionValue } from '../types';
import { formatDate } from '../utils/format';
import { balancingBadge, dimensionTypeLabel } from '../utils/coaStructure';

const QUALIFIERS = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const NORMAL_BALANCES = ['DR', 'CR'];

const QUALIFIER_BADGE_CLASSES: Record<string, string> = {
  ASSET: 'bg-blue-light text-blue-dark',
  LIABILITY: 'bg-amber-light text-amber',
  EQUITY: 'bg-green-light text-green',
  REVENUE: 'bg-purple-100 text-purple-700',
  EXPENSE: 'bg-red-50 text-red-600',
};

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

function SummaryPostableBadge({ value }: { value: DimensionValue }) {
  if (value.isSummary) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-light px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-amber">
        Summary
      </span>
    );
  }
  if (value.isPostable) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-light px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-green">
        Postable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-slate">
      Not Postable
    </span>
  );
}

function QualifierBadge({ qualifier }: { qualifier: string | null }) {
  if (!qualifier) return <span className="text-slate">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        QUALIFIER_BADGE_CLASSES[qualifier] ?? 'bg-slate-100 text-slate'
      }`}
    >
      {qualifier}
    </span>
  );
}

function NormalBalanceBadge({ normalBalance }: { normalBalance: string | null }) {
  if (!normalBalance) return <span className="text-slate">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-navy">
      {normalBalance}
    </span>
  );
}

interface TreeGroup {
  key: string;
  label: string;
  items: DimensionValue[];
}

function groupForTree(dimensionType: string, values: DimensionValue[]): TreeGroup[] | null {
  if (dimensionType === 'NATURAL_ACCOUNT') {
    const groups: TreeGroup[] = QUALIFIERS.map((q) => ({
      key: q,
      label: `${q} (Summary)`,
      items: values.filter((v) => v.accountQualifier === q).sort((a, b) => a.displayOrder - b.displayOrder),
    })).filter((g) => g.items.length > 0);
    const others = values.filter((v) => !v.accountQualifier);
    if (others.length > 0) groups.push({ key: 'OTHER', label: 'Other', items: others });
    return groups;
  }

  const hasHierarchy = values.some((v) => v.parentValueId);
  if (!hasHierarchy) return null;

  const map = new Map<string, TreeGroup>();
  const roots: DimensionValue[] = [];
  for (const v of values) {
    if (v.parentValueId) {
      if (!map.has(v.parentValueId)) {
        map.set(v.parentValueId, {
          key: v.parentValueId,
          label: [v.parentValueCode, v.parentValueName].filter(Boolean).join(' — ') || 'Parent',
          items: [],
        });
      }
      map.get(v.parentValueId)!.items.push(v);
    } else {
      roots.push(v);
    }
  }
  const groups = Array.from(map.values());
  if (roots.length > 0) groups.unshift({ key: 'ROOT', label: 'Top Level', items: roots });
  return groups;
}

interface ValueFormState {
  code: string;
  name: string;
  description: string;
  displayOrder: string;
  isPostable: boolean;
  isSummary: boolean;
  parentValueId: string;
  accountQualifier: string;
  normalBalance: string;
  gstApplicable: boolean;
  tdsApplicable: boolean;
  tdsSection: string;
  ccDepartment: string;
  ccManagerName: string;
  ccManagerEmail: string;
}

const EMPTY_FORM: ValueFormState = {
  code: '',
  name: '',
  description: '',
  displayOrder: '0',
  isPostable: true,
  isSummary: false,
  parentValueId: '',
  accountQualifier: QUALIFIERS[0],
  normalBalance: NORMAL_BALANCES[0],
  gstApplicable: false,
  tdsApplicable: false,
  tdsSection: '',
  ccDepartment: '',
  ccManagerName: '',
  ccManagerEmail: '',
};

export default function DimensionValuesPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:dimension:manage');

  const [coaStructure, setCoaStructure] = useState<CoaStructure | null>(null);
  const [valuesByDimension, setValuesByDimension] = useState<Record<string, DimensionValue[]>>({});
  const [activeDimensionId, setActiveDimensionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmDefaultId, setConfirmDefaultId] = useState<string | null>(null);
  const [defaultActingId, setDefaultActingId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DimensionValue | null>(null);
  const [form, setForm] = useState<ValueFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<'code' | 'name' | 'accountQualifier' | 'normalBalance', string>>
  >({});
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const ledgerId = await getPrimaryLedgerId(user.legalEntityId);
      if (!ledgerId) {
        setCoaStructure(null);
        setLoading(false);
        return;
      }
      const structure = await getCoaStructureByLedger(ledgerId);
      const segments = [...structure.segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
      setCoaStructure({ ...structure, segments });
      setActiveDimensionId((prev) => (prev && segments.some((s) => s.id === prev) ? prev : segments[0]?.id ?? null));

      const entries = await Promise.all(
        segments.map(async (seg): Promise<[string, DimensionValue[]]> => {
          try {
            const vals = await listDimensionValues(seg.id);
            return [seg.id, Array.isArray(vals) ? vals : []];
          } catch {
            return [seg.id, []];
          }
        }),
      );
      setValuesByDimension(Object.fromEntries(entries));
    } catch {
      setError(true);
      showToast('Failed to load dimension values.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function reloadActiveValues() {
    if (!activeDimensionId) return;
    try {
      const vals = await listDimensionValues(activeDimensionId);
      setValuesByDimension((prev) => ({ ...prev, [activeDimensionId]: Array.isArray(vals) ? vals : [] }));
    } catch {
      showToast('Failed to refresh dimension values.', 'error');
    }
  }

  const segments = coaStructure?.segments ?? [];
  const activeDimension: CoaSegmentSummary | undefined = segments.find((s) => s.id === activeDimensionId);
  const activeValues = activeDimensionId ? valuesByDimension[activeDimensionId] ?? [] : [];
  const isNaturalAccount = activeDimension?.dimensionType === 'NATURAL_ACCOUNT';
  const isCostCentre = activeDimension?.dimensionType === 'COST_CENTRE';
  const supportsTree = activeDimension?.dimensionType === 'NATURAL_ACCOUNT' || activeDimension?.dimensionType === 'COST_CENTRE';

  const totalDimensions = segments.length;
  const allValues = segments.flatMap((s) => valuesByDimension[s.id] ?? []);
  const totalValues = allValues.length;
  const postableValues = allValues.filter((v) => !v.isSummary).length;
  const summaryValues = allValues.filter((v) => v.isSummary).length;

  function switchTab(dimensionId: string) {
    setActiveDimensionId(dimensionId);
    setViewMode('table');
    setCollapsedGroups(new Set());
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
      isSummary: v.isSummary,
      parentValueId: v.parentValueId ?? '',
      accountQualifier: v.accountQualifier ?? QUALIFIERS[0],
      normalBalance: v.normalBalance ?? NORMAL_BALANCES[0],
      gstApplicable: v.gstApplicable,
      tdsApplicable: v.tdsApplicable,
      tdsSection: v.tdsSection ?? '',
      ccDepartment: v.ccDepartment ?? '',
      ccManagerName: v.ccManagerName ?? '',
      ccManagerEmail: v.ccManagerEmail ?? '',
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
    if (!activeDimensionId || !validate()) return;
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
        isSummary: form.isSummary,
        parentValueId: form.parentValueId || null,
      };
      if (isNaturalAccount) {
        body.accountQualifier = form.accountQualifier;
        body.normalBalance = form.normalBalance;
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
        await createDimensionValue({ financeDimensionId: activeDimensionId, code, name, ...body });
        showToast('Value created successfully.', 'success');
      }
      setShowModal(false);
      await reloadActiveValues();
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
      await reloadActiveValues();
    } catch {
      showToast('Failed to deactivate value. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleSetDefault = async (v: DimensionValue) => {
    setDefaultActingId(v.id);
    setConfirmDefaultId(null);
    try {
      await setDimensionValueDefault(v.id);
      showToast(`${v.name} is now the default for ${activeDimension?.name ?? 'this dimension'}`, 'success');
      await reloadActiveValues();
    } catch {
      showToast('Failed to set default value. Please try again.', 'error');
    } finally {
      setDefaultActingId(null);
    }
  };

  const handleClearDefault = async (v: DimensionValue) => {
    setDefaultActingId(v.id);
    try {
      await clearDimensionValueDefault(v.id);
      showToast(`Default cleared for ${activeDimension?.name ?? 'this dimension'}`, 'success');
      await reloadActiveValues();
    } catch {
      showToast('Failed to clear default. Please try again.', 'error');
    } finally {
      setDefaultActingId(null);
    }
  };

  const parentOptions = activeValues.filter((v) => !editing || v.id !== editing.id);
  const showDefaultColumn = !!activeDimension && !activeDimension.isRequired;

  function renderRow(v: DimensionValue) {
    return (
      <tr key={v.id} className="border-b border-border last:border-0 hover:bg-offwhite">
        <td className="py-2 pr-2 font-mono text-navy">{v.code}</td>
        <td className="py-2 pr-2">{v.name}</td>
        <td className="py-2 pr-2">
          <SummaryPostableBadge value={v} />
        </td>
        {isNaturalAccount && (
          <>
            <td className="py-2 pr-2">
              <QualifierBadge qualifier={v.accountQualifier} />
            </td>
            <td className="py-2 pr-2">
              <NormalBalanceBadge normalBalance={v.normalBalance} />
            </td>
            <td className="py-2 pr-2">{v.gstApplicable ? '✓' : '—'}</td>
            <td className="py-2 pr-2">
              {v.tdsApplicable ? `✓${v.tdsSection ? ` (${v.tdsSection})` : ''}` : '—'}
            </td>
          </>
        )}
        {isCostCentre && (
          <>
            <td className="py-2 pr-2">{v.ccDepartment ?? '—'}</td>
            <td className="py-2 pr-2">{v.ccManagerName ?? '—'}</td>
          </>
        )}
        {showDefaultColumn && (
          <td className="py-2 pr-2">
            {v.isDefault ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green">★ Default</span>
            ) : (
              <span className="text-slate">—</span>
            )}
          </td>
        )}
        <td className="py-2 pr-2">
          <StatusBadge isActive={v.isActive} />
        </td>
        {canManage && (
          <td className="py-2 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => openEdit(v)}>
                Edit
              </Button>
              {showDefaultColumn &&
                (v.isDefault ? (
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    disabled={defaultActingId === v.id}
                    onClick={() => handleClearDefault(v)}
                  >
                    Clear Default
                  </Button>
                ) : confirmDefaultId === v.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    Set as default?
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      disabled={defaultActingId === v.id}
                      onClick={() => handleSetDefault(v)}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      disabled={defaultActingId === v.id}
                      onClick={() => setConfirmDefaultId(null)}
                    >
                      No
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    disabled={defaultActingId === v.id}
                    onClick={() => setConfirmDefaultId(v.id)}
                  >
                    Set Default
                  </Button>
                ))}
              {v.isActive &&
                (confirmId === v.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    Deactivate?
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
    );
  }

  function renderTable(list: DimensionValue[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
              <th className="py-2 pr-2 font-medium">Code</th>
              <th className="py-2 pr-2 font-medium">Name</th>
              <th className="py-2 pr-2 font-medium">Summary/Postable</th>
              {isNaturalAccount && (
                <>
                  <th className="py-2 pr-2 font-medium">Qualifier</th>
                  <th className="py-2 pr-2 font-medium">Normal Balance</th>
                  <th className="py-2 pr-2 font-medium">GST</th>
                  <th className="py-2 pr-2 font-medium">TDS</th>
                </>
              )}
              {isCostCentre && (
                <>
                  <th className="py-2 pr-2 font-medium">Department</th>
                  <th className="py-2 pr-2 font-medium">Manager</th>
                </>
              )}
              {showDefaultColumn && <th className="py-2 pr-2 font-medium">Default</th>}
              <th className="py-2 pr-2 font-medium">Status</th>
              {canManage && <th className="py-2 pr-2 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>{[...list].sort((a, b) => a.displayOrder - b.displayOrder).map(renderRow)}</tbody>
        </table>
      </div>
    );
  }

  const treeGroups = activeDimension ? groupForTree(activeDimension.dimensionType, activeValues) : null;

  return (
    <AppLayout breadcrumb="Dimension Values">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dimension Values</h1>
          <p className="mt-1 text-sm text-slate">
            Manage values for each financial dimension
            {coaStructure ? ` in ${coaStructure.name}` : ''}
          </p>
        </div>
        {canManage && activeDimensionId && (
          <Button onClick={openAdd} aria-label="Add new value">
            Add Value
          </Button>
        )}
      </div>

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={4} />
          <div className="mt-6">
            <TableSkeleton rows={5} columns={6} />
          </div>
        </div>
      )}

      {!loading && error && (
        <Card className="mt-6">
          <ErrorState
            message="Failed to load dimension values. Please try again."
            onRetry={loadAll}
          />
        </Card>
      )}

      {!loading && !error && segments.length === 0 && (
        <Card className="mt-6">
          <EmptyState
            title="No COA structure assigned to this ledger"
            message="Assign a COA Structure to the ledger before managing dimension values."
          />
        </Card>
      )}

      {!loading && !error && segments.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-4 gap-4">
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate">Total Dimensions</p>
              <p className="mt-1 text-2xl font-bold text-navy">{totalDimensions}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate">Total Values</p>
              <p className="mt-1 text-2xl font-bold text-navy">{totalValues}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate">Postable Values</p>
              <p className="mt-1 text-2xl font-bold text-navy">{postableValues}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-slate">Summary Values</p>
              <p className="mt-1 text-2xl font-bold text-navy">{summaryValues}</p>
            </Card>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
            {segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => switchTab(seg.id)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeDimensionId === seg.id
                    ? 'border-blue text-blue'
                    : 'border-transparent text-slate hover:text-navy'
                }`}
              >
                {dimensionTypeLabel(seg.dimensionType)} ({(valuesByDimension[seg.id] ?? []).length})
                {seg.isBalancing && <span aria-label="Balancing segment"> ⚖</span>}
              </button>
            ))}
          </div>

          <Card className="mt-6">
            {activeDimension && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                  {activeDimension.name} Values
                  {(() => {
                    const badge = balancingBadge(activeDimension.balancingSequence);
                    return (
                      badge && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.label} Segment ⚖
                        </span>
                      )
                    );
                  })()}
                </h2>
              </div>
            )}

            {activeDimension?.isBalancing && (
              <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
                <p className="font-semibold">
                  ⚖ {activeDimension.balancingSequence === 2 ? 'Secondary' : 'Tertiary'} Balancing Segment
                </p>
                <p className="mt-1">
                  Journals must balance within each {activeDimension.name} value.
                </p>
                <p className="mt-1 text-xs text-purple-700">PostingEngine enforcement: coming in V30b</p>
              </div>
            )}

            {activeDimension && (
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate">{activeValues.length} values</p>
                {supportsTree && (
                  <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        viewMode === 'table' ? 'bg-blue text-white' : 'text-slate hover:text-navy'
                      }`}
                    >
                      Table View
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('tree')}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        viewMode === 'tree' ? 'bg-blue text-white' : 'text-slate hover:text-navy'
                      }`}
                    >
                      Tree View
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeValues.length === 0 && (
              <EmptyState
                title={`No values defined for ${activeDimension?.name ?? 'this dimension'}`}
                message="Add values to define valid entries for this dimension."
                action={canManage ? { label: 'Add Value', onClick: openAdd } : undefined}
              />
            )}

            {activeValues.length > 0 && viewMode === 'table' && renderTable(activeValues)}

            {activeValues.length > 0 && viewMode === 'tree' && (
              <div>
                {treeGroups === null && (
                  <>
                    <p className="mb-3 text-xs text-slate">
                      No hierarchy defined for this dimension yet — showing flat list.
                    </p>
                    {renderTable(activeValues)}
                  </>
                )}
                {treeGroups !== null &&
                  treeGroups.map((group) => (
                    <div key={group.key} className="mb-3">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex items-center gap-2 text-sm font-semibold text-navy"
                      >
                        <span>{collapsedGroups.has(group.key) ? '▶' : '▼'}</span>
                        {group.label}
                      </button>
                      {!collapsedGroups.has(group.key) && (
                        <div className="ml-5 mt-1 divide-y divide-border">
                          {group.items.map((v) => (
                            <div key={v.id} className="flex items-center gap-4 py-1.5 text-sm">
                              <span className="w-20 font-mono text-navy">{v.code}</span>
                              <span className="flex-1">{v.name}</span>
                              <SummaryPostableBadge value={v} />
                              {v.normalBalance && <NormalBalanceBadge normalBalance={v.normalBalance} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Edit Value' : 'Add Value'}
          subtitle={
            editing
              ? `Created: ${formatDate(editing.createdAt)} · Last modified: ${formatDate(editing.updatedAt)}`
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
            <Select
              id="dv-parent"
              label="Parent Value"
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

            <div className="col-span-2 flex flex-wrap gap-6 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.isPostable}
                  onChange={(e) => setForm({ ...form, isPostable: e.target.checked })}
                />
                Is Postable
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.isSummary}
                  onChange={(e) => setForm({ ...form, isSummary: e.target.checked })}
                />
                Is Summary
              </label>
              {form.isSummary && (
                <p className="w-full text-xs text-slate">Summary values cannot be posted to directly.</p>
              )}
              {isNaturalAccount && (
                <>
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
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
