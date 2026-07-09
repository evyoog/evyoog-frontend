import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useAuth } from '../context/AuthContext';
import { createJournal } from '../api/gl';
import { formatINR } from '../utils/format';

interface DraftLine {
  key: string;
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

function newLine(): DraftLine {
  return { key: crypto.randomUUID(), accountCode: '', description: '', debit: '', credit: '' };
}

export default function JournalEntryPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [accountingDate, setAccountingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([newLine(), newLine()]);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const removeLine = (key: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handleSave = async (submitForApproval: boolean) => {
    if (!user) return;
    setError('');
    setSuccess('');
    setSaving(submitForApproval ? 'submit' : 'draft');
    try {
      const journal = await createJournal({
        legalEntityId: user.legalEntityId,
        description,
        accountingDate,
        source: 'MANUAL',
        submitForApproval,
        lines: lines.map((l, idx) => ({
          lineNumber: idx + 1,
          accountCombination: { account: l.accountCode },
          description: l.description,
          debitAmount: l.debit ? parseFloat(l.debit) : null,
          creditAmount: l.credit ? parseFloat(l.credit) : null,
        })),
      });
      setSuccess(`Journal ${journal.journalNumber} saved successfully.`);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch {
      setError('Failed to save journal. Please check the entries and try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppLayout breadcrumb="Journal Entry">
      <h1 className="text-2xl font-bold text-navy">New Journal Entry</h1>
      <p className="mt-1 text-sm text-slate">Create a manual journal for the current period</p>

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              id="description"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Input
            id="accountingDate"
            label="Accounting Date"
            type="date"
            value={accountingDate}
            onChange={(e) => setAccountingDate(e.target.value)}
          />
          <Select id="source" label="Journal Source" defaultValue="MANUAL" disabled>
            <option value="MANUAL">MANUAL</option>
          </Select>
        </div>

        <h2 className="mt-6 mb-3 text-sm font-semibold uppercase tracking-wide text-slate">
          Journal Lines
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-slate">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Account Code</th>
              <th className="py-2 pr-2 font-medium">Description</th>
              <th className="py-2 pr-2 text-right font-medium">Debit</th>
              <th className="py-2 pr-2 text-right font-medium">Credit</th>
              <th className="py-2 pr-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} className="border-b border-border last:border-0">
                <td className="py-2 pr-2 font-mono text-slate">{idx + 1}</td>
                <td className="py-2 pr-2">
                  <Input
                    value={line.accountCode}
                    onChange={(e) => updateLine(line.key, { accountCode: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    className="text-right font-mono"
                    value={line.debit}
                    onChange={(e) => updateLine(line.key, { debit: e.target.value, credit: '' })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    className="text-right font-mono"
                    value={line.credit}
                    onChange={(e) => updateLine(line.key, { credit: e.target.value, debit: '' })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 2}
                    className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate/40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Button variant="ghost" className="mt-3" onClick={addLine}>
          + Add Line
        </Button>

        <div className="mt-6 flex items-center justify-between rounded-md bg-offwhite p-4">
          <div className="flex gap-8 font-mono text-sm">
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

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-green">{success}</p>}

        <div className="mt-6 flex gap-3">
          {hasPermission('gl:journal:create') && (
            <Button
              variant="secondary"
              loading={saving === 'draft'}
              disabled={saving !== null}
              onClick={() => handleSave(false)}
            >
              Save as Draft
            </Button>
          )}
          {hasPermission('gl:journal:submit') && (
            <Button
              loading={saving === 'submit'}
              disabled={!isBalanced || saving !== null}
              onClick={() => handleSave(true)}
            >
              Submit for Approval
            </Button>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
