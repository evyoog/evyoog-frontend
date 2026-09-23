import { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import CoaStructureEditPanel from '../components/CoaStructureEditPanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createCoaStructure, getCoaCombinationFormat, listCoaStructures } from '../api/gl';
import type { CoaSegmentSummary, CoaStructure } from '../types';
import { formatDate } from '../utils/format';
import {
  OPTIONAL_DIMENSION_TYPES,
  autoSegmentCode,
  balancingBadge,
  buildCombinationPreview,
  dimensionTypeBadgeClass,
  dimensionTypeLabel,
} from '../utils/coaStructure';

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

function RequiredBadge({ isRequired }: { isRequired: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
        isRequired ? 'bg-green-light text-green' : 'bg-slate-100 text-slate'
      }`}
    >
      {isRequired ? 'Mandatory' : 'Optional'}
    </span>
  );
}

function DimensionTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${dimensionTypeBadgeClass(
        type,
      )}`}
    >
      {dimensionTypeLabel(type)}
    </span>
  );
}

function SegmentRow({ segment }: { segment: CoaSegmentSummary }) {
  const badge = balancingBadge(segment.balancingSequence);
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
        {segment.segmentNumber}
      </span>
      <span className="font-mono text-navy">{segment.code}</span>
      <span className="text-slate">{segment.name}</span>
      <RequiredBadge isRequired={segment.isRequired} />
      <DimensionTypeBadge type={segment.dimensionType} />
      {badge && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      <span className="text-xs text-slate">
        {segment.valueCount} value{segment.valueCount === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function CoaStructureCard({
  structure,
  format,
  canManage,
  onEdit,
}: {
  structure: CoaStructure;
  format: string | undefined;
  canManage: boolean;
  onEdit: (s: CoaStructure) => void;
}) {
  const sortedSegments = [...structure.segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
  const secondaryBalancing = sortedSegments
    .filter((s) => s.isBalancing)
    .sort((a, b) => (a.balancingSequence ?? 0) - (b.balancingSequence ?? 0));
  const balancingSummary =
    secondaryBalancing.length > 0
      ? `Legal Entity (primary) + ${secondaryBalancing.map((s) => s.name).join(' + ')} (secondary)`
      : 'Legal Entity (primary) only';
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-bold text-navy">{structure.code}</p>
          <p className="text-sm text-slate">{structure.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge isActive={structure.isActive} />
          {canManage && (
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => onEdit(structure)}
              aria-label={`Edit ${structure.code}`}
            >
              Edit
            </Button>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate">
        Legal Entity is always the primary balancing segment (implicit)
      </p>

      {structure.description && <p className="mt-2 text-sm text-slate">{structure.description}</p>}

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate">
          Segments ({structure.segmentCount})
        </p>
        <div className="mt-1 divide-y divide-border">
          {sortedSegments.map((seg) => (
            <SegmentRow key={seg.id} segment={seg} />
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate">Combination Format</p>
        <code className="mt-1 inline-block rounded bg-offwhite px-2 py-1 font-mono text-sm text-navy">
          {format ?? buildCombinationPreview(sortedSegments.map((s) => s.code), structure.separator)}
        </code>
      </div>

      <p className="mt-4 text-xs text-slate">Balancing Segments: {balancingSummary}</p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-slate">
        <span>
          Assigned to: {structure.assignedLedgerCount} Ledger
          {structure.assignedLedgerCount === 1 ? '' : 's'}
        </span>
        <span>Created: {formatDate(structure.createdAt)}</span>
      </div>
    </Card>
  );
}

interface AddSegmentRow {
  dimensionType: string;
  code: string;
  name: string;
  isRequired: boolean;
  locked: boolean;
}

const NATURAL_ACCOUNT_ROW: AddSegmentRow = {
  dimensionType: 'NATURAL_ACCOUNT',
  code: 'NAT-ACCT',
  name: 'Natural Account',
  isRequired: true,
  locked: true,
};

interface AddFormState {
  code: string;
  name: string;
  description: string;
  segments: AddSegmentRow[];
}

const EMPTY_ADD_FORM: AddFormState = {
  code: '',
  name: '',
  description: '',
  segments: [NATURAL_ACCOUNT_ROW],
};

export default function CoaStructurePage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:ledger:manage');

  const [structures, setStructures] = useState<CoaStructure[]>([]);
  const [formats, setFormats] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitError, setAddSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingStructure, setEditingStructure] = useState<CoaStructure | null>(null);

  async function loadStructures() {
    if (!user?.businessGroupId) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await listCoaStructures(user.businessGroupId);
      const list = Array.isArray(data) ? data : [];
      setStructures(list);
      const entries = await Promise.all(
        list.map(async (s) => {
          try {
            return [s.id, await getCoaCombinationFormat(s.id)] as const;
          } catch {
            return [
              s.id,
              buildCombinationPreview(
                [...s.segments].sort((a, b) => a.segmentNumber - b.segmentNumber).map((seg) => seg.code),
                s.separator,
              ),
            ] as const;
          }
        }),
      );
      setFormats(Object.fromEntries(entries));
    } catch {
      setError(true);
      showToast('Failed to load COA Structures.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalStructures = structures.length;
  const activeStructures = structures.filter((s) => s.isActive).length;
  const totalLedgersUsing = structures.reduce((sum, s) => sum + s.assignedLedgerCount, 0);

  const openAdd = () => {
    setAddForm(EMPTY_ADD_FORM);
    setAddErrors({});
    setAddSubmitError(null);
    setShowAddModal(true);
  };

  const usedOptionalTypes = addForm.segments
    .filter((s) => !s.locked)
    .map((s) => s.dimensionType);
  const canAddSegment = usedOptionalTypes.length < OPTIONAL_DIMENSION_TYPES.length;

  const handleAddSegmentRow = () => {
    const nextType = OPTIONAL_DIMENSION_TYPES.find((t) => !usedOptionalTypes.includes(t));
    if (!nextType) return;
    setAddForm((f) => ({
      ...f,
      segments: [
        ...f.segments,
        {
          dimensionType: nextType,
          code: autoSegmentCode(nextType),
          name: dimensionTypeLabel(nextType),
          isRequired: true,
          locked: false,
        },
      ],
    }));
  };

  const handleRemoveSegmentRow = (index: number) => {
    setAddForm((f) => ({ ...f, segments: f.segments.filter((_, i) => i !== index) }));
  };

  const handleSegmentTypeChange = (index: number, dimensionType: string) => {
    setAddForm((f) => ({
      ...f,
      segments: f.segments.map((s, i) =>
        i === index
          ? { ...s, dimensionType, code: autoSegmentCode(dimensionType), name: dimensionTypeLabel(dimensionType) }
          : s,
      ),
    }));
  };

  const updateSegmentRow = (index: number, patch: Partial<AddSegmentRow>) => {
    setAddForm((f) => ({
      ...f,
      segments: f.segments.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const validateAdd = () => {
    const next: Record<string, string> = {};
    const code = addForm.code.trim();
    const name = addForm.name.trim();
    if (!code) next.code = 'Code is required';
    else if (code.length > 50) next.code = 'Code must be 50 characters or fewer';
    if (!name) next.name = 'Name is required';
    else if (name.length > 255) next.name = 'Name must be 255 characters or fewer';
    if (addForm.segments.some((s) => !s.code.trim() || !s.name.trim())) {
      next.segments = 'Every segment needs a code and a name';
    }
    setAddErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreate = async () => {
    if (!validateAdd()) return;
    if (!user?.businessGroupId) {
      setAddSubmitError('Missing business group context. Please log in again.');
      return;
    }
    setSaving(true);
    setAddSubmitError(null);
    try {
      await createCoaStructure({
        businessGroupId: user.businessGroupId,
        code: addForm.code.trim().toUpperCase(),
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
        separator: '.',
        segments: addForm.segments.map((s, i) => ({
          code: s.code.trim().toUpperCase(),
          name: s.name.trim(),
          dimensionType: s.dimensionType,
          segmentNumber: i + 1,
          isRequired: s.isRequired,
        })),
      });
      showToast('COA Structure created successfully.', 'success');
      setShowAddModal(false);
      await loadStructures();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setAddSubmitError(message || 'Failed to create COA Structure. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const noStructuresAtAll = !loading && !error && totalStructures === 0;

  return (
    <AppLayout breadcrumb="COA Structure">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Chart of Accounts Structure</h1>
          <p className="mt-1 text-sm text-slate">
            Define segment structures for your accounting framework
          </p>
        </div>
        {canManage && <Button onClick={openAdd}>Add COA Structure</Button>}
      </div>

      <div className="mt-6 rounded-lg border border-blue/30 bg-blue-light px-4 py-3 text-sm text-blue-dark">
        A COA Structure defines which financial dimensions (segments) form your account
        combination. One structure can be shared across multiple ledgers.
      </div>

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={3} />
        </div>
      )}

      {!loading && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Total Structures</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalStructures}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Active Structures</p>
            <p className="mt-1 text-2xl font-bold text-navy">{activeStructures}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Total Ledgers Using Structures</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalLedgersUsing}</p>
          </Card>
        </div>
      )}

      <div className="mt-6">
        {!loading && error && (
          <ErrorState
            message="Failed to load COA Structures. Please try again."
            onRetry={loadStructures}
          />
        )}

        {!loading && !error && noStructuresAtAll && (
          <EmptyState
            title="No COA Structures defined"
            message="Create a COA Structure to define the segment layout for your Chart of Accounts."
            action={canManage ? { label: 'Add COA Structure', onClick: openAdd } : undefined}
          />
        )}

        {!loading && !error && !noStructuresAtAll && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {structures.map((s) => (
              <CoaStructureCard
                key={s.id}
                structure={s}
                format={formats[s.id]}
                canManage={canManage}
                onEdit={setEditingStructure}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <Modal
          title="Add COA Structure"
          onClose={() => setShowAddModal(false)}
          widthClassName="max-w-2xl"
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="coa-code"
                label="Code"
                required
                value={addForm.code}
                onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                error={addErrors.code}
                placeholder="e.g. STD-IND-SVC"
              />
              <Input
                id="coa-name"
                label="Name"
                required
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                error={addErrors.name}
              />
              <div className="col-span-2">
                <label htmlFor="coa-description" className="text-xs font-medium uppercase tracking-wide text-slate">
                  Description
                </label>
                <textarea
                  id="coa-description"
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue"
                />
              </div>
              <Input id="coa-separator" label="Separator" value="." disabled />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Segments</p>
              <div className="mt-2 flex flex-col gap-2">
                {addForm.segments.map((seg, index) => {
                  const options = OPTIONAL_DIMENSION_TYPES.filter(
                    (t) => t === seg.dimensionType || !usedOptionalTypes.includes(t),
                  );
                  return (
                    <div
                      key={index}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-offwhite px-3 py-2"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      {seg.locked ? (
                        <span className="flex-1 text-sm font-medium text-navy">
                          Natural Account (locked)
                        </span>
                      ) : (
                        <Select
                          aria-label={`Segment ${index + 1} dimension type`}
                          className="flex-1"
                          value={seg.dimensionType}
                          onChange={(e) => handleSegmentTypeChange(index, e.target.value)}
                        >
                          {options.map((t) => (
                            <option key={t} value={t}>
                              {dimensionTypeLabel(t)}
                            </option>
                          ))}
                        </Select>
                      )}
                      <Input
                        aria-label={`Segment ${index + 1} code`}
                        className="w-28 font-mono"
                        value={seg.code}
                        disabled={seg.locked}
                        onChange={(e) =>
                          updateSegmentRow(index, { code: e.target.value.toUpperCase() })
                        }
                      />
                      <Input
                        aria-label={`Segment ${index + 1} name`}
                        className="w-40"
                        value={seg.name}
                        disabled={seg.locked}
                        onChange={(e) => updateSegmentRow(index, { name: e.target.value })}
                      />
                      <Select
                        aria-label={`Segment ${index + 1} required`}
                        className="w-32"
                        value={seg.isRequired ? 'MANDATORY' : 'OPTIONAL'}
                        disabled={seg.locked}
                        onChange={(e) =>
                          updateSegmentRow(index, { isRequired: e.target.value === 'MANDATORY' })
                        }
                      >
                        <option value="MANDATORY">Mandatory</option>
                        <option value="OPTIONAL">Optional</option>
                      </Select>
                      {!seg.locked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSegmentRow(index)}
                          aria-label={`Remove segment ${index + 1}`}
                          className="text-slate hover:text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {addErrors.segments && <p className="mt-1 text-xs text-red-600">{addErrors.segments}</p>}
              <Button
                variant="secondary"
                className="mt-2 px-3 py-1.5 text-xs"
                onClick={handleAddSegmentRow}
                disabled={!canAddSegment}
              >
                + Add Segment
              </Button>
            </div>

            <div className="rounded-md border border-border bg-offwhite px-3 py-2 font-mono text-sm text-navy">
              Preview: {buildCombinationPreview(addForm.segments.map((s) => s.code))}
            </div>

            {addSubmitError && <p className="text-xs text-red-600">{addSubmitError}</p>}
          </div>
        </Modal>
      )}

      {editingStructure && user && (
        <CoaStructureEditPanel
          structure={editingStructure}
          canManage={canManage}
          legalEntityId={user.legalEntityId}
          onClose={() => setEditingStructure(null)}
          onChanged={loadStructures}
        />
      )}
    </AppLayout>
  );
}
