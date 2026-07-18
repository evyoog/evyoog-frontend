import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  permission?: string;
}

const topNavItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Journal Entry', to: '/journals/new', permission: 'gl:journal:create' },
  { label: 'Trial Balance', to: '/trial-balance', permission: 'gl:trial-balance:view' },
  { label: 'P&L Statement', to: '/pl-statement', permission: 'gl:pl:view' },
];

function NavItemLink({ item }: { item: NavItem }) {
  const { hasPermission } = useAuth();
  const allowed = item.permission ? hasPermission(item.permission) : true;
  if (!allowed) return null;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `block border-l-4 px-4 py-2.5 text-sm transition-colors ${
          isActive
            ? 'border-l-blue bg-white/5 font-medium text-white'
            : 'border-l-transparent text-white/70 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      {item.label}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-navy">
      <div className="px-4 py-5">
        <span className="text-lg font-bold text-white">eVyoog ERP</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 border-t border-white/10 pt-3">
        {topNavItems.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="border-t border-white/10 py-3">
        <NavItemLink item={{ label: 'Settings', to: '/settings' }} />
      </div>
    </aside>
  );
}
