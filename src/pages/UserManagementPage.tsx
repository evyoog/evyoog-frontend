import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import UserRolesPanel from '../components/UserRolesPanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createUser,
  deactivateUser,
  getUserRoles,
  listRoles,
  listUsers,
  resetUserPassword,
} from '../api/users';
import type { AppUser, Role, UserRoleAssignment } from '../types';
import { formatDate } from '../utils/format';

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

function MustChangePwdBadge({ mustChangePwd }: { mustChangePwd: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        mustChangePwd ? 'bg-amber-light text-amber' : 'bg-slate-100 text-slate'
      }`}
    >
      {mustChangePwd ? 'Yes' : 'No'}
    </span>
  );
}

interface AddUserFormState {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
}

const EMPTY_ADD_FORM: AddUserFormState = { fullName: '', email: '', password: '', roleId: '' };

interface ResetPasswordFormState {
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_RESET_FORM: ResetPasswordFormState = { newPassword: '', confirmPassword: '' };

export default function UserManagementPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission('gl:users:create');
  const canEdit = hasPermission('gl:users:edit');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, UserRoleAssignment[]>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddUserFormState>(EMPTY_ADD_FORM);
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof AddUserFormState, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rolesPanelUser, setRolesPanelUser] = useState<AppUser | null>(null);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetForm, setResetForm] = useState<ResetPasswordFormState>(EMPTY_RESET_FORM);
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSaving, setResetSaving] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const [usersData, rolesData] = await Promise.all([
        listUsers(user.legalEntityId),
        listRoles(user.legalEntityId),
      ]);
      const usersList = Array.isArray(usersData) ? usersData : [];
      setUsers(usersList);
      setRoles(Array.isArray(rolesData) ? rolesData : []);

      const entries = await Promise.all(
        usersList.map(async (u) => {
          try {
            const r = await getUserRoles(u.id);
            return [u.id, Array.isArray(r) ? r : []] as const;
          } catch {
            return [u.id, []] as const;
          }
        }),
      );
      setUserRoles(Object.fromEntries(entries));
    } catch {
      setError(true);
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openAdd = () => {
    setAddForm({ ...EMPTY_ADD_FORM, roleId: roles[0]?.id ?? '' });
    setAddErrors({});
    setShowPassword(false);
    setShowAddModal(true);
  };

  const validateAdd = () => {
    const next: typeof addErrors = {};
    if (!addForm.fullName.trim()) next.fullName = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim())) next.email = 'Enter a valid email';
    if (addForm.password.length < 8) next.password = 'Password must be at least 8 characters';
    if (!addForm.roleId) next.roleId = 'Role is required';
    setAddErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddUser = async () => {
    if (!user || !validateAdd()) return;
    setSaving(true);
    try {
      await createUser({
        fullName: addForm.fullName.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        roleId: addForm.roleId,
        legalEntityId: user.legalEntityId,
      });
      showToast(
        `User ${addForm.fullName.trim()} created successfully. They must change their password on first login.`,
        'success',
      );
      setShowAddModal(false);
      await load();
    } catch {
      showToast('Failed to create user. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openReset = (u: AppUser) => {
    setResetUserId(u.id);
    setResetForm(EMPTY_RESET_FORM);
    setResetShowPassword(false);
    setResetError(null);
  };

  const handleReset = async (u: AppUser) => {
    if (resetForm.newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    setResetSaving(true);
    try {
      await resetUserPassword(u.id, resetForm.newPassword);
      showToast('Password reset successfully.', 'success');
      setResetUserId(null);
    } catch {
      showToast('Failed to reset password. Please try again.', 'error');
    } finally {
      setResetSaving(false);
    }
  };

  const handleDeactivate = async (u: AppUser) => {
    setActingId(u.id);
    setConfirmId(null);
    try {
      await deactivateUser(u.id);
      showToast('User deactivated.', 'success');
      await load();
    } catch {
      showToast('Failed to deactivate user. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const mustChangeCount = users.filter((u) => u.mustChangePwd).length;

  return (
    <AppLayout breadcrumb="User Management">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">User Management</h1>
          <p className="mt-1 text-sm text-slate">
            Manage users and role assignments for Orbinox Valves India Pvt Ltd
          </p>
        </div>
        {canCreate && (
          <Button onClick={openAdd} aria-label="Add new user">
            Add User
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
            <p className="text-xs uppercase tracking-wide text-slate">Total Users</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Active</p>
            <p className="mt-1 text-2xl font-bold text-navy">{activeCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Inactive</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount - activeCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Must Change Password</p>
            <p className="mt-1 text-2xl font-bold text-navy">{mustChangeCount}</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        {loading && <TableSkeleton rows={5} columns={8} />}

        {!loading && error && (
          <ErrorState message="Failed to load users. Please try again." onRetry={load} />
        )}

        {!loading && !error && users.length === 0 && (
          <EmptyState
            title="No users found"
            message="Add users to give them access to eVyoog ERP."
            action={canCreate ? { label: 'Add User', onClick: openAdd } : undefined}
          />
        )}

        {!loading && !error && users.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                <th className="py-2 pr-2 font-medium">Full Name</th>
                <th className="py-2 pr-2 font-medium">Email</th>
                <th className="py-2 pr-2 font-medium">Status</th>
                <th className="py-2 pr-2 font-medium">Must Change Pwd</th>
                <th className="py-2 pr-2 font-medium">Last Login</th>
                <th className="py-2 pr-2 font-medium">Created</th>
                <th className="py-2 pr-2 font-medium">Roles</th>
                <th className="py-2 pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                  <td className="py-2 pr-2 text-navy">{u.fullName}</td>
                  <td className="py-2 pr-2">{u.email}</td>
                  <td className="py-2 pr-2">
                    <StatusBadge isActive={u.isActive} />
                  </td>
                  <td className="py-2 pr-2">
                    <MustChangePwdBadge mustChangePwd={u.mustChangePwd} />
                  </td>
                  <td className="py-2 pr-2">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                  <td className="py-2 pr-2">{formatDate(u.createdAt)}</td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-1">
                      {(userRoles[u.id] ?? []).length === 0 && <span className="text-slate">—</span>}
                      {(userRoles[u.id] ?? []).map((r) => (
                        <span
                          key={r.userRoleId}
                          className="inline-flex items-center rounded-full bg-blue-light px-2 py-0.5 text-xs font-medium text-blue-dark"
                        >
                          {r.roleName}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    {resetUserId === u.id ? (
                      <div className="flex flex-col gap-2 rounded-md border border-border bg-offwhite p-3">
                        <Input
                          id={`reset-pwd-${u.id}`}
                          label="New Password"
                          type={resetShowPassword ? 'text' : 'password'}
                          value={resetForm.newPassword}
                          onChange={(e) =>
                            setResetForm({ ...resetForm, newPassword: e.target.value })
                          }
                        />
                        <Input
                          id={`reset-pwd-confirm-${u.id}`}
                          label="Confirm"
                          type={resetShowPassword ? 'text' : 'password'}
                          value={resetForm.confirmPassword}
                          onChange={(e) =>
                            setResetForm({ ...resetForm, confirmPassword: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="self-start text-xs text-blue hover:underline"
                          onClick={() => setResetShowPassword((s) => !s)}
                        >
                          {resetShowPassword ? 'Hide' : 'Show'} password
                        </button>
                        {resetError && <span className="text-xs text-red-600">{resetError}</span>}
                        <div className="flex gap-2">
                          <Button
                            className="px-2 py-1 text-xs"
                            loading={resetSaving}
                            onClick={() => handleReset(u)}
                          >
                            Save
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={resetSaving}
                            onClick={() => setResetUserId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : confirmId === u.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        Deactivate {u.fullName}? They will no longer be able to log in.
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          disabled={actingId === u.id}
                          onClick={() => handleDeactivate(u)}
                        >
                          Yes
                        </Button>
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={actingId === u.id}
                          onClick={() => setConfirmId(null)}
                        >
                          No
                        </Button>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={() => setRolesPanelUser(u)}
                          aria-label={`Edit roles for ${u.fullName}`}
                        >
                          Edit Roles
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openReset(u)}
                              aria-label={`Reset password for ${u.fullName}`}
                            >
                              Reset Password
                            </Button>
                            {u.isActive && (
                              <Button
                                variant="danger"
                                className="px-2 py-1 text-xs"
                                disabled={actingId === u.id}
                                onClick={() => setConfirmId(u.id)}
                                aria-label={`Deactivate ${u.fullName}`}
                              >
                                Deactivate
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {showAddModal && (
        <Modal
          title="Add User"
          onClose={() => setShowAddModal(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} loading={saving}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              id="add-user-full-name"
              label="Full Name *"
              value={addForm.fullName}
              onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
              error={addErrors.fullName}
            />
            <Input
              id="add-user-email"
              label="Email *"
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              error={addErrors.email}
            />
            <div>
              <Input
                id="add-user-password"
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                error={addErrors.password}
              />
              <button
                type="button"
                className="mt-1 text-xs text-blue hover:underline"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? 'Hide' : 'Show'} password
              </button>
            </div>
            <Select
              id="add-user-role"
              label="Role *"
              value={addForm.roleId}
              onChange={(e) => setAddForm({ ...addForm, roleId: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            {addErrors.roleId && <span className="text-xs text-red-600">{addErrors.roleId}</span>}
          </div>
        </Modal>
      )}

      {rolesPanelUser && user && (
        <UserRolesPanel
          user={rolesPanelUser}
          roles={roles}
          legalEntityId={user.legalEntityId}
          canManage={canEdit}
          onClose={() => setRolesPanelUser(null)}
          onChanged={load}
        />
      )}
    </AppLayout>
  );
}
