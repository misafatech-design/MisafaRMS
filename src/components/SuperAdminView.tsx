import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  ExternalLink,
  Globe,
  KeyRound,
  LayoutDashboard,
  Layers,
  Lock,
  PlugZap,
  Plus,
  Receipt,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  BusinessEntity,
  DatabaseServiceInstance,
  DatabaseSystemCategory,
  EmployeeRecord,
  PlatformBillingGateway,
  PlatformUserRecord,
  ProductItem,
  StoreBranch,
  SubscriptionInvoice,
  SubscriptionPlanId,
  SubscriptionPlanTier,
  SubscriptionStatus,
} from '../types/erp';
import { BUSINESS_INDUSTRY_TEMPLATES } from '../data/businessTemplates';

type SuperAdminSection =
  | 'overview'
  | 'businesses'
  | 'services'
  | 'access_requests'
  | 'users'
  | 'templates'
  | 'subscriptions'
  | 'payment_config';

interface SuperAdminViewProps {
  businesses: BusinessEntity[];
  databaseServices: DatabaseServiceInstance[];
  stores: StoreBranch[];
  employees: EmployeeRecord[];
  products: ProductItem[];
  platformUsers: PlatformUserRecord[];
  subscriptionPlans: SubscriptionPlanTier[];
  platformBillingGateways: PlatformBillingGateway[];
  subscriptionInvoices: SubscriptionInvoice[];
  currentUserEmail?: string | null;
  onSwitchToBusiness: (businessId: string) => void;
  onCreateService?: (payload: {
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
  onUpdateService?: (
    serviceId: string,
    patch: Partial<{
      displayName: string;
      engineStatus: DatabaseServiceInstance['engineStatus'];
      region: DatabaseServiceInstance['region'];
      parentGroupName: string;
      customSystemLabel: string;
    }>
  ) => Promise<void>;
  onDeleteService?: (serviceId: string) => Promise<void>;
  onRequestSupportAccess: (
    businessId: string,
    reason: string,
    durationHours: number
  ) => Promise<void>;
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

const PAGE_SIZE = 8;

function isSupportAccessActive(biz: BusinessEntity): boolean {
  if (biz.supportAccess?.status !== 'approved') return false;
  if (!biz.supportAccess.expiresAt) return true;
  return new Date(biz.supportAccess.expiresAt).getTime() > Date.now();
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  businesses,
  databaseServices,
  stores,
  employees,
  products,
  platformUsers,
  subscriptionPlans,
  platformBillingGateways,
  subscriptionInvoices,
  currentUserEmail,
  onSwitchToBusiness,
  onCreateService,
  onUpdateService,
  onDeleteService,
  onRequestSupportAccess,
  onUpdateBusinessSubscription,
  onAddBranchToBusiness,
  onCreatePlatformUser,
  onUpdatePlatformUser,
  onUpdatePlans,
  onSaveBillingGateways,
  onPaySubscription,
  onOpenNewBusinessWizard,
}) => {
  const [section, setSection] = useState<SuperAdminSection>('overview');
  const [banner, setBanner] = useState('');

  // Businesses & Zero-Trust Access state
  const [bizSearch, setBizSearch] = useState('');
  const [bizStatusFilter, setBizStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [bizPage, setBizPage] = useState(1);
  const [expandedBizId, setExpandedBizId] = useState<string | null>(null);
  const [branchFormBizId, setBranchFormBizId] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  const [newBranchTill, setNewBranchTill] = useState('');

  // Support Request Modal state
  const [accessModalBiz, setAccessModalBiz] = useState<BusinessEntity | null>(null);
  const [accessReason, setAccessReason] = useState('eTIMS tax & POS register troubleshooting');
  const [accessDurationHours, setAccessDurationHours] = useState<number>(4);
  const [submittingAccess, setSubmittingAccess] = useState(false);

  // Software Users state
  const [userSearch, setUserSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | PlatformUserRecord['tier']>('all');
  const [userPage, setUserPage] = useState(1);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTier, setNewUserTier] = useState<PlatformUserRecord['tier']>('admin');
  const [newUserRole, setNewUserRole] = useState<PlatformUserRecord['role']>('Owner');
  const [newUserBizId, setNewUserBizId] = useState(businesses[0]?.id || '');

  // Subscriptions & Checkout state
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

  // Database Services management state
  const [svcSearch, setSvcSearch] = useState('');
  const [svcCatFilter, setSvcCatFilter] = useState<'all' | DatabaseSystemCategory>('all');
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcSlug, setNewSvcSlug] = useState('');
  const [newSvcCat, setNewSvcCat] = useState<DatabaseSystemCategory>('restaurant');
  const [newSvcCustomLabel, setNewSvcCustomLabel] = useState('');
  const [newSvcGroup, setNewSvcGroup] = useState('');
  const [newSvcRegion, setNewSvcRegion] = useState<DatabaseServiceInstance['region']>('ke-nairobi-1');
  const [newSvcOwnerName, setNewSvcOwnerName] = useState('');
  const [newSvcOwnerEmail, setNewSvcOwnerEmail] = useState('');
  const [creatingSvc, setCreatingSvc] = useState(false);

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

  const pendingAccessCount = businesses.filter(
    (b) => b.supportAccess?.status === 'pending_approval'
  ).length;
  const activeAccessCount = businesses.filter((b) => isSupportAccessActive(b)).length;

  // Filtered & paginated businesses (zero-trust search never searches masked PII unless approved)
  const filteredBusinesses = useMemo(() => {
    const q = bizSearch.trim().toLowerCase();
    return businesses.filter((b) => {
      const status = b.subscriptionStatus || 'active';
      if (bizStatusFilter !== 'all' && status !== bizStatusFilter) return false;
      if (!q) return true;
      const consented = isSupportAccessActive(b);
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.country.toLowerCase().includes(q) ||
        (consented && (b.ownerEmail || '').toLowerCase().includes(q))
      );
    });
  }, [businesses, bizSearch, bizStatusFilter]);

  const totalBizPages = Math.max(1, Math.ceil(filteredBusinesses.length / PAGE_SIZE));
  const safeBizPage = Math.min(bizPage, totalBizPages);
  const pagedBusinesses = filteredBusinesses.slice(
    (safeBizPage - 1) * PAGE_SIZE,
    safeBizPage * PAGE_SIZE
  );

  // Filtered & paginated users
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

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const pagedUsers = filteredUsers.slice(
    (safeUserPage - 1) * PAGE_SIZE,
    safeUserPage * PAGE_SIZE
  );

  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessModalBiz || !accessReason.trim()) return;
    setSubmittingAccess(true);
    try {
      await onRequestSupportAccess(accessModalBiz.id, accessReason.trim(), accessDurationHours);
      notify(
        `Support access request sent to ${accessModalBiz.name}'s Business Owner (${accessDurationHours}h window). Awaiting explicit approval.`
      );
      setAccessModalBiz(null);
    } finally {
      setSubmittingAccess(false);
    }
  };

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

  const navItems: Array<{
    id: SuperAdminSection;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    { id: 'overview', label: 'Control Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      id: 'businesses',
      label: 'Tenants & Branches',
      icon: <Building2 className="h-4 w-4" />,
      count: businesses.length,
    },
    {
      id: 'services',
      label: 'Database Services',
      icon: <Database className="h-4 w-4" />,
      count: databaseServices.length,
    },
    {
      id: 'access_requests',
      label: 'Privacy & Access Queue',
      icon: <Lock className="h-4 w-4" />,
      count: pendingAccessCount + activeAccessCount,
    },
    {
      id: 'users',
      label: 'Software Users',
      icon: <Users className="h-4 w-4" />,
      count: platformUsers.length,
    },
    {
      id: 'templates',
      label: 'Industry Templates',
      icon: <Layers className="h-4 w-4" />,
      count: BUSINESS_INDUSTRY_TEMPLATES.length,
    },
    {
      id: 'subscriptions',
      label: 'Plans & Invoices',
      icon: <Receipt className="h-4 w-4" />,
      count: subscriptionInvoices.length,
    },
    {
      id: 'payment_config',
      label: 'SaaS Billing Gateways',
      icon: <CreditCard className="h-4 w-4" />,
      count: enabledGatewaysCount,
    },
  ];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Scalable Enterprise SaaS Left Sidebar */}
      <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-3 lg:sticky lg:top-20 lg:w-64 dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-2 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400">
            <ShieldCheck className="h-4 w-4" />
            <span>MisafaRMS Control Plane</span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {currentUserEmail || 'misafatech@gmail.com'}
          </p>
        </div>

        <nav className="mt-2 flex flex-row gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active ? 'text-slate-300 dark:text-teal-100' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-3 hidden border-t border-slate-100 pt-3 lg:block dark:border-slate-800">
          <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-950/60 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
              <Lock className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              <span>Zero-Trust Tenant Privacy</span>
            </div>
            <p className="mt-1 leading-relaxed">
              Owner PII, tax IDs, and workspace sessions remain encrypted &amp; locked until the Business Owner approves your timed support request.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenNewBusinessWizard}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Onboard Business</span>
          </button>
        </div>
      </aside>

      {/* Main Scalable Control Area */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Sticky Action Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {navItems.find((n) => n.id === section)?.label}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enterprise Multi-Tenant Orchestration · {businesses.length} Tenants · {totalBranchesCount} Branches
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenNewBusinessWizard}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 lg:hidden dark:bg-teal-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Onboard</span>
            </button>
          </div>
        </header>

        {banner && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{banner}</span>
          </div>
        )}

        {/* VIEW 1: PLATFORM OVERVIEW */}
        {section === 'overview' && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Active Tenants &amp; Branches</span>
                  <Building2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {activeBusinessesCount}{' '}
                  <span className="text-sm font-normal text-slate-400">/ {businesses.length}</span>
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {totalBranchesCount}
                  </span>{' '}
                  branches provisioned
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
                  {subscriptionInvoices.filter((i) => i.status === 'paid').length} paid invoices
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Consent Grants</span>
                  <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {activeAccessCount}{' '}
                  <span className="text-sm font-normal text-slate-400">active</span>
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {pendingAccessCount} awaiting Owner approval
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Software Users</span>
                  <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {activeUsersCount}{' '}
                  <span className="text-sm font-normal text-slate-400">/ {platformUsers.length}</span>
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {enabledGatewaysCount} active SaaS billing rails
                </p>
              </div>
            </section>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Privacy &amp; Support Access Status
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSection('access_requests')}
                    className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
                  >
                    Manage Queue
                  </button>
                </div>
                <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {businesses.slice(0, 5).map((b) => {
                    const granted = isSupportAccessActive(b);
                    const pending = b.supportAccess?.status === 'pending_approval';
                    return (
                      <div key={b.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{b.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">
                            misafarms.com/{b.slug}
                          </p>
                        </div>
                        {granted ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <Unlock className="h-3 w-3" />
                            Approved
                          </span>
                        ) : pending ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            Pending Owner
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAccessModalBiz(b)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                          >
                            Request Access
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Recent Subscription Settlements
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSection('subscriptions')}
                    className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
                  >
                    View Ledger
                  </button>
                </div>
                <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                  {subscriptionInvoices.slice(0, 5).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {inv.businessName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {inv.invoiceNo} · {inv.planId}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {inv.currency} {inv.amount.toLocaleString()}
                        </p>
                        <p className="text-[11px] uppercase text-emerald-700 dark:text-emerald-400">
                          {inv.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* VIEW 2: TENANTS & ZERO-TRUST PRIVACY DIRECTORY */}
        {section === 'businesses' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={bizSearch}
                    onChange={(e) => {
                      setBizSearch(e.target.value);
                      setBizPage(1);
                    }}
                    placeholder="Search business name, slug, or country..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={bizStatusFilter}
                  onChange={(e) => {
                    setBizStatusFilter(e.target.value as 'all' | SubscriptionStatus);
                    setBizPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="past_due">Past Due</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                Page {safeBizPage} / {totalBizPages} · {filteredBusinesses.length} tenants
              </span>
            </div>

            <div className="space-y-3">
              {pagedBusinesses.map((biz) => {
                const consented = isSupportAccessActive(biz);
                const pending = biz.supportAccess?.status === 'pending_approval';
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
                          aria-label={`Toggle details for ${biz.name}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
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
                            {consented ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Unlock className="h-3 w-3" />
                                Consent Granted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <Lock className="h-3 w-3" />
                                Zero-Trust Masked
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {biz.serviceCode ? `${biz.serviceCode} · ` : ''}
                            {biz.systemCategory ? `${biz.systemCategory} · ` : ''}
                            {consented ? (
                              <>
                                Owner: {biz.ownerName || 'Admin'} ({biz.ownerEmail || 'owner@misafarms.com'}) · Tax PIN:{' '}
                                <span className="font-mono">{biz.taxPin}</span> · {biz.country} ({biz.currency})
                              </>
                            ) : (
                              <>
                                Owner PII &amp; KRA Tax ID masked — Private until Owner consent · {biz.country} ({biz.currency})
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Branches</span>
                          <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {bizBranches.length} / {branchLimit >= 999 ? '∞' : branchLimit}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Staff / SKUs</span>
                          <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {consented ? `${bizStaffCount} · ${bizSkuCount}` : 'Masked'}
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
                              {p.name} (KES {p.monthlyPriceKes.toLocaleString()})
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

                        {consented ? (
                          <button
                            type="button"
                            onClick={() => onSwitchToBusiness(biz.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                          >
                            <span>Enter Workspace</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : pending ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Pending Owner Approval</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAccessModalBiz(biz)}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-700 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-300"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Request Access</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Branches Drawer — Respects Zero-Trust Consent */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                        {!consented ? (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-2.5">
                              <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                  Branch registers, eTIMS serials, and personal details are protected
                                </p>
                                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                                  Request time-limited support consent from {biz.name}&apos;s Owner to inspect branch hardware or enter this workspace.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAccessModalBiz(biz)}
                              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                            >
                              Request Owner Consent
                            </button>
                          </div>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalBizPages > 1 && (
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={safeBizPage <= 1}
                  onClick={() => setBizPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="font-mono text-slate-500">
                  {safeBizPage} / {totalBizPages}
                </span>
                <button
                  type="button"
                  disabled={safeBizPage >= totalBizPages}
                  onClick={() => setBizPage((p) => Math.min(totalBizPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: PRIVACY & SUPPORT ACCESS REQUEST QUEUE */}
        {section === 'access_requests' && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Active &amp; Pending Tenant Privacy Access Sessions
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                All workspace entries by Super Admins require a logged reason and explicit Owner approval with an automatic TTL expiry.
              </p>

              <div className="mt-4 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                {businesses.map((biz) => {
                  const granted = isSupportAccessActive(biz);
                  const sa = biz.supportAccess;
                  return (
                    <div key={biz.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {biz.name}{' '}
                          <span className="font-mono text-[11px] font-normal text-slate-500">
                            (misafarms.com/{biz.slug})
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {sa?.reason
                            ? `Reason: "${sa.reason}" · Requested by ${sa.requestedByEmail || 'Super Admin'}`
                            : 'No active or pending support access request'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {granted ? (
                          <>
                            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                              Expires {sa?.expiresAt ? new Date(sa.expiresAt).toLocaleTimeString() : 'manual'}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSwitchToBusiness(biz.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                            >
                              <span>Enter Workspace</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </>
                        ) : sa?.status === 'pending_approval' ? (
                          <span className="rounded bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Awaiting Owner Approval ({sa.requestedDurationHours || 4}h)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAccessModalBiz(biz)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Request Consent</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* VIEW 4: SOFTWARE USERS DIRECTORY & PROVISIONING */}
        {section === 'users' && (
          <div className="space-y-5">
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

            <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    placeholder="Filter users by name, email, or tenant..."
                    className="w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <select
                    value={tierFilter}
                    onChange={(e) => {
                      setTierFilter(e.target.value as 'all' | PlatformUserRecord['tier']);
                      setUserPage(1);
                    }}
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
                  Page {safeUserPage} / {totalUserPages} · {filteredUsers.length} accounts
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
                    {pagedUsers.map((usr) => (
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

              {totalUserPages > 1 && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 text-xs dark:border-slate-800">
                  <button
                    type="button"
                    disabled={safeUserPage <= 1}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 px-2.5 py-1 disabled:opacity-40 dark:border-slate-700"
                  >
                    Prev
                  </button>
                  <span className="font-mono text-slate-500">
                    {safeUserPage} / {totalUserPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeUserPage >= totalUserPages}
                    onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
                    className="rounded border border-slate-200 px-2.5 py-1 disabled:opacity-40 dark:border-slate-700"
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* VIEW 2B: DATABASE SERVICES CONTROL */}
        {section === 'services' && (
          <div className="space-y-5">
            {onCreateService && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newSvcName.trim()) return;
                  setCreatingSvc(true);
                  try {
                    const slugVal = (newSvcSlug || newSvcName)
                      .toLowerCase()
                      .replace(/[^a-z0-9-]+/g, '-')
                      .replace(/^-|-$/g, '')
                      .slice(0, 48);
                    await onCreateService({
                      displayName: newSvcName.trim(),
                      slug: slugVal,
                      systemCategory: newSvcCat,
                      customSystemLabel:
                        newSvcCat === 'custom' && newSvcCustomLabel.trim()
                          ? newSvcCustomLabel.trim()
                          : undefined,
                      parentGroupName: newSvcGroup.trim() || undefined,
                      templateId: newSvcCat,
                      region: newSvcRegion,
                      country: newSvcRegion === 'eu-west-2' ? 'GB' : 'KE',
                      currency: newSvcRegion === 'eu-west-2' ? 'GBP' : 'KES',
                      taxPin: 'P051900120K',
                      etimsEnabled: newSvcRegion !== 'eu-west-2',
                      branchName: 'HQ Branch',
                      branchLocation: newSvcRegion === 'eu-west-2' ? 'London' : 'Nairobi',
                      ownerName: newSvcOwnerName.trim() || 'Service Owner',
                      ownerEmail: newSvcOwnerEmail.trim() || `admin@${slugVal}.misafarms.com`,
                      ownerPin: '1234',
                      subscriptionPlan: 'Trial',
                      setupMode: 'starter',
                      ecommerceEnabled: true,
                    });
                    notify(`Provisioned Database Service "${newSvcName.trim()}" (${newSvcCat}).`);
                    setNewSvcName('');
                    setNewSvcSlug('');
                    setNewSvcCustomLabel('');
                    setNewSvcGroup('');
                    setNewSvcOwnerName('');
                    setNewSvcOwnerEmail('');
                  } finally {
                    setCreatingSvc(false);
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      Provision Business Database Service
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Spin up a dedicated vertical system (Restaurant, Hardware, Rentals, Supermarket, or Custom) for any tenant.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    type="text"
                    required
                    value={newSvcName}
                    onChange={(e) => {
                      setNewSvcName(e.target.value);
                      if (!newSvcSlug) {
                        setNewSvcSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]+/g, '-')
                            .replace(/^-|-$/g, '')
                        );
                      }
                    }}
                    placeholder="Service / Business Name"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={newSvcSlug}
                    onChange={(e) =>
                      setNewSvcSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))
                    }
                    placeholder="Domain slug (misafarms.com/...)"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <select
                    value={newSvcCat}
                    onChange={(e) => setNewSvcCat(e.target.value as DatabaseSystemCategory)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="restaurant">System: Restaurant &amp; Dining</option>
                    <option value="hardware">System: Hardware &amp; Timber</option>
                    <option value="rentals">System: Rentals &amp; Leasing</option>
                    <option value="supermarket">System: Supermarket &amp; Retail</option>
                    <option value="pharmacy">System: Pharmacy &amp; Clinic</option>
                    <option value="fashion">System: Fashion &amp; Apparel</option>
                    <option value="electronics">System: Electronics &amp; Tech</option>
                    <option value="salon">System: Salon &amp; Spa</option>
                    <option value="wholesale">System: Wholesale Depot</option>
                    <option value="custom">System: Custom Vertical</option>
                  </select>
                  <select
                    value={newSvcRegion}
                    onChange={(e) =>
                      setNewSvcRegion(e.target.value as DatabaseServiceInstance['region'])
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ke-nairobi-1">Region: Nairobi (ke-nairobi-1)</option>
                    <option value="af-south-1">Region: Cape Town (af-south-1)</option>
                    <option value="eu-west-2">Region: London (eu-west-2)</option>
                  </select>
                  {newSvcCat === 'custom' && (
                    <input
                      type="text"
                      required
                      value={newSvcCustomLabel}
                      onChange={(e) => setNewSvcCustomLabel(e.target.value)}
                      placeholder="Custom system type (e.g. Auto Garage)"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  )}
                  <input
                    type="text"
                    value={newSvcGroup}
                    onChange={(e) => setNewSvcGroup(e.target.value)}
                    placeholder="Parent Group (optional)"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={newSvcOwnerName}
                    onChange={(e) => setNewSvcOwnerName(e.target.value)}
                    placeholder="Owner Name"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="email"
                    value={newSvcOwnerEmail}
                    onChange={(e) => setNewSvcOwnerEmail(e.target.value)}
                    placeholder="Owner Email"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    disabled={creatingSvc}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{creatingSvc ? 'Provisioning...' : 'Add Database Service'}</span>
                  </button>
                </div>
              </form>
            )}

            <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    All Platform Database Services ({databaseServices.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage service engines across businesses. Entering a tenant workspace still requires Owner Zero-Trust consent.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={svcSearch}
                      onChange={(e) => setSvcSearch(e.target.value)}
                      placeholder="Filter services..."
                      className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <select
                    value={svcCatFilter}
                    onChange={(e) =>
                      setSvcCatFilter(e.target.value as 'all' | DatabaseSystemCategory)
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="all">All Systems</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="hardware">Hardware</option>
                    <option value="rentals">Rentals</option>
                    <option value="supermarket">Supermarket</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-2.5">Service</th>
                      <th className="px-5 py-2.5">System Vertical</th>
                      <th className="px-5 py-2.5">Domain</th>
                      <th className="px-5 py-2.5">Region &amp; Nodes</th>
                      <th className="px-5 py-2.5">Engine Status</th>
                      <th className="px-5 py-2.5 text-right">Connect / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {databaseServices
                      .filter((svc) => {
                        if (svcCatFilter !== 'all' && svc.systemCategory !== svcCatFilter) return false;
                        const q = svcSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          svc.displayName.toLowerCase().includes(q) ||
                          svc.serviceCode.toLowerCase().includes(q) ||
                          svc.slug.toLowerCase().includes(q) ||
                          (svc.parentGroupName || '').toLowerCase().includes(q)
                        );
                      })
                      .map((svc) => {
                        const biz = businesses.find((b) => b.id === svc.businessId);
                        const consented = biz ? isSupportAccessActive(biz) : false;
                        const branchCount = stores.filter((st) => st.businessId === svc.businessId).length;
                        return (
                          <tr key={svc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {svc.displayName}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500">
                                {svc.serviceCode}
                                {svc.parentGroupName ? ` · ${svc.parentGroupName}` : ''}
                              </p>
                            </td>
                            <td className="px-5 py-3 capitalize text-slate-700 dark:text-slate-300">
                              {svc.systemCategory === 'custom' && svc.customSystemLabel
                                ? svc.customSystemLabel
                                : svc.systemCategory}
                            </td>
                            <td className="px-5 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              misafarms.com/{svc.slug}
                            </td>
                            <td className="px-5 py-3 font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
                              {svc.region} · {branchCount} branch{branchCount === 1 ? '' : 'es'}
                            </td>
                            <td className="px-5 py-3">
                              {onUpdateService ? (
                                <select
                                  aria-label={`Engine status for ${svc.displayName}`}
                                  value={svc.engineStatus}
                                  onChange={async (e) => {
                                    const next = e.target.value as DatabaseServiceInstance['engineStatus'];
                                    await onUpdateService(svc.id, { engineStatus: next });
                                    notify(`Updated ${svc.serviceCode} engine status -> ${next}.`);
                                  }}
                                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <option value="online">Online</option>
                                  <option value="maintenance">Maintenance</option>
                                  <option value="suspended">Suspended</option>
                                </select>
                              ) : (
                                <span className="capitalize">{svc.engineStatus}</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {biz && consented ? (
                                  <button
                                    type="button"
                                    onClick={() => onSwitchToBusiness(biz.id)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                                  >
                                    <PlugZap className="h-3 w-3" />
                                    <span>Connect</span>
                                  </button>
                                ) : biz ? (
                                  <button
                                    type="button"
                                    onClick={() => setAccessModalBiz(biz)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-teal-700 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-300"
                                  >
                                    <Lock className="h-3 w-3" />
                                    <span>Request Connect</span>
                                  </button>
                                ) : null}
                                {onDeleteService && databaseServices.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await onDeleteService(svc.id);
                                      notify(`Removed Database Service ${svc.serviceCode}.`);
                                    }}
                                    title="Decommission service"
                                    className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 5: READY-MADE INDUSTRY TEMPLATES CATALOG */}
        {section === 'templates' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {BUSINESS_INDUSTRY_TEMPLATES.map((tpl) => {
              const activeTenantsUsing = businesses.filter((b) => b.templateId === tpl.id).length;
              return (
                <div
                  key={tpl.id}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {tpl.name}
                      </h2>
                      <p className="text-xs text-teal-700 dark:text-teal-400">{tpl.tagline}</p>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-500">
                      {activeTenantsUsing} tenant{activeTenantsUsing === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{tpl.description}</p>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    <div>Modules: {tpl.installedModuleIds.length}</div>
                    <div>Layout: {tpl.layoutConfig.layoutMode}</div>
                    <div>Categories: {tpl.catalogTaxonomy.length}</div>
                    <div>Starter SKUs: {tpl.starterProducts.length}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 6: SUBSCRIPTIONS & INVOICES */}
        {section === 'subscriptions' && (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    SaaS Subscription Plans &amp; Branch Quotas
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
                      <th className="px-5 py-2.5 font-medium">Plan &amp; Period</th>
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

        {/* VIEW 7: SAAS PAYMENT GATEWAYS CONFIG */}
        {section === 'payment_config' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  SaaS Subscription Payment Gateways Configuration
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Integrate and manage Paybills, Tills, Card processors, and Bank EFT rails businesses pay subscriptions with. Secret keys are write-only and stored strictly server-side.
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
                  <option value="Card & Mobile">Card &amp; Mobile</option>
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

      {/* Zero-Trust Support Access Request Modal */}
      {accessModalBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Request Tenant Support Access
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAccessModalBiz(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAccessRequest} className="mt-4 space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Request time-limited diagnostic access for <strong>{accessModalBiz.name}</strong> (
                <span className="font-mono">misafarms.com/{accessModalBiz.slug}</span>). Personal details and workspace navigation stay locked until the Business Owner clicks Approve.
              </p>

              <label className="block">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Support Reason (Shown to Business Owner)
                </span>
                <input
                  type="text"
                  required
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Access Duration Window
                </span>
                <select
                  value={accessDurationHours}
                  onChange={(e) => setAccessDurationHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={2}>2 Hours (Quick Fix)</option>
                  <option value={4}>4 Hours (Standard Support)</option>
                  <option value={24}>24 Hours (Migration / Setup)</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccessModalBiz(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAccess}
                  className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {submittingAccess ? 'Sending Request...' : 'Send Consent Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
