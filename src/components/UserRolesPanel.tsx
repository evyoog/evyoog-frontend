import { useEffect, useState } from 'react';
import Button from './ui/Button';
import Select from './ui/Select';
import LoadingSpinner from './ui/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { assignUserRole, getUserRoles, removeUserRole } from '../api/users';
import type { AppUser, Role, UserRoleAssignment } from '../types';

interface UserRolesPanelProps {
  user: AppUser;
  roles: Role[];
  legalEntityId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export default function UserRolesPanel({
  user,
  roles,
  legalEntityId,
  canManage,
  onClose,
  onChanged,
}: UserRolesPanelProps) {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmRoleId, setConfirmRoleId] = useState<string | null>(null);
  const [actingRoleId, setActingRoleId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getUserRoles(user.id);
      setAssignments(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load role assignments.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setVisible(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const availableRoles = roles.filter(
    (r) => r.isActive && !assignments.some((a) => a.roleId === r.id),
  );

  useEffect(() => {
    if (availableRoles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(availableRoles[0].id);
    }
    if (availableRoles.length > 0 && !availableRoles.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(availableRoles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  const handleAdd = async () => {
    if (!selectedRoleId) return;
    setAdding(true);
    try {
      await assignUserRole(user.id, selectedRoleId, legalEntityId);
      showToast('Role assigned successfully.', 'success');
      await load();
      onChanged?.();
    } catch {
      showToast('Failed to assign role. Please try again.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (roleId: string) => {
    setActingRoleId(roleId);
    setConfirmRoleId(null);
    try {
      await removeUserRole(user.id, roleId);
      showToast('Role removed successfully.', 'success');
      await load();
      onChanged?.();
    } catch {
      showToast('Failed to remove role. Please try again.', 'error');
    } finally {
      setActingRoleId(null);
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
            <h2 className="text-lg font-bold text-navy">{user.fullName}</h2>
            <p className="mt-0.5 text-xs text-slate">{user.email}</p>
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
          {loading && <LoadingSpinner />}

          {!loading && (
            <>
              {canManage && (
                <div className="mb-4 flex items-end gap-2 border-b border-border pb-4">
                  <div className="flex-1">
                    <Select
                      id="add-role-select"
                      label="Add Role"
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      disabled={availableRoles.length === 0}
                    >
                      {availableRoles.length === 0 && <option value="">No roles available</option>}
                      {availableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    onClick={handleAdd}
                    loading={adding}
                    disabled={availableRoles.length === 0}
                  >
                    Add
                  </Button>
                </div>
              )}

              {assignments.length === 0 && (
                <p className="py-6 text-center text-sm text-slate">No roles assigned.</p>
              )}

              <ul className="flex flex-col gap-2">
                {assignments.map((a) => (
                  <li
                    key={a.userRoleId}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy">{a.roleName}</p>
                      <p className="text-xs text-slate">{a.legalEntityCode}</p>
                    </div>
                    {canManage &&
                      (confirmRoleId === a.roleId ? (
                        <span className="flex items-center gap-1 text-xs">
                          Remove?
                          <Button
                            variant="danger"
                            className="px-2 py-1 text-xs"
                            disabled={actingRoleId === a.roleId}
                            onClick={() => handleRemove(a.roleId)}
                          >
                            Yes
                          </Button>
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={actingRoleId === a.roleId}
                            onClick={() => setConfirmRoleId(null)}
                          >
                            No
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          disabled={actingRoleId === a.roleId || assignments.length <= 1}
                          onClick={() => setConfirmRoleId(a.roleId)}
                        >
                          Remove
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            </>
          )}
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
