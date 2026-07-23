import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import Button from './ui/Button';

const WARNING_WINDOW_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export default function SessionTimeoutWarning() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setShowWarning(false);
        return;
      }
      const expiryMs = getTokenExpiryMs(token);
      if (expiryMs === null) {
        setShowWarning(false);
        return;
      }
      const msRemaining = expiryMs - Date.now();
      setShowWarning(msRemaining > 0 && msRemaining <= WARNING_WINDOW_MS);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleExtend = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      handleLogout();
      return;
    }
    setExtending(true);
    try {
      const { accessToken } = await authApi.refreshAccessToken(refreshToken);
      localStorage.setItem('accessToken', accessToken);
      setShowWarning(false);
    } catch {
      handleLogout();
    } finally {
      setExtending(false);
    }
  };

  const handleLogout = () => {
    setShowWarning(false);
    logout();
    navigate('/login');
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40">
      <div className="w-96 rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-navy">Session Expiring Soon</h2>
        <p className="mt-2 text-sm text-slate">
          Your session expires in 5 minutes. Would you like to extend it?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={handleLogout} disabled={extending}>
            Log Out
          </Button>
          <Button onClick={handleExtend} loading={extending}>
            Extend Session
          </Button>
        </div>
      </div>
    </div>
  );
}
