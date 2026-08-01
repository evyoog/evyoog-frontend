export interface PermissionCategory {
  category: string;
  permissions: { code: string; label: string }[];
}

export const PERMISSION_CATALOG: PermissionCategory[] = [
  {
    category: 'Journal',
    permissions: [
      { code: 'gl:journal:view', label: 'View Journals' },
      { code: 'gl:journal:create', label: 'Create Journals' },
      { code: 'gl:journal:edit', label: 'Edit Journals' },
      { code: 'gl:journal:submit', label: 'Submit for Approval' },
      { code: 'gl:journal:approve', label: 'Approve Journals' },
      { code: 'gl:journal:reverse', label: 'Reverse Journals' },
    ],
  },
  {
    category: 'Reporting',
    permissions: [
      { code: 'gl:trial-balance:view', label: 'View Trial Balance' },
      { code: 'gl:trial-balance:export', label: 'Export Trial Balance' },
      { code: 'gl:pl:view', label: 'View P&L Statement' },
      { code: 'gl:pl:export', label: 'Export P&L Statement' },
      { code: 'gl:balance-sheet:view', label: 'View Balance Sheet' },
      { code: 'gl:balance-sheet:export', label: 'Export Balance Sheet' },
      { code: 'gl:account-ledger:view', label: 'View Account Ledger' },
      { code: 'gl:account-ledger:export', label: 'Export Account Ledger' },
      { code: 'gl:balance:view', label: 'View Account Balances' },
      { code: 'gl:balance:manage', label: 'Manage Account Balances' },
    ],
  },
  {
    category: 'Setup',
    permissions: [
      { code: 'gl:accounts:view', label: 'View Chart of Accounts' },
      { code: 'gl:accounts:create', label: 'Create Accounts' },
      { code: 'gl:accounts:edit', label: 'Edit Accounts' },
      { code: 'gl:dimension:view', label: 'View Finance Dimensions' },
      { code: 'gl:dimension:manage', label: 'Manage Finance Dimensions' },
      { code: 'gl:ledger:view', label: 'View Ledger' },
      { code: 'gl:ledger:manage', label: 'Manage Ledger' },
      { code: 'gl:period:view', label: 'View Periods' },
      { code: 'gl:period:manage', label: 'Manage Periods' },
      { code: 'gl:wizard:view', label: 'View Setup Wizard' },
      { code: 'gl:wizard:run', label: 'Run Setup Wizard' },
    ],
  },
  {
    category: 'Users & Roles',
    permissions: [
      { code: 'gl:users:view', label: 'View Users' },
      { code: 'gl:users:create', label: 'Create Users' },
      { code: 'gl:users:edit', label: 'Edit Users' },
      { code: 'gl:roles:view', label: 'View Roles' },
      { code: 'gl:roles:create', label: 'Create Roles' },
      { code: 'gl:roles:edit', label: 'Edit Roles' },
    ],
  },
  {
    category: 'Compliance',
    permissions: [
      { code: 'gl:gst:view', label: 'View GST Reports' },
      { code: 'gl:gst:export', label: 'Export GST Reports' },
      { code: 'gl:tds:view', label: 'View TDS Reports' },
      { code: 'gl:tds:export', label: 'Export TDS Reports' },
      { code: 'gl:audit:view', label: 'View Audit Trail' },
      { code: 'gl:aie:view', label: 'View AIE Imports' },
      { code: 'gl:aie:import', label: 'Run AIE Import' },
    ],
  },
  {
    category: 'Other',
    permissions: [
      { code: 'gl:recurring:view', label: 'View Recurring Journals' },
      { code: 'gl:recurring:create', label: 'Create Recurring Journals' },
      { code: 'gl:recurring:edit', label: 'Edit Recurring Journals' },
      { code: 'gl:approval-policy:view', label: 'View Approval Policies' },
      { code: 'gl:approval-policy:manage', label: 'Manage Approval Policies' },
      { code: 'gl:enterprise:view', label: 'View Enterprise Settings' },
      { code: 'gl:enterprise:manage', label: 'Manage Enterprise Settings' },
    ],
  },
];

const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.flatMap((group) => group.permissions.map((p) => [p.code, p.label])),
);

export function permissionLabel(code: string): string {
  return PERMISSION_LABELS[code] ?? code;
}
