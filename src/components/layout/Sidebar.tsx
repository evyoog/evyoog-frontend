import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  permission?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [{ label: 'Dashboard', to: '/dashboard' }],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Journal Entry', to: '/journals/new', permission: 'gl:journal:create' },
      { label: 'Journal Listing', to: '/journals', permission: 'gl:journal:view' },
      { label: 'Trial Balance', to: '/trial-balance', permission: 'gl:trial-balance:view' },
      { label: 'P&L Statement', to: '/pl-statement', permission: 'gl:pl:view' },
      { label: 'Balance Sheet', to: '/balance-sheet', permission: 'gl:balance-sheet:view' },
      { label: 'Cash Flow Statement', to: '/cash-flow', permission: 'gl:balance-sheet:view' },
      { label: 'Account Ledger', to: '/account-ledger', permission: 'gl:account-ledger:view' },
    ],
  },
  {
    title: 'Organisation',
    items: [{ label: 'Enterprise Structure', to: '/enterprise', permission: 'gl:enterprise:view' }],
  },
  {
    title: 'Accounting Configuration',
    items: [
      { label: 'Ledger Setup', to: '/ledger-setup', permission: 'gl:ledger:view' },
      { label: 'Finance Dimensions', to: '/finance-dimensions', permission: 'gl:dimension:view' },
      { label: 'Chart of Accounts', to: '/chart-of-accounts', permission: 'gl:accounts:view' },
      { label: 'Account Combinations', to: '/account-combinations', permission: 'gl:accounts:view' },
      { label: 'Period Management', to: '/period-management', permission: 'gl:period:view' },
    ],
  },
  {
    title: 'Access Control',
    items: [
      { label: 'User Management', to: '/users', permission: 'gl:users:view' },
      { label: 'Role Management', to: '/roles', permission: 'gl:roles:view' },
      { label: 'Approval Policy', to: '/approval-policy', permission: 'gl:approval-policy:view' },
    ],
  },
  {
    title: 'Settings',
    items: [{ label: 'Change Password', to: '/change-password' }],
  },
];

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { hasPermission } = useAuth();
  const allowed = item.permission ? hasPermission(item.permission) : true;
  if (!allowed) return null;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
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

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { hasPermission } = useAuth();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-shrink-0 flex-col bg-navy transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="px-4 py-5">
        <span className="text-lg font-bold text-white">eVyoog ERP</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto border-t border-white/10 pt-3">
        {navSections.map((section) => {
          const visible = section.items.some(
            (item) => !item.permission || hasPermission(item.permission),
          );
          if (!visible) return null;

          return (
            <div key={section.title}>
              <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                {section.title}
              </div>
              {section.items.map((item) => (
                <NavItemLink key={item.to} item={item} onNavigate={onClose} />
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
