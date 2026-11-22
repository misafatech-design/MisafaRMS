import React, { useState } from 'react';
import { CheckCircle2, Plus, Smartphone, Trash2, WalletCards } from 'lucide-react';
import { BusinessEntity, PaymentGatewayConfig } from '../types/erp';

interface PaymentGatewaysViewProps {
  business: BusinessEntity;
  onUpdateGateways: (gateways: PaymentGatewayConfig[]) => Promise<void>;
}

export const PaymentGatewaysView: React.FC<PaymentGatewaysViewProps> = ({
  business,
  onUpdateGateways,
}) => {
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(business.paymentGateways);
  const [customName, setCustomName] = useState('');
  const [customMode, setCustomMode] = useState<PaymentGatewayConfig['mode']>('Buy Goods Till');
  const [customShortcode, setCustomShortcode] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState('');

  const handleToggle = async (id: string) => {
    const next = gateways.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g));
    setGateways(next);
    setSaving(true);
    try {
      await onUpdateGateways(next);
      setSavedBanner('Gateway availability synced to POS terminals.');
      setTimeout(() => setSavedBanner(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (
    id: string,
    field: keyof PaymentGatewayConfig,
    value: string | boolean
  ) => {
    setGateways((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onUpdateGateways(gateways);
      setSavedBanner('All M-Pesa Daraja, Airtel Money, Paybill & Till settings saved.');
      setTimeout(() => setSavedBanner(''), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customShortcode.trim()) return;
    const newGw: PaymentGatewayConfig = {
      id: `gw-custom-${Date.now().toString(36)}`,
      provider: 'custom',
      displayName: customName.trim(),
      enabled: true,
      mode: customMode,
      shortcodeOrTill: customShortcode.trim(),
      accountPrefix: customPrefix.trim() || 'POS',
      environment: 'Production',
      stkPushSupported: customMode === 'Paybill' || customMode === 'Buy Goods Till',
    };
    const next = [...gateways, newGw];
    setGateways(next);
    setCustomName('');
    setCustomShortcode('');
    setCustomPrefix('');
    await onUpdateGateways(next);
    setSavedBanner(`Added "${newGw.displayName}" to active POS tender methods.`);
    setTimeout(() => setSavedBanner(''), 3500);
  };

  const handleDeleteCustom = async (id: string) => {
    const next = gateways.filter((g) => g.id !== id);
    setGateways(next);
    await onUpdateGateways(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Payment Gateways & Custom POS Tender Methods
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure Safaricom M-Pesa Daraja, Airtel Money Kenya, Paybill/Buy Goods Tills, T-Kash, Pesapal, and custom checkout tenders.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
        >
          {saving ? 'Saving...' : 'Save Gateway Configurations'}
        </button>
      </div>

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Existing Configured Gateways */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {gateways.map((gw) => (
          <div
            key={gw.id}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  {gw.stkPushSupported ? (
                    <Smartphone className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  ) : (
                    <WalletCards className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  )}
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    {gw.displayName}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {gw.mode} · {gw.environment}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gw.provider === 'custom' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustom(gw.id)}
                    aria-label="Remove custom gateway"
                    className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleToggle(gw.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    gw.enabled
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {gw.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Settlement Mode
                </label>
                <select
                  value={gw.mode}
                  onChange={(e) =>
                    handleFieldChange(gw.id, 'mode', e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="Paybill">Paybill</option>
                  <option value="Buy Goods Till">Buy Goods Till</option>
                  <option value="Card Terminal">Card Terminal</option>
                  <option value="Cash Drawer">Cash Drawer</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Shortcode / Till / ID
                </label>
                <input
                  type="text"
                  value={gw.shortcodeOrTill}
                  onChange={(e) =>
                    handleFieldChange(gw.id, 'shortcodeOrTill', e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Account Prefix / Env
                </label>
                <input
                  type="text"
                  value={gw.accountPrefix}
                  onChange={(e) =>
                    handleFieldChange(gw.id, 'accountPrefix', e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Payment Gateway / Till */}
      <form
        onSubmit={handleAddCustom}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Add Custom Payment Method / Mobile Money Till
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            required
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name (e.g. Co-op MCo-opCash Till)"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <select
            value={customMode}
            onChange={(e) => setCustomMode(e.target.value as PaymentGatewayConfig['mode'])}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="Buy Goods Till">Buy Goods Till</option>
            <option value="Paybill">Paybill</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Custom">Custom Voucher / Credit</option>
          </select>
          <input
            type="text"
            required
            value={customShortcode}
            onChange={(e) => setCustomShortcode(e.target.value)}
            placeholder="Till / Paybill Number"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add to POS</span>
          </button>
        </div>
      </form>
    </div>
  );
};
