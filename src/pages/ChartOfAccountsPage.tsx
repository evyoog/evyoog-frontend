import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createAccount,
  getChartOfAccounts,
  importChartOfAccounts,
  listLedgers,
  searchChartOfAccounts,
  updateAccount,
} from '../api/gl';
import type { Account, CoaImportResult } from '../types';
import { formatDate } from '../utils/format';

const QUALIFIERS = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

const QUALIFIER_CLASSES: Record<string, string> = {
  ASSET: 'bg-blue-light text-blue-dark',
  LIABILITY: 'bg-amber-light text-amber',
  EQUITY: 'bg-navy/10 text-navy',
  REVENUE: 'bg-green-light text-green',
  EXPENSE: 'bg-red-50 text-red-600',
};

function QualifierBadge({ qualifier }: { qualifier: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        QUALIFIER_CLASSES[qualifier] ?? 'bg-slate-100 text-slate'
      }`}
    >
      {qualifier}
    </span>
  );
}

function TypeBadge({ isPostable }: { isPostable: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${
        isPostable ? 'bg-green-light text-green' : 'bg-slate-100 text-slate'
      }`}
    >
      {isPostable ? 'Postable' : 'Summary'}
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

function flattenAccounts(accounts: Account[]): Account[] {
  const result: Account[] = [];
  const walk = (list: Account[]) => {
    for (const a of list) {
      result.push(a);
      if (a.children?.length) walk(a.children);
    }
  };
  walk(accounts);
  return result;
}

interface AccountFormState {
  code: string;
  name: string;
  qualifier: string;
  parentAccountId: string;
  description: string;
  isSummary: boolean;
  isPostable: boolean;
  gstApplicable: boolean;
  tdsApplicable: boolean;
  tdsSection: string;
  validFrom: string;
  validTo: string;
}

const EMPTY_FORM: AccountFormState = {
  code: '',
  name: '',
  qualifier: QUALIFIERS[0],
  parentAccountId: '',
  description: '',
  isSummary: false,
  isPostable: true,
  gstApplicable: false,
  tdsApplicable: false,
  tdsSection: '',
  validFrom: '',
  validTo: '',
};

export default function ChartOfAccountsPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission('gl:accounts:create');
  const canEdit = hasPermission('gl:accounts:edit');

  const [legalEntityId, setLegalEntityId] = useState<string | null>(null);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [baseAccounts, setBaseAccounts] = useState<Account[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [postableCount, setPostableCount] = useState(0);
  const [summaryCount, setSummaryCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Account[] | null>(null);
  const [qualifierFilter, setQualifierFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<'code' | 'name' | 'qualifier', string>>>({});
  const [saving, setSaving] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CoaImportResult | null>(null);

  async function load(leId: string, lid: string) {
    setLoading(true);
    setError(false);
    try {
      const data = await getChartOfAccounts(leId, lid);
      setBaseAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      setTotalCount(data.totalCount ?? 0);
      setPostableCount(data.postableCount ?? 0);
      setSummaryCount(data.summaryCount ?? 0);
    } catch {
      setError(true);
      showToast('Failed to load chart of accounts.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLegalEntityId(user.legalEntityId);
    listLedgers(user.legalEntityId)
      .then((ledgers) => {
        if (cancelled) return;
        const lid = ledgers[0]?.id ?? null;
        setLedgerId(lid);
        if (lid) load(user.legalEntityId, lid);
        else setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          showToast('Failed to load ledger.', 'error');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!ledgerId) return;
    if (!debouncedSearch.trim()) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    searchChartOfAccounts(ledgerId, debouncedSearch.trim())
      .then((res) => {
        if (!cancelled) setSearchResults(Array.isArray(res) ? flattenAccounts(res) : []);
      })
      .catch(() => {
        if (!cancelled) setSearchResults(null);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, ledgerId]);

  const flatAccounts = useMemo(() => flattenAccounts(baseAccounts), [baseAccounts]);

  const displayedAccounts = useMemo(() => {
    const source = searchResults !== null ? searchResults : flatAccounts;
    const term = debouncedSearch.trim().toLowerCase();
    const clientTextFilter = searchResults === null && term.length > 0;
    return source
      .filter((a) => (qualifierFilter === 'ALL' ? true : a.qualifier === qualifierFilter))
      .filter((a) => {
        if (statusFilter === 'ALL') return true;
        return statusFilter === 'ACTIVE' ? a.isActive : !a.isActive;
      })
      .filter((a) => {
        if (!clientTextFilter) return true;
        return a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term);
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [flatAccounts, searchResults, qualifierFilter, statusFilter, debouncedSearch]);

  const activeCount = flatAccounts.filter((a) => a.isActive).length;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowAccountModal(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      code: a.code,
      name: a.name,
      qualifier: a.qualifier,
      parentAccountId: a.parentAccountId ?? '',
      description: a.description ?? '',
      isSummary: a.isSummary,
      isPostable: a.isPostable,
      gstApplicable: a.gstApplicable,
      tdsApplicable: a.tdsApplicable,
      tdsSection: a.tdsSection ?? '',
      validFrom: a.validFrom ?? '',
      validTo: a.validTo ?? '',
    });
    setErrors({});
    setShowAccountModal(true);
  };

  const validate = () => {
    const next: Partial<Record<'code' | 'name' | 'qualifier', string>> = {};
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.qualifier) next.qualifier = 'Qualifier is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveAccount = async () => {
    if (!ledgerId || !legalEntityId || !validate()) return;
    setSaving(true);
    try {
      const body: Partial<Account> = {
        code: form.code.trim(),
        name: form.name.trim(),
        qualifier: form.qualifier as Account['qualifier'],
        parentAccountId: form.parentAccountId || null,
        description: form.description.trim() || null,
        isSummary: form.isSummary,
        isPostable: form.isPostable,
        gstApplicable: form.gstApplicable,
        tdsApplicable: form.tdsApplicable,
        tdsSection: form.tdsApplicable ? form.tdsSection.trim() || null : null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      };
      if (editing) {
        await updateAccount(editing.id, body);
        showToast('Account updated successfully.', 'success');
      } else {
        await createAccount({ ledgerId, legalEntityId, ...body });
        showToast('Account created successfully.', 'success');
      }
      setShowAccountModal(false);
      await load(legalEntityId, ledgerId);
    } catch {
      showToast('Failed to save account. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (a: Account) => {
    if (!legalEntityId || !ledgerId) return;
    setActingId(a.id);
    setConfirmId(null);
    try {
      await updateAccount(a.id, { isActive: false });
      showToast('Account deactivated.', 'success');
      await load(legalEntityId, ledgerId);
    } catch {
      showToast('Failed to deactivate account. Please try again.', 'error');
    } finally {
      setActingId(null);
    }
  };

  const handleImport = async () => {
    if (!importFile || !legalEntityId || !ledgerId) return;
    setImporting(true);
    try {
      const result = await importChartOfAccounts(legalEntityId, ledgerId, importFile);
      setImportResult(result);
      await load(legalEntityId, ledgerId);
    } catch {
      showToast('Import failed. Please try again.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
  };

  const noAccountsAtAll = !loading && flatAccounts.length === 0;

  return (
    <AppLayout breadcrumb="Chart of Accounts">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-slate">
            Orbinox Valves India Pvt Ltd — Primary Ledger
          </p>
        </div>
        <div className="flex gap-3">
          {canCreate && (
            <Button
              variant="secondary"
              onClick={() => setShowImportModal(true)}
              aria-label="Import chart of accounts from Excel"
            >
              Import from Excel
            </Button>
          )}
          {canCreate && (
            <Button onClick={openAdd} aria-label="Add new account">
              Add Account
            </Button>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={4} />
        </div>
      )}

      {!loading && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Total Accounts</p>
            <p className="mt-1 text-2xl font-bold text-navy">{totalCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Postable</p>
            <p className="mt-1 text-2xl font-bold text-navy">{postableCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Summary</p>
            <p className="mt-1 text-2xl font-bold text-navy">{summaryCount}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate">Active</p>
            <p className="mt-1 text-2xl font-bold text-navy">{activeCount}</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <div className="flex items-end gap-3">
          <div className="w-72">
            <Input
              id="coa-search"
              label="Search"
              aria-label="Search chart of accounts"
              placeholder="Search by code or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              id="coa-qualifier-filter"
              label="Qualifier"
              aria-label="Filter by qualifier"
              value={qualifierFilter}
              onChange={(e) => setQualifierFilter(e.target.value)}
            >
              <option value="ALL">All qualifiers</option>
              {QUALIFIERS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select
              id="coa-status-filter"
              label="Status"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
        </div>

        <div className="mt-6">
          {loading && <TableSkeleton rows={8} columns={8} />}

          {!loading && error && (
            <ErrorState
              message="Failed to load chart of accounts. Please try again."
              onRetry={() => legalEntityId && ledgerId && load(legalEntityId, ledgerId)}
            />
          )}

          {!loading && !error && noAccountsAtAll && (
            <EmptyState
              title="No accounts found"
              message="Add accounts to your chart of accounts or import from Excel."
              action={canCreate ? { label: 'Add Account', onClick: openAdd } : undefined}
              secondaryAction={
                canCreate
                  ? { label: 'Import from Excel', onClick: () => setShowImportModal(true) }
                  : undefined
              }
            />
          )}

          {!loading && !error && !noAccountsAtAll && displayedAccounts.length === 0 && (
            <EmptyState
              title="No accounts match your filters"
              message="Try adjusting your search or filters."
            />
          )}

          {!loading && !error && displayedAccounts.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                  <th className="py-2 pr-2 font-medium">Code</th>
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 pr-2 font-medium">Qualifier</th>
                  <th className="py-2 pr-2 font-medium">Type</th>
                  <th className="py-2 pr-2 font-medium">Normal Balance</th>
                  <th className="py-2 pr-2 font-medium">GST</th>
                  <th className="py-2 pr-2 font-medium">TDS</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  {(canEdit || canCreate) && <th className="py-2 pr-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayedAccounts.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-offwhite">
                    <td className="py-2 pr-2 font-mono text-navy">{a.code}</td>
                    <td className="py-2 pr-2">{a.name}</td>
                    <td className="py-2 pr-2">
                      <QualifierBadge qualifier={a.qualifier} />
                    </td>
                    <td className="py-2 pr-2">
                      <TypeBadge isPostable={a.isPostable} />
                    </td>
                    <td className="py-2 pr-2">{a.normalBalance}</td>
                    <td className="py-2 pr-2">{a.gstApplicable ? '✓' : '—'}</td>
                    <td className="py-2 pr-2">
                      {a.tdsApplicable ? `✓${a.tdsSection ? ` (${a.tdsSection})` : ''}` : '—'}
                    </td>
                    <td className="py-2 pr-2">
                      <StatusBadge isActive={a.isActive} />
                    </td>
                    {(canEdit || canCreate) && (
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => openEdit(a)}
                              aria-label={`Edit ${a.name}`}
                            >
                              Edit
                            </Button>
                          )}
                          {canEdit && a.isActive && (
                            confirmId === a.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                Sure?
                                <Button
                                  variant="danger"
                                  className="px-2 py-1 text-xs"
                                  disabled={actingId === a.id}
                                  onClick={() => handleDeactivate(a)}
                                >
                                  Yes
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="px-2 py-1 text-xs"
                                  disabled={actingId === a.id}
                                  onClick={() => setConfirmId(null)}
                                >
                                  No
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="danger"
                                className="px-2 py-1 text-xs"
                                disabled={actingId === a.id}
                                onClick={() => setConfirmId(a.id)}
                                aria-label={`Deactivate ${a.name}`}
                              >
                                Deactivate
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </Card>

      {showAccountModal && (
        <Modal
          title={editing ? 'Edit Account' : 'Add Account'}
          subtitle={
            editing
              ? `Created: ${formatDate(editing.createdAt)}${
                  editing.updatedAt ? ` · Modified: ${formatDate(editing.updatedAt)}` : ''
                }`
              : undefined
          }
          onClose={() => setShowAccountModal(false)}
          widthClassName="max-w-2xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAccountModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveAccount} loading={saving}>
                Save
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="acc-code"
              label="Code *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              error={errors.code}
            />
            <Input
              id="acc-name"
              label="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <Select
              id="acc-qualifier"
              label="Qualifier *"
              value={form.qualifier}
              onChange={(e) => setForm({ ...form, qualifier: e.target.value })}
            >
              {QUALIFIERS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
            <Select
              id="acc-parent"
              label="Parent Account"
              value={form.parentAccountId}
              onChange={(e) => setForm({ ...form, parentAccountId: e.target.value })}
            >
              <option value="">None</option>
              {flatAccounts
                .filter((a) => !editing || a.id !== editing.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
            </Select>
            <div className="col-span-2">
              <Input
                id="acc-description"
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <Input
              id="acc-valid-from"
              label="Valid From"
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
            <Input
              id="acc-valid-to"
              label="Valid To"
              type="date"
              value={form.validTo}
              onChange={(e) => setForm({ ...form, validTo: e.target.value })}
            />

            <div className="col-span-2 flex flex-wrap gap-6 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.isSummary}
                  onChange={(e) => setForm({ ...form, isSummary: e.target.checked })}
                />
                Is Summary
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.isPostable}
                  onChange={(e) => setForm({ ...form, isPostable: e.target.checked })}
                />
                Is Postable
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.gstApplicable}
                  onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })}
                />
                GST Applicable
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={form.tdsApplicable}
                  onChange={(e) => setForm({ ...form, tdsApplicable: e.target.checked })}
                />
                TDS Applicable
              </label>
            </div>

            {form.tdsApplicable && (
              <div className="col-span-2">
                <Input
                  id="acc-tds-section"
                  label="TDS Section"
                  value={form.tdsSection}
                  onChange={(e) => setForm({ ...form, tdsSection: e.target.value })}
                />
              </div>
            )}

            {editing && (
              <div className="col-span-2 border-t pt-4 mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Record Info</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>Created: {formatDate(editing.createdAt)}</div>
                  <div>Account ID: {editing.id.slice(0, 8)}...</div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal title="Import from Excel" onClose={closeImportModal}
          footer={
            importResult ? (
              <Button onClick={closeImportModal}>Close</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={closeImportModal} disabled={importing}>
                  Cancel
                </Button>
                <Button onClick={handleImport} loading={importing} disabled={!importFile}>
                  Upload
                </Button>
              </>
            )
          }
        >
          {!importResult && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate">
                Upload an Excel file (.xlsx, .xls) to bulk import chart of accounts entries.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </div>
          )}
          {importResult && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-navy">
                Processed {importResult.totalRows} row(s) —{' '}
                <span className="text-green">{importResult.successCount} succeeded</span>,{' '}
                <span className="text-red-600">{importResult.errorCount} failed</span>
              </p>
              {importResult.errors?.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-border p-2">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="border-b border-border py-1 text-xs last:border-0">
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Modal>
      )}
    </AppLayout>
  );
}
