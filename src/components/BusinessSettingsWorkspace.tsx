import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  Mail,
  Settings2,
  ShieldCheck,
  Sliders,
  WalletCards,
} from 'lucide-react';
import { BusinessEntity, TenantSettings } from '../types/erp';

interface BusinessSettingsWorkspaceProps {
  business: BusinessEntity;
  onSaveSettings: (patch: Partial<BusinessEntity>) => Promise<void>;
  onJumpToModule: (moduleId: string) => void;
}

export const BusinessSettingsWorkspace: React.FC<BusinessSettingsWorkspaceProps> = ({
  business,
  onSaveSettings,
  onJumpToModule,
}) => {
  const ts: TenantSettings = business.tenantSettings || {};
  const [name, setName] = useState(business.name);
  const [country, setCountry] = useState(business.country);
  const [currency, setCurrency] = useState(business.currency);
  const [taxPin, setTaxPin] = useState(business.taxPin);
  const [vatRate, setVatRate] = useState(String(business.vatRate));
  const [etimsEnabled, setEtimsEnabled] = useState(business.etimsEnabled);
  const [etimsMode, setEtimsMode] = useState(business.etimsMode);

  const [invoicePrefix, setInvoicePrefix] = useState(ts.invoicePrefix || 'INV-');
  const [quotePrefix, setQuotePrefix] = useState(ts.quotePrefix || 'QT-');
  const [receiptPrefix, setReceiptPrefix] = useState(ts.receiptPrefix || 'RCPT-');
  const [loyaltyPts, setLoyaltyPts] = useState(String(ts.loyaltyPointsPerKes ?? 0.01));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(ts.lowStockThreshold ?? 12)
  );
  const [autoEmailReceipts, setAutoEmailReceipts] = useState(
    Boolean(ts.autoEmailReceipt)
  );
  const [smsOrderNotifications, setSmsOrderNotifications] = useState(
    Boolean(ts.smsOrderAlerts)
  );
  const [allowNegativeStock, setAllowNegativeStock] = useState(
    Boolean(ts.allowNegativeStock)
  );
  const [brandColor, setBrandColor] = useState(ts.primaryColor || '#0F766E');

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    const cur = business.tenantSettings || {};
    setName(business.name);
    setCountry(business.country);
    setCurrency(business.currency);
    setTaxPin(business.taxPin);
    setVatRate(String(business.vatRate));
    setEtimsEnabled(business.etimsEnabled);
    setEtimsMode(business.etimsMode);
    setInvoicePrefix(cur.invoicePrefix || 'INV-');
    setQuotePrefix(cur.quotePrefix || 'QT-');
    setReceiptPrefix(cur.receiptPrefix || 'RCPT-');
    setLoyaltyPts(String(cur.loyaltyPointsPerKes ?? 0.01));
    setLowStockThreshold(String(cur.lowStockThreshold ?? 12));
    setAutoEmailReceipts(Boolean(cur.autoEmailReceipt));
    setSmsOrderNotifications(Boolean(cur.smsOrderAlerts));
    setAllowNegativeStock(Boolean(cur.allowNegativeStock));
    setBrandColor(cur.primaryColor || '#0F766E');
  }, [business]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        name: name.trim() || business.name,
        country,
        currency,
        taxPin: taxPin.trim() || business.taxPin,
        vatRate: Math.max(0, Math.min(50, Number(vatRate) || 0)),
        etimsEnabled,
        etimsMode,
        tenantSettings: {
          invoicePrefix: invoicePrefix.trim() || 'INV-',
          quotePrefix: quotePrefix.trim() || 'QT-',
          receiptPrefix: receiptPrefix.trim() || 'RCPT-',
          loyaltyPointsPerKes: Math.max(0, Number(loyaltyPts) || 0),
          lowStockThreshold: Math.max(1, Number(lowStockThreshold) || 10),
          autoEmailReceipt: autoEmailReceipts,
          smsOrderAlerts: smsOrderNotifications,
          allowNegativeStock,
          primaryColor: brandColor,
        },
      });
      setSavedMsg('All enterprise tax, document numbering, stock & notification settings saved.');
      setTimeout(() => setSavedMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Business Settings &amp; Enterprise Customizations
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure fiscal tax rules, document numbering prefixes, loyalty accrual, stock policies, and branding for {business.name}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => onJumpToModule('payment_gateways')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <WalletCards className="h-3.5 w-3.5 text-teal-700" />
            <span>Daraja &amp; Payment Keys</span>
          </button>
          <button
            type="button"
            onClick={() => onJumpToModule('email_marketing')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Mail className="h-3.5 w-3.5 text-teal-700" />
            <span>SMTP &amp; Africa&apos;s Talking</span>
          </button>
          <button
            type="button"
            onClick={() => onJumpToModule('ecommerce')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Globe className="h-3.5 w-3.5 text-teal-700" />
            <span>Storefront &amp; SEO</span>
          </button>
          <button
            type="button"
            onClick={() => onJumpToModule('pos_admin')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Sliders className="h-3.5 w-3.5 text-teal-700" />
            <span>POS Layout &amp; Hardware</span>
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Fiscal & Legal Profile */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Legal Profile, Currency &amp; Tax Authority
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Business Trading Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Country Jurisdiction
                </label>
                <select
                  value={country}
                  onChange={(e) =>
                    setCountry(e.target.value as BusinessEntity['country'])
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="KE">Kenya (KRA eTIMS)</option>
                  <option value="UG">Uganda (URA EFRIS)</option>
                  <option value="TZ">Tanzania (TRA VFD)</option>
                  <option value="GB">United Kingdom (VAT)</option>
                  <option value="US">United States (Sales Tax)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Base Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as BusinessEntity['currency'])
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="UGX">UGX — Ugandan Shilling</option>
                  <option value="TZS">TZS — Tanzanian Shilling</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Tax / KRA PIN
                </label>
                <input
                  type="text"
                  value={taxPin}
                  onChange={(e) => setTaxPin(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Standard VAT Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  eTIMS / Fiscal Gateway Mode
                </label>
                <select
                  value={etimsMode}
                  onChange={(e) =>
                    setEtimsMode(e.target.value as BusinessEntity['etimsMode'])
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="OSCU">OSCU (Online Cloud API)</option>
                  <option value="VSCU">VSCU (Virtual Sales Control Unit)</option>
                  <option value="Standard">Standard Fiscal Ledger</option>
                </select>
              </div>

              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={etimsEnabled}
                    onChange={(e) => setEtimsEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Sign Receipts with KRA eTIMS CUIN</span>
                </label>
              </div>
            </div>
          </section>

          {/* Document Numbering, Loyalty & Automation */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Document Prefixes, Loyalty &amp; Automation Rules
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Quote Prefix
                </label>
                <input
                  type="text"
                  value={quotePrefix}
                  onChange={(e) => setQuotePrefix(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Receipt Prefix
                </label>
                <input
                  type="text"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Loyalty Pts per {currency}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={loyaltyPts}
                  onChange={(e) => setLoyaltyPts(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Low-Stock Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Storefront Accent Color
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent"
                  />
                  <span className="font-mono text-[11px] text-slate-500">{brandColor}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoEmailReceipts}
                  onChange={(e) => setAutoEmailReceipts(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Auto-dispatch fiscal eTIMS receipt emails via configured SMTP</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={smsOrderNotifications}
                  onChange={(e) => setSmsOrderNotifications(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Send Africa&apos;s Talking SMS order alerts for online store orders</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Allow POS &amp; Invoices to sell below 0 stock (backorder mode)</span>
              </label>
            </div>
          </section>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Saving Settings...' : 'Save Enterprise Settings'}
        </button>
      </form>
    </div>
  );
};
