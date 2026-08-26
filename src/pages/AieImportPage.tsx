import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { listLedgers, getPeriodStatus, downloadAieTemplate, importAieExcel } from '../api/gl';
import type { AieImportResponse, Ledger, PeriodStatus } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SOURCE_SYSTEMS = [
  { code: 'EXCEL_UPLOAD', label: 'Generic Excel upload' },
  { code: 'TALLY', label: 'Tally ERP export' },
  { code: 'SAP', label: 'SAP export' },
  { code: 'CUSTOM', label: 'Custom source' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AieImportPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [openPeriods, setOpenPeriods] = useState<PeriodStatus[]>([]);

  const [periodId, setPeriodId] = useState('');
  const [sourceSystem, setSourceSystem] = useState('EXCEL_UPLOAD');
  const [downloading, setDownloading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AieImportResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    if (!user) return;
    setLoadingLookups(true);
    setLookupError(false);
    try {
      const [ledgers, periods] = await Promise.all([
        listLedgers(user.legalEntityId),
        getPeriodStatus(user.legalEntityId),
      ]);
      setLedger(ledgers[0] ?? null);
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
      const blob = await downloadAieTemplate(ledger.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'eVyoog_Journal_Import_Template.xlsx';
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

  const handleUpload = async () => {
    if (!user || !ledger || !periodId || !file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const response = await importAieExcel(file, {
        legalEntityId: user.legalEntityId,
        ledgerId: ledger.id,
        accountingPeriodId: periodId,
        createdBy: user.email,
        sourceSystem,
      });
      setResult(response);
    } catch {
      setUploadError('Failed to upload the file. Please check your connection and try again.');
      showToast('Import failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleImportAnother = () => {
    setResult(null);
    setUploadError(null);
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadErrorReport = () => {
    if (!result) return;
    const csv = [
      'Line Number,Error Code,Error Message,Field',
      ...result.errors.map(
        (e) => `${e.lineNumber},${e.errorCode},"${e.errorMessage}",${e.fieldName ?? ''}`,
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewJournal = () => {
    if (!result?.journalNumber) return;
    navigate(`/journals?search=${encodeURIComponent(result.journalNumber)}`);
  };

  const canUpload = !!periodId && !!file && !fileError && !uploading;

  return (
    <AppLayout breadcrumb="Journal Import">
      <h1 className="text-2xl font-bold text-navy">Journal Import</h1>
      <p className="mt-1 text-sm text-slate">Import journal entries from Excel using the AIE pipeline</p>

      <div className="mt-4 rounded-md border border-blue-light bg-blue-light/40 px-4 py-3 text-sm text-navy">
        Download the Excel template, fill in your journal entries, then upload to import. The system
        validates each line and reports errors before posting.
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
            message="Set up a ledger for this legal entity before importing journals."
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
                  id="aie-period"
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
              <div className="w-56">
                <Select
                  id="aie-source"
                  label="Source"
                  value={sourceSystem}
                  onChange={(e) => setSourceSystem(e.target.value)}
                >
                  {SOURCE_SYSTEMS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code}
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
              <h2 className="text-lg font-semibold text-navy">Upload Excel File</h2>
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
                <p className="text-xs text-slate">Supported: .xlsx files only · Max size: 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {fileError && <p className="mt-2 text-xs text-amber">⚠️ {fileError}</p>}
              {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}

              <div className="mt-4 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFile(null);
                    setFileError(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={!canUpload} loading={uploading}>
                  Upload &amp; Import →
                </Button>
              </div>
            </Card>
          )}

          {result && (
            <Card className="mt-6">
              {result.status === 'POSTED' && result.errorLines === 0 && (
                <>
                  <h2 className="text-lg font-semibold text-green">✅ Import Successful</h2>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Journal Number</dt>
                      <dd className="font-mono text-navy">{result.journalNumber ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Total Lines</dt>
                      <dd className="text-navy">{result.totalLines}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Posted Lines</dt>
                      <dd className="text-navy">{result.validLines}</dd>
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
              )}

              {result.status !== 'FAILED' && result.errorLines > 0 && (
                <>
                  <h2 className="text-lg font-semibold text-amber">⚠️ Import Completed with Errors</h2>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Total Lines</dt>
                      <dd className="text-navy">{result.totalLines}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Posted Lines</dt>
                      <dd className="text-navy">{result.validLines}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate">Error Lines</dt>
                      <dd className="text-red-600">{result.errorLines}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
                          <th className="py-2 pr-2 font-medium">Line #</th>
                          <th className="py-2 pr-2 font-medium">Error Code</th>
                          <th className="py-2 pr-2 font-medium">Error Message</th>
                          <th className="py-2 pr-2 font-medium">Field</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((err, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-2 pr-2">{err.lineNumber}</td>
                            <td className="py-2 pr-2 font-mono text-xs">{err.errorCode}</td>
                            <td className="py-2 pr-2">{err.errorMessage}</td>
                            <td className="py-2 pr-2">{err.fieldName ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5 flex gap-3">
                    <Button variant="secondary" onClick={handleDownloadErrorReport}>
                      Download Error Report
                    </Button>
                    <Button variant="secondary" onClick={handleImportAnother}>
                      Import Another File
                    </Button>
                  </div>
                </>
              )}

              {result.status === 'FAILED' && (
                <>
                  <h2 className="text-lg font-semibold text-red-600">❌ Import Failed</h2>
                  <p className="mt-3 text-sm text-navy">{result.message}</p>
                  <div className="mt-5 flex gap-3">
                    <Button onClick={handleImportAnother}>Try Again</Button>
                    <Button variant="secondary" onClick={handleImportAnother}>
                      Import Another File
                    </Button>
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
