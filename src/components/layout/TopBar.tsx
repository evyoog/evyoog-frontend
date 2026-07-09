import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

interface TopBarProps {
  breadcrumb: string;
}

export default function TopBar({ breadcrumb }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <span className="text-sm font-medium text-slate">{breadcrumb}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-navy">{user?.fullName}</span>
        <Button variant="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
