import { useEffect, useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import { useToast } from '../context/ToastContext';
import {
  addCoaSegment,
  getCoaCombinationFormat,
  getCoaStructure,
  removeCoaSegment,
  updateCoaStructure,
} from '../api/gl';
import type { CoaSegmentSummary, CoaStructure } from '../types';
import { formatDate } from '../utils/format';
import {
  OPTIONAL_DIMENSION_TYPES,
  autoSegmentCode,
  buildCombinationPreview,
  dimensionTypeBadgeClass,
  dimensionTypeLabel,
} from '../utils/coaStructure';

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

interface CoaStructureEditPanelProps {
  structure: CoaStructure;
  canManage: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function CoaStructureEditPanel({
  structure,
  canManage,
  onClose,
  onChanged,
}: CoaStructureEditPanelProps) {
  const { showToast } = useToast();

  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<CoaStructure>(structure);
  const [format, setFormat] = useState<string | undefined>(undefined);

  const [name, setName] = useState(structure.name);
  const [description, setDescription] = useState(structure.description ?? '');
  const [isActive, setIsActive] = useState(structure.isActive);
  const [saving, setSaving] = useState(false);

  const [showAddSegment, setShowAddSegment] = useState(false);
  const [newSegType, setNewSegType] = useState('');
  const [newSegCode, setNewSegCode] = useState('');
  const [newSegName, setNewSegName] = useState('');
  const [newSegRequired, setNewSegRequired] = useState(true);
  const [addingSegment, setAddingSegment] = useState(false);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setVisible(true);
    getCoaCombinationFormat(structure.id)
      .then(setFormat)
      .catch(() => {
        setFormat(
          buildCombinationPreview(
            [...structure.segments]
              .sort((a, b) => a.segmentNumber - b.segmentNumber)
              .map((s) => s.code),
            structure.separator,
          ),
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  async function reload() {
    try {
      const updated = await getCoaStructure(current.id);
      setCurrent(updated);
      onChanged?.();
    } catch {
      showToast('Failed to refresh COA Structure.', 'error');
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCoaStructure(current.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
      });
      showToast('COA Structure updated successfully.', 'success');
      await reload();
    } catch {
      showToast('Failed to update COA Structure. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const usedTypes = current.segments.map((s) => s.dimensionType);
  const addSegmentOptions = OPTIONAL_DIMENSION_TYPES.filter((t) => !usedTypes.includes(t));

  const openAddSegment = () => {
    const defaultType = addSegmentOptions[0] ?? '';
    setNewSegType(defaultType);
    setNewSegCode(defaultType ? autoSegmentCode(defaultType) : '');
    setNewSegName(defaultType ? dimensionTypeLabel(defaultType) : '');
    setNewSegRequired(true);
    setShowAddSegment(true);
  };

  const handleAddSegment = async () => {
    if (!newSegType || !newSegCode.trim() || !newSegName.trim()) return;
    setAddingSegment(true);
    try {
      const nextSegmentNumber = Math.max(0, ...current.segments.map((s) => s.segmentNumber)) + 1;
      await addCoaSegment(current.id, {
        code: newSegCode.trim().toUpperCase(),
        name: newSegName.trim(),
        dimensionType: newSegType,
        segmentNumber: nextSegmentNumber,
        isRequired: newSegRequired,
      });
      showToast('Segment added successfully.', 'success');
      setShowAddSegment(false);
      await reload();
    } catch {
      showToast('Failed to add segment. Please try again.', 'error');
    } finally {
      setAddingSegment(false);
    }
  };

  const handleRemoveSegment = async (segment: CoaSegmentSummary) => {
    setRemovingId(segment.id);
    setConfirmRemoveId(null);
    try {
      await removeCoaSegment(current.id, segment.id);
      showToast('Segment removed.', 'success');
      await reload();
    } catch {
      showToast('Failed to remove segment. Please try again.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const sortedSegments = [...current.segments].sort((a, b) => a.segmentNumber - b.segmentNumber);

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
            <h2 className="text-lg font-bold text-navy">{current.name}</h2>
            <p className="mt-0.5 font-mono text-xs text-slate">{current.code}</p>
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
              id="coa-edit-name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
            />
            <div>
              <label htmlFor="coa-edit-description" className="text-xs font-medium uppercase tracking-wide text-slate">
                Description
              </label>
              <textarea
                id="coa-edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={!canManage}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue disabled:bg-offwhite"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={isActive}
                disabled={!canManage}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Is Active
            </label>
            {canManage && (
              <div>
                <Button onClick={handleSave} loading={saving} className="px-3 py-1.5 text-xs">
                  Save Changes
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate">Code</p>
                <p className="mt-1 font-mono text-sm text-navy">{current.code}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate">Separator</p>
                <p className="mt-1 font-mono text-sm text-navy">{current.separator}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate">
                  Combination Format
                </p>
                <code className="mt-1 inline-block rounded bg-offwhite px-2 py-1 font-mono text-sm text-navy">
                  {format ?? buildCombinationPreview(sortedSegments.map((s) => s.code), current.separator)}
                </code>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate">
                  Segments — Segment Manager
                </p>
                {canManage && !showAddSegment && (
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={openAddSegment}
                    disabled={addSegmentOptions.length === 0}
                  >
                    Add Segment
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate">
                Code and dimension type cannot be changed after creation. To modify segments, use the
                Segment Manager below.
              </p>

              <div className="mt-2 flex flex-col divide-y divide-border">
                {sortedSegments.map((seg) => (
                  <div key={seg.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                      {seg.segmentNumber}
                    </span>
                    <span className="font-mono text-navy">{seg.code}</span>
                    <span className="flex-1 text-slate">{seg.name}</span>
                    <RequiredBadge isRequired={seg.isRequired} />
                    <DimensionTypeBadge type={seg.dimensionType} />
                    {canManage &&
                      seg.dimensionType !== 'NATURAL_ACCOUNT' &&
                      (confirmRemoveId === seg.id ? (
                        <span className="flex items-center gap-1 text-xs">
                          Removing may affect existing combinations.
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            disabled={removingId === seg.id}
                            onClick={() => handleRemoveSegment(seg)}
                          >
                            Yes
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={removingId === seg.id}
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            No
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          disabled={removingId === seg.id}
                          onClick={() => setConfirmRemoveId(seg.id)}
                          aria-label={`Remove segment ${seg.code}`}
                        >
                          Remove
                        </Button>
                      ))}
                  </div>
                ))}
              </div>

              {showAddSegment && (
                <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-offwhite p-3">
                  <Select
                    id="coa-new-seg-type"
                    label="Dimension Type"
                    value={newSegType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setNewSegType(t);
                      setNewSegCode(autoSegmentCode(t));
                      setNewSegName(dimensionTypeLabel(t));
                    }}
                  >
                    {addSegmentOptions.map((t) => (
                      <option key={t} value={t}>
                        {dimensionTypeLabel(t)}
                      </option>
                    ))}
                  </Select>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      id="coa-new-seg-code"
                      label="Code"
                      value={newSegCode}
                      onChange={(e) => setNewSegCode(e.target.value.toUpperCase())}
                    />
                    <Input
                      id="coa-new-seg-name"
                      label="Name"
                      value={newSegName}
                      onChange={(e) => setNewSegName(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={newSegRequired}
                      onChange={(e) => setNewSegRequired(e.target.checked)}
                    />
                    Required
                  </label>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setShowAddSegment(false)}
                      disabled={addingSegment}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="px-3 py-1.5 text-xs"
                      onClick={handleAddSegment}
                      loading={addingSegment}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 text-xs text-slate">
              <p>
                Created: {formatDate(current.createdAt)} by {current.createdBy}
              </p>
              <p>Last modified: {formatDate(current.updatedAt)}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
