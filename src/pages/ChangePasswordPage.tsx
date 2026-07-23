import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as authApi from '../api/auth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

function validateNewPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return null;
}

export default function ChangePasswordPage() {
  const { clearMustChangePwd, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      clearMustChangePwd();
      showToast('Password changed successfully.', 'success');
      navigate('/dashboard');
    } catch {
      setError('Failed to change password. Please check your current password and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4">
      <h1 className="mb-8 text-2xl font-bold text-white">eVyoog ERP</h1>

      <div className="w-96 rounded-xl bg-white p-8 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold text-navy">Change Your Password</h2>
        <p className="mb-6 text-sm text-slate">
          You must change your password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="currentPassword"
            label="Current Password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            id="newPassword"
            label="New Password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <p className="text-xs text-slate">
            Must be at least 8 characters, with an uppercase letter and a number.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            Change Password
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={handleLogout}>
            Log Out Instead
          </Button>
        </form>
      </div>
    </div>
  );
}
