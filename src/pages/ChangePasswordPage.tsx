import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { changePassword } from '../api/auth';

type Strength = 'weak' | 'fair' | 'strong';

function getStrength(password: string): Strength {
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (password.length < 8) return 'weak';
  if (hasUpper && hasDigit) return 'strong';
  return 'fair';
}

const strengthStyles: Record<Strength, { label: string; className: string }> = {
  weak: { label: 'Weak', className: 'text-red-600' },
  fair: { label: 'Fair', className: 'text-amber' },
  strong: { label: 'Strong', className: 'text-green' },
};

function EyeToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate hover:text-navy"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.751 6.69l1.109 1.109a2.5 2.5 0 013.341 3.341l1.109 1.109a4 4 0 00-5.559-5.559z" clipRule="evenodd" />
          <path d="M10.75 12.75l-4.207-4.207a3.02 3.02 0 00-.238.966A4 4 0 0010 14a4 4 0 004-4 3.99 3.99 0 00-.049-.5l-1.71-1.71a2.5 2.5 0 01-1.49 1.49l-.001.47z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export default function ChangePasswordPage() {
  const { user, clearMustChangePwd } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasUpper = /[A-Z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const newPasswordValid = newPassword.length >= 8 && hasUpper && hasDigit;
  const confirmMismatch = confirmTouched && confirmPassword !== newPassword;
  const strength = newPassword ? getStrength(newPassword) : null;

  const canSubmit =
    currentPassword.length > 0 &&
    newPasswordValid &&
    confirmPassword === newPassword &&
    confirmPassword.length > 0 &&
    !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCurrentPasswordError('');
    setNewPasswordError('');

    if (!currentPassword) {
      setCurrentPasswordError('Current password is required.');
      return;
    }
    if (!newPasswordValid) {
      setNewPasswordError(
        'Password must be at least 8 characters with one uppercase letter and one number.',
      );
      return;
    }
    if (confirmPassword !== newPassword) {
      setConfirmTouched(true);
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password changed successfully', 'success');
      clearMustChangePwd();
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      const code = axios.isAxiosError(err) ? err.response?.data?.code : undefined;
      if (code === 'INVALID_CURRENT_PASSWORD') {
        setCurrentPasswordError('Current password is incorrect. Please try again.');
      } else if (code === 'WEAK_PASSWORD') {
        setNewPasswordError(
          'Password must be at least 8 characters with one uppercase letter and one number.',
        );
      } else {
        showToast('Failed to update password. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout breadcrumb="Change Password">
      <div className="mx-auto max-w-md">
        <Card>
          <h1 className="text-lg font-semibold text-navy">Change Password</h1>
          <p className="mt-1 text-sm text-slate">Update your account password</p>

          {user && (
            <p className="mt-4 text-xs text-slate">
              Logged in as: <span className="font-medium text-navy">{user.fullName}</span> (
              {user.email})
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="relative">
              <Input
                id="currentPassword"
                label="Current Password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setCurrentPasswordError('');
                }}
                error={currentPasswordError}
                className="pr-10"
                required
              />
              <EyeToggle visible={showCurrent} onClick={() => setShowCurrent((v) => !v)} />
            </div>

            <div>
              <div className="relative">
                <Input
                  id="newPassword"
                  label="New Password"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setNewPasswordError('');
                  }}
                  error={newPasswordError}
                  className="pr-10"
                  required
                />
                <EyeToggle visible={showNew} onClick={() => setShowNew((v) => !v)} />
              </div>
              {!newPasswordError && (
                <p className="mt-1 text-xs text-slate">
                  Minimum 8 characters with at least one uppercase letter and one number
                </p>
              )}
              {strength && (
                <p className={`mt-1 text-xs font-medium ${strengthStyles[strength].className}`}>
                  {strengthStyles[strength].label}
                </p>
              )}
            </div>

            <div className="relative">
              <Input
                id="confirmPassword"
                label="Confirm New Password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmTouched(true)}
                error={confirmMismatch ? 'Passwords do not match.' : undefined}
                className="pr-10"
                required
              />
              <EyeToggle visible={showConfirm} onClick={() => setShowConfirm((v) => !v)} />
            </div>

            <div className="mt-2 flex gap-3">
              <Button type="submit" loading={submitting} disabled={!canSubmit}>
                Update Password
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
