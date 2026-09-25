import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getPrimaryLedger,
  getPeriodStatus,
  downloadObTemplate,
  previewOpeningBalances,
  importOpeningBalances,
} from '../api/gl';
import { formatINR } from '../utils/format';
import type {
  Ledger,
  PeriodStatus,
  OpeningBalancePreviewResponse,
  OpeningBalanceImportResponse,
} from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const QUALIFIER_BADGE: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-amber-100 text-amber-800',
  EQUITY: 'bg-green-100 text-green-800',
  REVENUE: 'bg-purple-100 text-purple-800',
  EXPENSE: 'bg-red-100 text-red-800',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function OpeningBalanceImportPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [openPeriods, setOpenPeriods] = useState<PeriodStatus[]>([]);

  const [periodId, setPeriodId] = useState('');
  const [downloading, setDownloading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<OpeningBalancePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<OpeningBalanceImportResponse | null>(null);

  const loadLookups = useCallback(async () => {
    if (!user) return;
    setLoadingLookups(true);
    setLookupError(false);
    try {
      const [primaryLedger, periods] = await Promise.all([
        getPrimaryLedger(user.legalEntityId),
        getPeriodStatus(user.legalEntityId),
      ]);
      setLedger(primaryLedger);
      setOpenPeriods(periods.filter((p) => p.status === 'OPEN'));
    } catch {
      setLookupError(true);
    } finally {
      setLoadingLookups(false);
    }
  }, [user]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const handleDownloadTemplate = async () => {
    if (!ledger) return;
    setDownloading(true);
    try {
      const blob = await downloadObTemplate(ledger.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'eVyoog_Opening_Balance_Template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download template. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const validateAndSetFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setFileError('Only .xlsx files are supported.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError('File exceeds the 10MB size limit.');
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(selected);
    setPreview(null);
    setPreviewError(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handlePreview = async () => {
    if (!user || !ledger || !periodId || !file) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const response = await previewOpeningBalances(file, {
        legalEntityId: user.legalEntityId,
        ledgerId: ledger.id,
        accountingPeriodId: periodId,
      });
      setPreview(response);
    } catch {
      setPreviewError('Failed to preview the file. Please check your connection and try again.');
      showToast('Preview failed. Please try again.', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleChangeFile = () => {
    setFile(null);
    setFileError(null);
    setPreview(null);
    setPreviewError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!user || !ledger || !periodId || !file) return;
    setPosting(true);
    try {
      const response = await importOpeningBalances(file, {
        legalEntityId: user.legalEntityId,
        ledgerId: ledger.id,
        accountingPeriodId: periodId,
        createdBy: user.email,
      });
      setResult(response);
    } catch {
      showToast('Failed to post opening balances. Please try again.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleImportAnother = () => {
    setResult(null);
    setPreview(null);
    setPreviewError(null);
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleViewJournal = () => {
    if (!result?.journalNumber) return;
    navigate(`/journals?search=${encodeURIComponent(result.journalNumber)}`);
  };

  const canPreview = !!periodId && !!file && !fileError && !previewing;
  const canPost = !!preview && preview.isBalanced && preview.errorLines === 0 && !posting;

  return (
    <AppLayout breadcrumb="Opening Balance Import">
      <h1 className="text-2xl font-bold text-navy">Opening Balance Import</h1>
      <p className="mt-1 text-sm text-slate">
        Import opening account balances from your previous ERP system
      </p>

      <div className="mt-4 rounded-md border border-blue-light bg-blue-light/40 px-4 py-3 text-sm text-navy">
        Upload your account balances as of the migration date. The system automatically classifies
        Debits and Credits based on account type. Preview before posting — no changes are made until
        you confirm.
      </div>

      {loadingLookups && (
        <div className="mt-6">
          <CardSkeleton count={1} />
        </div>
      )}

      {!loadingLookups && lookupError && (
        <Card className="mt-6">
          <ErrorState
            message="Failed to load import configuration. Please try again."
            onRetry={loadLookups}
          />
        </Card>
      )}

      {!loadingLookups && !lookupError && !ledger && (
        <Card className="mt-6">
          <EmptyState
            title="No ledger configured"
            message="Set up a ledger for this legal entity before importing opening balances."
          />
        </Card>
      )}

      {!loadingLookups && !lookupError && ledger && (
        <>
          <Card className="mt-6">
            <h2 className="text-lg font-semibold text-navy">Import Configuration</h2>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="w-64">
                <Select
                  id="ob-period"
                  label="Period"
                  required
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                >
                  <option value="">Select period...</option>
                  {openPeriods.map((p) => (
                    <option key={p.accountingPeriodId} value={p.accountingPeriodId}>
                      {p.periodName} (Open)
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" onClick={handleDownloadTemplate} loading={downloading}>
                ⬇ Download Template
              </Button>
            </div>
            {openPeriods.length === 0 && (
              <p className="mt-3 text-xs text-amber">
                No open periods found. Open a period in Period Management before importing.
              </p>
            )}
          </Card>

          {!result && (
            <Card className="mt-6">
              <h2 className="text-lg font-semibold text-navy">Upload Balance File</h2>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  dragActive ? 'border-blue bg-blue-light/30' : 'border-border bg-offwhite'
                }`}
              >
                <span className="text-3xl" aria-hidden="true">
                  📄
                </span>
                {file ? (
                  <p className="text-sm font-medium text-navy">
                    {file.name} ({formatBytes(file.size)})
                  </p>
                ) : (
                  <p className="text-sm font-medium text-navy">
                    Drop your Excel file here or click to browse
                  </p>
                )}
                <p className="text-xs text-slate">Supported: .xlsx only · Max: 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {fileError && <p className="mt-2 text-xs text-amber">⚠️ {fileError}</p>}
              {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}

              {!preview && (
                <div className="mt-4 flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleChangeFile}
                    disabled={previewing || !file}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handlePreview} disabled={!canPreview} loading={previewing}>
                    Preview Balances →
                  </Button>
                </div>
              )}
            </Card>
          )}

          {!result && preview && (
            <Card className="mt-6">
              <h2 className="text-lg font-semibold text-navy">
                Preview — {preview.totalLines} accounts
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate">Total Debit</dt>
                  <dd className="font-mono text-navy">₹{formatINR(preview.totalDr)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate">Total Credit</dt>
                  <dd className="font-mono text-navy">₹{formatINR(preview.totalCr)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate">Status</dt>
                  <dd className={preview.isBalanced ? 'text-green' : 'text-amber'}>
                    {preview.isBalanced ? '✅ Balanced' : '⚠️ Not Balanced'}
                  </dd>
                </div>
              </dl>

              {!preview.isBalanced && (
                <div className="mt-4 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-navy">
                  <p className="font-medium text-amber">
                    ⚠️ Imbalance of ₹{formatINR(preview.imbalanceAmount)} detected
                  </p>
                  <p className="mt-1 text-xs text-slate">
                    Total DR: ₹{formatINR(preview.totalDr)} &nbsp;|&nbsp; Total CR: ₹
                    {formatINR(preview.totalCr)}
                  </p>
                  <p className="mt-1 text-xs text-slate">Fix the imbalance before posting.</p>
                </div>
              )}

              {preview.errorLines > 0 && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {preview.errorLines} line(s) have errors and must be fixed before posting.
                </div>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                      <th className="py-2 pr-2 font-medium">Line#</th>
                      <th className="py-2 pr-2 font-medium">Account Code</th>
                      <th className="py-2 pr-2 font-medium">Account Name</th>
                      <th className="py-2 pr-2 font-medium">Qualifier</th>
                      <th className="py-2 pr-2 font-medium">Balance (INR)</th>
                      <th className="py-2 pr-2 font-medium">DR/CR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line) => (
                      <tr
                        key={line.lineNumber}
                        className={`border-b border-border last:border-0 ${
                          line.errorMessage ? 'bg-red-50' : ''
                        }`}
                      >
                        <td className="py-2 pr-2">{line.lineNumber}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{line.accountCode}</td>
                        <td className="py-2 pr-2">{line.accountName}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              QUALIFIER_BADGE[line.accountQualifier] ?? 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {line.accountQualifier}
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-mono">₹{formatINR(line.balance)}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              line.normalBalance === 'DR'
                                ? 'bg-navy text-white'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {line.normalBalance}
                          </span>
                          {line.errorMessage && (
                            <p className="mt-1 text-xs text-red-600">{line.errorMessage}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" onClick={handleChangeFile} disabled={posting}>
                  ← Change File
                </Button>
                {preview.isBalanced && preview.errorLines === 0 && (
                  <Button onClick={handlePost} disabled={!canPost} loading={posting}>
                    Post Opening Balances →
                  </Button>
                )}
              </div>
            </Card>
          )}

          {result && (
            <Card className="mt-6">
              {result.success ? (
                <>
                  <h2 className="text-lg font-semibold text-green">
                    ✅ Opening Balances Posted Successfully
                  </h2>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Journal Number</dt>
                      <dd className="font-mono text-navy">{result.journalNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">
                        Total Lines Posted
                      </dt>
                      <dd className="text-navy">{result.postedLines}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex gap-3">
                    <Button onClick={handleViewJournal} disabled={!result.journalNumber}>
                      View Journal →
                    </Button>
                    <Button variant="secondary" onClick={handleImportAnother}>
                      Import Another File
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-red-600">❌ Import Failed</h2>
                  <p className="mt-3 text-sm text-navy">{result.message}</p>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-red-600">
                      {result.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-5 flex gap-3">
                    <Button onClick={handleImportAnother}>Try Again</Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </AppLayout>
  );
}
