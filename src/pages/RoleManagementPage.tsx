import { Fragment, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createRole, listRoles, updateRole } from '../api/users';
import type { Role } from '../types';
import { PERMISSION_CATALOG, permissionLabel } from '../utils/permissions';

function TypeBadge({ isSystemRole }: { isSystemRole: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        isSystemRole ? 'bg-navy/10 text-navy' : 'bg-blue-light text-blue-dark'
      }`}
    >
      {isSystemRole ? 'System' : 'Custom'}
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

interface RoleFormState {
  code: string;
  name: string;
  description: string;
  permissionCodes: Set<string>;
}

const EMPTY_FORM: RoleFormState = {
  code: '',
  name: '',
  description: '',
  permissionCodes: new Set(),
};

export default function RoleManagementPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission('gl:roles:create');
  const canEdit = hasPermission('gl:roles:edit');

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<'code' | 'name', string>>>({});
  const [saving, setSaving] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const data = await listRoles(user.legalEntityId);
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
      showToast('Failed to load roles.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (r: Role) => {
    setEditing(r);
    setForm({
      code: r.code,
      name: r.name,
      description: r.description ?? '',
      permissionCodes: new Set(r.permissions),
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.name.trim()) next.name = 'Name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const togglePermission = (code: string) => {
    setForm((prev) => {
      const next = new Set(prev.permissionCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...prev, permissionCodes: next };
    });
  };

  const toggleGroup = (codes: string[], selectAll: boolean) => {
    setForm((prev) => {
      const next = new Set(prev.permissionCodes);
      codes.forEach((c) => (selectAll ? next.add(c) : next.delete(c)));
      return { ...prev, permissionCodes: next };
    });
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const permissionCodes = Array.from(form.permissionCodes);
      if (editing) {
        await updateRole(editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          permissionCodes,
          isActive: editing.isActive,
        });
        showToast('Role updated successfully.', 'success');
      } else {
        await createRole({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim(),
          permissionCodes,
        });
        showToast('Role created successfully.', 'success');
      }
      setShowModal(false);
      await load();
    } catch {
      showToast('Failed to save role. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (r: Role) => {
    setActingId(r.id);
    setConfirmId(null);
    try {
      await updateRole(r.id, {
        name: r.name,
        description: r.description ?? '',
        permissionCodes: r.permissions,
        isActive: false,
      });
      showToast('Role deactivated.', 'success');
      await load();
    } catch {
      showToast('Failed to deactivate role. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const totalCount = roles.length;
  const systemCount = roles.filter((r) => r.isSystemRole).length;
  const activeCount = roles.filter((r) => r.isActive).length;

  const isReadOnly = !!editing?.isSystemRole;

  return (
    <AppLayout breadcrumb="Role Management">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Role Management</h1>
          <p className="mt-1 text-sm text-slate">Define roles and permission sets</p>
        </div>
        {canCreate && (
          <Button onClick={openAdd} aria-label="Add new role">
            Add Role
          </Button>
        )}
      </div>

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={4} />
        </div>
      )}

      {!loading && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Total Roles</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">System Roles</p>
            <p className="mt-1 text-2xl font-bold text-navy">{systemCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Custom Roles</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount - systemCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Active</p>
            <p className="mt-1 text-2xl font-bold text-navy">{activeCount}</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        {loading && <TableSkeleton rows={6} columns={5} />}

        {!loading && error && (
          <ErrorState message="Failed to load roles. Please try again." onRetry={load} />
        )}

        {!loading && !error && roles.length === 0 && (
          <EmptyState
            title="No roles found"
            message="Define roles to control what users can access in eVyoog ERP."
            action={canCreate ? { label: 'Add Role', onClick: openAdd } : undefined}
          />
        )}

        {!loading && !error && roles.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                <th className="py-2 pr-2 font-medium">Code</th>
                <th className="py-2 pr-2 font-medium">Name</th>
                <th className="py-2 pr-2 font-medium">Type</th>
                <th className="py-2 pr-2 font-medium">Permissions</th>
                <th className="py-2 pr-2 font-medium">Status</th>
                <th className="py-2 pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-offwhite">
                    <td className="py-2 pr-2 font-mono text-navy">{r.code}</td>
                    <td className="py-2 pr-2">{r.name}</td>
                    <td className="py-2 pr-2">
                      <TypeBadge isSystemRole={r.isSystemRole} />
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        className="text-blue hover:underline"
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      >
                        {r.permissions.length} permissions
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <StatusBadge isActive={r.isActive} />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => openEdit(r)}
                          aria-label={`${canEdit && !r.isSystemRole ? 'Edit' : 'View'} permissions for ${r.name}`}
                        >
                          {canEdit && !r.isSystemRole ? 'Edit' : 'View'} Permissions
                        </Button>
                        {canEdit &&
                          !r.isSystemRole &&
                          r.isActive &&
                          (confirmId === r.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              Deactivate?
                              <Button
                                variant="danger"
                                className="px-2 py-1 text-xs"
                                disabled={actingId === r.id}
                                onClick={() => handleDeactivate(r)}
                              >
                                Yes
                              </Button>
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                disabled={actingId === r.id}
                                onClick={() => setConfirmId(null)}
                              >
                                No
                              </Button>
                            </span>
                          ) : (
                            <Button
                              variant="danger"
                              className="px-2 py-1 text-xs"
                              disabled={actingId === r.id}
                              onClick={() => setConfirmId(r.id)}
                              aria-label={`Deactivate ${r.name}`}
                            >
                              Deactivate
                            </Button>
                          ))}
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr className="border-b border-border last:border-0 bg-offwhite">
                      <td colSpan={6} className="px-2 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {r.permissions.map((code) => (
                            <span
                              key={code}
                              className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs text-navy ring-1 ring-inset ring-border"
                              title={code}
                            >
                              {permissionLabel(code)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {showModal && (
        <Modal
          title={editing ? (isReadOnly ? 'View Role Permissions' : 'Edit Role') : 'Add Role'}
          onClose={() => setShowModal(false)}
          widthClassName="max-w-3xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button onClick={handleSave} loading={saving}>
                  Save
                </Button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="role-code"
                label="Code *"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                error={errors.code}
                disabled={!!editing}
              />
              <Input
                id="role-name"
                label="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={errors.name}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label
                htmlFor="role-description"
                className="text-xs font-medium uppercase tracking-wide text-slate"
              >
                Description
              </label>
              <textarea
                id="role-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                disabled={isReadOnly}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-blue focus:ring-1 focus:ring-blue disabled:bg-offwhite"
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-4">
              {PERMISSION_CATALOG.map((group) => {
                const codes = group.permissions.map((p) => p.code);
                const allSelected = codes.every((c) => form.permissionCodes.has(c));
                return (
                  <div key={group.category}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-navy">{group.category}</h3>
                      {!isReadOnly && (
                        <label className="flex items-center gap-2 text-xs text-slate">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleGroup(codes, e.target.checked)}
                          />
                          Select All
                        </label>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {group.permissions.map((p) => (
                        <label key={p.code} className="flex items-start gap-2 text-sm text-navy">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={form.permissionCodes.has(p.code)}
                            disabled={isReadOnly}
                            onChange={() => togglePermission(p.code)}
                          />
                          <span>
                            {p.label}
                            <span className="block text-xs text-slate">{p.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
