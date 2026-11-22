import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { X } from 'lucide-react';
import { AccountingWorkspace } from './components/AccountingWorkspace';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AppLauncher } from './components/AppLauncher';
import { BackupRestoreWorkspace } from './components/BackupRestoreWorkspace';
import { CrmWorkspace } from './components/CrmWorkspace';
import { EcommerceDomainWorkspace } from './components/EcommerceDomainWorkspace';
import { EnterpriseGovernanceView } from './components/EnterpriseGovernanceView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EtimsComplianceView } from './components/EtimsComplianceView';
import { FieldAgentView } from './components/FieldAgentView';
import { InvoicingWorkspace } from './components/InvoicingWorkspace';
import { LandingPage } from './components/LandingPage';
import { ModuleWorkspace } from './components/ModuleWorkspace';
import { OnboardingWizardModal } from './components/OnboardingWizardModal';
import { OnlineOrdersWorkspace } from './components/OnlineOrdersWorkspace';
import { PaymentGatewaysView } from './components/PaymentGatewaysView';
import { PosAdminConsole } from './components/PosAdminConsole';
import { PosTerminal } from './components/PosTerminal';
import { StudioView } from './components/StudioView';
import { SuperAdminView } from './components/SuperAdminView';
import { PrimaryWorkspaceTab, TopBar } from './components/TopBar';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { APP_MODULES } from './data/modulesRegistry';
import {
  DEFAULT_PLATFORM_BILLING_GATEWAYS,
  DEFAULT_SUBSCRIPTION_PLANS,
  SEED_ATTENDANCE_LOGS,
  SEED_AUDIT_LOGS,
  SEED_AUTOMATIONS,
  SEED_BACKUPS,
  SEED_BUSINESSES,
  SEED_CRM_LEADS,
  SEED_EMPLOYEES,
  SEED_ERP_RECORDS,
  SEED_INVOICES,
  SEED_ONLINE_ORDERS,
  SEED_PAYROLL_RUNS,
  SEED_PLATFORM_USERS,
  SEED_PRODUCTS,
  SEED_STORES,
  SEED_STUDIO_MODELS,
  SEED_SUBSCRIPTION_INVOICES,
  SEED_TRANSACTIONS,
} from './data/seedData';
import {
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  handleFirestoreError,
  onAuthStateChanged,
  OperationType,
  query,
  setDoc,
  signInWithGoogle,
  signOutFirebase,
  where,
} from './lib/firebase';
import {
  AccountTier,
  AppModuleMeta,
  AuditLogEntry,
  BackupSnapshot,
  BusinessEntity,
  BusinessLayoutConfig,
  CategoryGroup,
  CrmCustomerLead,
  EmployeePermissionSet,
  EmployeeRecord,
  ErpRecord,
  OnlineOrder,
  OnlineOrderFulfillmentStatus,
  PaymentGatewayConfig,
  PaymentMethod,
  PayrollRunRecord,
  PlatformBillingGateway,
  PlatformUserRecord,
  PosCustomizationConfig,
  ProductItem,
  PromoOffer,
  SaleTransaction,
  ShiftAttendanceLog,
  SlotStatus,
  StoreBranch,
  StudioField,
  StudioModel,
  SubscriptionInvoice,
  SubscriptionPlanId,
  SubscriptionPlanTier,
  SubscriptionStatus,
  TaxCode,
  TaxInvoiceRecord,
  UserRole,
  WorkflowAutomation,
} from './types/erp';
import { decryptOfflinePayload, encryptOfflinePayload } from './utils/cryptoSync';

const OFFLINE_QUEUE_STORAGE = 'misafarms_encrypted_offline_queue_v1';
const POS_BINDING_STORAGE = 'misafarms_pos_binding_v1';

const NON_BUSINESS_PATH_PREFIXES = new Set([
  'pos',
  'api',
  'assets',
  'super-admin',
  'superadmin',
  'admin',
  'apps',
  'etims',
  'analytics',
  'manifest.webmanifest',
  'sw.js',
]);

function detectDedicatedPosEntry(): {
  isPosOnly: boolean;
  isSuperAdminPath: boolean;
  isShopPath: boolean;
  bizSlug: string | null;
  storeId: string | null;
} {
  if (typeof window === 'undefined') {
    return { isPosOnly: false, isSuperAdminPath: false, isShopPath: false, bizSlug: null, storeId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/');
  const firstSegment = segments[0]?.toLowerCase() || '';
  const secondSegment = segments[1]?.toLowerCase() || '';

  const isPosPath = pathname === '/pos' || pathname.startsWith('/pos/');
  const isPosQuery = params.get('pos') === '1';
  const isSuperAdminPath = firstSegment === 'super-admin' || firstSegment === 'superadmin';
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const isPosOnly = isPosPath || isPosQuery || isStandalone;
  let bizSlug = params.get('biz');
  let storeId = params.get('store');

  if (!isPosOnly && firstSegment && !NON_BUSINESS_PATH_PREFIXES.has(firstSegment)) {
    bizSlug = firstSegment;
  }
  const isShopPath = Boolean(
    !isPosOnly && firstSegment && !NON_BUSINESS_PATH_PREFIXES.has(firstSegment) && secondSegment === 'shop'
  );

  if (isPosOnly && (bizSlug || storeId)) {
    try {
      window.localStorage.setItem(
        POS_BINDING_STORAGE,
        JSON.stringify({ bizSlug, storeId })
      );
    } catch {
      // Ignore storage error
    }
  } else if (isPosOnly && !bizSlug && !storeId) {
    try {
      const saved = window.localStorage.getItem(POS_BINDING_STORAGE);
      if (saved) {
        const parsed = JSON.parse(saved) as { bizSlug?: string; storeId?: string };
        bizSlug = parsed.bizSlug || null;
        storeId = parsed.storeId || null;
      }
    } catch {
      // Ignore parse error
    }
  }

  return { isPosOnly, isSuperAdminPath, isShopPath, bizSlug, storeId };
}

interface QueuedOfflineCheckout {
  id: string;
  receiptNo: string;
  businessId: string;
  storeId: string;
  cashierRole: UserRole;
  cashierName: string;
  customerName: string;
  customerPin: string;
  customerPhone: string;
  customerEmail?: string;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  amountTendered: number;
  offerName?: string;
  offerDiscount?: number;
  tipAmount?: number;
  slotId?: string;
  tableOrSlotLabel?: string;
  channel: 'POS' | 'Field Agent' | 'Restaurant';
  lines: Array<{ productId: string; qty: number; discountPct: number }>;
  createdAt: string;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

function MisafaWorkspaceApp() {
  const initialEntry = useMemo(() => detectDedicatedPosEntry(), []);
  const initialPosShortcut = initialEntry.isPosOnly;

  const initialMatchedBiz = useMemo(() => {
    if (!initialEntry.bizSlug) return SEED_BUSINESSES[0];
    return (
      SEED_BUSINESSES.find(
        (b) => b.slug.toLowerCase() === initialEntry.bizSlug!.toLowerCase()
      ) || SEED_BUSINESSES[0]
    );
  }, [initialEntry.bizSlug]);

  const initialMatchedStore = useMemo(() => {
    if (initialEntry.storeId) {
      const found = SEED_STORES.find(
        (s) => s.id === initialEntry.storeId && s.businessId === initialMatchedBiz.id
      );
      if (found) return found;
    }
    return SEED_STORES.find((s) => s.businessId === initialMatchedBiz.id) || SEED_STORES[0];
  }, [initialEntry.storeId, initialMatchedBiz.id]);

  const initialPathMatchesBiz = useMemo(() => {
    if (!initialEntry.bizSlug || initialPosShortcut) return false;
    return SEED_BUSINESSES.some(
      (b) => b.slug.toLowerCase() === initialEntry.bizSlug!.toLowerCase()
    );
  }, [initialEntry.bizSlug, initialPosShortcut]);

  const [showLanding, setShowLanding] = useState(
    !initialPosShortcut && !initialEntry.isSuperAdminPath && !initialPathMatchesBiz && !initialEntry.isShopPath
  );
  const [posKioskMode, setPosKioskMode] = useState(initialPosShortcut);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authBanner, setAuthBanner] = useState('');

  const [businesses, setBusinesses] = useState<BusinessEntity[]>(SEED_BUSINESSES);
  const [stores, setStores] = useState<StoreBranch[]>(SEED_STORES);
  const [employees, setEmployees] = useState<EmployeeRecord[]>(SEED_EMPLOYEES);
  const [products, setProducts] = useState<ProductItem[]>(SEED_PRODUCTS);
  const [transactions, setTransactions] = useState<SaleTransaction[]>(SEED_TRANSACTIONS);
  const [invoices, setInvoices] = useState<TaxInvoiceRecord[]>(SEED_INVOICES);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>(SEED_ONLINE_ORDERS);
  const [crmLeads, setCrmLeads] = useState<CrmCustomerLead[]>(SEED_CRM_LEADS);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunRecord[]>(SEED_PAYROLL_RUNS);
  const [backups, setBackups] = useState<BackupSnapshot[]>(SEED_BACKUPS);
  const [studioModels, setStudioModels] = useState<StudioModel[]>(SEED_STUDIO_MODELS);
  const [automations, setAutomations] = useState<WorkflowAutomation[]>(SEED_AUTOMATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);
  const [erpRecords, setErpRecords] = useState<ErpRecord[]>(SEED_ERP_RECORDS);
  const [attendanceLogs, setAttendanceLogs] = useState<ShiftAttendanceLog[]>(SEED_ATTENDANCE_LOGS);
  const [platformUsers, setPlatformUsers] = useState<PlatformUserRecord[]>(SEED_PLATFORM_USERS);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanTier[]>(
    DEFAULT_SUBSCRIPTION_PLANS
  );
  const [platformBillingGateways, setPlatformBillingGateways] = useState<
    PlatformBillingGateway[]
  >(DEFAULT_PLATFORM_BILLING_GATEWAYS);
  const [subscriptionInvoices, setSubscriptionInvoices] = useState<SubscriptionInvoice[]>(
    SEED_SUBSCRIPTION_INVOICES
  );

  const [activeBusinessId, setActiveBusinessId] = useState<string>(initialMatchedBiz.id);
  const [activeStoreId, setActiveStoreId] = useState<string>(initialMatchedStore.id);
  const [accountTier, setAccountTier] = useState<AccountTier>(
    initialPosShortcut ? 'employee' : 'admin'
  );
  const [activeRole, setActiveRole] = useState<UserRole>(
    initialPosShortcut ? 'Cashier' : 'Owner'
  );
  const [activeEmployee, setActiveEmployee] = useState<EmployeeRecord | null>(SEED_EMPLOYEES[0]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const [topTab, setTopTab] = useState<PrimaryWorkspaceTab>(
    initialPosShortcut ? 'pos' : initialEntry.isSuperAdminPath ? 'super_admin' : 'apps'
  );
  const [selectedModule, setSelectedModule] = useState<AppModuleMeta | null>(() =>
    initialEntry.isShopPath
      ? APP_MODULES.find((m) => m.id === 'ecommerce') || null
      : null
  );
  const [crmLeadDraft, setCrmLeadDraft] = useState<CrmCustomerLead | null>(null);

  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [encryptedOfflineQueue, setEncryptedOfflineQueue] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  const [newBranchTill, setNewBranchTill] = useState('');
  const [syncBanner, setSyncBanner] = useState('');

  // Ensure Firestore user account & hydrate all owned cloud businesses and subcollections upon Google Sign-In
  useEffect(() => {
    const mergeById = <T extends { id: string }>(
      prev: T[],
      incoming: T[],
      prependNew = false
    ): T[] => {
      const byId = new Map(prev.map((item) => [item.id, item]));
      for (const item of incoming) byId.set(item.id, item);
      if (prependNew) {
        const incomingIds = new Set(incoming.map((x) => x.id));
        return [...incoming, ...prev.filter((x) => !incomingIds.has(x.id))];
      }
      return Array.from(byId.values());
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || !user.emailVerified) return;

      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        const now = new Date().toISOString();
        if (!snap.exists()) {
          const isBootstrappedAdmin = user.email === 'misafatech@gmail.com';
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Misafa User',
            accountType: isBootstrappedAdmin ? 'admin' : 'admin',
            activeBusinessId: initialMatchedBiz.id,
            createdAt: now,
            updatedAt: now,
          });
          await setDoc(doc(db, 'users', user.uid, 'private', 'profile'), {
            uid: user.uid,
            email: user.email || `${user.uid}@misafarms.com`,
            updatedAt: now,
          });
        } else {
          const data = snap.data();
          if (
            data?.accountType === 'admin' ||
            data?.accountType === 'employee' ||
            data?.accountType === 'user'
          ) {
            setAccountTier(data.accountType);
          }
        }

        // Load all Firestore businesses owned by this signed-in user & their subcollections
        const bizQuery = query(
          collection(db, 'businesses'),
          where('ownerId', '==', user.uid)
        );
        const bizSnap = await getDocs(bizQuery);
        if (!bizSnap.empty) {
          const cloudBusinesses = bizSnap.docs.map((d) => d.data() as BusinessEntity);
          setBusinesses((prev) => mergeById(prev, cloudBusinesses));

          let primaryCloudStoreId: string | undefined;
          let primaryCloudEmp: EmployeeRecord | undefined;

          for (const cb of cloudBusinesses) {
            const [
              stSnap,
              empSnap,
              prodSnap,
              txSnap,
              invSnap,
              ordSnap,
              leadSnap,
              paySnap,
              bkpSnap,
            ] = await Promise.all([
              getDocs(collection(db, 'businesses', cb.id, 'stores')),
              getDocs(collection(db, 'businesses', cb.id, 'employees')),
              getDocs(collection(db, 'businesses', cb.id, 'products')),
              getDocs(collection(db, 'businesses', cb.id, 'transactions')),
              getDocs(collection(db, 'businesses', cb.id, 'invoices')),
              getDocs(collection(db, 'businesses', cb.id, 'onlineOrders')),
              getDocs(collection(db, 'businesses', cb.id, 'crmLeads')),
              getDocs(collection(db, 'businesses', cb.id, 'payrollRuns')),
              getDocs(collection(db, 'businesses', cb.id, 'backups')),
            ]);

            if (!stSnap.empty) {
              const cloudStores = stSnap.docs.map((d) => d.data() as StoreBranch);
              setStores((prev) => mergeById(prev, cloudStores));
              if (!primaryCloudStoreId && cb.id === cloudBusinesses[0].id) {
                primaryCloudStoreId = cloudStores[0].id;
              }
            }
            if (!empSnap.empty) {
              const cloudEmps = empSnap.docs.map((d) => d.data() as EmployeeRecord);
              setEmployees((prev) => mergeById(prev, cloudEmps));
              if (!primaryCloudEmp && cb.id === cloudBusinesses[0].id) {
                primaryCloudEmp = cloudEmps[0];
              }
            }
            if (!prodSnap.empty) {
              setProducts((prev) =>
                mergeById(prev, prodSnap.docs.map((d) => d.data() as ProductItem))
              );
            }
            if (!txSnap.empty) {
              setTransactions((prev) =>
                mergeById(prev, txSnap.docs.map((d) => d.data() as SaleTransaction), true)
              );
            }
            if (!invSnap.empty) {
              setInvoices((prev) =>
                mergeById(prev, invSnap.docs.map((d) => d.data() as TaxInvoiceRecord), true)
              );
            }
            if (!ordSnap.empty) {
              setOnlineOrders((prev) =>
                mergeById(prev, ordSnap.docs.map((d) => d.data() as OnlineOrder), true)
              );
            }
            if (!leadSnap.empty) {
              setCrmLeads((prev) =>
                mergeById(prev, leadSnap.docs.map((d) => d.data() as CrmCustomerLead), true)
              );
            }
            if (!paySnap.empty) {
              setPayrollRuns((prev) =>
                mergeById(prev, paySnap.docs.map((d) => d.data() as PayrollRunRecord), true)
              );
            }
            if (!bkpSnap.empty) {
              setBackups((prev) =>
                mergeById(prev, bkpSnap.docs.map((d) => d.data() as BackupSnapshot), true)
              );
            }
          }

          // Focus the signed-in user's real business unless explicitly browsing Savannah demo
          if (
            !initialPosShortcut &&
            !initialEntry.isSuperAdminPath &&
            initialEntry.bizSlug !== 'misafatech'
          ) {
            const firstOwned = cloudBusinesses[0];
            setActiveBusinessId((cur) => (cur === 'biz-savannah' ? firstOwned.id : cur));
            if (primaryCloudStoreId) {
              setActiveStoreId((cur) => (cur === 'store-nbo-01' ? primaryCloudStoreId! : cur));
            }
            if (primaryCloudEmp) {
              setActiveEmployee(primaryCloudEmp);
            }
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    });
    return () => unsub();
  }, [initialEntry.bizSlug, initialEntry.isSuperAdminPath, initialMatchedBiz.id, initialPosShortcut]);

  // Load workspace from Express backend & restore encrypted offline queue
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const res = await fetch('/api/workspace');
        if (res.ok) {
          const data = await res.json();
          setBusinesses(data.businesses);
          setStores(data.stores);
          if (Array.isArray(data.employees)) setEmployees(data.employees);
          setProducts(data.products);
          setTransactions(data.transactions);
          if (Array.isArray(data.invoices)) setInvoices(data.invoices);
          if (Array.isArray(data.onlineOrders)) setOnlineOrders(data.onlineOrders);
          if (Array.isArray(data.crmLeads)) setCrmLeads(data.crmLeads);
          if (Array.isArray(data.payrollRuns)) setPayrollRuns(data.payrollRuns);
          if (Array.isArray(data.backups)) setBackups(data.backups);
          setStudioModels(data.studioModels);
          setAutomations(data.automations);
          setAuditLogs(data.auditLogs);
          setErpRecords(data.erpRecords);
          if (Array.isArray(data.attendanceLogs)) setAttendanceLogs(data.attendanceLogs);
          if (Array.isArray(data.platformUsers)) setPlatformUsers(data.platformUsers);
          if (Array.isArray(data.subscriptionPlans)) setSubscriptionPlans(data.subscriptionPlans);
          if (Array.isArray(data.platformBillingGateways)) {
            setPlatformBillingGateways(data.platformBillingGateways);
          }
          if (Array.isArray(data.subscriptionInvoices)) {
            setSubscriptionInvoices(data.subscriptionInvoices);
          }

          if (initialEntry.bizSlug) {
            const matchedBiz = (data.businesses as BusinessEntity[]).find(
              (b) => b.slug.toLowerCase() === initialEntry.bizSlug!.toLowerCase()
            );
            if (matchedBiz) {
              setActiveBusinessId(matchedBiz.id);
              if (!initialPosShortcut) setShowLanding(false);
              const matchedStore = (data.stores as StoreBranch[]).find(
                (s) =>
                  s.businessId === matchedBiz.id &&
                  (!initialEntry.storeId || s.id === initialEntry.storeId)
              );
              if (matchedStore) setActiveStoreId(matchedStore.id);
              const matchedEmp = (data.employees as EmployeeRecord[] | undefined)?.find(
                (e) => e.businessId === matchedBiz.id
              );
              setActiveEmployee(matchedEmp || null);
              if (initialEntry.isShopPath) {
                const ecomMod = APP_MODULES.find((m) => m.id === 'ecommerce');
                if (ecomMod) setSelectedModule(ecomMod);
              }
            }
          }
        }
      } catch {
        // Fallback cleanly to seeded state when offline
      }
    };
    loadWorkspace();

    try {
      const savedQueue = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE);
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue);
        if (Array.isArray(parsed)) setEncryptedOfflineQueue(parsed);
      }
    } catch {
      // Ignore storage parse failure
    }
  }, [initialEntry.bizSlug, initialEntry.isShopPath, initialEntry.storeId, initialPosShortcut]);

  // Initialize in-memory bearer session on role/auth switch
  useEffect(() => {
    if (isOffline) return;
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: activeEmployee?.name || 'Amina Hassan',
        role: activeRole,
        email: firebaseUser?.email || '',
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.token) setSessionToken(data.token);
      })
      .catch(() => {});
  }, [activeRole, activeEmployee?.name, firebaseUser?.email, isOffline]);

  // Listen to browser online/offline events
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Sync Tailwind dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === activeBusinessId) || businesses[0],
    [businesses, activeBusinessId]
  );

  const businessStores = useMemo(
    () => stores.filter((s) => s.businessId === activeBusiness.id),
    [stores, activeBusiness.id]
  );

  const activeStore = useMemo(
    () => businessStores.find((s) => s.id === activeStoreId) || businessStores[0],
    [businessStores, activeStoreId]
  );

  useEffect(() => {
    if (initialPosShortcut || (!selectedModule && topTab === 'pos')) {
      document.title = `${activeBusiness.name} — POS Register (${activeStore.registerId})`;
    } else {
      document.title = 'MisafaRMS — Enterprise Retail Management & Kenya eTIMS ERP';
    }
  }, [initialPosShortcut, selectedModule, topTab, activeBusiness.name, activeStore.registerId]);

  const businessEmployees = useMemo(
    () => employees.filter((e) => e.businessId === activeBusiness.id),
    [employees, activeBusiness.id]
  );

  const businessProducts = useMemo(
    () => products.filter((p) => p.businessId === activeBusiness.id),
    [products, activeBusiness.id]
  );

  const businessTransactions = useMemo(
    () => transactions.filter((t) => t.businessId === activeBusiness.id),
    [transactions, activeBusiness.id]
  );

  const businessInvoices = useMemo(
    () => invoices.filter((i) => i.businessId === activeBusiness.id),
    [invoices, activeBusiness.id]
  );

  const businessOnlineOrders = useMemo(
    () => onlineOrders.filter((o) => o.businessId === activeBusiness.id),
    [onlineOrders, activeBusiness.id]
  );

  const businessCrmLeads = useMemo(
    () => crmLeads.filter((l) => l.businessId === activeBusiness.id),
    [crmLeads, activeBusiness.id]
  );

  const businessPayrollRuns = useMemo(
    () => payrollRuns.filter((r) => r.businessId === activeBusiness.id),
    [payrollRuns, activeBusiness.id]
  );

  const businessBackups = useMemo(
    () => backups.filter((b) => !b.businessId || b.businessId === activeBusiness.id),
    [backups, activeBusiness.id]
  );

  const businessErpRecords = useMemo(
    () => erpRecords.filter((r) => r.businessId === activeBusiness.id),
    [erpRecords, activeBusiness.id]
  );

  const businessAttendanceLogs = useMemo(
    () => attendanceLogs.filter((l) => l.businessId === activeBusiness.id),
    [attendanceLogs, activeBusiness.id]
  );

  const handleSelectBusiness = (bizId: string) => {
    setActiveBusinessId(bizId);
    const biz = businesses.find((b) => b.id === bizId);
    if (biz && !initialPosShortcut && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/${biz.slug}`);
    }
    const firstStore = stores.find((s) => s.businessId === bizId);
    if (firstStore) setActiveStoreId(firstStore.id);
    const firstEmp = employees.find((e) => e.businessId === bizId);
    setActiveEmployee(firstEmp || null);
  };

  const handleSelectAccountTier = (tier: AccountTier) => {
    setAccountTier(tier);
    if (tier === 'user') {
      setTopTab('apps');
      if (selectedModule && !selectedModule.portalVisible) {
        setSelectedModule(null);
      }
    } else if (tier === 'employee') {
      if (activeRole === 'Owner') setActiveRole('Cashier');
      if (selectedModule?.adminOnly || topTab === 'super_admin') {
        setSelectedModule(null);
        setTopTab('apps');
      }
    } else {
      setActiveRole('Owner');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      setFirebaseUser(user);
      setShowLanding(false);
      setAuthBanner(`Signed in to Firebase Cloud Sync as ${user.email}`);
      setTimeout(() => setAuthBanner(''), 4500);
    } catch (err) {
      setAuthBanner(err instanceof Error ? err.message : 'Google sign-in was cancelled.');
      setTimeout(() => setAuthBanner(''), 4500);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutFirebase();
    setFirebaseUser(null);
    setAuthBanner('Signed out of Firebase Cloud Sync.');
    setTimeout(() => setAuthBanner(''), 3500);
  };

  const syncBusinessDocToCloud = useCallback(
    async (biz: BusinessEntity) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      const bizRef = doc(db, 'businesses', biz.id);
      try {
        const existing = await getDoc(bizRef);
        const ownerId = existing.exists()
          ? (existing.data().ownerId as string)
          : firebaseUser.uid;
        if (
          existing.exists() &&
          ownerId !== firebaseUser.uid &&
          firebaseUser.email !== 'misafatech@gmail.com'
        ) {
          return;
        }
        await setDoc(
          bizRef,
          stripUndefined({
            id: biz.id,
            ownerId,
            slug: biz.slug,
            name: biz.name,
            country: biz.country,
            currency: biz.currency,
            taxAuthority: biz.taxAuthority,
            taxPin: biz.taxPin,
            vatRate: biz.vatRate,
            etimsEnabled: biz.etimsEnabled,
            etimsMode: biz.etimsMode,
            paybillOrTill: biz.paybillOrTill,
            ecommerceEnabled: biz.ecommerceEnabled,
            customDomain: biz.customDomain,
            domainVerified: biz.domainVerified,
            dnsToken: biz.dnsToken,
            storefrontTagline: biz.storefrontTagline,
            deliveryFee: biz.deliveryFee,
            freeDeliveryAbove: biz.freeDeliveryAbove,
            storefrontPickupEnabled: biz.storefrontPickupEnabled,
            installedModuleIds: biz.installedModuleIds,
            posConfig: biz.posConfig,
            paymentGateways: biz.paymentGateways,
            layoutConfig: biz.layoutConfig,
            catalogTaxonomy: biz.catalogTaxonomy,
            offers: biz.offers,
            createdAt: biz.createdAt,
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `businesses/${biz.id}`);
      }
    },
    [firebaseUser]
  );

  const syncSubdocToCloud = useCallback(
    async (
      business: BusinessEntity,
      subcollection: string,
      docId: string,
      payload: Record<string, unknown>
    ) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      if (
        business.ownerId &&
        business.ownerId !== firebaseUser.uid &&
        firebaseUser.email !== 'misafatech@gmail.com'
      ) {
        return;
      }
      try {
        await setDoc(
          doc(db, 'businesses', business.id, subcollection, docId),
          stripUndefined({ ...payload, ownerId: business.ownerId || firebaseUser.uid }),
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `businesses/${business.id}/${subcollection}/${docId}`
        );
      }
    },
    [firebaseUser]
  );

  const deleteSubdocFromCloud = useCallback(
    async (business: BusinessEntity, subcollection: string, docId: string) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      if (
        business.ownerId &&
        business.ownerId !== firebaseUser.uid &&
        firebaseUser.email !== 'misafatech@gmail.com'
      ) {
        return;
      }
      try {
        await deleteDoc(doc(db, 'businesses', business.id, subcollection, docId));
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `businesses/${business.id}/${subcollection}/${docId}`
        );
      }
    },
    [firebaseUser]
  );

  const handleSyncOfflineQueue = useCallback(async () => {
    if (isOffline || encryptedOfflineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    try {
      const decryptedItems: QueuedOfflineCheckout[] = [];
      for (const cipher of encryptedOfflineQueue) {
        const decoded = await decryptOfflinePayload<QueuedOfflineCheckout>(cipher);
        if (decoded) decryptedItems.push(decoded);
      }
      if (decryptedItems.length === 0) return;

      const res = await fetch('/api/pos/sync-offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ transactions: decryptedItems }),
      });

      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        setAuditLogs(data.auditLogs);
        if (Array.isArray(data.erpRecords)) setErpRecords(data.erpRecords);
        setTransactions((prev) => {
          const syncedIds = new Set(data.synced.map((t: SaleTransaction) => t.id));
          const remaining = prev.filter((t) => !syncedIds.has(t.id));
          return [...data.synced, ...remaining];
        });
        setEncryptedOfflineQueue([]);
        window.localStorage.removeItem(OFFLINE_QUEUE_STORAGE);
        setSyncBanner(`Synced ${data.syncedCount} encrypted offline receipts to KRA eTIMS & cloud.`);
        setTimeout(() => setSyncBanner(''), 5000);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOffline, encryptedOfflineQueue, isSyncing, sessionToken]);

  useEffect(() => {
    if (!isOffline && encryptedOfflineQueue.length > 0) {
      handleSyncOfflineQueue();
    }
  }, [isOffline, encryptedOfflineQueue.length, handleSyncOfflineQueue]);

  const handleUnlockByPin = (pin: string): EmployeeRecord | null => {
    const match = businessEmployees.find((e) => e.active && e.pinCode === pin);
    if (!match) return null;
    setActiveEmployee(match);
    setActiveRole(match.role);
    return match;
  };

  const handleCheckout = async (payload: {
    lines: Array<{ productId: string; qty: number; discountPct: number }>;
    customerName: string;
    customerPin: string;
    customerPhone: string;
    customerEmail?: string;
    paymentMethod: PaymentMethod;
    paymentRef: string;
    amountTendered: number;
    offerName?: string;
    offerDiscount?: number;
    tipAmount?: number;
    slotId?: string;
    tableOrSlotLabel?: string;
    channel: 'POS' | 'Field Agent' | 'Restaurant';
  }): Promise<SaleTransaction | null> => {
    const requestPayload: QueuedOfflineCheckout = {
      id: `tx-off-${Date.now().toString(36)}`,
      receiptNo: `${activeStore.code.replace('-', '')}-OFF-${Date.now().toString().slice(-5)}`,
      businessId: activeBusiness.id,
      storeId: activeStore.id,
      cashierRole: activeRole,
      cashierName: activeEmployee?.name || 'Amina Hassan',
      customerName: payload.customerName,
      customerPin: payload.customerPin,
      customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      paymentMethod: payload.paymentMethod,
      paymentRef: payload.paymentRef,
      amountTendered: payload.amountTendered,
      offerName: payload.offerName,
      offerDiscount: payload.offerDiscount,
      tipAmount: payload.tipAmount,
      slotId: payload.slotId,
      tableOrSlotLabel: payload.tableOrSlotLabel,
      channel: payload.channel,
      lines: payload.lines,
      createdAt: new Date().toISOString(),
    };

    if (isOffline) {
      const cipher = await encryptOfflinePayload(requestPayload);
      const nextQueue = [...encryptedOfflineQueue, cipher];
      setEncryptedOfflineQueue(nextQueue);
      window.localStorage.setItem(OFFLINE_QUEUE_STORAGE, JSON.stringify(nextQueue));

      let subtotal = 0;
      let taxAmount = 0;
      const computedLines: SaleTransaction['lines'] = [];

      for (const l of payload.lines) {
        const prod = products.find((p) => p.id === l.productId);
        if (!prod) continue;
        const net = prod.price * l.qty * (1 - l.discountPct / 100);
        const vatFrac =
          prod.taxCode === 'B_16' ? activeBusiness.vatRate / (100 + activeBusiness.vatRate) : 0;
        subtotal += net;
        taxAmount += net * vatFrac;
        computedLines.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          qty: l.qty,
          unitPrice: prod.price,
          discountPct: l.discountPct,
          taxCode: prod.taxCode,
          lineTotal: Math.round(net * 100) / 100,
        });
      }

      const offerDiscount = Math.max(0, Math.min(subtotal, Number(payload.offerDiscount) || 0));
      const tipAmount = Math.max(0, Number(payload.tipAmount) || 0);
      const discountedSubtotal = Math.max(0, Math.round((subtotal - offerDiscount) * 100) / 100);
      const finalTotal = Math.round((discountedSubtotal + tipAmount) * 100) / 100;

      setProducts((prev) =>
        prev.map((p) => {
          const sold = payload.lines.find((l) => l.productId === p.id);
          if (!sold) return p;
          return {
            ...p,
            stockByStore: {
              ...p.stockByStore,
              [activeStore.id]: Math.max(0, (p.stockByStore[activeStore.id] ?? 0) - sold.qty),
            },
          };
        })
      );

      if (activeEmployee) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === activeEmployee.id
              ? {
                  ...e,
                  ordersHandled: (e.ordersHandled ?? 0) + 1,
                  tipsEarned: Math.round(((e.tipsEarned ?? 0) + tipAmount) * 100) / 100,
                }
              : e
          )
        );
      }

      if (payload.slotId && activeBusiness.layoutConfig?.autoMarkTableNeedsClearing) {
        setBusinesses((prev) =>
          prev.map((b) => {
            if (b.id !== activeBusiness.id || !b.layoutConfig) return b;
            return {
              ...b,
              layoutConfig: {
                ...b.layoutConfig,
                zones: b.layoutConfig.zones.map((z) =>
                  z.kind !== 'floor'
                    ? z
                    : {
                        ...z,
                        slots: z.slots.map((s) =>
                          s.id === payload.slotId
                            ? {
                                ...s,
                                status: 'needs_clearing',
                                activeOrderTotal: undefined,
                                lastUpdatedAt: new Date().toISOString(),
                              }
                            : s
                        ),
                      }
                ),
              },
            };
          })
        );
      }

      const offlineTx: SaleTransaction = {
        id: requestPayload.id,
        receiptNo: requestPayload.receiptNo,
        businessId: activeBusiness.id,
        storeId: activeStore.id,
        storeName: activeStore.name,
        cashierRole: activeRole,
        cashierName: requestPayload.cashierName,
        customerName: payload.customerName,
        customerPin: payload.customerPin || undefined,
        customerPhone: payload.customerPhone || undefined,
        customerEmail: payload.customerEmail,
        channel: payload.channel,
        paymentMethod: payload.paymentMethod,
        paymentRef: payload.paymentRef,
        currency: activeBusiness.currency,
        subtotal: discountedSubtotal,
        taxAmount: Math.round(taxAmount * 100) / 100,
        discountTotal: Math.round(offerDiscount * 100) / 100,
        offerName: payload.offerName,
        offerDiscount: offerDiscount > 0 ? offerDiscount : undefined,
        tipAmount: tipAmount > 0 ? tipAmount : undefined,
        tableOrSlotLabel: payload.tableOrSlotLabel,
        total: finalTotal,
        amountTendered: Math.max(finalTotal, payload.amountTendered),
        changeDue: Math.max(0, Math.round((payload.amountTendered - finalTotal) * 100) / 100),
        etimsCuin: 'PENDING-OFFLINE-SYNC',
        etimsStatus: 'Queued Offline',
        etimsQrData: 'https://etims.kra.go.ke/verify?status=queued',
        lines: computedLines,
        createdAt: requestPayload.createdAt,
        encryptedOffline: true,
      };

      setTransactions((prev) => [offlineTx, ...prev]);
      return offlineTx;
    }

    const res = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify(requestPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Checkout request rejected.');
    }

    setTransactions((prev) => [data.transaction, ...prev]);
    setProducts(data.products);
    setAuditLogs(data.auditLogs);
    if (Array.isArray(data.businesses)) setBusinesses(data.businesses);
    if (Array.isArray(data.employees)) {
      setEmployees(data.employees);
      if (activeEmployee) {
        const refreshed = (data.employees as EmployeeRecord[]).find(
          (e) => e.id === activeEmployee.id
        );
        if (refreshed) setActiveEmployee(refreshed);
      }
    }
    if (Array.isArray(data.erpRecords)) setErpRecords(data.erpRecords);

    // Sync transaction to Firestore if user is signed in & owns the business
    if (firebaseUser && firebaseUser.emailVerified && activeBusiness.ownerId === firebaseUser.uid) {
      const tx: SaleTransaction = data.transaction;
      try {
        await setDoc(
          doc(db, 'businesses', activeBusiness.id, 'transactions', tx.id),
          stripUndefined({
            id: tx.id,
            ownerId: firebaseUser.uid,
            receiptNo: tx.receiptNo,
            businessId: tx.businessId,
            storeId: tx.storeId,
            storeName: tx.storeName,
            cashierRole: tx.cashierRole,
            cashierName: tx.cashierName,
            customerName: tx.customerName,
            customerPin: tx.customerPin,
            customerPhone: tx.customerPhone,
            customerEmail: tx.customerEmail,
            emailedTo: tx.emailedTo,
            channel: tx.channel,
            paymentMethod: tx.paymentMethod,
            paymentRef: tx.paymentRef,
            currency: tx.currency,
            subtotal: tx.subtotal,
            taxAmount: tx.taxAmount,
            discountTotal: tx.discountTotal,
            offerName: tx.offerName,
            offerDiscount: tx.offerDiscount,
            tipAmount: tx.tipAmount,
            tableOrSlotLabel: tx.tableOrSlotLabel,
            staffRating: tx.staffRating,
            total: tx.total,
            amountTendered: tx.amountTendered,
            changeDue: tx.changeDue,
            etimsCuin: tx.etimsCuin,
            etimsStatus: tx.etimsStatus,
            etimsQrData: tx.etimsQrData,
            lines: tx.lines,
            createdAt: tx.createdAt,
            syncedAt: tx.syncedAt,
            encryptedOffline: tx.encryptedOffline,
          })
        );
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `businesses/${activeBusiness.id}/transactions/${tx.id}`
        );
      }
    }

    return data.transaction;
  };

  const handleEmailReceipt = async (txId: string, email: string) => {
    const res = await fetch('/api/receipts/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txId, email }),
    });
    if (res.ok) {
      const data = await res.json();
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, emailedTo: email, customerEmail: email } : t))
      );
      if (data.auditLog) {
        setAuditLogs((prev) => [data.auditLog, ...prev]);
      }
    }
  };

  const updateBusinessConfig = async (patch: Partial<BusinessEntity>) => {
    const res = await fetch(`/api/businesses/${activeBusiness.id}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setBusinesses((prev) =>
        prev.map((b) => (b.id === activeBusiness.id ? data.business : b))
      );
      await syncBusinessDocToCloud(data.business);
    }
  };

  const handleToggleInstallModule = async (moduleId: string) => {
    const isInstalled = activeBusiness.installedModuleIds.includes(moduleId);
    const nextIds = isInstalled
      ? activeBusiness.installedModuleIds.filter((id) => id !== moduleId)
      : [...activeBusiness.installedModuleIds, moduleId];
    await updateBusinessConfig({ installedModuleIds: nextIds });
  };

  const handleUpdatePosConfig = async (posConfig: PosCustomizationConfig) => {
    await updateBusinessConfig({ posConfig });
  };

  const handleUpdateGateways = async (paymentGateways: PaymentGatewayConfig[]) => {
    await updateBusinessConfig({ paymentGateways });
  };

  const handleUpdateLayoutConfig = async (layoutConfig: BusinessLayoutConfig) => {
    await updateBusinessConfig({ layoutConfig });
  };

  const handleUpdateTaxonomy = async (catalogTaxonomy: CategoryGroup[]) => {
    await updateBusinessConfig({ catalogTaxonomy });
  };

  const handleUpdateOffers = async (offers: PromoOffer[]) => {
    await updateBusinessConfig({ offers });
  };

  const handleSlotStatusChange = async (
    zoneId: string,
    slotId: string,
    status: SlotStatus
  ) => {
    if (isOffline) {
      setBusinesses((prev) =>
        prev.map((b) => {
          if (b.id !== activeBusiness.id || !b.layoutConfig) return b;
          return {
            ...b,
            layoutConfig: {
              ...b.layoutConfig,
              zones: b.layoutConfig.zones.map((z) =>
                z.id !== zoneId
                  ? z
                  : {
                      ...z,
                      slots: z.slots.map((s) =>
                        s.id === slotId
                          ? {
                              ...s,
                              status,
                              activeOrderTotal: status === 'available' ? undefined : s.activeOrderTotal,
                              assignedEmployeeName:
                                status === 'available' ? undefined : s.assignedEmployeeName,
                              lastUpdatedAt: new Date().toISOString(),
                            }
                          : s
                      ),
                    }
              ),
            },
          };
        })
      );
      return;
    }

    const res = await fetch(`/api/businesses/${activeBusiness.id}/slot-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneId,
        slotId,
        status,
        actor: activeEmployee?.name || 'Staff',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setBusinesses((prev) =>
        prev.map((b) => (b.id === activeBusiness.id ? data.business : b))
      );
      await syncBusinessDocToCloud(data.business);
    }
  };

  const handleEmployeeAttendance = async (
    employeeId: string,
    action: 'clock_in' | 'clock_out',
    note?: string
  ) => {
    const targetEmp = employees.find((e) => e.id === employeeId);
    if (isOffline && targetEmp) {
      const now = new Date().toISOString();
      const updatedEmp: EmployeeRecord = {
        ...targetEmp,
        clockedIn: action === 'clock_in',
        lastClockInAt: action === 'clock_in' ? now : targetEmp.lastClockInAt,
        lastClockOutAt: action === 'clock_out' ? now : targetEmp.lastClockOutAt,
      };
      setEmployees((prev) => prev.map((e) => (e.id === employeeId ? updatedEmp : e)));
      if (activeEmployee?.id === employeeId) setActiveEmployee(updatedEmp);
      setAttendanceLogs((prev) => [
        {
          id: `att-off-${Date.now().toString(36)}`,
          businessId: activeBusiness.id,
          employeeId: targetEmp.id,
          employeeName: targetEmp.name,
          role: targetEmp.role,
          branchId: targetEmp.branchId,
          action,
          timestamp: now,
          note: note || (action === 'clock_in' ? 'Offline Clock-In' : 'Offline Clock-Out'),
        },
        ...prev,
      ]);
      return;
    }

    const res = await fetch('/api/employees/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness.id,
        employeeId,
        action,
        note,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.employee) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === data.employee.id ? data.employee : e))
        );
        if (activeEmployee?.id === data.employee.id) {
          setActiveEmployee(data.employee);
        }
      }
      if (Array.isArray(data.attendanceLogs)) {
        setAttendanceLogs(data.attendanceLogs);
      }
    }
  };

  const handleRateEmployee = async (
    employeeName: string,
    transactionId: string,
    rating: number
  ) => {
    if (isOffline) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? { ...t, staffRating: rating } : t))
      );
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.name.toLowerCase() !== employeeName.toLowerCase()) return e;
          const prevCount = e.ratingCount ?? 0;
          const prevAvg = e.ratingAvg ?? 5;
          const nextCount = prevCount + 1;
          return {
            ...e,
            ratingAvg: Math.round(((prevAvg * prevCount + rating) / nextCount) * 100) / 100,
            ratingCount: nextCount,
          };
        })
      );
      return;
    }

    const res = await fetch('/api/employees/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness.id,
        employeeName,
        transactionId,
        rating,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.employee) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === data.employee.id ? data.employee : e))
        );
        if (activeEmployee?.id === data.employee.id) {
          setActiveEmployee(data.employee);
        }
      }
      if (data.transaction) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === data.transaction.id ? data.transaction : t))
        );
      }
    }
  };

  const handleLaunchModule = (mod: AppModuleMeta) => {
    if (mod.specialView === 'pos') {
      setSelectedModule(null);
      setTopTab('pos');
      return;
    }
    if (mod.specialView === 'etims') {
      setSelectedModule(null);
      setTopTab('etims');
      return;
    }
    if (mod.specialView === 'analytics') {
      setSelectedModule(null);
      setTopTab('analytics');
      return;
    }
    setSelectedModule(mod);
    setTopTab('apps');
  };

  const handleSelectTopTab = (tab: PrimaryWorkspaceTab) => {
    if (accountTier === 'user' && tab !== 'apps') {
      setTopTab('apps');
      return;
    }
    setTopTab(tab);
    setSelectedModule(null);
  };

  const handleCreateBusiness = async (payload: {
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
    ecommerceEnabled?: boolean;
  }) => {
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to provision business domain.');
    }
    const createdBiz: BusinessEntity = {
      ...data.business,
      ownerId: firebaseUser?.uid,
    };
    setBusinesses((prev) => [...prev, createdBiz]);
    setStores((prev) => [...prev, data.store]);
    if (Array.isArray(data.employees)) setEmployees((prev) => [...prev, ...data.employees]);
    if (Array.isArray(data.products) && data.products.length > 0) {
      setProducts((prev) => [...data.products, ...prev]);
    }
    if (data.platformUser) setPlatformUsers((prev) => [data.platformUser, ...prev]);
    if (data.subscriptionInvoice) {
      setSubscriptionInvoices((prev) => [data.subscriptionInvoice, ...prev]);
    }
    setActiveBusinessId(createdBiz.id);
    setActiveStoreId(data.store.id);
    setAccountTier('admin');
    setActiveRole('Owner');
    setActiveEmployee(
      Array.isArray(data.employees) && data.employees.length > 0 ? data.employees[0] : null
    );
    if (!initialPosShortcut && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/${createdBiz.slug}`);
    }
    setShowLanding(false);
    setTopTab('apps');
    setSelectedModule(null);
    await syncBusinessDocToCloud(createdBiz);
    await syncSubdocToCloud(createdBiz, 'stores', data.store.id, data.store);
    if (Array.isArray(data.employees)) {
      for (const emp of data.employees as EmployeeRecord[]) {
        await syncSubdocToCloud(createdBiz, 'employees', emp.id, emp as unknown as Record<string, unknown>);
      }
    }
  };

  const handleCreateEmployee = async (payload: {
    name: string;
    email: string;
    role: UserRole;
    pinCode: string;
    branchId: string;
    grossSalary: number;
    permissions: EmployeePermissionSet;
  }) => {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, businessId: activeBusiness.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setEmployees((prev) => [...prev, data.employee]);
      if (data.platformUser) setPlatformUsers((prev) => [data.platformUser, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'employees',
        data.employee.id,
        data.employee as unknown as Record<string, unknown>
      );
    }
  };

  const handleUpdateEmployee = async (
    employeeId: string,
    patch: Partial<{
      name: string;
      email: string;
      role: UserRole;
      pinCode: string;
      branchId: string;
      grossSalary: number;
      active: boolean;
      permissions: EmployeePermissionSet;
    }>
  ) => {
    const res = await fetch(`/api/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setEmployees((prev) => prev.map((e) => (e.id === employeeId ? data.employee : e)));
      if (activeEmployee?.id === employeeId) setActiveEmployee(data.employee);
      await syncSubdocToCloud(
        activeBusiness,
        'employees',
        data.employee.id,
        data.employee as unknown as Record<string, unknown>
      );
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    const res = await fetch(`/api/employees/${employeeId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
      setPlatformUsers((prev) => prev.filter((u) => u.id !== `usr-${employeeId}`));
      if (activeEmployee?.id === employeeId) setActiveEmployee(null);
      await deleteSubdocFromCloud(activeBusiness, 'employees', employeeId);
    }
  };

  const handleRunPayroll = async (periodLabel: string): Promise<PayrollRunRecord | null> => {
    const res = await fetch('/api/payroll/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness.id, periodLabel }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Payroll execution failed.');
    }
    if (data.payrollRun) {
      setPayrollRuns((prev) => [data.payrollRun, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'payrollRuns',
        data.payrollRun.id,
        data.payrollRun as unknown as Record<string, unknown>
      );
    }
    if (data.erpRecord) {
      setErpRecords((prev) => [data.erpRecord, ...prev]);
    }
    return data.payrollRun || null;
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness.id,
        name: newBranchName.trim(),
        location: newBranchLocation.trim(),
        tillNumber: newBranchTill.trim(),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setStores((prev) => [...prev, data.store]);
      setActiveStoreId(data.store.id);
      setNewBranchName('');
      setNewBranchLocation('');
      setNewBranchTill('');
      setAddStoreOpen(false);
      await syncSubdocToCloud(
        activeBusiness,
        'stores',
        data.store.id,
        data.store as unknown as Record<string, unknown>
      );
    }
  };

  // Super Admin SaaS Control Plane Handlers
  const ensureSuperAdminHeaders = () => ({
    'Content-Type': 'application/json',
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  });

  const handleSuperAdminUpdateBusiness = async (
    businessId: string,
    patch: {
      subscriptionPlan?: SubscriptionPlanId;
      subscriptionStatus?: SubscriptionStatus;
      branchLimit?: number;
      monthlyFee?: number;
      subscriptionRenewsAt?: string;
    }
  ) => {
    const res = await fetch(`/api/super-admin/businesses/${businessId}`, {
      method: 'PATCH',
      headers: ensureSuperAdminHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setBusinesses((prev) => prev.map((b) => (b.id === businessId ? data.business : b)));
    }
  };

  const handleSuperAdminAddBranch = async (payload: {
    businessId: string;
    name: string;
    location: string;
    tillNumber: string;
  }) => {
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setStores((prev) => [...prev, data.store]);
    }
  };

  const handleSuperAdminCreateUser = async (payload: {
    name: string;
    email: string;
    tier: PlatformUserRecord['tier'];
    role: PlatformUserRecord['role'];
    businessId?: string;
  }) => {
    const res = await fetch('/api/super-admin/users', {
      method: 'POST',
      headers: ensureSuperAdminHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setPlatformUsers((prev) => [data.user, ...prev]);
    }
  };

  const handleSuperAdminUpdateUser = async (
    userId: string,
    patch: {
      status?: 'active' | 'suspended';
      tier?: PlatformUserRecord['tier'];
      role?: PlatformUserRecord['role'];
      businessId?: string;
    }
  ) => {
    const res = await fetch(`/api/super-admin/users/${userId}`, {
      method: 'PATCH',
      headers: ensureSuperAdminHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setPlatformUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
    }
  };

  const handleSuperAdminUpdatePlans = async (plans: SubscriptionPlanTier[]) => {
    const res = await fetch('/api/super-admin/plans', {
      method: 'PATCH',
      headers: ensureSuperAdminHeaders(),
      body: JSON.stringify({ plans }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubscriptionPlans(data.subscriptionPlans);
    }
  };

  const handleSuperAdminSaveBillingGateways = async (
    gateways: PlatformBillingGateway[],
    secretUpdates: Record<string, { consumerKey?: string }>
  ) => {
    const res = await fetch('/api/super-admin/billing-gateways', {
      method: 'PUT',
      headers: ensureSuperAdminHeaders(),
      body: JSON.stringify({ gateways, secretUpdates }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlatformBillingGateways(data.platformBillingGateways);
    }
  };

  const handlePaySubscription = async (payload: {
    businessId: string;
    planId: SubscriptionPlanId;
    gatewayId: string;
    payerRef: string;
  }) => {
    const res = await fetch('/api/subscriptions/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setBusinesses((prev) =>
        prev.map((b) => (b.id === payload.businessId ? data.business : b))
      );
      if (Array.isArray(data.subscriptionInvoices)) {
        setSubscriptionInvoices(data.subscriptionInvoices);
      }
    }
  };

  const handleRetransmitEtims = async (txId: string) => {
    const res = await fetch('/api/etims/transmit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txId }),
    });
    if (res.ok) {
      const data = await res.json();
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? data.transaction : t))
      );
    }
  };

  const handleIssueCreditNote = async (txId: string, reason: string) => {
    const res = await fetch('/api/etims/credit-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: txId, reason }),
    });
    if (res.ok) {
      const data = await res.json();
      setTransactions((prev) => [data.creditNote, ...prev]);
      if (Array.isArray(data.products)) setProducts(data.products);
    }
  };

  const handleReceivePurchaseOrder = async (recordId: string) => {
    const res = await fetch('/api/purchase/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, storeId: activeStore.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setErpRecords((prev) => prev.map((r) => (r.id === recordId ? data.record : r)));
      if (Array.isArray(data.products)) setProducts(data.products);
    }
  };

  const handleCreateProduct = async (payload: {
    name: string;
    sku: string;
    category: string;
    subCategory?: string;
    zoneId?: string;
    slotId?: string;
    shelfCode?: string;
    price: number;
    cost: number;
    initialQty: number;
    taxCode: TaxCode;
  }) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        businessId: activeBusiness.id,
        storeId: activeStore.id,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((prev) => [data.product, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'products',
        data.product.id,
        data.product as unknown as Record<string, unknown>
      );
    }
  };

  const handleUpdateProduct = async (
    productId: string,
    patch: {
      name?: string;
      sku?: string;
      category?: string;
      subCategory?: string;
      price?: number;
      cost?: number;
      taxCode?: TaxCode;
      reorderPoint?: number;
    }
  ) => {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === productId ? data.product : p)));
      await syncSubdocToCloud(
        activeBusiness,
        'products',
        data.product.id,
        data.product as unknown as Record<string, unknown>
      );
    }
  };

  const handleAdjustStock = async (payload: {
    productId: string;
    storeId: string;
    delta: number;
    reason: string;
  }) => {
    const res = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === data.product.id ? data.product : p)));
      await syncSubdocToCloud(
        activeBusiness,
        'products',
        data.product.id,
        data.product as unknown as Record<string, unknown>
      );
    }
  };

  const handleTransferStock = async (payload: {
    productId: string;
    fromStoreId: string;
    toStoreId: string;
    qty: number;
  }) => {
    const res = await fetch('/api/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Transfer failed.');
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === data.product.id ? data.product : p))
    );
    await syncSubdocToCloud(
      activeBusiness,
      'products',
      data.product.id,
      data.product as unknown as Record<string, unknown>
    );
  };

  const handleCreateInvoice = async (payload: {
    storeId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerPin?: string;
    docType: 'Tax Invoice' | 'Proforma Quote';
    dueDate: string;
    lines: Array<{
      productId?: string;
      sku: string;
      name: string;
      qty: number;
      unitPrice: number;
      taxCode: TaxCode;
    }>;
  }): Promise<TaxInvoiceRecord | null> => {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, businessId: activeBusiness.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to create invoice.');
    }
    setInvoices((prev) => [data.invoice, ...prev]);
    setCrmLeadDraft(null);
    await syncSubdocToCloud(
      activeBusiness,
      'invoices',
      data.invoice.id,
      data.invoice as unknown as Record<string, unknown>
    );
    return data.invoice;
  };

  const handlePayInvoice = async (
    invoiceId: string,
    payload: { amount: number; paymentMethod: string; paymentRef: string }
  ) => {
    const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Payment failed.');
    }
    if (data.invoice) {
      setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? data.invoice : i)));
      await syncSubdocToCloud(
        activeBusiness,
        'invoices',
        data.invoice.id,
        data.invoice as unknown as Record<string, unknown>
      );
    }
    if (data.transaction) {
      setTransactions((prev) => [data.transaction, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'transactions',
        data.transaction.id,
        data.transaction as unknown as Record<string, unknown>
      );
    }
    if (Array.isArray(data.products)) setProducts(data.products);
    if (data.erpRecord) setErpRecords((prev) => [data.erpRecord, ...prev]);
  };

  const handleCreateCrmLead = async (payload: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    kraPin?: string;
    stage: CrmCustomerLead['stage'];
    expectedValue: number;
    notes?: string;
    source: CrmCustomerLead['source'];
  }) => {
    const res = await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, businessId: activeBusiness.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setCrmLeads((prev) => [data.lead, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'crmLeads',
        data.lead.id,
        data.lead as unknown as Record<string, unknown>
      );
    }
  };

  const handleUpdateCrmLead = async (
    leadId: string,
    patch: { stage?: CrmCustomerLead['stage']; expectedValue?: number; notes?: string }
  ) => {
    const res = await fetch(`/api/crm/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setCrmLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
      await syncSubdocToCloud(
        activeBusiness,
        'crmLeads',
        data.lead.id,
        data.lead as unknown as Record<string, unknown>
      );
    }
  };

  const handleCreateJournal = async (payload: {
    debitAccount: string;
    creditAccount: string;
    description: string;
    amount: number;
    date: string;
  }) => {
    const res = await fetch('/api/accounting/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, businessId: activeBusiness.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to post journal entry.');
    }
    setErpRecords((prev) => [data.record, ...prev]);
  };

  const handleUpdateDomainConfig = async (patch: {
    ecommerceEnabled?: boolean;
    customDomain?: string;
    verifyDomain?: boolean;
    storefrontTagline?: string;
    deliveryFee?: number;
    freeDeliveryAbove?: number;
    storefrontPickupEnabled?: boolean;
  }) => {
    const res = await fetch(`/api/businesses/${activeBusiness.id}/domain`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save domain settings.');
    }
    setBusinesses((prev) =>
      prev.map((b) => (b.id === activeBusiness.id ? data.business : b))
    );
    await syncBusinessDocToCloud(data.business);
  };

  const handlePlaceOnlineOrder = async (payload: {
    storeId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerPin?: string;
    deliveryMethod: 'delivery' | 'pickup';
    deliveryAddress: string;
    paymentMethod: string;
    paymentRef?: string;
    lines: Array<{ productId: string; qty: number }>;
  }): Promise<OnlineOrder | null> => {
    const res = await fetch('/api/online-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, businessId: activeBusiness.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to place online order.');
    }
    if (data.onlineOrder) {
      setOnlineOrders((prev) => [data.onlineOrder, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'onlineOrders',
        data.onlineOrder.id,
        data.onlineOrder as unknown as Record<string, unknown>
      );
    }
    if (data.transaction) {
      setTransactions((prev) => [data.transaction, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'transactions',
        data.transaction.id,
        data.transaction as unknown as Record<string, unknown>
      );
    }
    if (data.invoice) {
      setInvoices((prev) => [data.invoice, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'invoices',
        data.invoice.id,
        data.invoice as unknown as Record<string, unknown>
      );
    }
    if (Array.isArray(data.products)) setProducts(data.products);
    if (data.erpRecord) setErpRecords((prev) => [data.erpRecord, ...prev]);
    return data.onlineOrder || null;
  };

  const handleUpdateOnlineOrderStatus = async (
    orderId: string,
    fulfillmentStatus: OnlineOrderFulfillmentStatus
  ) => {
    const res = await fetch(`/api/online-orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfillmentStatus }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.onlineOrder) {
        setOnlineOrders((prev) =>
          prev.map((o) => (o.id === orderId ? data.onlineOrder : o))
        );
        await syncSubdocToCloud(
          activeBusiness,
          'onlineOrders',
          data.onlineOrder.id,
          data.onlineOrder as unknown as Record<string, unknown>
        );
      }
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.invoices)) setInvoices(data.invoices);
      if (data.creditNote) setTransactions((prev) => [data.creditNote, ...prev]);
    }
  };

  const handleCreateBackup = async (
    label: string,
    scope: 'business' | 'platform'
  ): Promise<BackupSnapshot | null> => {
    const res = await fetch('/api/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness.id,
        scope,
        label,
        createdBy: activeEmployee?.name || 'Business Admin',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Backup creation failed.');
    }
    if (data.backup) {
      setBackups((prev) => [data.backup, ...prev]);
      await syncSubdocToCloud(
        activeBusiness,
        'backups',
        data.backup.id,
        data.backup as unknown as Record<string, unknown>
      );
    }
    return data.backup || null;
  };

  const applyRestoreState = (data: Record<string, unknown>) => {
    if (Array.isArray(data.businesses)) setBusinesses(data.businesses as BusinessEntity[]);
    if (Array.isArray(data.stores)) setStores(data.stores as StoreBranch[]);
    if (Array.isArray(data.employees)) setEmployees(data.employees as EmployeeRecord[]);
    if (Array.isArray(data.products)) setProducts(data.products as ProductItem[]);
    if (Array.isArray(data.transactions)) setTransactions(data.transactions as SaleTransaction[]);
    if (Array.isArray(data.invoices)) setInvoices(data.invoices as TaxInvoiceRecord[]);
    if (Array.isArray(data.onlineOrders)) setOnlineOrders(data.onlineOrders as OnlineOrder[]);
    if (Array.isArray(data.crmLeads)) setCrmLeads(data.crmLeads as CrmCustomerLead[]);
    if (Array.isArray(data.payrollRuns)) setPayrollRuns(data.payrollRuns as PayrollRunRecord[]);
    if (Array.isArray(data.erpRecords)) setErpRecords(data.erpRecords as ErpRecord[]);
  };

  const handleRestoreBackup = async (backupId: string) => {
    const res = await fetch(`/api/backups/${backupId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Restore failed.');
    }
    applyRestoreState(data);
  };

  const handleImportBackup = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/backups/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness.id, payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Backup import failed.');
    }
    applyRestoreState(data);
  };

  const handleCreateStudioModel = async (payload: {
    name: string;
    category: string;
    description: string;
    fields: StudioField[];
  }) => {
    const res = await fetch('/api/studio/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setStudioModels((prev) => [data.model, ...prev]);
    }
  };

  const handleCreateAutomation = async (payload: {
    name: string;
    trigger: string;
    condition: string;
    action: string;
  }) => {
    const res = await fetch('/api/studio/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setAutomations((prev) => [data.automation, ...prev]);
    }
  };

  const handleCreateErpRecord = async (payload: {
    moduleId: string;
    title: string;
    subtitle: string;
    status: string;
    amount?: number;
  }) => {
    const res = await fetch('/api/erp/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        businessId: activeBusiness.id,
        currency: activeBusiness.currency,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setErpRecords((prev) => [data.record, ...prev]);
    }
  };

  const totalSalesToday = useMemo(
    () =>
      businessTransactions
        .filter((t) => t.storeId === activeStore?.id)
        .reduce((sum, t) => sum + t.total, 0),
    [businessTransactions, activeStore?.id]
  );

  const lowStockCount = useMemo(
    () =>
      businessProducts.filter(
        (p) => (p.stockByStore[activeStore?.id] ?? 0) <= p.reorderPoint
      ).length,
    [businessProducts, activeStore?.id]
  );

  if (showLanding) {
    return (
      <>
        <LandingPage
          onLaunchDemoBusiness={() => {
            handleSelectBusiness('biz-savannah');
            setAccountTier('admin');
            setActiveRole('Owner');
            setPosKioskMode(false);
            setTopTab('apps');
            setSelectedModule(null);
            setShowLanding(false);
          }}
          onEmployeePosLogin={() => {
            if (typeof window !== 'undefined') {
              window.location.assign('/pos?biz=misafatech&store=store-nbo-01');
              return;
            }
            handleSelectBusiness('biz-savannah');
            setAccountTier('employee');
            setActiveRole('Cashier');
            setPosKioskMode(true);
            setSelectedModule(null);
            setTopTab('pos');
            setShowLanding(false);
          }}
          onStartFreeOnboarding={() => {
            setPosKioskMode(false);
            setShowLanding(false);
            setWizardOpen(true);
          }}
          onGoogleSignIn={handleGoogleSignIn}
          onOpenPortalSlug={(slug) => {
            const matched =
              businesses.find((b) => b.slug.toLowerCase() === slug.toLowerCase()) ||
              businesses[0];
            handleSelectBusiness(matched.id);
            setPosKioskMode(false);
            setTopTab('apps');
            setSelectedModule(null);
            setShowLanding(false);
          }}
          onOpenSuperAdmin={() => {
            setAccountTier('admin');
            setActiveRole('Owner');
            setPosKioskMode(false);
            setSelectedModule(null);
            setTopTab('super_admin');
            setShowLanding(false);
          }}
          firebaseUserEmail={firebaseUser?.email}
          onContinueSignedIn={() => {
            setPosKioskMode(false);
            setShowLanding(false);
          }}
        />
        <OnboardingWizardModal
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          existingBusinesses={businesses}
          subscriptionPlans={subscriptionPlans}
          onCreateBusiness={handleCreateBusiness}
        />
      </>
    );
  }

  // Dedicated full-screen POS register mode: NO ERP TopBar, NO WorkspaceToolbar, NO Admin configuration buttons
  if (initialPosShortcut || (!selectedModule && topTab === 'pos')) {
    return (
      <PosTerminal
        business={activeBusiness}
        store={activeStore}
        products={businessProducts}
        employees={businessEmployees}
        activeEmployee={activeEmployee}
        onUnlockByPin={(pin) => {
          const matched = handleUnlockByPin(pin);
          if (matched && (accountTier !== 'admin' || initialPosShortcut)) {
            setPosKioskMode(true);
          }
          return matched;
        }}
        onEmployeeAttendance={handleEmployeeAttendance}
        onRateEmployee={handleRateEmployee}
        onSlotStatusChange={handleSlotStatusChange}
        activeRole={activeRole}
        isOffline={isOffline}
        canExitToAdmin={!initialPosShortcut && accountTier === 'admin' && !posKioskMode}
        onExitToAdmin={() => {
          setSelectedModule(null);
          setTopTab('apps');
        }}
        onOpenModuleById={(modId) => {
          const mod = APP_MODULES.find((m) => m.id === modId);
          if (mod) {
            setSelectedModule(mod);
            setTopTab('apps');
          }
        }}
        initialLocked={true}
        onCompleteCheckout={handleCheckout}
        onEmailReceipt={handleEmailReceipt}
      />
    );
  }

  const breadcrumb = selectedModule
    ? selectedModule.name
    : topTab === 'pos'
      ? 'Point of Sale'
      : topTab === 'etims'
        ? 'KRA eTIMS & Tax'
        : topTab === 'analytics'
          ? 'Dynamics BI & Analytics'
          : topTab === 'super_admin'
            ? 'Super Admin Control Plane'
            : 'Enterprise Launcher';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar
        activeTab={selectedModule ? 'apps' : topTab}
        onSelectTab={handleSelectTopTab}
        onOpenWizard={() => setWizardOpen(true)}
        onGoLanding={() => setShowLanding(true)}
        showSuperAdmin={accountTier === 'admin'}
      />

      <WorkspaceToolbar
        businesses={businesses}
        activeBusiness={activeBusiness}
        onSelectBusiness={handleSelectBusiness}
        stores={businessStores}
        activeStore={activeStore}
        onSelectStore={setActiveStoreId}
        onAddStoreClick={() => setAddStoreOpen(true)}
        accountTier={accountTier}
        onSelectAccountTier={handleSelectAccountTier}
        activeRole={activeRole}
        onSelectRole={setActiveRole}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline((v) => !v)}
        offlineQueueCount={encryptedOfflineQueue.length}
        isSyncing={isSyncing}
        onSyncNow={handleSyncOfflineQueue}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        breadcrumb={breadcrumb}
        onBackToApps={
          selectedModule || topTab !== 'apps'
            ? () => {
                setSelectedModule(null);
                setTopTab('apps');
              }
            : undefined
        }
        firebaseUserEmail={firebaseUser?.email}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
      />

      {/* Mobile View Switcher */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden dark:border-slate-800 dark:bg-slate-950">
        {(
          [
            { id: 'apps', label: 'Apps' },
            { id: 'pos', label: 'POS' },
            { id: 'etims', label: 'eTIMS' },
            { id: 'analytics', label: 'Analytics' },
            ...(accountTier === 'admin' ? ([{ id: 'super_admin', label: 'Super Admin' }] as const) : []),
          ] as const
        )
          .filter((t) => accountTier !== 'user' || t.id === 'apps')
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTopTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                !selectedModule && topTab === tab.id
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {authBanner && (
          <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300">
            {authBanner}
          </div>
        )}

        {syncBanner && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            {syncBanner}
          </div>
        )}

        {selectedModule ? (
          selectedModule.specialView === 'studio' ? (
            <StudioView
              models={studioModels}
              automations={automations}
              onCreateModel={handleCreateStudioModel}
              onCreateAutomation={handleCreateAutomation}
            />
          ) : selectedModule.specialView === 'pos_admin' ? (
            <PosAdminConsole
              business={activeBusiness}
              stores={businessStores}
              activeStore={activeStore}
              transactions={businessTransactions}
              employees={businessEmployees}
              attendanceLogs={businessAttendanceLogs}
              onUpdatePosConfig={handleUpdatePosConfig}
              onUpdateLayoutConfig={handleUpdateLayoutConfig}
              onUpdateTaxonomy={handleUpdateTaxonomy}
              onUpdateOffers={handleUpdateOffers}
              onSlotStatusChange={handleSlotStatusChange}
              onEmployeeAttendance={handleEmployeeAttendance}
              onLaunchPosRegister={() => {
                setSelectedModule(null);
                setTopTab('pos');
              }}
            />
          ) : selectedModule.specialView === 'payments' ? (
            <PaymentGatewaysView
              business={activeBusiness}
              onUpdateGateways={handleUpdateGateways}
            />
          ) : selectedModule.specialView === 'field' ? (
            <FieldAgentView
              business={activeBusiness}
              store={activeStore}
              products={businessProducts}
              transactions={businessTransactions}
              isOffline={isOffline}
              offlineQueueCount={encryptedOfflineQueue.length}
              onSyncNow={handleSyncOfflineQueue}
              onSubmitFieldOrder={handleCheckout}
            />
          ) : selectedModule.specialView === 'crm' ? (
            <CrmWorkspace
              business={activeBusiness}
              transactions={businessTransactions}
              onlineOrders={businessOnlineOrders}
              invoices={businessInvoices}
              crmLeads={businessCrmLeads}
              onCreateLead={handleCreateCrmLead}
              onUpdateLead={handleUpdateCrmLead}
              onConvertLeadToInvoice={(lead) => {
                setCrmLeadDraft(lead);
                const invMod = APP_MODULES.find((m) => m.id === 'invoicing');
                if (invMod) {
                  setSelectedModule(invMod);
                  setTopTab('apps');
                }
              }}
            />
          ) : selectedModule.specialView === 'invoicing' ? (
            <InvoicingWorkspace
              business={activeBusiness}
              activeStore={activeStore}
              products={businessProducts}
              invoices={businessInvoices}
              initialCustomer={
                crmLeadDraft
                  ? {
                      name: crmLeadDraft.name,
                      email: crmLeadDraft.email,
                      phone: crmLeadDraft.phone,
                      kraPin: crmLeadDraft.kraPin,
                    }
                  : null
              }
              onCreateInvoice={handleCreateInvoice}
              onPayInvoice={handlePayInvoice}
            />
          ) : selectedModule.specialView === 'accounting' ? (
            <AccountingWorkspace
              business={activeBusiness}
              products={businessProducts}
              transactions={businessTransactions}
              invoices={businessInvoices}
              payrollRuns={businessPayrollRuns}
              erpRecords={businessErpRecords}
              onCreateJournal={handleCreateJournal}
            />
          ) : selectedModule.specialView === 'ecommerce' ? (
            <EcommerceDomainWorkspace
              business={activeBusiness}
              stores={businessStores}
              activeStore={activeStore}
              products={businessProducts}
              isAdmin={accountTier === 'admin'}
              onUpdateDomainConfig={handleUpdateDomainConfig}
              onPlaceOnlineOrder={handlePlaceOnlineOrder}
            />
          ) : selectedModule.specialView === 'online_orders' ? (
            <OnlineOrdersWorkspace
              business={activeBusiness}
              onlineOrders={businessOnlineOrders}
              onUpdateStatus={handleUpdateOnlineOrderStatus}
            />
          ) : selectedModule.specialView === 'backups' ? (
            <BackupRestoreWorkspace
              business={activeBusiness}
              backups={businessBackups}
              onCreateBackup={handleCreateBackup}
              onRestoreBackup={handleRestoreBackup}
              onImportBackup={handleImportBackup}
            />
          ) : selectedModule.specialView === 'governance' ||
            selectedModule.specialView === 'api' ||
            selectedModule.specialView === 'timeline' ? (
            <EnterpriseGovernanceView
              mode={selectedModule.specialView}
              auditLogs={auditLogs}
              activeRole={activeRole}
            />
          ) : (
            <ModuleWorkspace
              module={selectedModule}
              business={activeBusiness}
              stores={businessStores}
              activeStore={activeStore}
              products={businessProducts}
              employees={businessEmployees}
              attendanceLogs={businessAttendanceLogs}
              payrollRuns={businessPayrollRuns}
              records={businessErpRecords}
              accountTier={accountTier}
              activeRole={activeRole}
              onCreateProduct={handleCreateProduct}
              onUpdateProduct={handleUpdateProduct}
              onAdjustStock={handleAdjustStock}
              onTransferStock={handleTransferStock}
              onCreateEmployee={handleCreateEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onRunPayroll={handleRunPayroll}
              onEmployeeAttendance={handleEmployeeAttendance}
              onSlotStatusChange={handleSlotStatusChange}
              onReceivePurchaseOrder={handleReceivePurchaseOrder}
              onCreateRecord={handleCreateErpRecord}
            />
          )
        ) : topTab === 'etims' ? (
          <EtimsComplianceView
            business={activeBusiness}
            stores={businessStores}
            transactions={businessTransactions}
            erpRecords={businessErpRecords}
            onRetransmit={handleRetransmitEtims}
            onIssueCreditNote={handleIssueCreditNote}
          />
        ) : topTab === 'analytics' ? (
          <AnalyticsDashboard
            business={activeBusiness}
            stores={businessStores}
            products={businessProducts}
            transactions={businessTransactions}
          />
        ) : topTab === 'super_admin' && accountTier === 'admin' ? (
          <SuperAdminView
            businesses={businesses}
            stores={stores}
            employees={employees}
            products={products}
            platformUsers={platformUsers}
            subscriptionPlans={subscriptionPlans}
            platformBillingGateways={platformBillingGateways}
            subscriptionInvoices={subscriptionInvoices}
            currentUserEmail={firebaseUser?.email}
            onSwitchToBusiness={(bizId) => {
              handleSelectBusiness(bizId);
              setSelectedModule(null);
              setTopTab('apps');
            }}
            onUpdateBusinessSubscription={handleSuperAdminUpdateBusiness}
            onAddBranchToBusiness={handleSuperAdminAddBranch}
            onCreatePlatformUser={handleSuperAdminCreateUser}
            onUpdatePlatformUser={handleSuperAdminUpdateUser}
            onUpdatePlans={handleSuperAdminUpdatePlans}
            onSaveBillingGateways={handleSuperAdminSaveBillingGateways}
            onPaySubscription={handlePaySubscription}
            onOpenNewBusinessWizard={() => setWizardOpen(true)}
          />
        ) : (
          <AppLauncher
            activeBusiness={activeBusiness}
            activeStore={activeStore}
            accountTier={accountTier}
            onLaunchModule={handleLaunchModule}
            onToggleInstallModule={handleToggleInstallModule}
            totalSalesToday={totalSalesToday}
            lowStockCount={lowStockCount}
            queuedOfflineCount={encryptedOfflineQueue.length}
            onOpenWizard={() => setWizardOpen(true)}
          />
        )}
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white py-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:px-6 dark:text-slate-400">
          <span>
            MisafaRMS · https://misafarms.com/{activeBusiness.slug}
          </span>
          {accountTier === 'admin' && (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const mod = APP_MODULES.find((m) => m.id === 'implementation_plan');
                  if (mod) handleLaunchModule(mod);
                }}
                className="hover:text-teal-700 hover:underline dark:hover:text-teal-400"
              >
                Project Timeline & Budget
              </button>
              <button
                type="button"
                onClick={() => {
                  const mod = APP_MODULES.find((m) => m.id === 'api_docs');
                  if (mod) handleLaunchModule(mod);
                }}
                className="hover:text-teal-700 hover:underline dark:hover:text-teal-400"
              >
                API Docs
              </button>
              <button
                type="button"
                onClick={() => {
                  const mod = APP_MODULES.find((m) => m.id === 'security');
                  if (mod) handleLaunchModule(mod);
                }}
                className="hover:text-teal-700 hover:underline dark:hover:text-teal-400"
              >
                Security & KDPA/GDPR
              </button>
            </div>
          )}
        </div>
      </footer>

      <OnboardingWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        existingBusinesses={businesses}
        subscriptionPlans={subscriptionPlans}
        onCreateBusiness={handleCreateBusiness}
      />

      {/* Quick Add Store Branch Modal */}
      {addStoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Add Branch Store to {activeBusiness.name}
              </h3>
              <button
                type="button"
                onClick={() => setAddStoreOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBranch} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. Kisumu Mega City Outlet"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Location / Address
                </label>
                <input
                  type="text"
                  value={newBranchLocation}
                  onChange={(e) => setNewBranchLocation(e.target.value)}
                  placeholder="e.g. Nairobi Road, Kisumu"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  M-Pesa Till / Register ID
                </label>
                <input
                  type="text"
                  value={newBranchTill}
                  onChange={(e) => setNewBranchTill(e.target.value)}
                  placeholder="e.g. 849209"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddStoreOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MisafaWorkspaceApp />
    </ErrorBoundary>
  );
}
