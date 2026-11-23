import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Globe, Layers, Loader2, Search, X, AlertCircle } from 'lucide-react';
import { BusinessEntity, SubscriptionPlanId, SubscriptionPlanTier } from '../types/erp';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../data/seedData';
import { BUSINESS_INDUSTRY_TEMPLATES, getIndustryTemplateById } from '../data/businessTemplates';

interface SlugScanResult {
  slug: string;
  available: boolean;
  nameTaken?: boolean;
  reason?: string;
  fullUrl: string;
  suggestions: string[];
}

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingBusinesses?: BusinessEntity[];
  subscriptionPlans?: SubscriptionPlanTier[];
  onCreateBusiness: (payload: {
    name: string;
    slug: string;
    subscriptionPlan: SubscriptionPlanId;
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
    ownerPin?: string;
    setupMode?: 'clean' | 'starter';
    templateId?: string;
    ecommerceEnabled?: boolean;
  }) => Promise<void>;
}

const RESERVED_LOCAL = new Set([
  'pos',
  'admin',
  'superadmin',
  'super-admin',
  'api',
  'login',
  'logout',
  'signup',
  'register',
  'pricing',
  'apps',
  'etims',
  'analytics',
  'assets',
  'manifest',
  'settings',
  'billing',
  'health',
  'support',
  'docs',
]);

function slugifyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  existingBusinesses = [],
  subscriptionPlans,
  onCreateBusiness,
}) => {
  const plans = useMemo(
    () => (subscriptionPlans && subscriptionPlans.length > 0 ? subscriptionPlans : DEFAULT_SUBSCRIPTION_PLANS),
    [subscriptionPlans]
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [scanResult, setScanResult] = useState<SlugScanResult | null>(null);
  const [scanningSlug, setScanningSlug] = useState(false);

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
  const [ownerPin, setOwnerPin] = useState('1234');
  const [templateId, setTemplateId] = useState<string>('supermarket');
  const [setupMode, setSetupMode] = useState<'clean' | 'starter'>('starter');
  const [ecommerceEnabled, setEcommerceEnabled] = useState(true);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanId>('Trial');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const runSlugScan = async (candidateSlug: string, candidateName: string) => {
    const normalized = slugifyName(candidateSlug || candidateName);
    if (!normalized) {
      setScanResult(null);
      return;
    }
    setScanningSlug(true);
    try {
      const res = await fetch(
        `/api/businesses/check-slug?slug=${encodeURIComponent(normalized)}&name=${encodeURIComponent(candidateName)}`
      );
      if (res.ok) {
        const data: SlugScanResult = await res.json();
        setScanResult(data);
        return;
      }
    } catch {
      // Fallback to local scan when offline
    } finally {
      setScanningSlug(false);
    }

    const isReserved = RESERVED_LOCAL.has(normalized);
    const slugTaken = existingBusinesses.some((b) => b.slug.toLowerCase() === normalized);
    const nameTaken =
      candidateName.trim().length >= 3 &&
      existingBusinesses.some((b) => b.name.toLowerCase() === candidateName.trim().toLowerCase());
    const available = normalized.length >= 2 && !isReserved && !slugTaken;
    const suggestions = available
      ? []
      : [`${normalized}-ke`, `${normalized}-retail`, `${normalized}-mart`].filter(
          (cand) =>
            !RESERVED_LOCAL.has(cand) &&
            !existingBusinesses.some((b) => b.slug.toLowerCase() === cand)
        );
    setScanResult({
      slug: normalized,
      available,
      nameTaken,
      reason: isReserved
        ? `"${normalized}" is a reserved platform route.`
        : slugTaken
          ? `misafarms.com/${normalized} is already claimed by another business.`
          : normalized.length < 2
            ? 'Handle must be at least 2 characters.'
            : undefined,
      fullUrl: `https://misafarms.com/${normalized}`,
      suggestions,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const activeSlug = slug || slugifyName(name);
    if (!activeSlug) {
      setScanResult(null);
      return;
    }
    const timer = setTimeout(() => {
      runSlugScan(activeSlug, name);
    }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, name, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugifyName(val));
    }
  };

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48));
  };

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

  const effectiveSlug = slugifyName(slug || name);
  const slugBlocked = Boolean(scanResult && !scanResult.available) || effectiveSlug.length < 2;

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || slugBlocked) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onCreateBusiness({
        name: name.trim(),
        slug: effectiveSlug,
        subscriptionPlan,
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
        ownerPin: ownerPin.replace(/[^0-9]/g, '') || '1234',
        setupMode: templateId === 'custom' ? 'clean' : 'starter',
        templateId,
        ecommerceEnabled,
      });
      setName('');
      setSlug('');
      setSlugManuallyEdited(false);
      setScanResult(null);
      setStep(1);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to provision business workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlanObj = plans.find((p) => p.id === subscriptionPlan) || plans[0];
  const selectedTemplate = getIndustryTemplateById(templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Quick Business & Store Onboarding Wizard
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Step {step} of 4 · Domain handle scan, localization, KRA eTIMS & subscription plan.
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
            '1. Name & Domain',
            '2. Branch Setup',
            '3. Plan & eTIMS',
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
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. GiftMart Retail Ltd"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Domain Path Prefix & Live Availability Scanner */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Dedicated Workspace URL Path
                  </label>
                  <button
                    type="button"
                    onClick={() => runSlugScan(effectiveSlug, name)}
                    disabled={!effectiveSlug || scanningSlug}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline disabled:opacity-40 dark:text-teal-400"
                  >
                    <Search className="h-3 w-3" />
                    <span>{scanningSlug ? 'Scanning...' : 'Scan Availability'}</span>
                  </button>
                </div>

                <div className="mt-1 flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus-within:border-teal-600 dark:border-slate-700 dark:bg-slate-800">
                  <span className="inline-flex items-center gap-1.5 border-r border-slate-200 px-3 py-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <Globe className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                    <span>https://misafarms.com/</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="giftmart"
                    className="w-full bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-slate-100"
                  />
                  <span className="px-2.5 text-slate-400">
                    {scanningSlug ? (
                      <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                    ) : scanResult?.available ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : scanResult && !scanResult.available ? (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    ) : null}
                  </span>
                </div>

                {scanResult && (
                  <div
                    className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
                      scanResult.available
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {scanResult.available
                          ? `Available: ${scanResult.fullUrl}`
                          : scanResult.reason || 'Unavailable domain handle'}
                      </span>
                    </div>
                    {scanResult.nameTaken && scanResult.available && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        Note: {scanResult.reason}
                      </p>
                    )}
                    {!scanResult.available && scanResult.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px]">Try available handle:</span>
                        {scanResult.suggestions.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleSlugChange(sug)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 hover:border-teal-600 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            /{sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Layers className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Ready-to-Use Industry Template</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Pre-configures POS, zones, categories &amp; hardware</span>
                </div>
                <div className="mt-2 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {BUSINESS_INDUSTRY_TEMPLATES.map((tpl) => {
                    const active = templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setTemplateId(tpl.id);
                          setSetupMode(tpl.id === 'custom' ? 'clean' : 'starter');
                        }}
                        className={`rounded-lg border p-2.5 text-left transition-colors ${
                          active
                            ? 'border-teal-600 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {tpl.name}
                          </span>
                          <span className="font-mono text-[10px] font-semibold text-teal-700 dark:text-teal-400">
                            {tpl.installedModuleIds.length} apps
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                          {tpl.tagline}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                          {tpl.starterProducts.length > 0
                            ? `${tpl.starterProducts.length} starter SKUs · ${tpl.layoutConfig.zones.length} zones`
                            : 'Zero fake data · Configure from scratch'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select SaaS Subscription Tier
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {plans.map((plan) => {
                    const selected = subscriptionPlan === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSubscriptionPlan(plan.id)}
                        className={`rounded-lg border p-2.5 text-left transition-colors ${
                          selected
                            ? 'border-teal-600 bg-teal-50/80 dark:border-teal-500 dark:bg-teal-950/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                          <span>{plan.name}</span>
                          <span className="font-mono text-teal-700 dark:text-teal-400">
                            {plan.monthlyPriceKes === 0
                              ? 'Free'
                              : `KES ${plan.monthlyPriceKes.toLocaleString()}`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Up to {plan.branchLimit} {plan.branchLimit === 1 ? 'branch' : 'branches'} · {plan.userLimit} users
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

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

              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Owner POS PIN
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Selected Blueprint: {selectedTemplate.name}
                  </span>
                  <span className="font-mono text-[11px] text-teal-700 dark:text-teal-400">
                    {selectedTemplate.installedModuleIds.length} modules ·{' '}
                    {setupMode === 'clean' ? 'Zero Seed Data' : `${selectedTemplate.starterProducts.length} Starter SKUs`}
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={ecommerceEnabled}
                    onChange={(e) => setEcommerceEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Enable Online eCommerce Storefront at misafarms.com/{effectiveSlug || 'shop'}/shop</span>
                </label>
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
                <div>
                  Portal URL:{' '}
                  <strong className="font-mono text-teal-700 dark:text-teal-400">
                    https://misafarms.com/{effectiveSlug}
                  </strong>
                </div>
                <div>Template: <strong>{selectedTemplate.name}</strong></div>
                <div>Localization: <strong>{country} · {currency} (VAT {vatRate}%)</strong></div>
                <div>Branch: <strong>{branchName}</strong></div>
                <div>Fiscal Mode: <strong>{etimsMode} ({taxPin})</strong></div>
                <div>
                  Plan:{' '}
                  <strong>
                    {selectedPlanObj.name} ({selectedPlanObj.monthlyPriceKes === 0 ? '14d Free' : `KES ${selectedPlanObj.monthlyPriceKes.toLocaleString()}/mo`})
                  </strong>
                </div>
                <div>eCommerce: <strong>{ecommerceEnabled ? 'Enabled' : 'Disabled'}</strong></div>
              </div>
            </div>
          )}

          {submitError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {submitError}
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
                disabled={step === 1 && Boolean(name.trim()) && slugBlocked}
                onClick={() => {
                  if (step === 1 && !name.trim()) {
                    handleNameChange('GiftMart Retail Ltd');
                    return;
                  }
                  if (step === 1 && slugBlocked) return;
                  setStep((step + 1) as 2 | 3 | 4);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-600"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || slugBlocked}
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
