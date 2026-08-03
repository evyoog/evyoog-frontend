import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createApprovalPolicy,
  deleteApprovalPolicy,
  listApprovalPolicies,
  listRoles,
  updateApprovalPolicy,
} from '../api/users';
import { listJournalSources } from '../api/gl';
import type { ApprovalPolicy, JournalSource, Role } from '../types';
import { formatINR } from '../utils/format';

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        value ? 'bg-green-light text-green' : 'bg-slate-100 text-slate'
      }`}
    >
      {value ? 'Yes' : 'No'}
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

interface PolicyFormState {
  journalSourceCode: string;
  requiresApproval: boolean;
  approvalThresholdAmount: string;
  approverRoleCode: string;
  businessUnitId: string;
}

const EMPTY_FORM: PolicyFormState = {
  journalSourceCode: '',
  requiresApproval: true,
  approvalThresholdAmount: '',
  approverRoleCode: '',
  businessUnitId: '',
};

export default function ApprovalPolicyPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:approval-policy:manage');

  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [sources, setSources] = useState<JournalSource[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ApprovalPolicy | null>(null);
  const [form, setForm] = useState<PolicyFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<'journalSourceCode' | 'approvalThresholdAmount', string>>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const [policiesData, sourcesData, rolesData] = await Promise.all([
        listApprovalPolicies(user.legalEntityId),
        listJournalSources(user.legalEntityId),
        listRoles(user.legalEntityId),
      ]);
      setPolicies(Array.isArray(policiesData) ? policiesData : []);
      setSources(Array.isArray(sourcesData) ? sourcesData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch {
      setError(true);
      showToast('Failed to load approval policies.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sourceName = (code: string) => sources.find((s) => s.code === code)?.name ?? code;
  const roleName = (code: string | null) =>
    code ? (roles.find((r) => r.code === code)?.name ?? code) : '—';
  const approverRoles = roles.filter((r) => r.permissions.includes('gl:journal:approve'));

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, journalSourceCode: sources[0]?.code ?? '' });
    setErrors({});
    setShowAdvanced(false);
    setShowModal(true);
  };

  const openEdit = (p: ApprovalPolicy) => {
    setEditing(p);
    setForm({
      journalSourceCode: p.journalSourceCode,
      requiresApproval: p.requiresApproval,
      approvalThresholdAmount: p.approvalThresholdAmount != null ? String(p.approvalThresholdAmount) : '',
      approverRoleCode: p.approverRoleCode ?? '',
      businessUnitId: p.businessUnitId ?? '',
    });
    setErrors({});
    setShowAdvanced(!!p.businessUnitId);
    setShowModal(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.journalSourceCode) next.journalSourceCode = 'Journal source is required';
    if (form.requiresApproval && form.approvalThresholdAmount.trim()) {
      const n = Number(form.approvalThresholdAmount);
      if (!Number.isFinite(n) || n <= 0) {
        next.approvalThresholdAmount = 'Threshold must be greater than 0';
      }
    }
    const duplicate = policies.some(
      (p) => p.journalSourceCode === form.journalSourceCode && p.id !== editing?.id,
    );
    if (duplicate) next.journalSourceCode = 'A policy already exists for this journal source';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    try {
      const body = {
        journalSourceCode: form.journalSourceCode,
        requiresApproval: form.requiresApproval,
        businessUnitId: form.businessUnitId.trim() || null,
        inventoryOrgId: editing?.inventoryOrgId ?? null,
        approvalThresholdAmount:
          form.requiresApproval && form.approvalThresholdAmount.trim()
            ? Number(form.approvalThresholdAmount)
            : null,
        approverRoleCode: form.requiresApproval && form.approverRoleCode ? form.approverRoleCode : null,
      };
      if (editing) {
        await updateApprovalPolicy(editing.id, body);
        showToast('Approval policy updated successfully.', 'success');
      } else {
        await createApprovalPolicy({ ...body, legalEntityId: user.legalEntityId });
        showToast('Approval policy created successfully.', 'success');
      }
      setShowModal(false);
      await load();
    } catch {
      showToast('Failed to save approval policy. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ApprovalPolicy) => {
    setActingId(p.id);
    setConfirmId(null);
    try {
      await deleteApprovalPolicy(p.id);
      showToast('Approval policy deleted.', 'success');
      await load();
    } catch {
      showToast('Failed to delete approval policy. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const totalCount = policies.length;
  const requiresCount = policies.filter((p) => p.requiresApproval).length;
  const activeCount = policies.filter((p) => p.isActive).length;

  return (
    <AppLayout breadcrumb="Approval Policy">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Approval Policy</h1>
          <p className="mt-1 text-sm text-slate">
            Configure journal approval rules for Orbinox Valves India Pvt Ltd
          </p>
        </div>
        {canManage && (
          <Button onClick={openAdd} aria-label="Add new approval policy">
            Add Policy
          </Button>
        )}
      </div>

      <div className="mt-4 rounded-md border-l-4 border-l-amber bg-amber-light px-4 py-3 text-sm text-amber">
        Approval policies control which journals require sign-off before posting. A journal
        matching a policy will be held in PENDING_APPROVAL status until an authorised approver
        acts on it.
      </div>

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={4} />
        </div>
      )}

      {!loading && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Total Policies</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Requires Approval</p>
            <p className="mt-1 text-2xl font-bold text-navy">{requiresCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">No Approval Required</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount - requiresCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Active</p>
            <p className="mt-1 text-2xl font-bold text-navy">{activeCount}</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        {loading && <TableSkeleton rows={5} columns={6} />}

        {!loading && error && (
          <ErrorState message="Failed to load approval policies. Please try again." onRetry={load} />
        )}

        {!loading && !error && policies.length === 0 && (
          <EmptyState
            title="No approval policies configured"
            message="Add a policy to require approval for specific journal sources."
            action={canManage ? { label: 'Add Policy', onClick: openAdd } : undefined}
          />
        )}

        {!loading && !error && policies.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                <th className="py-2 pr-2 font-medium">Journal Source</th>
                <th className="py-2 pr-2 font-medium">Requires Approval</th>
                <th className="py-2 pr-2 font-medium">Threshold</th>
                <th className="py-2 pr-2 font-medium">Approver Role</th>
                <th className="py-2 pr-2 font-medium">Status</th>
                <th className="py-2 pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                  <td className="py-2 pr-2 text-navy">{sourceName(p.journalSourceCode)}</td>
                  <td className="py-2 pr-2">
                    <YesNoBadge value={p.requiresApproval} />
                  </td>
                  <td className="py-2 pr-2">
                    {p.approvalThresholdAmount != null
                      ? formatINR(p.approvalThresholdAmount)
                      : 'All amounts'}
                  </td>
                  <td className="py-2 pr-2">{roleName(p.approverRoleCode)}</td>
                  <td className="py-2 pr-2">
                    <StatusBadge isActive={p.isActive} />
                  </td>
                  <td className="py-2 pr-2">
                    {confirmId === p.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        Delete this policy?
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          disabled={actingId === p.id}
                          onClick={() => handleDelete(p)}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={actingId === p.id}
                          onClick={() => setConfirmId(null)}
                        >
                          No
                        </Button>
                      </span>
                    ) : (
                      canManage && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => openEdit(p)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            disabled={actingId === p.id}
                            onClick={() => setConfirmId(p.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {showModal && (
        <Modal
          title={editing ? 'Edit Policy' : 'Add Policy'}
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
            <div>
              <Select
                id="policy-source"
                label="Journal Source *"
                value={form.journalSourceCode}
                onChange={(e) => setForm({ ...form, journalSourceCode: e.target.value })}
                disabled={!!editing}
              >
                <option value="">Select a journal source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </Select>
              {errors.journalSourceCode && (
                <span className="text-xs text-red-600">{errors.journalSourceCode}</span>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={form.requiresApproval}
                onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
              />
              Requires Approval
            </label>

            {form.requiresApproval && (
              <>
                <div>
                  <label
                    htmlFor="policy-threshold"
                    className="text-xs font-medium uppercase tracking-wide text-slate"
                  >
                    Minimum amount requiring approval (leave blank for all amounts)
                  </label>
                  <input
                    id="policy-threshold"
                    type="number"
                    min="0"
                    placeholder="e.g. 100000 for ₹1,00,000"
                    value={form.approvalThresholdAmount}
                    onChange={(e) => setForm({ ...form, approvalThresholdAmount: e.target.value })}
                    className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue ${
                      errors.approvalThresholdAmount ? 'border-red-500' : 'border-border'
                    }`}
                  />
                  {errors.approvalThresholdAmount && (
                    <span className="text-xs text-red-600">{errors.approvalThresholdAmount}</span>
                  )}
                </div>

                <Select
                  id="policy-approver-role"
                  label="Role authorised to approve"
                  value={form.approverRoleCode}
                  onChange={(e) => setForm({ ...form, approverRoleCode: e.target.value })}
                >
                  <option value="">Not set</option>
                  {approverRoles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </>
            )}

            <div className="border-t border-border pt-3">
              <button
                type="button"
                className="text-xs text-blue hover:underline"
                onClick={() => setShowAdvanced((s) => !s)}
              >
                {showAdvanced ? 'Hide' : 'Show'} advanced options
              </button>
              {showAdvanced && (
                <div className="mt-3 flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor="policy-business-unit"
                      className="text-xs font-medium uppercase tracking-wide text-slate"
                    >
                      Business Unit
                    </label>
                    <input
                      id="policy-business-unit"
                      type="text"
                      value={form.businessUnitId}
                      onChange={(e) => setForm({ ...form, businessUnitId: e.target.value })}
                      className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue"
                    />
                  </div>
                  {editing && (
                    <p className="text-xs text-slate">Policy ID: {editing.id}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
