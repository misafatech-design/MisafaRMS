import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  Lock,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { BackupSnapshot, BusinessEntity } from '../types/erp';
import { encryptOfflinePayload } from '../utils/cryptoSync';

interface BackupRestoreWorkspaceProps {
  business: BusinessEntity;
  backups: BackupSnapshot[];
  onCreateBackup: (label: string, scope: 'business' | 'platform') => Promise<BackupSnapshot | null>;
  onRestoreBackup: (backupId: string) => Promise<void>;
  onImportBackup: (payload: Record<string, unknown>) => Promise<void>;
}

export const BackupRestoreWorkspace: React.FC<BackupRestoreWorkspaceProps> = ({
  business,
  backups,
  onCreateBackup,
  onRestoreBackup,
  onImportBackup,
}) => {
  const [label, setLabel] = useState(
    `${business.name} Backup · ${new Date().toISOString().slice(0, 10)}`
  );
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const bizBackups = useMemo(
    () => backups.filter((b) => !b.businessId || b.businessId === business.id),
    [backups, business.id]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg('');
    try {
      const snap = await onCreateBackup(label.trim() || 'Manual Snapshot', 'business');
      if (snap) {
        setFeedback(`Created snapshot "${snap.label}" (${Math.max(1, Math.round(snap.sizeBytes / 1024))} KB).`);
        setTimeout(() => setFeedback(''), 4000);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Backup creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadJson = (snap: BackupSnapshot) => {
    const blob = new Blob([JSON.stringify(snap.payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `misafarms-${business.slug}-${snap.createdAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadEncrypted = async (snap: BackupSnapshot) => {
    const cipher = await encryptOfflinePayload(snap.payload);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'MisafaRMS-AES-GCM-256-Backup',
            businessId: business.id,
            businessSlug: business.slug,
            createdAt: snap.createdAt,
            ciphertext: cipher,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `misafarms-${business.slug}-${snap.createdAt.slice(0, 10)}.enc.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (snap: BackupSnapshot) => {
    setRestoringId(snap.id);
    setErrorMsg('');
    try {
      await onRestoreBackup(snap.id);
      setFeedback(`Restored workspace from snapshot "${snap.label}".`);
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      await onImportBackup(parsed);
      setFeedback(`Imported & restored backup archive "${file.name}".`);
      setTimeout(() => setFeedback(''), 4500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid backup JSON file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Backups, Cloud Snapshots &amp; Point-in-Time Restore
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create full snapshots of branches, staff, SKUs, sales, invoices, online orders &amp; ledger for {business.name}.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Upload className="h-3.5 w-3.5" />
          <span>Import JSON Backup</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Snapshot label (e.g. End-of-Month Audit Close)"
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
        >
          <DatabaseBackup className="h-3.5 w-3.5" />
          <span>{creating ? 'Creating Snapshot...' : 'Create Backup Snapshot'}</span>
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Snapshot History ({bizBackups.length})
          </h2>
        </div>

        {bizBackups.length === 0 ? (
          <div className="p-10 text-center">
            <DatabaseBackup className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              No backup snapshots saved yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Click "Create Backup Snapshot" above to archive your complete business database.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {bizBackups.map((snap) => (
              <div
                key={snap.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {snap.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(snap.createdAt).toLocaleString()} ·{' '}
                    {Math.max(1, Math.round(snap.sizeBytes / 1024))} KB · By {snap.createdBy}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-teal-700 dark:text-teal-400">
                    {snap.counts.stores} branches · {snap.counts.employees} staff ·{' '}
                    {snap.counts.products} SKUs · {snap.counts.transactions} receipts ·{' '}
                    {snap.counts.invoices} invoices · {snap.counts.onlineOrders} web orders
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadJson(snap)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadEncrypted(snap)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Lock className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Encrypted</span>
                  </button>
                  <button
                    type="button"
                    disabled={restoringId === snap.id}
                    onClick={() => handleRestore(snap)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{restoringId === snap.id ? 'Restoring...' : 'Restore'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
