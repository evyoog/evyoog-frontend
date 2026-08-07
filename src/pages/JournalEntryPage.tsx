import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { FormSkeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createJournal,
  getPeriodStatus,
  listChartOfAccounts,
  listDimensionValues,
  listFinanceDimensions,
  listJournalCategories,
  listJournalSources,
  listLedgers,
} from '../api/gl';
import type {
  ChartOfAccount,
  DimensionValue,
  FinanceDimension,
  JournalCategory,
  JournalSource,
  PeriodStatus,
} from '../types';
import { formatINR } from '../utils/format';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function periodDateRange(periodName: string): { start: string; end: string } | null {
  const [monAbbr, year] = periodName.split('-');
  const monthIndex = MONTHS.indexOf(monAbbr?.toUpperCase());
  if (monthIndex === -1 || !year) return null;
  const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Number(year), monthIndex + 1, 0).getDate();
  const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

interface DraftLine {
  key: string;
  naturalAccountValueId: string;
  accountCode: string;
  costCentreCode: string;
  productCode: string;
  description: string;
  debit: string;
  credit: string;
}

function newLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    naturalAccountValueId: '',
    accountCode: '',
    costCentreCode: '',
    productCode: '',
    description: '',
    debit: '',
    credit: '',
  };
}

function buildAccountCombination(
  naturalAccountCode: string,
  costCentreCode: string,
  productCode: string,
): Record<string, string> {
  const combination: Record<string, string> = { NATURAL_ACCOUNT: naturalAccountCode };
  if (costCentreCode) combination.COST_CENTRE = costCentreCode;
  if (productCode) combination.PRODUCT = productCode;
  return combination;
}

function validateDescription(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Description is required.';
  if (trimmed.length < 3) return 'Description must be at least 3 characters.';
  return undefined;
}

function validateGlDate(value: string, openPeriod: PeriodStatus | null): string | undefined {
  if (!value) return 'GL Date is required.';
  if (Number.isNaN(new Date(value).getTime())) return 'Enter a valid date.';
  if (openPeriod) {
    const range = periodDateRange(openPeriod.periodName);
    if (range && (value < range.start || value > range.end)) {
      return `GL Date must fall within the open period (${openPeriod.periodName}).`;
    }
  }
  return undefined;
}

function validateLineAccount(line: DraftLine): string | undefined {
  return line.naturalAccountValueId ? undefined : 'Account is required.';
}

function validateLineCostCentre(
  line: DraftLine,
  costCentreDim: FinanceDimension | null,
): string | undefined {
  if (costCentreDim?.isRequired && !line.costCentreCode) return 'Cost Centre is required.';
  return undefined;
}

function validateLineAmounts(line: DraftLine): { debit?: string; credit?: string } {
  const debitVal = line.debit.trim();
  const creditVal = line.credit.trim();
  if (debitVal && creditVal) {
    const msg = 'Enter either a debit or a credit amount, not both.';
    return { debit: msg, credit: msg };
  }
  if (!debitVal && !creditVal) {
    const msg = 'Enter a debit or a credit amount.';
    return { debit: msg, credit: msg };
  }
  if (debitVal) {
    const n = parseFloat(debitVal);
    if (Number.isNaN(n) || n <= 0) return { debit: 'Debit amount must be a positive number.' };
  }
  if (creditVal) {
    const n = parseFloat(creditVal);
    if (Number.isNaN(n) || n <= 0) return { credit: 'Credit amount must be a positive number.' };
  }
  return {};
}

export default function JournalEntryPage() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [glDate, setGlDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([newLine(), newLine()]);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const [sources, setSources] = useState<JournalSource[]>([]);
  const [journalSourceId, setJournalSourceId] = useState('');
  const [categories, setCategories] = useState<JournalCategory[]>([]);
  const [journalCategoryId, setJournalCategoryId] = useState('');
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [openPeriod, setOpenPeriod] = useState<PeriodStatus | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [costCentreDim, setCostCentreDim] = useState<FinanceDimension | null>(null);
  const [productDim, setProductDim] = useState<FinanceDimension | null>(null);
  const [costCentreValues, setCostCentreValues] = useState<DimensionValue[]>([]);
  const [productValues, setProductValues] = useState<DimensionValue[]>([]);

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;
  const linesReady = lines.every(
    (l) => l.naturalAccountValueId && (!costCentreDim?.isRequired || l.costCentreCode),
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      listJournalSources(),
      listJournalCategories(),
      listLedgers(user.legalEntityId),
      getPeriodStatus(user.legalEntityId),
    ])
      .then(async ([sourceList, categoryList, ledgers, periods]) => {
        if (cancelled) return;
        setSources(sourceList);
        setCategories(categoryList);
        if (sourceList.length === 1) setJournalSourceId(sourceList[0].id);
        if (categoryList.length === 1) setJournalCategoryId(categoryList[0].id);
        const open = periods.find((p) => p.status === 'OPEN') ?? null;
        setOpenPeriod(open);
        const range = open ? periodDateRange(open.periodName) : null;
        if (range) setGlDate(range.start);

        const ledger = ledgers[0];
        if (ledger) {
          const [accountList, dims] = await Promise.all([
            listChartOfAccounts(user.legalEntityId, ledger.id),
            listFinanceDimensions(ledger.id),
          ]);
          if (cancelled) return;
          setAccounts(accountList);

          const costCtrDim = dims.find((d) => d.dimensionType === 'COST_CENTRE') ?? null;
          const prodDim = dims.find((d) => d.dimensionType === 'PRODUCT') ?? null;
          setCostCentreDim(costCtrDim);
          setProductDim(prodDim);

          const [costVals, prodVals] = await Promise.all([
            costCtrDim ? listDimensionValues(costCtrDim.id) : Promise.resolve([]),
            prodDim ? listDimensionValues(prodDim.id) : Promise.resolve([]),
          ]);
          if (cancelled) return;
          setCostCentreValues(costVals.filter((v) => v.isActive));
          setProductValues(prodVals.filter((v) => v.isActive));
        }
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load journal sources, categories, or accounts.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingLookups(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (isDirty) {
      window.onbeforeunload = () => 'You have unsaved changes. Are you sure you want to leave?';
    } else {
      window.onbeforeunload = null;
    }
    return () => {
      window.onbeforeunload = null;
    };
  }, [isDirty]);

  const setFieldError = (field: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setIsDirty(true);
    clearFieldError('description');
  };

  const handleDescriptionBlur = () => {
    const err = validateDescription(description);
    if (err) setFieldError('description', err);
    else clearFieldError('description');
  };

  const handleGlDateChange = (value: string) => {
    setGlDate(value);
    setIsDirty(true);
    clearFieldError('glDate');
  };

  const handleGlDateBlur = () => {
    const err = validateGlDate(glDate, openPeriod);
    if (err) setFieldError('glDate', err);
    else clearFieldError('glDate');
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setIsDirty(true);
  };

  const selectAccount = (key: string, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    updateLine(key, {
      naturalAccountValueId: accountId,
      accountCode: account?.code ?? '',
    });
    clearFieldError(`account-${key}`);
  };

  const handleLineAccountBlur = (line: DraftLine) => {
    const err = validateLineAccount(line);
    if (err) setFieldError(`account-${line.key}`, err);
    else clearFieldError(`account-${line.key}`);
  };

  const selectCostCentre = (key: string, costCentreCode: string) => {
    updateLine(key, { costCentreCode });
    clearFieldError(`costCentre-${key}`);
  };

  const handleLineCostCentreBlur = (line: DraftLine) => {
    const err = validateLineCostCentre(line, costCentreDim);
    if (err) setFieldError(`costCentre-${line.key}`, err);
    else clearFieldError(`costCentre-${line.key}`);
  };

  const selectProduct = (key: string, productCode: string) => {
    updateLine(key, { productCode });
  };

  const handleLineAmountChange = (line: DraftLine, patch: Partial<DraftLine>) => {
    updateLine(line.key, patch);
    clearFieldError(`debit-${line.key}`);
    clearFieldError(`credit-${line.key}`);
  };

  const handleLineAmountBlur = (line: DraftLine) => {
    const { debit, credit } = validateLineAmounts(line);
    if (debit) setFieldError(`debit-${line.key}`, debit);
    else clearFieldError(`debit-${line.key}`);
    if (credit) setFieldError(`credit-${line.key}`, credit);
    else clearFieldError(`credit-${line.key}`);
  };

  const addLine = () => {
    setLines((prev) => [...prev, newLine()]);
    setIsDirty(true);
  };

  const removeLine = (key: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
    setIsDirty(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`account-${key}`];
      delete next[`costCentre-${key}`];
      delete next[`debit-${key}`];
      delete next[`credit-${key}`];
      return next;
    });
  };

  const validateAll = (): boolean => {
    const next: Record<string, string> = {};
    const descErr = validateDescription(description);
    if (descErr) next.description = descErr;
    const dateErr = validateGlDate(glDate, openPeriod);
    if (dateErr) next.glDate = dateErr;
    for (const line of lines) {
      const accErr = validateLineAccount(line);
      if (accErr) next[`account-${line.key}`] = accErr;
      const ccErr = validateLineCostCentre(line, costCentreDim);
      if (ccErr) next[`costCentre-${line.key}`] = ccErr;
      const { debit, credit } = validateLineAmounts(line);
      if (debit) next[`debit-${line.key}`] = debit;
      if (credit) next[`credit-${line.key}`] = credit;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (submitForApproval: boolean) => {
    if (!user) return;
    if (!validateAll()) {
      showToast('Please fix the highlighted errors before continuing.', 'error');
      return;
    }
    setSaving(submitForApproval ? 'submit' : 'draft');
    try {
      const journal = await createJournal({
        legalEntityId: user.legalEntityId,
        description,
        glDate,
        journalSourceId,
        journalCategoryId,
        submitForApproval,
        lines: lines.map((l, idx) => ({
          lineNumber: idx + 1,
          naturalAccountValueId: l.naturalAccountValueId,
          accountCombination: buildAccountCombination(l.accountCode, l.costCentreCode, l.productCode),
          description: l.description,
          debitAmount: l.debit ? parseFloat(l.debit) : null,
          creditAmount: l.credit ? parseFloat(l.credit) : null,
        })),
      });
      setIsDirty(false);
      showToast(`Journal ${journal.journalNumber} saved successfully.`, 'success');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch {
      showToast('Failed to save journal. Please check the entries and try again.', 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppLayout breadcrumb="Journal Entry">
      <h1 className="text-2xl font-bold text-navy">New Journal Entry</h1>
      <p className="mt-1 text-sm text-slate">Create a manual journal for the current period</p>

      <Card className="mt-6">
        {loadingLookups ? (
          <FormSkeleton fields={6} />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">
              Fields marked <span className="text-red-500">*</span> are required.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  id="description"
                  label="Description"
                  required
                  aria-label="Journal description"
                  value={description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  error={fieldErrors.description}
                  disabled={saving !== null}
                />
              </div>
              <Input
                id="glDate"
                label="GL Date"
                type="date"
                required
                aria-label="GL date"
                value={glDate}
                onChange={(e) => handleGlDateChange(e.target.value)}
                onBlur={handleGlDateBlur}
                error={fieldErrors.glDate}
                disabled={saving !== null}
              />
              <Select
                id="source"
                label="Journal Source"
                aria-label="Journal source"
                value={journalSourceId}
                onChange={(e) => {
                  setJournalSourceId(e.target.value);
                  setIsDirty(true);
                }}
                disabled={loadingLookups || saving !== null}
              >
                <option value="">Select a source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                id="category"
                label="Journal Category"
                aria-label="Journal category"
                value={journalCategoryId}
                onChange={(e) => {
                  setJournalCategoryId(e.target.value);
                  setIsDirty(true);
                }}
                disabled={loadingLookups || saving !== null}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <h2 className="mt-6 mb-3 text-sm font-semibold uppercase tracking-wide text-slate">
              Journal Lines <span className="text-red-500">*</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Natural Account</th>
                    {costCentreDim && (
                      <th className="py-2 pr-2 font-medium">
                        Cost Centre
                        {costCentreDim.isRequired && <span className="text-red-500"> *</span>}
                      </th>
                    )}
                    {productDim && <th className="py-2 pr-2 font-medium">Product</th>}
                    <th className="py-2 pr-2 font-medium">Description</th>
                    <th className="py-2 pr-2 text-right font-medium">Debit</th>
                    <th className="py-2 pr-2 text-right font-medium">Credit</th>
                    <th className="py-2 pr-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.key} className="border-b border-border align-top last:border-0">
                      <td className="py-2 pr-2 font-mono text-slate">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <Select
                          aria-label={`Natural Account for line ${idx + 1}`}
                          value={line.naturalAccountValueId}
                          onChange={(e) => selectAccount(line.key, e.target.value)}
                          onBlur={() => handleLineAccountBlur(line)}
                          error={fieldErrors[`account-${line.key}`]}
                          disabled={loadingLookups || saving !== null}
                        >
                          <option value="">Select an account</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </Select>
                        {line.accountCode && (line.costCentreCode || line.productCode) && (
                          <div className="mt-1 text-xs text-slate/60">
                            {line.accountCode}
                            {line.costCentreCode ? `.${line.costCentreCode}` : ''}
                            {line.productCode ? `.${line.productCode}` : ''}
                          </div>
                        )}
                      </td>
                      {costCentreDim && (
                        <td className="py-2 pr-2">
                          <Select
                            aria-label={`Cost Centre for line ${idx + 1}`}
                            value={line.costCentreCode}
                            onChange={(e) => selectCostCentre(line.key, e.target.value)}
                            onBlur={() => handleLineCostCentreBlur(line)}
                            error={fieldErrors[`costCentre-${line.key}`]}
                            disabled={loadingLookups || saving !== null}
                          >
                            <option value="">Select Cost Centre</option>
                            {costCentreValues.map((v) => (
                              <option key={v.code} value={v.code}>
                                {v.code} — {v.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                      )}
                      {productDim && (
                        <td className="py-2 pr-2">
                          <Select
                            aria-label={`Product for line ${idx + 1}`}
                            value={line.productCode}
                            onChange={(e) => selectProduct(line.key, e.target.value)}
                            disabled={loadingLookups || saving !== null}
                          >
                            <option value="">— Optional —</option>
                            {productValues.map((v) => (
                              <option key={v.code} value={v.code}>
                                {v.code} — {v.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                      )}
                      <td className="py-2 pr-2">
                        <Input
                          aria-label={`Description for line ${idx + 1}`}
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          disabled={saving !== null}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          className="text-right font-mono"
                          aria-label={`Debit amount for line ${idx + 1}`}
                          value={line.debit}
                          onChange={(e) => handleLineAmountChange(line, { debit: e.target.value, credit: '' })}
                          onBlur={() => handleLineAmountBlur(line)}
                          error={fieldErrors[`debit-${line.key}`]}
                          disabled={saving !== null}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          className="text-right font-mono"
                          aria-label={`Credit amount for line ${idx + 1}`}
                          value={line.credit}
                          onChange={(e) => handleLineAmountChange(line, { credit: e.target.value, debit: '' })}
                          onBlur={() => handleLineAmountBlur(line)}
                          error={fieldErrors[`credit-${line.key}`]}
                          disabled={saving !== null}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          aria-label={`Remove line ${idx + 1}`}
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length <= 2 || saving !== null}
                          className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate/40"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              variant="ghost"
              className="mt-3"
              aria-label="Add journal line"
              onClick={addLine}
              disabled={saving !== null}
            >
              + Add Line
            </Button>

            <div className="mt-6 flex flex-col gap-3 rounded-md bg-offwhite p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1 font-mono text-sm sm:flex-row sm:gap-8">
                <span>
                  Total Debit: <strong className="text-navy">{formatINR(totalDebit)}</strong>
                </span>
                <span>
                  Total Credit: <strong className="text-navy">{formatINR(totalCredit)}</strong>
                </span>
              </div>
              <span className={`text-sm font-medium ${isBalanced ? 'text-green' : 'text-red-600'}`}>
                {isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {hasPermission('gl:journal:create') && (
                <Button
                  variant="secondary"
                  loading={saving === 'draft'}
                  aria-label="Save journal as draft"
                  disabled={saving !== null || !journalSourceId || !journalCategoryId || !linesReady}
                  onClick={() => handleSave(false)}
                >
                  Save as Draft
                </Button>
              )}
              {hasPermission('gl:journal:submit') && (
                <Button
                  loading={saving === 'submit'}
                  aria-label="Submit journal for approval"
                  disabled={
                    !isBalanced ||
                    saving !== null ||
                    !journalSourceId ||
                    !journalCategoryId ||
                    !linesReady
                  }
                  onClick={() => handleSave(true)}
                >
                  Submit for Approval
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </AppLayout>
  );
}
