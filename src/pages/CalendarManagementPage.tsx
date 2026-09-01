import { useCallback, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  listCalendars,
  listLedgers,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  listAccountingPeriods,
  generateNextYearPeriods,
} from '../api/gl';
import { formatDate } from '../utils/format';
import type { AccountingCalendar, AccountingPeriod, Ledger } from '../types';

const MONTH_NAMES: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

const MONTH_ABBR: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

const PERIOD_TYPE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly (12 periods/year)',
  QUARTERLY: 'Quarterly (4 periods/year)',
  FISCAL_4_4_5: 'Fiscal 4-4-5 (13 periods/year)',
};

const PERIOD_ROW_TYPE_BADGE: Record<string, string> = {
  REGULAR: 'bg-slate-100 text-slate-800',
  ADJUSTMENT: 'bg-amber-100 text-amber-800',
  YEAR_END: 'bg-purple-100 text-purple-800',
};

function endMonthAbbr(startMonth: number): string {
  const end = startMonth === 1 ? 12 : startMonth - 1;
  return MONTH_ABBR[end];
}

function groupPeriodsByFiscalYear(periods: AccountingPeriod[]): [string, AccountingPeriod[]][] {
  const groups = new Map<string, AccountingPeriod[]>();
  for (const p of periods) {
    const list = groups.get(p.fiscalYear) ?? [];
    list.push(p);
    groups.set(p.fiscalYear, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

interface CreateCalendarForm {
  ledgerId: string;
  name: string;
  description: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  periodType: string;
  initialFiscalYear: number;
}

function defaultCreateForm(): CreateCalendarForm {
  return {
    ledgerId: '',
    name: '',
    description: '',
    fiscalYearStartMonth: 4,
    fiscalYearStartDay: 1,
    periodType: 'MONTHLY',
    initialFiscalYear: new Date().getFullYear(),
  };
}

export default function CalendarManagementPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('gl:ledger:manage');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [calendars, setCalendars] = useState<AccountingCalendar[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [periodsByCalendar, setPeriodsByCalendar] = useState<Record<string, AccountingPeriod[]>>(
    {},
  );
  const [loadingPeriodsId, setLoadingPeriodsId] = useState<string | null>(null);
  const [selectedFY, setSelectedFY] = useState<Record<string, string>>({});

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCalendarForm>(defaultCreateForm());
  const [creating, setCreating] = useState(false);

  const [editingCalendar, setEditingCalendar] = useState<AccountingCalendar | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AccountingCalendar | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [generateTarget, setGenerateTarget] = useState<AccountingCalendar | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadCalendars = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [cals, allLedgers] = await Promise.all([listCalendars(), listLedgers()]);
      setCalendars(cals);
      setLedgers(allLedgers);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  const toggleViewPeriods = async (calendar: AccountingCalendar) => {
    if (expandedId === calendar.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(calendar.id);
    if (periodsByCalendar[calendar.id]) return;
    setLoadingPeriodsId(calendar.id);
    try {
      const periods = await listAccountingPeriods(calendar.id);
      setPeriodsByCalendar((prev) => ({ ...prev, [calendar.id]: periods }));
      const groups = groupPeriodsByFiscalYear(periods);
      if (groups.length > 0) {
        setSelectedFY((prev) => ({ ...prev, [calendar.id]: groups[0][0] }));
      }
    } catch {
      showToast('Failed to load periods for this calendar.', 'error');
      setExpandedId(null);
    } finally {
      setLoadingPeriodsId(null);
    }
  };

  const handleCreateSubmit = async () => {
    if (!createForm.ledgerId || !createForm.name || !createForm.initialFiscalYear) return;
    setCreating(true);
    try {
      await createCalendar({
        ledgerId: createForm.ledgerId,
        name: createForm.name,
        description: createForm.description || undefined,
        fiscalYearStartMonth: createForm.fiscalYearStartMonth,
        fiscalYearStartDay: createForm.fiscalYearStartDay,
        periodType: createForm.periodType,
        initialFiscalYear: createForm.initialFiscalYear,
      });
      showToast('Calendar created', 'success');
      setShowCreateModal(false);
      setCreateForm(defaultCreateForm());
      loadCalendars();
    } catch {
      showToast('Failed to create calendar. Please try again.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (calendar: AccountingCalendar) => {
    setEditingCalendar(calendar);
    setEditName(calendar.name);
    setEditDescription(calendar.description ?? '');
    setMenuOpenId(null);
  };

  const handleEditSubmit = async () => {
    if (!editingCalendar || !editName) return;
    setSavingEdit(true);
    try {
      await updateCalendar(editingCalendar.id, {
        name: editName,
        description: editDescription || undefined,
      });
      showToast('Calendar updated', 'success');
      setEditingCalendar(null);
      loadCalendars();
    } catch {
      showToast('Failed to update calendar. Please try again.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCalendar(deleteTarget.id);
      showToast('Calendar deleted', 'success');
      setDeleteTarget(null);
      loadCalendars();
    } catch {
      showToast('Failed to delete calendar. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateConfirm = async () => {
    if (!generateTarget) return;
    setGenerating(true);
    try {
      await generateNextYearPeriods(generateTarget.id);
      showToast('Periods generated successfully', 'success');
      setGenerateTarget(null);
      setPeriodsByCalendar((prev) => {
        const next = { ...prev };
        delete next[generateTarget.id];
        return next;
      });
      loadCalendars();
      if (expandedId === generateTarget.id) {
        const periods = await listAccountingPeriods(generateTarget.id);
        setPeriodsByCalendar((prev) => ({ ...prev, [generateTarget.id]: periods }));
      }
    } catch {
      showToast('Failed to generate periods. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout breadcrumb="Calendar Management">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Calendar Management</h1>
          <p className="mt-1 text-sm text-slate">
            Create and manage accounting calendars for your ledgers
          </p>
        </div>
        {canManage && calendars.length > 0 && (
          <Button onClick={() => setShowCreateModal(true)}>+ Add Calendar</Button>
        )}
      </div>

      {loading && (
        <div className="mt-6">
          <CardSkeleton count={3} />
        </div>
      )}

      {!loading && error && (
        <Card className="mt-6">
          <ErrorState
            message="Failed to load accounting calendars. Please try again."
            onRetry={loadCalendars}
          />
        </Card>
      )}

      {!loading && !error && calendars.length === 0 && (
        <Card className="mt-6">
          <EmptyState
            title="No calendars yet"
            message="Create your first accounting calendar to get started."
            action={
              canManage ? { label: 'Add Calendar', onClick: () => setShowCreateModal(true) } : undefined
            }
          />
        </Card>
      )}

      {!loading && !error && calendars.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {calendars.map((calendar) => {
            const periods = periodsByCalendar[calendar.id];
            const groups = periods ? groupPeriodsByFiscalYear(periods) : [];
            const activeFY = selectedFY[calendar.id] ?? groups[0]?.[0];
            const activeGroup = groups.find(([fy]) => fy === activeFY);
            const canDelete = calendar.generatedPeriodCount === 0;

            return (
              <Card key={calendar.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-navy">{calendar.name}</h2>
                    <p className="text-sm text-slate">Linked to: {calendar.ledgerName}</p>
                  </div>
                  {canManage && (
                    <div className="relative flex items-center gap-2">
                      <Button variant="secondary" onClick={() => openEdit(calendar)}>
                        Edit
                      </Button>
                      <button
                        type="button"
                        onClick={() =>
                          setMenuOpenId((cur) => (cur === calendar.id ? null : calendar.id))
                        }
                        aria-label="More actions"
                        className="rounded-md border border-border px-2 py-2 text-slate hover:bg-offwhite"
                      >
                        ⋮
                      </button>
                      {menuOpenId === calendar.id && (
                        <div className="absolute right-0 top-11 z-10 w-56 rounded-md border border-border bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              setGenerateTarget(calendar);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-navy hover:bg-offwhite"
                          >
                            Generate Next FY Periods
                          </button>
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => {
                              setMenuOpenId(null);
                              setDeleteTarget(calendar);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-offwhite disabled:cursor-not-allowed disabled:text-slate/50 disabled:hover:bg-transparent"
                            title={
                              canDelete
                                ? undefined
                                : 'Cannot delete a calendar with generated periods'
                            }
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="text-navy">
                    {MONTH_ABBR[calendar.fiscalYearStartMonth]} – {endMonthAbbr(calendar.fiscalYearStartMonth)}
                  </span>
                  <span className="rounded-full bg-blue-light px-2.5 py-0.5 text-xs font-medium text-blue-dark">
                    {calendar.periodType}
                  </span>
                  <span className="text-slate">{calendar.periodsPerYear} periods/year</span>
                  <span className="text-slate">FY {calendar.currentFiscalYear}</span>
                  <span className="text-slate">{calendar.generatedPeriodCount} periods generated</span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleViewPeriods(calendar)}
                  className="mt-4 text-sm font-medium text-blue hover:text-blue-dark"
                >
                  View Periods {expandedId === calendar.id ? '▲' : '▼'}
                </button>

                {expandedId === calendar.id && (
                  <div className="mt-3 border-t border-border pt-4">
                    {loadingPeriodsId === calendar.id && (
                      <p className="text-sm text-slate">Loading periods...</p>
                    )}
                    {loadingPeriodsId !== calendar.id && groups.length === 0 && (
                      <p className="text-sm text-slate">No periods generated yet.</p>
                    )}
                    {loadingPeriodsId !== calendar.id && groups.length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {groups.map(([fy]) => (
                            <button
                              key={fy}
                              type="button"
                              onClick={() =>
                                setSelectedFY((prev) => ({ ...prev, [calendar.id]: fy }))
                              }
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                fy === activeFY
                                  ? 'bg-navy text-white'
                                  : 'bg-offwhite text-slate hover:bg-border'
                              }`}
                            >
                              FY {fy}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                                <th className="py-2 pr-2 font-medium">Period</th>
                                <th className="py-2 pr-2 font-medium">Dates</th>
                                <th className="py-2 pr-2 font-medium">Quarter</th>
                                <th className="py-2 pr-2 font-medium">Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeGroup?.[1].map((period) => (
                                <tr key={period.id} className="border-b border-border last:border-0">
                                  <td className="py-2 pr-2 font-medium text-navy">{period.name}</td>
                                  <td className="py-2 pr-2 text-slate">
                                    {formatDate(period.startDate)} – {formatDate(period.endDate)}
                                  </td>
                                  <td className="py-2 pr-2 text-slate">Q{period.quarterNumber}</td>
                                  <td className="py-2 pr-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        PERIOD_ROW_TYPE_BADGE[period.periodType] ??
                                        'bg-slate-100 text-slate-800'
                                      }`}
                                    >
                                      {period.periodType}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <Modal
          title="Create Accounting Calendar"
          onClose={() => {
            setShowCreateModal(false);
            setCreateForm(defaultCreateForm());
          }}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm(defaultCreateForm());
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                loading={creating}
                disabled={!createForm.ledgerId || !createForm.name || !createForm.initialFiscalYear}
              >
                Create Calendar
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Select
              id="cal-ledger"
              label="Ledger"
              required
              value={createForm.ledgerId}
              onChange={(e) => setCreateForm((f) => ({ ...f, ledgerId: e.target.value }))}
            >
              <option value="">Select ledger...</option>
              {ledgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name ?? l.ledgerName}
                </option>
              ))}
            </Select>
            <Input
              id="cal-name"
              label="Name"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="FY Calendar"
            />
            <Input
              id="cal-description"
              label="Description"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="optional"
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                id="cal-fy-start-month"
                label="Fiscal Year Start Month"
                value={createForm.fiscalYearStartMonth}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, fiscalYearStartMonth: Number(e.target.value) }))
                }
              >
                {Object.entries(MONTH_NAMES).map(([num, name]) => (
                  <option key={num} value={num}>
                    {name}
                  </option>
                ))}
              </Select>
              <Input
                id="cal-fy-start-day"
                label="Fiscal Year Start Day"
                type="number"
                min={1}
                max={31}
                value={createForm.fiscalYearStartDay}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, fiscalYearStartDay: Number(e.target.value) }))
                }
              />
            </div>
            <Select
              id="cal-period-type"
              label="Period Type"
              required
              value={createForm.periodType}
              onChange={(e) => setCreateForm((f) => ({ ...f, periodType: e.target.value }))}
            >
              {Object.entries(PERIOD_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              id="cal-initial-fy"
              label="Initial Fiscal Year"
              required
              type="number"
              value={createForm.initialFiscalYear}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, initialFiscalYear: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-slate">
              Generates periods for FY{' '}
              {createForm.fiscalYearStartMonth === 1
                ? createForm.initialFiscalYear
                : `${createForm.initialFiscalYear}-${String(createForm.initialFiscalYear + 1).slice(-2)}`}
            </p>
          </div>
        </Modal>
      )}

      {editingCalendar && (
        <Modal
          title="Edit Calendar"
          onClose={() => setEditingCalendar(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditingCalendar(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} loading={savingEdit} disabled={!editName}>
                Save Changes
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input
              id="edit-cal-name"
              label="Name"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              id="edit-cal-description"
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="optional"
            />
            <p className="text-xs text-slate">
              Note: Fiscal year, period type, and ledger cannot be changed after creation.
            </p>
          </div>
        </Modal>
      )}

      {generateTarget && (
        <Modal
          title="Generate Next FY Periods"
          onClose={() => setGenerateTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setGenerateTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateConfirm} loading={generating}>
                Generate Periods
              </Button>
            </>
          }
        >
          <p className="text-sm text-navy">
            This will generate the next fiscal year's periods on calendar &ldquo;{generateTarget.name}
            &rdquo;. This action cannot be undone.
          </p>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Calendar"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-navy">
            Are you sure you want to delete &ldquo;{deleteTarget.name}&rdquo;? This action cannot be
            undone.
          </p>
        </Modal>
      )}
    </AppLayout>
  );
}
