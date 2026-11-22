import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBusiness: (payload: {
    name: string;
    country: 'KE' | 'UG' | 'TZ' | 'GB' | 'US';
    currency: 'KES' | 'UGX' | 'TZS' | 'GBP' | 'USD';
    taxPin: string;
    vatRate: number;
    etimsEnabled: boolean;
    etimsMode: 'OSCU' | 'VSCU' | 'Standard';
    paybillOrTill: string;
    branchName: string;
    branchLocation: string;
    ownerName: string;
    ownerEmail: string;
  }) => Promise<void>;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onCreateBusiness,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [country, setCountry] = useState<'KE' | 'UG' | 'TZ' | 'GB' | 'US'>('KE');
  const [currency, setCurrency] = useState<'KES' | 'UGX' | 'TZS' | 'GBP' | 'USD'>('KES');
  const [taxPin, setTaxPin] = useState('P051882410X');
  const [vatRate, setVatRate] = useState(16);
  const [etimsEnabled, setEtimsEnabled] = useState(true);
  const [etimsMode, setEtimsMode] = useState<'OSCU' | 'VSCU' | 'Standard'>('OSCU');
  const [branchName, setBranchName] = useState('Flagship Branch');
  const [branchLocation, setBranchLocation] = useState('Kilimani, Nairobi');
  const [paybillOrTill, setPaybillOrTill] = useState('Till 774102');
  const [ownerName, setOwnerName] = useState('Joseph Mwangi');
  const [ownerEmail, setOwnerEmail] = useState('owner@enterprise.co.ke');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCountryChange = (c: 'KE' | 'UG' | 'TZ' | 'GB' | 'US') => {
    setCountry(c);
    if (c === 'KE') {
      setCurrency('KES');
      setVatRate(16);
      setEtimsEnabled(true);
      setEtimsMode('OSCU');
    } else if (c === 'UG') {
      setCurrency('UGX');
      setVatRate(18);
      setEtimsEnabled(false);
      setEtimsMode('Standard');
    } else if (c === 'TZ') {
      setCurrency('TZS');
      setVatRate(18);
      setEtimsEnabled(false);
      setEtimsMode('Standard');
    } else if (c === 'GB') {
      setCurrency('GBP');
      setVatRate(20);
      setEtimsEnabled(false);
      setEtimsMode('Standard');
    } else {
      setCurrency('USD');
      setVatRate(8);
      setEtimsEnabled(false);
      setEtimsMode('Standard');
    }
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreateBusiness({
        name: name.trim(),
        country,
        currency,
        taxPin: taxPin.trim(),
        vatRate,
        etimsEnabled,
        etimsMode,
        paybillOrTill: paybillOrTill.trim(),
        branchName: branchName.trim() || 'Main Store',
        branchLocation: branchLocation.trim() || 'CBD',
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
      });
      setName('');
      setStep(1);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Quick Business & Store Onboarding Wizard
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Step {step} of 4 · Configure localization, KRA eTIMS, payment gateways, and RBAC.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper progress */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] font-medium">
          {[
            '1. Business & Tax',
            '2. Branch Setup',
            '3. Payments & eTIMS',
            '4. Launch Ready',
          ].map((label, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div
                key={label}
                className={`rounded-md px-2 py-1.5 text-center ${
                  active
                    ? 'bg-teal-700 text-white dark:bg-teal-600'
                    : done
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleFinish} className="mt-5 space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Registered Business Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kilimani Fresh Grocers Ltd"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Country & Tax Localization
                  </label>
                  <select
                    value={country}
                    onChange={(e) =>
                      handleCountryChange(e.target.value as 'KE' | 'UG' | 'TZ' | 'GB' | 'US')
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="KE">Kenya (KES · KRA eTIMS)</option>
                    <option value="UG">Uganda (UGX · URA EFRIS)</option>
                    <option value="TZ">Tanzania (TZS · TRA VFD)</option>
                    <option value="GB">United Kingdom (GBP · HMRC)</option>
                    <option value="US">United States (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tax PIN / VAT ID
                  </label>
                  <input
                    type="text"
                    value={taxPin}
                    onChange={(e) => setTaxPin(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  First Store / Branch Name
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Physical Location / Town
                </label>
                <input
                  type="text"
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    M-Pesa Paybill / Till / Gateway
                  </label>
                  <input
                    type="text"
                    value={paybillOrTill}
                    onChange={(e) => setPaybillOrTill(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    KRA eTIMS Integration Mode
                  </label>
                  <select
                    value={etimsMode}
                    onChange={(e) => {
                      const val = e.target.value as 'OSCU' | 'VSCU' | 'Standard';
                      setEtimsMode(val);
                      setEtimsEnabled(val !== 'Standard');
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="OSCU">OSCU (Online Cloud Integration)</option>
                    <option value="VSCU">VSCU (Virtual Local Control Unit)</option>
                    <option value="Standard">Standard VAT (Non-eTIMS)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Owner / Admin Name
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Audit & Alert Email
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span>Ready to provision workspace</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>Business: <strong>{name || 'New Enterprise'}</strong></div>
                <div>Localization: <strong>{country} · {currency} (VAT {vatRate}%)</strong></div>
                <div>Branch: <strong>{branchName}</strong></div>
                <div>Fiscal Mode: <strong>{etimsMode} ({taxPin})</strong></div>
                <div>Payment Gateway: <strong>{paybillOrTill}</strong></div>
                <div>Owner Alert Email: <strong>{ownerEmail}</strong></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3 | 4) : onClose())}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !name.trim()) {
                    setName('Nairobi Urban Retail Ltd');
                  }
                  setStep((step + 1) as 2 | 3 | 4);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
              >
                {submitting ? 'Provisioning...' : 'Launch Business Workspace'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
