import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
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
  createAccountCombination,
  deactivateAccountCombination,
  listAccountCombinations,
  listDimensionValues,
  listFinanceDimensions,
  getPrimaryLedger,
  toggleDynamicInsert,
  updateAccountCombination,
} from '../api/gl';
import type { AccountCombination, DimensionValue, FinanceDimension, Ledger } from '../types';
import { formatDate } from '../utils/format';

const SEGMENT_ORDER = ['NATURAL_ACCOUNT', 'COST_CENTRE', 'PRODUCT'];

const SEGMENT_CLASSES: Record<string, string> = {
  NATURAL_ACCOUNT: 'bg-navy/10 text-navy',
  COST_CENTRE: 'bg-blue-light text-blue-dark',
  PRODUCT: 'bg-green-light text-green',
};

function segmentRank(type: string) {
  const i = SEGMENT_ORDER.indexOf(type);
  return i === -1 ? SEGMENT_ORDER.length : i;
}

function sortDimensions(a: FinanceDimension, b: FinanceDimension) {
  const rankDiff = segmentRank(a.dimensionType) - segmentRank(b.dimensionType);
  return rankDiff !== 0 ? rankDiff : a.displayOrder - b.displayOrder;
}

function sortedSegments(combination: Record<string, string>) {
  return Object.entries(combination).sort(([a], [b]) => segmentRank(a) - segmentRank(b));
}

function SegmentBadge({
  type,
  code,
  valueMap,
}: {
  type: string;
  code: string;
  valueMap: Record<string, string>;
}) {
  const name = valueMap[code];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        SEGMENT_CLASSES[type] ?? 'bg-slate-100 text-slate'
      }`}
    >
      {code}
      {name ? ` ${name}` : ''}
    </span>
  );
}

function TypeBadge({ isDynamic }: { isDynamic: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        isDynamic ? 'bg-amber-light text-amber' : 'bg-green-light text-green'
      }`}
    >
      {isDynamic ? 'Auto' : 'Approved'}
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

interface AddFormState {
  values: Record<string, string>;
  description: string;
}

const EMPTY_ADD_FORM: AddFormState = { values: {}, description: '' };

export default function AccountCombinationsPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission('gl:accounts:create');
  const canEdit = hasPermission('gl:accounts:edit');
  const canManageLedger = hasPermission('gl:ledger:manage');

  const [legalEntityId, setLegalEntityId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [dimensions, setDimensions] = useState<FinanceDimension[]>([]);
  const [dimensionValues, setDimensionValues] = useState<Record<string, DimensionValue[]>>({});
  const [valueMap, setValueMap] = useState<Record<string, string>>({});

  const [combinations, setCombinations] = useState<AccountCombination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [costCentreFilter, setCostCentreFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [confirmToggleOff, setConfirmToggleOff] = useState(false);
  const [togglingInsert, setTogglingInsert] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitError, setAddSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<AccountCombination | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  async function loadCombinations(lid: string, leId: string) {
    setLoading(true);
    setError(false);
    try {
      const data = await listAccountCombinations(lid, leId);
      setCombinations(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
      showToast('Failed to load account combinations.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadDimensionsAndValues(lid: string) {
    try {
      const dims = await listFinanceDimensions(lid);
      const activeDims = dims.filter((d) => d.isActive).sort(sortDimensions);
      setDimensions(activeDims);
      const byDim: Record<string, DimensionValue[]> = {};
      const flatMap: Record<string, string> = {};
      await Promise.all(
        activeDims.map(async (d) => {
          const vals = await listDimensionValues(d.id);
          const activeVals = vals.filter((v) => v.isActive);
          byDim[d.id] = activeVals;
          activeVals.forEach((v) => {
            flatMap[v.code] = v.name;
          });
        }),
      );
      setDimensionValues(byDim);
      setValueMap(flatMap);
    } catch {
      showToast('Failed to load finance dimensions.', 'error');
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLegalEntityId(user.legalEntityId);
    getPrimaryLedger(user.legalEntityId)
      .then((led) => {
        if (cancelled) return;
        setLedger(led);
        if (led) {
          loadDimensionsAndValues(led.id);
          loadCombinations(led.id, user.legalEntityId);
        } else {
          setLoading(false);
        }
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

  const costCentreDim = dimensions.find((d) => d.dimensionType === 'COST_CENTRE');
  const productDim = dimensions.find((d) => d.dimensionType === 'PRODUCT');
  const costCentreOptions = costCentreDim ? dimensionValues[costCentreDim.id] ?? [] : [];
  const productOptions = productDim ? dimensionValues[productDim.id] ?? [] : [];

  const displayedCombinations = useMemo(() => {
    return combinations
      .filter((c) => (costCentreFilter ? c.combination.COST_CENTRE === costCentreFilter : true))
      .filter((c) => (productFilter ? c.combination.PRODUCT === productFilter : true))
      .filter((c) => {
        if (statusFilter === 'ALL') return true;
        return statusFilter === 'ACTIVE' ? c.isActive : !c.isActive;
      })
      .sort((a, b) => a.combinationCode.localeCompare(b.combinationCode));
  }, [combinations, costCentreFilter, productFilter, statusFilter]);

  const totalCount = combinations.length;
  const activeCount = combinations.filter((c) => c.isActive).length;
  const dynamicCount = combinations.filter((c) => c.isDynamic).length;
  const manualCount = combinations.filter((c) => !c.isDynamic).length;

  const handleToggleDynamicInsert = async (nextValue: boolean) => {
    if (!ledger || !user) return;
    setTogglingInsert(true);
    setConfirmToggleOff(false);
    try {
      const updated = await toggleDynamicInsert(ledger.id, nextValue, user.email);
      setLedger((prev) =>
        prev ? { ...prev, allowDynamicInsert: updated?.allowDynamicInsert ?? nextValue } : prev,
      );
      showToast(`Dynamic Insert turned ${nextValue ? 'on' : 'off'}.`, 'success');
    } catch {
      showToast('Failed to update Dynamic Insert setting. Please try again.', 'error');
    } finally {
      setTogglingInsert(false);
    }
  };

  const openAdd = () => {
    setAddForm(EMPTY_ADD_FORM);
    setAddErrors({});
    setAddSubmitError(null);
    setShowAddModal(true);
  };

  const buildPreview = (values: Record<string, string>) =>
    dimensions
      .map((d) => values[d.id])
      .filter(Boolean)
      .join('.');

  const validateAdd = () => {
    const next: Record<string, string> = {};
    dimensions.forEach((d) => {
      if (d.isRequired && !addForm.values[d.id]) {
        next[d.id] = `${d.name} is required`;
      }
    });
    setAddErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (!ledger || !legalEntityId || !validateAdd()) return;
    setSaving(true);
    setAddSubmitError(null);
    try {
      const combination: Record<string, string> = {};
      dimensions.forEach((d) => {
        const val = addForm.values[d.id];
        if (val) combination[d.dimensionType] = val;
      });
      await createAccountCombination({
        ledgerId: ledger.id,
        legalEntityId,
        combination,
        description: addForm.description.trim() || undefined,
      });
      showToast('Account combination created successfully.', 'success');
      setShowAddModal(false);
      await loadCombinations(ledger.id, legalEntityId);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setAddSubmitError(message || 'Failed to create combination. It may already exist.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: AccountCombination) => {
    setEditing(c);
    setEditDescription(c.description ?? '');
    setEditIsActive(c.isActive);
  };

  const handleSaveEdit = async () => {
    if (!editing || !ledger || !legalEntityId) return;
    setEditSaving(true);
    try {
      await updateAccountCombination(editing.id, {
        description: editDescription.trim(),
        isActive: editIsActive,
      });
      showToast('Combination updated successfully.', 'success');
      setEditing(null);
      await loadCombinations(ledger.id, legalEntityId);
    } catch {
      showToast('Failed to update combination. Please try again.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeactivate = async (c: AccountCombination) => {
    if (!ledger || !legalEntityId) return;
    setActingId(c.id);
    setConfirmDeactivateId(null);
    try {
      await deactivateAccountCombination(c.id);
      showToast('Combination deactivated.', 'success');
      await loadCombinations(ledger.id, legalEntityId);
    } catch {
      showToast('Failed to deactivate combination. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const noCombinationsAtAll = !loading && !error && totalCount === 0;

  return (
    <AppLayout breadcrumb="Account Combinations">
      <div>
        <h1 className="text-2xl font-bold text-navy">Account Combinations</h1>
        <p className="mt-1 text-sm text-slate">
          Pre-approved account segment combinations for Primary Ledger
        </p>
      </div>

      {ledger && (
        <div
          className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
            ledger.allowDynamicInsert
              ? 'border-green-200 bg-green-light/40'
              : 'border-amber-200 bg-amber-light/40'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
                ledger.allowDynamicInsert ? 'bg-green-light text-green' : 'bg-amber-light text-amber'
              }`}
            >
              Dynamic Insert: {ledger.allowDynamicInsert ? 'ON' : 'OFF'}
            </span>
            <p className="text-sm text-slate">
              {ledger.allowDynamicInsert
                ? 'When ON, new combinations are auto-registered on first posting.'
                : 'When OFF, only combinations in this list may be posted.'}
            </p>
          </div>
          {canManageLedger &&
            (confirmToggleOff ? (
              <span className="flex flex-wrap items-center gap-2 text-xs">
                Turning off Dynamic Insert means only pre-approved combinations can be posted. Are
                you sure?
                <Button
                  variant="amber"
                  className="px-2 py-1 text-xs"
                  disabled={togglingInsert}
                  onClick={() => handleToggleDynamicInsert(false)}
                >
                  Yes, turn off
                </Button>
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  disabled={togglingInsert}
                  onClick={() => setConfirmToggleOff(false)}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                variant={ledger.allowDynamicInsert ? 'amber' : 'secondary'}
                loading={togglingInsert}
                onClick={() =>
                  ledger.allowDynamicInsert
                    ? setConfirmToggleOff(true)
                    : handleToggleDynamicInsert(true)
                }
              >
                Turn {ledger.allowDynamicInsert ? 'Off' : 'On'}
              </Button>
            ))}
        </div>
      )}

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={4} />
        </div>
      )}

      {!loading && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Total Combinations</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Active</p>
            <p className="mt-1 text-2xl font-bold text-navy">{activeCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Dynamic</p>
            <p className="mt-1 text-2xl font-bold text-navy">{dynamicCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Manual</p>
            <p className="mt-1 text-2xl font-bold text-navy">{manualCount}</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Select
                id="ac-cost-centre-filter"
                label="Cost Centre"
                aria-label="Filter by Cost Centre"
                value={costCentreFilter}
                onChange={(e) => setCostCentreFilter(e.target.value)}
              >
                <option value="">All</option>
                {costCentreOptions.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <Select
                id="ac-product-filter"
                label="Product"
                aria-label="Filter by Product"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="">All</option>
                {productOptions.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select
                id="ac-status-filter"
                label="Status"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          </div>
          {canCreate && (
            <Button onClick={openAdd} aria-label="Add new account combination">
              Add Combination
            </Button>
          )}
        </div>

        <div className="mt-6">
          {loading && <TableSkeleton rows={6} columns={7} />}

          {!loading && error && (
            <ErrorState
              message="Failed to load account combinations. Please try again."
              onRetry={() => ledger && legalEntityId && loadCombinations(ledger.id, legalEntityId)}
            />
          )}

          {!loading && !error && noCombinationsAtAll && (
            <EmptyState
              title="No account combinations defined"
              message="Add combinations manually or enable Dynamic Insert to auto-register on posting."
              action={canCreate ? { label: 'Add Combination', onClick: openAdd } : undefined}
            />
          )}

          {!loading && !error && !noCombinationsAtAll && displayedCombinations.length === 0 && (
            <EmptyState
              title="No combinations match your filters"
              message="Try adjusting your search or filters."
            />
          )}

          {!loading && !error && displayedCombinations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                    <th className="py-2 pr-2 font-medium">Combination Code</th>
                    <th className="py-2 pr-2 font-medium">Segments</th>
                    <th className="py-2 pr-2 font-medium">Type</th>
                    <th className="py-2 pr-2 font-medium">Description</th>
                    <th className="py-2 pr-2 font-medium">First Used</th>
                    <th className="py-2 pr-2 font-medium">Status</th>
                    {canEdit && <th className="py-2 pr-2 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayedCombinations.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                      <td className="py-2 pr-2 font-mono text-navy">{c.combinationCode}</td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap gap-1.5">
                          {sortedSegments(c.combination).map(([type, code]) => (
                            <SegmentBadge key={type} type={type} code={code} valueMap={valueMap} />
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <TypeBadge isDynamic={c.isDynamic} />
                      </td>
                      <td className="py-2 pr-2 text-slate">{c.description ?? '—'}</td>
                      <td className="py-2 pr-2">
                        {c.firstUsedAt ? formatDate(c.firstUsedAt) : 'Never'}
                      </td>
                      <td className="py-2 pr-2">
                        <StatusBadge isActive={c.isActive} />
                      </td>
                      {canEdit && (
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openEdit(c)}
                              aria-label={`Edit ${c.combinationCode}`}
                            >
                              Edit
                            </Button>
                            {c.isActive &&
                              (confirmDeactivateId === c.id ? (
                                <span className="flex items-center gap-1 text-xs">
                                  Deactivating this combination will prevent future postings using
                                  it.
                                  <Button
                                    variant="danger"
                                    className="px-2 py-1 text-xs"
                                    disabled={actingId === c.id}
                                    onClick={() => handleDeactivate(c)}
                                  >
                                    Yes
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    className="px-2 py-1 text-xs"
                                    disabled={actingId === c.id}
                                    onClick={() => setConfirmDeactivateId(null)}
                                  >
                                    No
                                  </Button>
                                </span>
                              ) : (
                                <Button
                                  variant="danger"
                                  className="px-2 py-1 text-xs"
                                  disabled={actingId === c.id}
                                  onClick={() => setConfirmDeactivateId(c.id)}
                                  aria-label={`Deactivate ${c.combinationCode}`}
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
            </div>
          )}
        </div>
      </Card>

      {showAddModal && (
        <Modal
          title="Add Account Combination"
          onClose={() => setShowAddModal(false)}
          widthClassName="max-w-xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={saving}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {dimensions.map((d) => (
              <Select
                key={d.id}
                id={`ac-dim-${d.id}`}
                label={`${d.name}${d.isRequired ? ' *' : ''}`}
                value={addForm.values[d.id] ?? ''}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, values: { ...f.values, [d.id]: e.target.value } }))
                }
                error={addErrors[d.id]}
              >
                <option value="">{d.isRequired ? 'Select...' : '— None —'}</option>
                {(dimensionValues[d.id] ?? []).map((v) => (
                  <option key={v.id} value={v.code}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </Select>
            ))}

            <div className="rounded-md border border-border bg-offwhite px-3 py-2 font-mono text-sm text-navy">
              Combination: {buildPreview(addForm.values) || '—'}
            </div>

            <Input
              id="ac-description"
              label="Description"
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
            />

            {addSubmitError && <p className="text-xs text-red-600">{addSubmitError}</p>}
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title="Edit Account Combination"
          subtitle={`Created: ${formatDate(editing.createdAt)} by ${editing.createdBy} · Last modified: ${formatDate(
            editing.updatedAt,
          )} by ${editing.updatedBy}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={editSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} loading={editSaving}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Combination</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {sortedSegments(editing.combination).map(([type, code]) => (
                  <SegmentBadge key={type} type={type} code={code} valueMap={valueMap} />
                ))}
              </div>
              <p className="mt-1 font-mono text-sm text-navy">{editing.combinationCode}</p>
            </div>
            <Input
              id="ac-edit-description"
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
              />
              Is Active
            </label>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
