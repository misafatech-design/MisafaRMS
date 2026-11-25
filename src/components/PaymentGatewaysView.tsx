import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  KeyRound,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  WalletCards,
} from 'lucide-react';
import {
  BusinessEntity,
  GatewayProviderId,
  PaymentGatewayConfig,
} from '../types/erp';

export type GatewaySecretUpdateMap = Record<
  string,
  {
    consumerKey?: string;
    consumerSecret?: string;
    passkey?: string;
    secretKey?: string;
    clearSecrets?: boolean;
  }
>;

interface PaymentGatewaysViewProps {
  business: BusinessEntity;
  onSaveGateways: (
    gateways: PaymentGatewayConfig[],
    secretUpdates: GatewaySecretUpdateMap
  ) => Promise<void>;
}

interface ProviderPreset {
  provider: GatewayProviderId;
  label: string;
  badge: string;
  mode: PaymentGatewayConfig['mode'];
  transactionType?: PaymentGatewayConfig['transactionType'];
  stkPushSupported: boolean;
  defaultPrefix: string;
  defaultShortcode: string;
  currencies: string[];
}

const KENYA_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider: 'mpesa_daraja',
    label: 'Safaricom M-Pesa Daraja (Paybill STK)',
    badge: 'STK Push · C2B',
    mode: 'Paybill',
    transactionType: 'CustomerPayBillOnline',
    stkPushSupported: true,
    defaultPrefix: 'MPESA',
    defaultShortcode: '174379',
    currencies: ['KES'],
  },
  {
    provider: 'mpesa_daraja',
    label: 'M-Pesa Buy Goods Till (Daraja)',
    badge: 'Lipa Na M-Pesa',
    mode: 'Buy Goods Till',
    transactionType: 'CustomerBuyGoodsOnline',
    stkPushSupported: true,
    defaultPrefix: 'TILL',
    defaultShortcode: '5428910',
    currencies: ['KES'],
  },
  {
    provider: 'payhero',
    label: 'PayHero Kenya',
    badge: 'M-Pesa + Bank + Channels',
    mode: 'Buy Goods Till',
    stkPushSupported: true,
    defaultPrefix: 'PYH',
    defaultShortcode: 'CHANNEL-01',
    currencies: ['KES'],
  },
  {
    provider: 'paystack',
    label: 'Paystack (Cards & M-Pesa)',
    badge: 'Visa / MC / M-Pesa',
    mode: 'Card Terminal',
    stkPushSupported: false,
    defaultPrefix: 'PSK',
    defaultShortcode: 'PSK-LIVE',
    currencies: ['KES', 'USD', 'NGN', 'GHS'],
  },
  {
    provider: 'pesapal_card',
    label: 'Pesapal v3',
    badge: 'Cards + Mobile Money',
    mode: 'Card Terminal',
    stkPushSupported: false,
    defaultPrefix: 'PPL',
    defaultShortcode: 'PESAPAL-V3',
    currencies: ['KES', 'UGX', 'TZS', 'USD'],
  },
  {
    provider: 'dpo_pay',
    label: 'DPO Pay (Direct Pay Online)',
    badge: 'Pan-African Cards & Mobile',
    mode: 'Card Terminal',
    stkPushSupported: false,
    defaultPrefix: 'DPO',
    defaultShortcode: 'DPO-SERV-01',
    currencies: ['KES', 'UGX', 'TZS', 'USD'],
  },
  {
    provider: 'instapay',
    label: 'InstaPay Kenya',
    badge: 'Instant Wallet & QR',
    mode: 'Bank Transfer',
    stkPushSupported: false,
    defaultPrefix: 'INS',
    defaultShortcode: 'INSTA-01',
    currencies: ['KES', 'USD'],
  },
  {
    provider: 'airtel_money',
    label: 'Airtel Money Kenya',
    badge: 'Mobile Money',
    mode: 'Paybill',
    stkPushSupported: true,
    defaultPrefix: 'AIR',
    defaultShortcode: 'AIRTEL-BIZ',
    currencies: ['KES', 'UGX', 'TZS'],
  },
  {
    provider: 'tkash',
    label: 'T-Kash (Telkom Kenya)',
    badge: 'Mobile Money',
    mode: 'Buy Goods Till',
    stkPushSupported: false,
    defaultPrefix: 'TKASH',
    defaultShortcode: 'TK-88210',
    currencies: ['KES'],
  },
  {
    provider: 'bank_rtgs',
    label: 'KCB / Equity Bank RTGS & PesaLink',
    badge: 'Direct Bank',
    mode: 'Bank Transfer',
    stkPushSupported: false,
    defaultPrefix: 'BANK',
    defaultShortcode: 'PESALINK-ACC',
    currencies: ['KES', 'USD'],
  },
];

export const PaymentGatewaysView: React.FC<PaymentGatewaysViewProps> = ({
  business,
  onSaveGateways,
}) => {
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(business.paymentGateways);
  const [secretDrafts, setSecretDrafts] = useState<GatewaySecretUpdateMap>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Custom gateway form
  const [customName, setCustomName] = useState('');
  const [customMode, setCustomMode] = useState<PaymentGatewayConfig['mode']>('Buy Goods Till');
  const [customShortcode, setCustomShortcode] = useState('');
  const [customPrefix, setCustomPrefix] = useState('');

  // Status & live STK test state
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState('');
  const [testPhoneByGw, setTestPhoneByGw] = useState<Record<string, string>>({});
  const [testingGwId, setTestingGwId] = useState<string | null>(null);
  const [testResultByGw, setTestResultByGw] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  useEffect(() => {
    setGateways(business.paymentGateways);
  }, [business.id, business.paymentGateways]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggle = async (id: string) => {
    const next = gateways.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g));
    setGateways(next);
    setSaving(true);
    try {
      await onSaveGateways(next, secretDrafts);
      setSecretDrafts({});
      setSavedBanner('Gateway availability synced to POS & eCommerce checkouts.');
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

  const handleSecretChange = (
    gwId: string,
    field: 'consumerKey' | 'consumerSecret' | 'passkey' | 'secretKey',
    value: string
  ) => {
    setSecretDrafts((prev) => ({
      ...prev,
      [gwId]: {
        ...(prev[gwId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await onSaveGateways(gateways, secretDrafts);
      setSecretDrafts({});
      setSavedBanner(
        'Gateway configurations & encrypted server-side API credentials saved.'
      );
      setTimeout(() => setSavedBanner(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPreset = async (preset: ProviderPreset) => {
    const newId = `gw-${preset.provider}-${Date.now().toString(36)}`;
    const newGw: PaymentGatewayConfig = {
      id: newId,
      provider: preset.provider,
      displayName: preset.label,
      enabled: true,
      mode: preset.mode,
      transactionType: preset.transactionType,
      shortcodeOrTill: preset.defaultShortcode,
      accountPrefix: preset.defaultPrefix,
      environment: 'Sandbox',
      stkPushSupported: preset.stkPushSupported,
      currencies: preset.currencies,
      callbackUrl: `https://misafarms.com/api/webhooks/payments/${business.slug}/${preset.provider}`,
    };
    const next = [...gateways, newGw];
    setGateways(next);
    setExpandedIds((prev) => ({ ...prev, [newId]: true }));
    setSaving(true);
    try {
      await onSaveGateways(next, secretDrafts);
      setSecretDrafts({});
      setSavedBanner(`Added ${preset.label}. Expand credentials below to connect live keys.`);
      setTimeout(() => setSavedBanner(''), 4000);
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
      currencies: [business.currency],
    };
    const next = [...gateways, newGw];
    setGateways(next);
    setCustomName('');
    setCustomShortcode('');
    setCustomPrefix('');
    setSaving(true);
    try {
      await onSaveGateways(next, secretDrafts);
      setSecretDrafts({});
      setSavedBanner(`Added "${newGw.displayName}" to active POS & eCommerce tenders.`);
      setTimeout(() => setSavedBanner(''), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGateway = async (id: string) => {
    const next = gateways.filter((g) => g.id !== id);
    setGateways(next);
    setSaving(true);
    try {
      await onSaveGateways(next, secretDrafts);
      setSecretDrafts({});
    } finally {
      setSaving(false);
    }
  };

  const handleTestGateway = async (gw: PaymentGatewayConfig) => {
    setTestingGwId(gw.id);
    try {
      // Save pending secrets first so test hits latest credentials
      if (secretDrafts[gw.id]) {
        await onSaveGateways(gateways, secretDrafts);
        setSecretDrafts({});
      }

      if (gw.provider === 'mpesa_daraja' || gw.stkPushSupported) {
        const phone = (testPhoneByGw[gw.id] || '254712345678').trim();
        const res = await fetch('/api/payments/daraja/stkpush', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: business.id,
            gatewayId: gw.id,
            phoneNumber: phone,
            amount: 1,
            accountReference: gw.accountPrefix || 'TEST',
            description: `${business.name} Daraja STK Test`,
          }),
        });
        const data = await res.json();
        setTestResultByGw((prev) => ({
          ...prev,
          [gw.id]: {
            ok: res.ok && Boolean(data.ok),
            message: res.ok
              ? `${data.mode === 'daraja_live' ? 'LIVE Daraja' : 'Sandbox'} · ${data.customerMessage || data.receiptCode} (${data.checkoutRequestId})`
              : data.error || 'Daraja STK test failed.',
          },
        }));
      } else {
        const res = await fetch('/api/payments/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: business.id,
            gatewayId: gw.id,
            provider: gw.provider,
            amount: 100,
            currency: business.currency,
            email: business.ownerEmail || 'checkout@misafarms.com',
            phone: testPhoneByGw[gw.id] || '254712345678',
            reference: `TEST-${Date.now().toString(36).toUpperCase()}`,
          }),
        });
        const data = await res.json();
        setTestResultByGw((prev) => ({
          ...prev,
          [gw.id]: {
            ok: res.ok && Boolean(data.ok),
            message: res.ok
              ? `${data.mode || gw.environment} · ${data.message} · Ref: ${data.reference}`
              : data.error || 'Provider initiation failed.',
          },
        }));
      }
    } catch (err) {
      setTestResultByGw((prev) => ({
        ...prev,
        [gw.id]: {
          ok: false,
          message: err instanceof Error ? err.message : 'Network error testing gateway.',
        },
      }));
    } finally {
      setTestingGwId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Payment Gateways, Daraja STK &amp; Kenyan Providers
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure Safaricom M-Pesa Daraja (Consumer Key, Secret, Passkey &amp; Shortcode), PayHero, Paystack, Pesapal, DPO Pay, InstaPay, Airtel Money, and custom POS tenders.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
        >
          {saving ? 'Saving Credentials...' : 'Save All Gateway Configurations'}
        </button>
      </div>

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Server-Side Secret Vault Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
          <span>
            All gateway environments (Sandbox / Production) and API secrets (Daraja Consumer Key, Secret, Passkey, Paystack/PayHero/DPO/Pesapal Keys) belong exclusively to <strong>{business.name}</strong> — never shared at system level — and are stored strictly in the server-side vault.
          </span>
        </div>
      </div>

      {/* 1-Click Add Kenyan & Regional Payment Providers */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quick-Add Kenyan &amp; African Payment Providers
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            1-click attach to POS &amp; Online Storefront
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {KENYA_PROVIDER_PRESETS.map((preset) => (
            <button
              key={`${preset.provider}-${preset.label}`}
              type="button"
              onClick={() => handleAddPreset(preset)}
              className="flex flex-col items-start justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition-colors hover:border-teal-600 hover:bg-teal-50/40 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-teal-500"
            >
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {preset.label}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-400">
                  {preset.badge}
                </p>
              </div>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <Plus className="h-3 w-3" />
                Add Provider
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Existing Configured Gateways */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gateways.map((gw) => {
          const isExpanded = Boolean(expandedIds[gw.id]);
          const isDaraja = gw.provider === 'mpesa_daraja';
          const isCashDrawer = gw.mode === 'Cash Drawer';
          const draft = secretDrafts[gw.id] || {};
          const testResult = testResultByGw[gw.id];

          return (
            <div
              key={gw.id}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {gw.stkPushSupported ? (
                      <Smartphone className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    ) : gw.mode === 'Card Terminal' ? (
                      <CreditCard className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                    ) : (
                      <WalletCards className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={gw.displayName}
                      onChange={(e) => handleFieldChange(gw.id, 'displayName', e.target.value)}
                      className="w-full bg-transparent font-display text-sm font-bold text-slate-900 focus:outline-none dark:text-slate-100"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {gw.provider.toUpperCase()} · {gw.mode} · {gw.environment}
                      {gw.maskedKeyPreview ? ` · Key ${gw.maskedKeyPreview}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCashDrawer && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGateway(gw.id)}
                      aria-label="Remove payment gateway"
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
                    onChange={(e) => handleFieldChange(gw.id, 'mode', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Paybill">Paybill</option>
                    <option value="Buy Goods Till">Buy Goods Till</option>
                    <option value="Card Terminal">Card Terminal / Online</option>
                    <option value="Cash Drawer">Cash Drawer</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {isDaraja ? 'Business Shortcode / Till' : 'Merchant / Till / Channel ID'}
                  </label>
                  <input
                    type="text"
                    value={gw.shortcodeOrTill}
                    onChange={(e) => handleFieldChange(gw.id, 'shortcodeOrTill', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Environment
                  </label>
                  <select
                    value={gw.environment}
                    onChange={(e) => handleFieldChange(gw.id, 'environment', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Sandbox">Sandbox (Test)</option>
                    <option value="Production">Production (Live)</option>
                  </select>
                </div>
              </div>

              {!isCashDrawer && (
                <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => toggleExpand(gw.id)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>
                        API Credentials, Webhook &amp; Live Test
                        {(gw.hasConsumerSecret || gw.hasSecretKey || gw.hasPasskey) &&
                          ' · Vault Configured ✓'}
                      </span>
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Account Prefix
                          </label>
                          <input
                            type="text"
                            value={gw.accountPrefix}
                            onChange={(e) =>
                              handleFieldChange(gw.id, 'accountPrefix', e.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>

                        {isDaraja ? (
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Daraja TransactionType
                            </label>
                            <select
                              value={gw.transactionType || 'CustomerPayBillOnline'}
                              onChange={(e) =>
                                handleFieldChange(gw.id, 'transactionType', e.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="CustomerPayBillOnline">CustomerPayBillOnline (Paybill)</option>
                              <option value="CustomerBuyGoodsOnline">CustomerBuyGoodsOnline (Till)</option>
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Public Key / Merchant ID
                            </label>
                            <input
                              type="text"
                              value={gw.publicKey || gw.merchantId || ''}
                              onChange={(e) =>
                                handleFieldChange(gw.id, 'publicKey', e.target.value)
                              }
                              placeholder="pk_live_... or Merchant ID"
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                        )}
                      </div>

                      {isDaraja ? (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <div>
                            <label className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              <span>Consumer Key</span>
                              {gw.hasConsumerKey && (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  Saved
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={draft.consumerKey || ''}
                              onChange={(e) =>
                                handleSecretChange(gw.id, 'consumerKey', e.target.value)
                              }
                              placeholder={gw.hasConsumerKey ? '•••••••• (Saved)' : 'Daraja Consumer Key'}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              <span>Consumer Secret</span>
                              {gw.hasConsumerSecret && (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  Saved
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={draft.consumerSecret || ''}
                              onChange={(e) =>
                                handleSecretChange(gw.id, 'consumerSecret', e.target.value)
                              }
                              placeholder={gw.hasConsumerSecret ? '•••••••• (Saved)' : 'Daraja Consumer Secret'}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              <span>Lipa Na M-Pesa Passkey</span>
                              {gw.hasPasskey && (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  Saved
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={draft.passkey || ''}
                              onChange={(e) =>
                                handleSecretChange(gw.id, 'passkey', e.target.value)
                              }
                              placeholder={gw.hasPasskey ? '•••••••• (Saved)' : 'Daraja Passkey'}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div>
                            <label className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              <span>API Secret / Company Token / Auth Key</span>
                              {gw.hasSecretKey && (
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                  Saved
                                </span>
                              )}
                            </label>
                            <input
                              type="password"
                              value={draft.secretKey || ''}
                              onChange={(e) =>
                                handleSecretChange(gw.id, 'secretKey', e.target.value)
                              }
                              placeholder={
                                gw.hasSecretKey ? '•••••••• (Saved on Server)' : 'sk_live_... / Basic Token'
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              Merchant / Channel ID
                            </label>
                            <input
                              type="text"
                              value={gw.merchantId || ''}
                              onChange={(e) =>
                                handleFieldChange(gw.id, 'merchantId', e.target.value)
                              }
                              placeholder="Optional channel or service ID"
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Callback / Webhook URL
                        </label>
                        <input
                          type="url"
                          value={
                            gw.callbackUrl ||
                            `https://misafarms.com/api/webhooks/payments/${business.slug}/${gw.provider}`
                          }
                          onChange={(e) =>
                            handleFieldChange(gw.id, 'callbackUrl', e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={gw.stkPushSupported}
                            onChange={(e) =>
                              handleFieldChange(gw.id, 'stkPushSupported', e.target.checked)
                            }
                            className="rounded border-slate-300 text-teal-700"
                          />
                          <span>Enable STK Push prompt on POS &amp; Web Checkout</span>
                        </label>
                      </div>

                      {/* Live STK / Provider Initiation Test */}
                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                        <input
                          type="tel"
                          value={testPhoneByGw[gw.id] ?? '254712345678'}
                          onChange={(e) =>
                            setTestPhoneByGw((prev) => ({
                              ...prev,
                              [gw.id]: e.target.value,
                            }))
                          }
                          placeholder="Test Phone (2547...)"
                          className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleTestGateway(gw)}
                          disabled={testingGwId === gw.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                        >
                          <Send className="h-3 w-3" />
                          <span>
                            {testingGwId === gw.id
                              ? 'Testing...'
                              : isDaraja || gw.stkPushSupported
                                ? 'Test STK Push (KES 1)'
                                : 'Test Gateway Handshake'}
                          </span>
                        </button>
                        {(gw.hasConsumerKey ||
                          gw.hasConsumerSecret ||
                          gw.hasPasskey ||
                          gw.hasSecretKey) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              setSaving(true);
                              try {
                                await onSaveGateways(gateways, {
                                  [gw.id]: { clearSecrets: true },
                                });
                                setSecretDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[gw.id];
                                  return next;
                                });
                                setSavedBanner(
                                  `Cleared saved API secrets for ${gw.displayName}.`
                                );
                                setTimeout(() => setSavedBanner(''), 3500);
                              } finally {
                                setSaving(false);
                              }
                            }}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          >
                            Clear Vault Secrets
                          </button>
                        )}
                      </div>

                      {testResult && (
                        <p
                          className={`rounded-lg border px-3 py-2 font-mono text-[11px] ${
                            testResult.ok
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {testResult.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
