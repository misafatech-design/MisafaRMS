import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Globe,
  KeyRound,
  Plus,
  Receipt,
  Save,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  BusinessEntity,
  EmployeeRecord,
  PlatformBillingGateway,
  PlatformUserRecord,
  ProductItem,
  StoreBranch,
  SubscriptionInvoice,
  SubscriptionPlanId,
  SubscriptionPlanTier,
  SubscriptionStatus,
  UserRole,
} from '../types/erp';

type SuperAdminTab = 'businesses' | 'users' | 'subscriptions' | 'payment_config';

interface SuperAdminViewProps {
  businesses: BusinessEntity[];
  stores: StoreBranch[];
  employees: EmployeeRecord[];
  products: ProductItem[];
  platformUsers: PlatformUserRecord[];
  subscriptionPlans: SubscriptionPlanTier[];
  platformBillingGateways: PlatformBillingGateway[];
  subscriptionInvoices: SubscriptionInvoice[];
  currentUserEmail?: string | null;
  onSwitchToBusiness: (businessId: string) => void;
  onUpdateBusinessSubscription: (
    businessId: string,
    patch: {
      subscriptionPlan?: SubscriptionPlanId;
      subscriptionStatus?: SubscriptionStatus;
      branchLimit?: number;
      monthlyFee?: number;
      subscriptionRenewsAt?: string;
    }
  ) => Promise<void>;
  onAddBranchToBusiness: (payload: {
    businessId: string;
    name: string;
    location: string;
    tillNumber: string;
  }) => Promise<void>;
  onCreatePlatformUser: (payload: {
    name: string;
    email: string;
    tier: PlatformUserRecord['tier'];
    role: PlatformUserRecord['role'];
    businessId?: string;
  }) => Promise<void>;
  onUpdatePlatformUser: (
    userId: string,
    patch: {
      status?: 'active' | 'suspended';
      tier?: PlatformUserRecord['tier'];
      role?: PlatformUserRecord['role'];
      businessId?: string;
    }
  ) => Promise<void>;
  onUpdatePlans: (plans: SubscriptionPlanTier[]) => Promise<void>;
  onSaveBillingGateways: (
    gateways: PlatformBillingGateway[],
    secretUpdates: Record<string, { consumerKey?: string }>
  ) => Promise<void>;
  onPaySubscription: (payload: {
    businessId: string;
    planId: SubscriptionPlanId;
    gatewayId: string;
    payerRef: string;
  }) => Promise<void>;
  onOpenNewBusinessWizard: () => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  businesses,
  stores,
  employees,
  products,
  platformUsers,
  subscriptionPlans,
  platformBillingGateways,
  subscriptionInvoices,
  currentUserEmail,
  onSwitchToBusiness,
  onUpdateBusinessSubscription,
  onAddBranchToBusiness,
  onCreatePlatformUser,
  onUpdatePlatformUser,
  onUpdatePlans,
  onSaveBillingGateways,
  onPaySubscription,
  onOpenNewBusinessWizard,
}) => {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('businesses');
  const [banner, setBanner] = useState('');

  // Businesses & Branches state
  const [bizSearch, setBizSearch] = useState('');
  const [expandedBizId, setExpandedBizId] = useState<string | null>(businesses[0]?.id || null);
  const [branchFormBizId, setBranchFormBizId] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  const [newBranchTill, setNewBranchTill] = useState('');

  // Software Users state
  const [userSearch, setUserSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | PlatformUserRecord['tier']>('all');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTier, setNewUserTier] = useState<PlatformUserRecord['tier']>('admin');
  const [newUserRole, setNewUserRole] = useState<PlatformUserRecord['role']>('Owner');
  const [newUserBizId, setNewUserBizId] = useState(businesses[0]?.id || '');

  // Subscription & Checkout state
  const [editablePlans, setEditablePlans] = useState<SubscriptionPlanTier[]>(subscriptionPlans);
  const [payBizId, setPayBizId] = useState(businesses[0]?.id || '');
  const [payPlanId, setPayPlanId] = useState<SubscriptionPlanId>('Multi-Store Pro');
  const [payGatewayId, setPayGatewayId] = useState(
    platformBillingGateways.find((g) => g.enabled)?.id || platformBillingGateways[0]?.id || ''
  );
  const [payRefInput, setPayRefInput] = useState('');
  const [paying, setPaying] = useState(false);

  // Payment Gateways config state
  const [gateways, setGateways] = useState<PlatformBillingGateway[]>(platformBillingGateways);
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [savingGateways, setSavingGateways] = useState(false);

  // Custom SaaS gateway creator state
  const [customGwName, setCustomGwName] = useState('');
  const [customGwMode, setCustomGwMode] = useState<PlatformBillingGateway['mode']>('Custom');
  const [customGwAccount, setCustomGwAccount] = useState('');
  const [customGwCurrencies, setCustomGwCurrencies] = useState('KES, USD');

  const notify = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(''), 4500);
  };

  // KPI computations
  const activeBusinessesCount = businesses.filter((b) => b.subscriptionStatus !== 'suspended').length;
  const totalBranchesCount = stores.length;
  const totalMrrKes = useMemo(
    () =>
      businesses
        .filter((b) => b.subscriptionStatus !== 'suspended')
        .reduce((sum, b) => sum + (b.monthlyFee ?? 0), 0),
    [businesses]
  );
  const activeUsersCount = platformUsers.filter((u) => u.status === 'active').length;
  const enabledGatewaysCount = gateways.filter((g) => g.enabled).length;

  const filteredBusinesses = useMemo(() => {
    const q = bizSearch.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.ownerEmail || '').toLowerCase().includes(q)
    );
  }, [businesses, bizSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return platformUsers.filter((u) => {
      if (tierFilter !== 'all' && u.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.businessName || '').toLowerCase().includes(q) ||
        (u.businessSlug || '').toLowerCase().includes(q)
      );
    });
  }, [platformUsers, tierFilter, userSearch]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    await onCreatePlatformUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      tier: newUserTier,
      role: newUserRole,
      businessId: newUserTier === 'super_admin' ? undefined : newUserBizId || undefined,
    });
    notify(`Provisioned software user ${newUserEmail.trim()} (${newUserTier}).`);
    setNewUserName('');
    setNewUserEmail('');
  };

  const handleAddBranchSubmit = async (e: React.FormEvent, bizId: string) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    await onAddBranchToBusiness({
      businessId: bizId,
      name: newBranchName.trim(),
      location: newBranchLocation.trim() || 'Kenya',
      tillNumber: newBranchTill.trim() || '849299',
    });
    notify(`Created new branch "${newBranchName.trim()}" and synced eTIMS BHF slot.`);
    setNewBranchName('');
    setNewBranchLocation('');
    setNewBranchTill('');
    setBranchFormBizId(null);
  };

  const handleSavePlansClick = async () => {
    await onUpdatePlans(editablePlans);
    notify('Saved SaaS subscription tier pricing & branch quotas.');
  };

  const handleProcessSubscriptionPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBizId || !payGatewayId) return;
    setPaying(true);
    try {
      await onPaySubscription({
        businessId: payBizId,
        planId: payPlanId,
        gatewayId: payGatewayId,
        payerRef: payRefInput.trim(),
      });
      notify('Subscription payment settled and invoice marked PAID.');
      setPayRefInput('');
    } finally {
      setPaying(false);
    }
  };

  const handleSaveGatewaysClick = async () => {
    setSavingGateways(true);
    try {
      const secretUpdates: Record<string, { consumerKey?: string }> = {};
      for (const [gwId, val] of Object.entries(secretInputs)) {
        if (val.trim()) secretUpdates[gwId] = { consumerKey: val.trim() };
      }
      await onSaveBillingGateways(gateways, secretUpdates);
      setSecretInputs({});
      notify('SaaS subscription payment gateways saved (write-only credentials rotated on server).');
    } finally {
      setSavingGateways(false);
    }
  };

  const handleAddCustomGateway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGwName.trim()) return;
    const id = `saas-gw-${Date.now().toString(36)}`;
    const nextGw: PlatformBillingGateway = {
      id,
      provider: 'custom',
      displayName: customGwName.trim(),
      enabled: true,
      mode: customGwMode,
      shortcodeOrAccount: customGwAccount.trim() || 'CUSTOM-ACCT',
      accountPrefix: 'SUB-',
      currencies: customGwCurrencies
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
      environment: 'Production',
      webhookUrl: `https://misafarms.com/api/webhooks/billing/${id}`,
      hasSecretConfigured: false,
      settlementSchedule: 'T+1 Settlement',
      instructions: 'Custom SaaS subscription collection rail.',
    };
    setGateways((prev) => [...prev, nextGw]);
    setCustomGwName('');
    setCustomGwAccount('');
    notify(`Added "${nextGw.displayName}" — click Save SaaS Payment Config to persist.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <ShieldCheck className="h-4 w-4" />
            <span>MisafaRMS SaaS Platform Control Plane · {currentUserEmail || 'misafatech@gmail.com'}</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Super Admin · Tenants, Users, Subscriptions & SaaS Billing
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage onboarded misafarms.com/&lt;slug&gt; businesses, branch counts, software users, plan billing, and collection gateways.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewBusinessWizard}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Onboard New Business</span>
        </button>
      </div>

      {banner && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Businesses & Branches</span>
            <Building2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {activeBusinessesCount} <span className="text-sm font-normal text-slate-400">/ {businesses.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{totalBranchesCount}</span> active retail branches synced
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Recurring SaaS MRR</span>
            <Receipt className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            KES {totalMrrKes.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {subscriptionInvoices.filter((i) => i.status === 'paid').length} settled ·{' '}
            {subscriptionInvoices.filter((i) => i.status !== 'paid').length} pending/overdue
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Software Users</span>
            <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {activeUsersCount} <span className="text-sm font-normal text-slate-400">/ {platformUsers.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Across Super Admin, Tenant Admins, Staff & Portal
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>SaaS Collection Gateways</span>
            <CreditCard className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {enabledGatewaysCount} <span className="text-sm font-normal text-slate-400">/ {gateways.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            M-Pesa Daraja, Airtel Money, Pesapal, Stripe & EFT
          </p>
        </div>
      </section>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {(
          [
            { id: 'businesses', label: `Businesses & Branches (${businesses.length})` },
            { id: 'users', label: `Software Users (${platformUsers.length})` },
            { id: 'subscriptions', label: `Subscriptions & Invoices (${subscriptionInvoices.length})` },
            { id: 'payment_config', label: `SaaS Payment Config (${enabledGatewaysCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Businesses & Branch Inspection */}
      {activeTab === 'businesses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={bizSearch}
              onChange={(e) => setBizSearch(e.target.value)}
              placeholder="Search business name, misafarms.com handle, or owner email..."
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
              Total Branches Platform-Wide: <strong className="text-slate-900 dark:text-slate-100">{totalBranchesCount}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {filteredBusinesses.map((biz) => {
              const bizBranches = stores.filter((s) => s.businessId === biz.id);
              const bizStaffCount = employees.filter((e) => e.businessId === biz.id).length;
              const bizSkuCount = products.filter((p) => p.businessId === biz.id).length;
              const isExpanded = expandedBizId === biz.id;
              const branchLimit = biz.branchLimit ?? 5;
              const status = biz.subscriptionStatus || 'active';

              return (
                <div
                  key={biz.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedBizId(isExpanded ? null : biz.id)}
                        className="mt-0.5 rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        aria-label={`Toggle branches for ${biz.name}`}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                            {biz.name}
                          </h2>
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-teal-800 dark:bg-slate-800 dark:text-teal-300">
                            <Globe className="h-3 w-3" />
                            misafarms.com/{biz.slug}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${
                              status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : status === 'trial'
                                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                  : status === 'past_due'
                                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Owner: {biz.ownerName || 'Admin'} ({biz.ownerEmail || 'owner@misafarms.com'}) · Tax PIN:{' '}
                          <span className="font-mono">{biz.taxPin}</span> · {biz.country} ({biz.currency})
                        </p>
                      </div>
                    </div>

                    {/* Exact Branch Count + Plan Controls */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedBizId(isExpanded ? null : biz.id)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left hover:border-teal-600 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Branches</span>
                        <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {bizBranches.length} / {branchLimit >= 999 ? '∞' : branchLimit}
                        </div>
                      </button>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Staff / SKUs</span>
                        <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {bizStaffCount} · {bizSkuCount}
                        </div>
                      </div>

                      <select
                        aria-label={`Subscription plan for ${biz.name}`}
                        value={biz.subscriptionPlan || 'Trial'}
                        onChange={async (e) => {
                          await onUpdateBusinessSubscription(biz.id, {
                            subscriptionPlan: e.target.value as SubscriptionPlanId,
                          });
                          notify(`Updated ${biz.name} to ${e.target.value} plan.`);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {subscriptionPlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            Plan: {p.name} (KES {p.monthlyPriceKes.toLocaleString()})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={async () => {
                          const nextStatus: SubscriptionStatus =
                            status === 'suspended' ? 'active' : 'suspended';
                          await onUpdateBusinessSubscription(biz.id, {
                            subscriptionStatus: nextStatus,
                          });
                          notify(
                            `${biz.name} workspace ${nextStatus === 'suspended' ? 'suspended' : 'reactivated'}.`
                          );
                        }}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          status === 'suspended'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400'
                        }`}
                      >
                        {status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSwitchToBusiness(biz.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                      >
                        <span>Enter Workspace</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Branches Drawer */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <Store className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                          <span>
                            Registered Store Branches for {biz.name} ({bizBranches.length} of{' '}
                            {branchLimit >= 999 ? 'Unlimited' : branchLimit} quota)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <span>Branch Quota:</span>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={branchLimit}
                              onChange={async (e) => {
                                const val = Math.max(1, Number(e.target.value) || 1);
                                await onUpdateBusinessSubscription(biz.id, { branchLimit: val });
                              }}
                              className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setBranchFormBizId(branchFormBizId === biz.id ? null : biz.id)
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-700 bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 dark:border-teal-600 dark:bg-slate-900 dark:text-teal-300"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Branch</span>
                          </button>
                        </div>
                      </div>

                      {branchFormBizId === biz.id && (
                        <form
                          onSubmit={(e) => handleAddBranchSubmit(e, biz.id)}
                          className="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <input
                            type="text"
                            required
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder="Branch Name (e.g. Nakuru CBD)"
                            className="rounded border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                          <input
                            type="text"
                            value={newBranchLocation}
                            onChange={(e) => setNewBranchLocation(e.target.value)}
                            placeholder="Location / Street"
                            className="rounded border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                          <input
                            type="text"
                            value={newBranchTill}
                            onChange={(e) => setNewBranchTill(e.target.value)}
                            placeholder="Till / Register Ref"
                            className="rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                          <button
                            type="submit"
                            className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                          >
                            Provision Branch
                          </button>
                        </form>
                      )}

                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                        {bizBranches.map((br) => (
                          <div
                            key={br.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {br.name}
                              </span>
                              <span className="font-mono text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                                {br.code}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {br.location} · Register {br.registerId}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
                              <span>eTIMS BHF-{br.etimsBhfId}: {br.vscuSerial}</span>
                              <span>Till {br.tillNumber}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Software Users Directory & Provisioning */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Provision Software User Form */}
          <form
            onSubmit={handleAddUserSubmit}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <UserPlus className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <span>Invite or Provision SaaS Software User</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Full Name"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@company.co.ke"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={newUserTier}
                onChange={(e) => {
                  const t = e.target.value as PlatformUserRecord['tier'];
                  setNewUserTier(t);
                  if (t === 'super_admin') setNewUserRole('Super Admin');
                  else if (t === 'admin') setNewUserRole('Owner');
                  else if (t === 'employee') setNewUserRole('Cashier');
                  else setNewUserRole('Customer');
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="super_admin">Tier: Super Admin</option>
                <option value="admin">Tier: Business Admin</option>
                <option value="employee">Tier: Employee (Staff)</option>
                <option value="user">Tier: Portal User</option>
              </select>
              <select
                value={newUserBizId}
                disabled={newUserTier === 'super_admin'}
                onChange={(e) => setNewUserBizId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (/{b.slug})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Software User</span>
              </button>
            </div>
          </form>

          {/* Users Table */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, email, or tenant..."
                  className="w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as 'all' | PlatformUserRecord['tier'])}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Access Tiers</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Business Admin</option>
                  <option value="employee">Staff Employee</option>
                  <option value="user">Portal Customer</option>
                </select>
              </div>
              <span className="font-mono text-xs text-slate-500">
                Showing {filteredUsers.length} of {platformUsers.length} accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Access Tier</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Assigned Business</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{usr.name}</p>
                        <p className="font-mono text-[11px] text-slate-500">{usr.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          aria-label={`Tier for ${usr.email}`}
                          value={usr.tier}
                          onChange={async (e) => {
                            await onUpdatePlatformUser(usr.id, {
                              tier: e.target.value as PlatformUserRecord['tier'],
                            });
                            notify(`Updated access tier for ${usr.email}.`);
                          }}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Business Admin</option>
                          <option value="employee">Employee</option>
                          <option value="user">Portal User</option>
                        </select>
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{usr.role}</td>
                      <td className="px-5 py-3">
                        {usr.tier === 'super_admin' ? (
                          <span className="font-mono text-[11px] text-teal-700 dark:text-teal-400">
                            Platform Global
                          </span>
                        ) : (
                          <select
                            aria-label={`Business for ${usr.email}`}
                            value={usr.businessId || ''}
                            onChange={async (e) => {
                              await onUpdatePlatformUser(usr.id, { businessId: e.target.value });
                              notify(`Reassigned ${usr.email} to new workspace.`);
                            }}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="">Unassigned</option>
                            {businesses.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} (/{b.slug})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            usr.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {usr.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const nextStatus = usr.status === 'active' ? 'suspended' : 'active';
                            await onUpdatePlatformUser(usr.id, { status: nextStatus });
                            notify(`${usr.email} marked ${nextStatus}.`);
                          }}
                          className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                        >
                          {usr.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Subscriptions, Plan Editor & Payment Collection */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Editable SaaS Plans Grid */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  SaaS Subscription Plans & Branch Quotas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure monthly KES/USD pricing, branch limits, and user caps applied to new and renewing businesses.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePlansClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Plan Pricing</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {editablePlans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-slate-900 dark:text-slate-100">
                      {plan.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{plan.id}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{plan.tagline}</p>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] text-slate-500">KES / mo</span>
                      <input
                        type="number"
                        min={0}
                        value={plan.monthlyPriceKes}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setEditablePlans((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, monthlyPriceKes: val } : p))
                          );
                        }}
                        className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">USD / mo</span>
                      <input
                        type="number"
                        min={0}
                        value={plan.monthlyPriceUsd}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setEditablePlans((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, monthlyPriceUsd: val } : p))
                          );
                        }}
                        className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Branch Limit</span>
                      <input
                        type="number"
                        min={1}
                        value={plan.branchLimit}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setEditablePlans((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, branchLimit: val } : p))
                          );
                        }}
                        className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">User Limit</span>
                      <input
                        type="number"
                        min={1}
                        value={plan.userLimit}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setEditablePlans((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, userLimit: val } : p))
                          );
                        }}
                        className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Collect / Process Subscription Payment */}
          <form
            onSubmit={handleProcessSubscriptionPayment}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <CreditCard className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <span>Collect / Settle Tenant Subscription Payment</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <select
                value={payBizId}
                onChange={(e) => setPayBizId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (/{b.slug})
                  </option>
                ))}
              </select>
              <select
                value={payPlanId}
                onChange={(e) => setPayPlanId(e.target.value as SubscriptionPlanId)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {editablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · KES {p.monthlyPriceKes.toLocaleString()}
                  </option>
                ))}
              </select>
              <select
                value={payGatewayId}
                onChange={(e) => setPayGatewayId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {gateways
                  .filter((g) => g.enabled)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.displayName} ({g.shortcodeOrAccount})
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={payRefInput}
                onChange={(e) => setPayRefInput(e.target.value)}
                placeholder="M-Pesa / Bank Ref (optional)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={paying || gateways.filter((g) => g.enabled).length === 0}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-teal-600"
              >
                {paying ? 'Settling...' : 'Mark Paid & Renew'}
              </button>
            </div>
          </form>

          {/* Subscription Invoices Ledger */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                SaaS Subscription Invoices Ledger
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-2.5 font-medium">Invoice #</th>
                    <th className="px-5 py-2.5 font-medium">Business</th>
                    <th className="px-5 py-2.5 font-medium">Plan & Period</th>
                    <th className="px-5 py-2.5 font-medium">Collection Gateway</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {subscriptionInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {inv.invoiceNo}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {inv.businessName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          misafarms.com/{inv.businessSlug}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {inv.planId}
                        </span>
                        <span className="ml-1.5 text-slate-500">· {inv.periodLabel}</span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-slate-700 dark:text-slate-300">{inv.paymentMethod}</p>
                        <p className="font-mono text-[11px] text-slate-400">Ref: {inv.paymentRef}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">
                        {inv.currency} {inv.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : inv.status === 'overdue'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: Super Admin SaaS Payment Config */}
      {activeTab === 'payment_config' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                SaaS Subscription Payment Gateways Configuration
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Integrate and manage the Paybills, Tills, Card processors, and Bank EFT rails businesses pay MisafaRMS subscriptions with. Secret keys are write-only and stored strictly server-side.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveGatewaysClick}
              disabled={savingGateways}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savingGateways ? 'Saving...' : 'Save SaaS Payment Config'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {gateways.map((gw) => (
              <div
                key={gw.id}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {gw.displayName}
                      </h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          gw.environment === 'Production'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {gw.environment}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {gw.mode} · Currencies: {gw.currencies.join(', ')} · {gw.settlementSchedule}
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={gw.enabled}
                      onChange={(e) =>
                        setGateways((prev) =>
                          prev.map((item) =>
                            item.id === gw.id ? { ...item, enabled: e.target.checked } : item
                          )
                        )
                      }
                      className="rounded border-slate-300 text-teal-700"
                    />
                    <span className={gw.enabled ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'}>
                      {gw.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Paybill / Till / Merchant ID
                    </span>
                    <input
                      type="text"
                      value={gw.shortcodeOrAccount}
                      onChange={(e) =>
                        setGateways((prev) =>
                          prev.map((item) =>
                            item.id === gw.id
                              ? { ...item, shortcodeOrAccount: e.target.value }
                              : item
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Account Reference Prefix
                    </span>
                    <input
                      type="text"
                      value={gw.accountPrefix}
                      onChange={(e) =>
                        setGateways((prev) =>
                          prev.map((item) =>
                            item.id === gw.id ? { ...item, accountPrefix: e.target.value } : item
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Environment
                    </span>
                    <select
                      value={gw.environment}
                      onChange={(e) =>
                        setGateways((prev) =>
                          prev.map((item) =>
                            item.id === gw.id
                              ? {
                                  ...item,
                                  environment: e.target.value as 'Production' | 'Sandbox',
                                }
                              : item
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="Production">Production</option>
                      <option value="Sandbox">Sandbox</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Settlement Schedule
                    </span>
                    <input
                      type="text"
                      value={gw.settlementSchedule}
                      onChange={(e) =>
                        setGateways((prev) =>
                          prev.map((item) =>
                            item.id === gw.id
                              ? { ...item, settlementSchedule: e.target.value }
                              : item
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                </div>

                <label className="block text-xs">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Webhook / IPN Callback URL
                  </span>
                  <input
                    type="text"
                    value={gw.webhookUrl}
                    onChange={(e) =>
                      setGateways((prev) =>
                        prev.map((item) =>
                          item.id === gw.id ? { ...item, webhookUrl: e.target.value } : item
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <KeyRound className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                      <span>Rotate API Secret / Consumer Passkey (Write-Only)</span>
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        gw.hasSecretConfigured ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'
                      }`}
                    >
                      {gw.hasSecretConfigured ? 'Configured Server-Side' : 'Not Rotated'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={secretInputs[gw.id] || ''}
                    onChange={(e) =>
                      setSecretInputs((prev) => ({ ...prev, [gw.id]: e.target.value }))
                    }
                    placeholder="Enter new secret/passkey to rotate on server..."
                    className="mt-1.5 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom SaaS Billing Gateway */}
          <form
            onSubmit={handleAddCustomGateway}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Integrate Additional SaaS Collection Gateway
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
              <input
                type="text"
                required
                value={customGwName}
                onChange={(e) => setCustomGwName(e.target.value)}
                placeholder="Gateway Name (e.g. Flutterwave / Jenga)"
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={customGwMode}
                onChange={(e) => setCustomGwMode(e.target.value as PlatformBillingGateway['mode'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Paybill">Paybill</option>
                <option value="Merchant Till">Merchant Till</option>
                <option value="Card & Mobile">Card & Mobile</option>
                <option value="International Card">International Card</option>
                <option value="Bank EFT / RTGS">Bank EFT / RTGS</option>
                <option value="Custom">Custom Rail</option>
              </select>
              <input
                type="text"
                value={customGwAccount}
                onChange={(e) => setCustomGwAccount(e.target.value)}
                placeholder="Merchant ID / Account #"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Gateway</span>
              </button>
            </div>
            <input
              type="text"
              value={customGwCurrencies}
              onChange={(e) => setCustomGwCurrencies(e.target.value)}
              placeholder="Supported Currencies (comma-separated, e.g. KES, USD, UGX)"
              className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </form>
        </div>
      )}
    </div>
  );
};
