import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  MonitorSmartphone,
  Settings2,
} from 'lucide-react';
import {
  BusinessEntity,
  PosCustomizationConfig,
  SaleTransaction,
  StoreBranch,
} from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface PosAdminConsoleProps {
  business: BusinessEntity;
  stores: StoreBranch[];
  activeStore: StoreBranch;
  transactions: SaleTransaction[];
  onUpdatePosConfig: (config: PosCustomizationConfig) => Promise<void>;
  onLaunchPosRegister: () => void;
}

export const PosAdminConsole: React.FC<PosAdminConsoleProps> = ({
  business,
  stores,
  activeStore,
  transactions,
  onUpdatePosConfig,
  onLaunchPosRegister,
}) => {
  const [draftConfig, setDraftConfig] = useState<PosCustomizationConfig>(business.posConfig);
  const [quickNotesInput, setQuickNotesInput] = useState(
    business.posConfig.quickCashNotes.join(', ')
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [reportStoreId, setReportStoreId] = useState<string>(activeStore.id);

  const reportStore = useMemo(
    () => stores.find((s) => s.id === reportStoreId) || activeStore,
    [stores, reportStoreId, activeStore]
  );

  const shiftSummary = useMemo(() => {
    const branchTxs = transactions.filter(
      (t) => t.storeId === reportStore.id && t.etimsStatus !== 'Credit Note'
    );
    let totalGross = 0;
    let totalVat = 0;
    const byGateway: Record<string, number> = {};
    for (const tx of branchTxs) {
      totalGross += tx.total;
      totalVat += tx.taxAmount;
      byGateway[tx.paymentMethod] = (byGateway[tx.paymentMethod] || 0) + tx.total;
    }
    return {
      count: branchTxs.length,
      totalGross,
      totalVat,
      byGateway,
    };
  }, [transactions, reportStore.id]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      const parsedNotes = quickNotesInput
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      await onUpdatePosConfig({
        ...draftConfig,
        quickCashNotes: parsedNotes.length > 0 ? parsedNotes : [500, 1000, 2000, 5000],
      });
      setSavedMsg('POS configuration saved and synced to all branch registers.');
      setTimeout(() => setSavedMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const posOnlyPath = `/pos?biz=${encodeURIComponent(business.slug)}&store=${encodeURIComponent(reportStore.id)}`;

  const handleDownloadPosShortcut = (type: 'launcher' | 'cheatsheet') => {
    const portalUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${posOnlyPath}`
        : `https://${business.slug}.misafarms.com${posOnlyPath}`;

    if (type === 'launcher') {
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${business.name} — POS Register (${reportStore.code})</title>
  <meta name="theme-color" content="#0f766e">
</head>
<body style="font-family:sans-serif;text-align:center;padding:48px;background:#f8fafc;color:#0f172a;">
  <h2>${business.name} · ${reportStore.name}</h2>
  <p>Opening dedicated POS-only register (${reportStore.registerId})...</p>
  <p><a href="${portalUrl}">${portalUrl}</a></p>
  <script>window.location.replace(${JSON.stringify(portalUrl)});</script>
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-${reportStore.code.toLowerCase()}-pos-shortcut.html`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const enabledGateways = business.paymentGateways
        .filter((g) => g.enabled)
        .map((g) => `${g.displayName} (${g.shortcodeOrTill})`)
        .join(', ');
      const txt = `MisafaRMS POS COUNTER SHORTCUTS & CONFIG
Business: ${business.name} (${business.slug}.misafarms.com)
Branch: ${reportStore.name} (${reportStore.code}) | Register: ${reportStore.registerId}
KRA eTIMS Serial: ${reportStore.vscuSerial} | PIN: ${business.taxPin}

CASHIER WORKFLOW
- Login with 4-digit Employee PIN at counter terminal
- Scan barcode + Enter to add SKU immediately
- Hold Order to park basket for next customer
- Lock terminal when ending shift so next employee signs in with PIN
- Enabled Payment Gateways: ${enabledGateways}
`;
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-pos-shortcuts.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            POS Setup, Counter Shortcuts & X/Z Shift Reports
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Admin-only configuration for {business.name}. Cashiers only see the clean PIN-locked register screen.
          </p>
        </div>

        <button
          type="button"
          onClick={onLaunchPosRegister}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
        >
          <MonitorSmartphone className="h-4 w-4" />
          <span>Launch Counter POS</span>
        </button>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: POS Customization & Shortcut Export */}
        <form
          onSubmit={handleSaveConfig}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <Settings2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Receipt Template, Counter Layout & Terminal Shortcuts
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Receipt Header Text
              </label>
              <input
                type="text"
                value={draftConfig.receiptHeader}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, receiptHeader: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Receipt Footer Message
              </label>
              <input
                type="text"
                value={draftConfig.receiptFooter}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, receiptFooter: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Receipt Paper Width
                </label>
                <select
                  value={draftConfig.paperWidth}
                  onChange={(e) =>
                    setDraftConfig((c) => ({
                      ...c,
                      paperWidth: e.target.value as '80mm' | 'A4',
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="80mm">80mm Thermal Roll</option>
                  <option value="A4">A4 Tax Invoice</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Catalog Grid Density
                </label>
                <select
                  value={draftConfig.gridDensity}
                  onChange={(e) =>
                    setDraftConfig((c) => ({
                      ...c,
                      gridDensity: e.target.value as 'comfortable' | 'compact',
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="comfortable">Comfortable (With Photos)</option>
                  <option value="compact">Compact (High-Speed Counter)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Quick Cash Denominations
                </label>
                <input
                  type="text"
                  value={quickNotesInput}
                  onChange={(e) => setQuickNotesInput(e.target.value)}
                  placeholder="500, 1000, 2000, 5000"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draftConfig.barcodeAutoFocus}
                  onChange={(e) =>
                    setDraftConfig((c) => ({ ...c, barcodeAutoFocus: e.target.checked }))
                  }
                />
                <span>Auto-Focus Barcode Scanner</span>
              </label>

              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draftConfig.requirePinPerShift}
                  onChange={(e) =>
                    setDraftConfig((c) => ({ ...c, requirePinPerShift: e.target.checked }))
                  }
                />
                <span>Require Employee 4-Digit PIN on Open</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={posOnlyPath}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
              >
                <MonitorSmartphone className="h-3.5 w-3.5" />
                <span>Open Installable POS (/pos)</span>
              </a>
              <button
                type="button"
                onClick={() => handleDownloadPosShortcut('launcher')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                <span>Download POS Shortcut (.html)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPosShortcut('cheatsheet')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Key Guide (.txt)</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
            >
              {saving ? 'Saving...' : 'Save POS Setup'}
            </button>
          </div>
        </form>

        {/* Right: X / Z Shift Reconciliation Report (Admin Back Office Only) */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                X / Z Shift Reconciliation
              </h2>
            </div>

            <select
              aria-label="Filter report by branch"
              value={reportStore.id}
              onChange={(e) => setReportStoreId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Shift Receipts</span>
              <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {shiftSummary.count}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Gross Revenue</span>
              <p className="font-mono text-xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
                {formatMoney(shiftSummary.totalGross, business.currency)}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {Object.keys(shiftSummary.byGateway).length === 0 ? (
              <p className="py-4 text-center text-slate-500 dark:text-slate-400">
                No transactions posted for {reportStore.name} yet.
              </p>
            ) : (
              Object.entries(shiftSummary.byGateway).map(([method, amt]) => (
                <div key={method} className="flex justify-between py-2.5">
                  <span className="text-slate-600 dark:text-slate-400">{method}</span>
                  <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(amt, business.currency)}
                  </span>
                </div>
              ))
            )}
            <div className="flex justify-between py-2.5 font-semibold text-slate-900 dark:text-slate-100">
              <span>KRA eTIMS Output VAT ({business.vatRate}%)</span>
              <span className="font-mono tabular-nums">
                {formatMoney(shiftSummary.totalVat, business.currency)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
