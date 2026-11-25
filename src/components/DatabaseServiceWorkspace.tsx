import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Database,
  Globe,
  Layers,
  Loader2,
  PlugZap,
  Plus,
  Search,
  Server,
  ShieldAlert,
  Store,
  X,
} from 'lucide-react';
import {
  BusinessEntity,
  DatabaseServiceInstance,
  DatabaseSystemCategory,
  ErpRecord,
  ProductItem,
  StoreBranch,
  SubscriptionPlanId,
  SubscriptionPlanTier,
} from '../types/erp';
import { BUSINESS_INDUSTRY_TEMPLATES } from '../data/businessTemplates';

interface SlugScanResult {
  slug: string;
  available: boolean;
  reason?: string;
  fullUrl: string;
  suggestions: string[];
}

interface DatabaseServiceWorkspaceProps {
  services: DatabaseServiceInstance[];
  businesses: BusinessEntity[];
  stores: StoreBranch[];
  products: ProductItem[];
  erpRecords: ErpRecord[];
  activeBusinessId: string;
  subscriptionPlans: SubscriptionPlanTier[];
  isAdmin: boolean;
  onConnectService: (serviceId: string) => Promise<void>;
  onCreateService: (payload: {
    displayName: string;
    slug: string;
    systemCategory: DatabaseSystemCategory;
    customSystemLabel?: string;
    parentGroupName?: string;
    templateId: string;
    region: DatabaseServiceInstance['region'];
    country: 'KE' | 'UG' | 'TZ' | 'GB' | 'US';
    currency: 'KES' | 'UGX' | 'TZS' | 'GBP' | 'USD';
    taxPin: string;
    etimsEnabled: boolean;
    branchName: string;
    branchLocation: string;
    ownerName: string;
    ownerEmail: string;
    ownerPin: string;
    subscriptionPlan: SubscriptionPlanId;
    setupMode: 'clean' | 'starter';
    ecommerceEnabled: boolean;
  }) => Promise<void>;
  onUpdateService: (
    serviceId: string,
    patch: Partial<{
      displayName: string;
      engineStatus: DatabaseServiceInstance['engineStatus'];
      region: DatabaseServiceInstance['region'];
      parentGroupName: string;
      customSystemLabel: string;
    }>
  ) => Promise<void>;
  onOpenAppsAfterConnect?: () => void;
}

const SYSTEM_CATEGORIES: Array<{ id: DatabaseSystemCategory; label: string; hint: string }> = [
  { id: 'supermarket', label: 'Supermarket & Retail', hint: 'Aisles, barcode POS, eTIMS & bulk stock' },
  { id: 'restaurant', label: 'Restaurant & Bistro', hint: 'Dining floors, tables, KOT & staff tips' },
  { id: 'hardware', label: 'Hardware & Timber', hint: 'Heavy yard bays, contractor quotes & repairs' },
  { id: 'rentals', label: 'Rentals & Leasing', hint: 'Leased equipment, deposits & asset returns' },
  { id: 'pharmacy', label: 'Pharmacy & Clinic', hint: 'Batches, OTC counters & exempt VAT' },
  { id: 'fashion', label: 'Fashion & Apparel', hint: 'Size/color racks & seasonal promos' },
  { id: 'electronics', label: 'Electronics & Tech', hint: 'Serial numbers, IMEI & warranty RMA' },
  { id: 'salon', label: 'Salon & Spa', hint: 'Chair appointments, bookings & service tips' },
  { id: 'wholesale', label: 'Wholesale & Depot', hint: 'Pallet bays, field reps & B2B invoicing' },
  { id: 'custom', label: 'Custom Business System', hint: 'Configure any bespoke operational vertical' },
];

function slugifyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export const DatabaseServiceWorkspace: React.FC<DatabaseServiceWorkspaceProps> = ({
  services,
  businesses,
  stores,
  products,
  erpRecords,
  activeBusinessId,
  subscriptionPlans,
  isAdmin,
  onConnectService,
  onCreateService,
  onUpdateService,
  onOpenAppsAfterConnect,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DatabaseSystemCategory>('all');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusBanner, setStatusBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  // Create Service form state
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [scanResult, setScanResult] = useState<SlugScanResult | null>(null);
  const [scanningSlug, setScanningSlug] = useState(false);
  const [systemCategory, setSystemCategory] = useState<DatabaseSystemCategory>('restaurant');
  const [customSystemLabel, setCustomSystemLabel] = useState('');
  const [parentGroupName, setParentGroupName] = useState('');
  const [region, setRegion] = useState<DatabaseServiceInstance['region']>('ke-nairobi-1');
  const [country, setCountry] = useState<'KE' | 'UG' | 'TZ' | 'GB' | 'US'>('KE');
  const [currency, setCurrency] = useState<'KES' | 'UGX' | 'TZS' | 'GBP' | 'USD'>('KES');
  const [taxPin, setTaxPin] = useState('P051900120K');
  const [etimsEnabled, setEtimsEnabled] = useState(true);
  const [branchName, setBranchName] = useState('Main Outlet');
  const [branchLocation, setBranchLocation] = useState('Westlands, Nairobi');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPin, setOwnerPin] = useState('1234');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanId>('Trial');
  const [setupMode, setSetupMode] = useState<'starter' | 'clean'>('starter');
  const [ecommerceEnabled, setEcommerceEnabled] = useState(true);
  const [creating, setCreating] = useState(false);

  const activeService = useMemo(
    () => services.find((s) => s.businessId === activeBusinessId) || services[0],
    [services, activeBusinessId]
  );

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((svc) => {
      if (categoryFilter !== 'all' && svc.systemCategory !== categoryFilter) return false;
      if (!q) return true;
      return (
        svc.displayName.toLowerCase().includes(q) ||
        svc.serviceCode.toLowerCase().includes(q) ||
        svc.slug.toLowerCase().includes(q) ||
        svc.systemCategory.toLowerCase().includes(q) ||
        (svc.customSystemLabel?.toLowerCase().includes(q) ?? false) ||
        (svc.parentGroupName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [services, categoryFilter, search]);

  const scanSlug = async (candidate: string, nameForCheck: string) => {
    const cleaned = slugifyName(candidate || nameForCheck);
    if (!cleaned) {
      setScanResult(null);
      return;
    }
    setScanningSlug(true);
    try {
      const res = await fetch(
        `/api/businesses/check-slug?slug=${encodeURIComponent(cleaned)}&name=${encodeURIComponent(nameForCheck)}`
      );
      if (res.ok) {
        const data: SlugScanResult = await res.json();
        setScanResult(data);
        return;
      }
    } catch {
      // Fallback local check
    } finally {
      setScanningSlug(false);
    }
    const taken = businesses.some((b) => b.slug.toLowerCase() === cleaned);
    setScanResult({
      slug: cleaned,
      available: !taken && cleaned.length >= 2,
      reason: taken ? `misafarms.com/${cleaned} is already claimed.` : undefined,
      fullUrl: `https://misafarms.com/${cleaned}`,
      suggestions: taken ? [`${cleaned}-ke`, `${cleaned}-sys`] : [],
    });
  };

  const handleConnect = async (svc: DatabaseServiceInstance) => {
    setErrorBanner('');
    setConnectingId(svc.id);
    try {
      await onConnectService(svc.id);
      setStatusBanner(`Connected to Database Service ${svc.serviceCode} — ${svc.displayName}`);
      setTimeout(() => setStatusBanner(''), 4000);
      if (onOpenAppsAfterConnect) {
        onOpenAppsAfterConnect();
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to connect to service.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setErrorBanner('');
    setCreating(true);
    try {
      const finalSlug = slugifyName(slug || displayName);
      await onCreateService({
        displayName: displayName.trim(),
        slug: finalSlug,
        systemCategory,
        customSystemLabel:
          systemCategory === 'custom' && customSystemLabel.trim()
            ? customSystemLabel.trim()
            : undefined,
        parentGroupName: parentGroupName.trim() || undefined,
        templateId:
          BUSINESS_INDUSTRY_TEMPLATES.find((t) => t.id === systemCategory)?.id || 'custom',
        region,
        country,
        currency,
        taxPin: taxPin.trim() || 'P051900120K',
        etimsEnabled,
        branchName: branchName.trim() || 'Main Outlet',
        branchLocation: branchLocation.trim() || 'Nairobi CBD',
        ownerName: ownerName.trim() || 'Service Owner',
        ownerEmail: ownerEmail.trim() || `admin@${finalSlug}.misafarms.com`,
        ownerPin: ownerPin.trim() || '1234',
        subscriptionPlan,
        setupMode,
        ecommerceEnabled,
      });
      setShowCreateModal(false);
      setDisplayName('');
      setSlug('');
      setSlugEdited(false);
      setScanResult(null);
      setCustomSystemLabel('');
      setParentGroupName('');
      setStatusBanner(`Provisioned & connected new ${systemCategory} Database Service.`);
      setTimeout(() => setStatusBanner(''), 4500);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Could not provision Database Service.');
    } finally {
      setCreating(false);
    }
  };

  const onlineCount = services.filter((s) => s.engineStatus === 'online').length;
  const distinctGroups = new Set(services.map((s) => s.parentGroupName).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Database Service Engine
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Run isolated systems per business vertical (Restaurant, Hardware, Rentals, Supermarket, or Custom) and click Connect to manage any service.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Add Database Service</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Database Services
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {services.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {onlineCount} online · {distinctGroups} groups
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Connected Service
          </p>
          <p className="mt-1 truncate font-display text-base font-bold text-teal-700 dark:text-teal-400">
            {activeService?.displayName || 'Default Service'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {activeService?.serviceCode || 'SVC-KE-001'} · {activeService?.systemCategory || 'supermarket'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Isolated Branch Nodes
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {stores.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Dedicated stock &amp; fiscal ledgers
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Stored SKUs &amp; ERP Records
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {products.length + erpRecords.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {products.length} SKUs · {erpRecords.length} entries
          </p>
        </div>
      </div>

      {statusBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {errorBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Search & System Type Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service name, code (SVC-KE-001), group, or domain..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All ({services.length})
          </button>
          {SYSTEM_CATEGORIES.filter((c) =>
            ['restaurant', 'hardware', 'rentals', 'supermarket', 'pharmacy', 'custom'].includes(c.id)
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                categoryFilter === cat.id
                  ? 'bg-slate-900 text-white dark:bg-teal-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {cat.id.charAt(0).toUpperCase() + cat.id.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Database Service Directory Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredServices.map((svc) => {
          const isConnected = svc.businessId === activeBusinessId;
          const biz = businesses.find((b) => b.id === svc.businessId);
          const svcBranches = stores.filter((st) => st.businessId === svc.businessId).length;
          const svcSkus = products.filter((pr) => pr.businessId === svc.businessId).length;
          const svcRecs = erpRecords.filter((rc) => rc.businessId === svc.businessId).length;
          const categoryLabel =
            svc.systemCategory === 'custom' && svc.customSystemLabel
              ? svc.customSystemLabel
              : SYSTEM_CATEGORIES.find((c) => c.id === svc.systemCategory)?.label || svc.systemCategory;

          return (
            <div
              key={svc.id}
              className={`flex flex-col justify-between rounded-xl border bg-white p-5 transition-colors dark:bg-slate-900 ${
                isConnected
                  ? 'border-teal-600 dark:border-teal-500'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-teal-400">
                      <Database className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {svc.displayName}
                      </h3>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {svc.serviceCode} · {svc.region}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[11px] font-semibold uppercase ${
                      svc.engineStatus === 'online'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : svc.engineStatus === 'maintenance'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {isConnected ? 'Connected' : svc.engineStatus}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <p className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {categoryLabel}
                    </span>
                    {svc.parentGroupName && (
                      <span className="truncate text-slate-500 dark:text-slate-400">
                        · {svc.parentGroupName}
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>misafarms.com/{svc.slug}</span>
                  </p>
                  <p className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
                    <Server className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      {svcBranches} Branches · {svcSkus} SKUs · {svcRecs} Records ·{' '}
                      {biz?.currency || 'KES'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800">
                {isAdmin ? (
                  <select
                    aria-label={`Engine status for ${svc.displayName}`}
                    value={svc.engineStatus}
                    onChange={(e) =>
                      onUpdateService(svc.id, {
                        engineStatus: e.target.value as DatabaseServiceInstance['engineStatus'],
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="online">Status: Online</option>
                    <option value="maintenance">Status: Maintenance</option>
                    <option value="suspended">Status: Suspended</option>
                  </select>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Plan: {svc.planId || 'Trial'}
                  </span>
                )}

                <button
                  type="button"
                  disabled={svc.engineStatus === 'suspended' || connectingId === svc.id}
                  onClick={() => handleConnect(svc)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                    isConnected
                      ? 'border border-teal-700 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-300'
                      : 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500'
                  }`}
                >
                  {connectingId === svc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlugZap className="h-3.5 w-3.5" />
                  )}
                  <span>{isConnected ? 'Open Connected System' : 'Connect'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Database Service Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Create Isolated Database Service
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Launch a dedicated business system (Restaurant, Hardware, Rentals, or Custom) in your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  1. Select Business System Vertical
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SYSTEM_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSystemCategory(cat.id)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        systemCategory === cat.id
                          ? 'border-teal-600 bg-teal-50/70 text-teal-900 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-200'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <p className="text-xs font-semibold">{cat.label}</p>
                      <p className="mt-0.5 text-[10px] opacity-80">{cat.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {systemCategory === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Custom System Vertical Label
                  </label>
                  <input
                    type="text"
                    required
                    value={customSystemLabel}
                    onChange={(e) => setCustomSystemLabel(e.target.value)}
                    placeholder="e.g. Car Wash & Detailing, Vet Clinic, Bakery Kitchen"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Business / Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDisplayName(val);
                      if (!slugEdited) {
                        const nextSlug = slugifyName(val);
                        setSlug(nextSlug);
                      }
                    }}
                    placeholder="e.g. Nyama Grill Lounge or Eldoret Rentals"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Domain Handle (misafarms.com/...)
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => {
                        setSlugEdited(true);
                        setSlug(slugifyName(e.target.value));
                      }}
                      placeholder="nyama-grill"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => void scanSlug(slug, displayName)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {scanningSlug ? 'Scanning...' : 'Scan'}
                    </button>
                  </div>
                  {scanResult && (
                    <p
                      className={`mt-1 text-[11px] ${
                        scanResult.available
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {scanResult.available
                        ? `Available: ${scanResult.fullUrl}`
                        : scanResult.reason || 'Unavailable'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Parent Group / Holding Co. (Optional)
                  </label>
                  <input
                    type="text"
                    value={parentGroupName}
                    onChange={(e) => setParentGroupName(e.target.value)}
                    placeholder="e.g. MisafaTech Group"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Database Region &amp; Plan
                  </label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value as DatabaseServiceInstance['region'])}
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="ke-nairobi-1">Nairobi (ke-nairobi-1)</option>
                      <option value="af-south-1">Cape Town (af-south-1)</option>
                      <option value="eu-west-2">London (eu-west-2)</option>
                    </select>
                    <select
                      value={subscriptionPlan}
                      onChange={(e) => setSubscriptionPlan(e.target.value as SubscriptionPlanId)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {subscriptionPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Country &amp; Currency
                  </label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={country}
                      onChange={(e) => {
                        const c = e.target.value as 'KE' | 'UG' | 'TZ' | 'GB' | 'US';
                        setCountry(c);
                        setCurrency(
                          c === 'KE' ? 'KES' : c === 'UG' ? 'UGX' : c === 'TZ' ? 'TZS' : c === 'GB' ? 'GBP' : 'USD'
                        );
                      }}
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="KE">Kenya (KE)</option>
                      <option value="UG">Uganda (UG)</option>
                      <option value="TZ">Tanzania (TZ)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="US">United States (US)</option>
                    </select>
                    <select
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value as 'KES' | 'UGX' | 'TZS' | 'GBP' | 'USD')
                      }
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="KES">KES</option>
                      <option value="UGX">UGX</option>
                      <option value="TZS">TZS</option>
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Branch Name &amp; Location
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="Main Branch"
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={branchLocation}
                      onChange={(e) => setBranchLocation(e.target.value)}
                      placeholder="Location"
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tax PIN &amp; Owner Name
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={taxPin}
                      onChange={(e) => setTaxPin(e.target.value)}
                      placeholder="P051900120K"
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Owner Name"
                      className="w-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Owner Email &amp; POS PIN
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="owner@business.co.ke"
                      className="w-2/3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={ownerPin}
                      onChange={(e) => setOwnerPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="1234"
                      className="w-1/3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
                <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={etimsEnabled}
                    onChange={(e) => setEtimsEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Enable KRA eTIMS</span>
                </label>
                <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={ecommerceEnabled}
                    onChange={(e) => setEcommerceEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Provision eCommerce Storefront</span>
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Starter Seed:</span>
                  <select
                    value={setupMode}
                    onChange={(e) => setSetupMode(e.target.value as 'starter' | 'clean')}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="starter">Preload Vertical SKUs &amp; Zones</option>
                    <option value="clean">Blank / Clean Workspace</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || (scanResult ? !scanResult.available : false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                  <span>Provision &amp; Connect Service</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
