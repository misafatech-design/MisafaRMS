import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { X } from 'lucide-react';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AppLauncher } from './components/AppLauncher';
import { EnterpriseGovernanceView } from './components/EnterpriseGovernanceView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EtimsComplianceView } from './components/EtimsComplianceView';
import { FieldAgentView } from './components/FieldAgentView';
import { LandingPage } from './components/LandingPage';
import { ModuleWorkspace } from './components/ModuleWorkspace';
import { OnboardingWizardModal } from './components/OnboardingWizardModal';
import { PaymentGatewaysView } from './components/PaymentGatewaysView';
import { PosTerminal } from './components/PosTerminal';
import { StudioView } from './components/StudioView';
import { PrimaryWorkspaceTab, TopBar } from './components/TopBar';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { APP_MODULES } from './data/modulesRegistry';
import {
  SEED_AUDIT_LOGS,
  SEED_AUTOMATIONS,
  SEED_BUSINESSES,
  SEED_EMPLOYEES,
  SEED_ERP_RECORDS,
  SEED_PRODUCTS,
  SEED_STORES,
  SEED_STUDIO_MODELS,
  SEED_TRANSACTIONS,
} from './data/seedData';
import {
  auth,
  collection,
  db,
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
  BusinessEntity,
  EmployeePermissionSet,
  EmployeeRecord,
  ErpRecord,
  PaymentGatewayConfig,
  PaymentMethod,
  PosCustomizationConfig,
  ProductItem,
  SaleTransaction,
  StoreBranch,
  StudioField,
  StudioModel,
  TaxCode,
  UserRole,
  WorkflowAutomation,
} from './types/erp';
import { decryptOfflinePayload, encryptOfflinePayload } from './utils/cryptoSync';

const OFFLINE_QUEUE_STORAGE = 'misafarms_encrypted_offline_queue_v1';

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
  channel: 'POS' | 'Field Agent';
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
  const initialPosShortcut =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('pos') === '1';

  const [showLanding, setShowLanding] = useState(!initialPosShortcut);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authBanner, setAuthBanner] = useState('');

  const [businesses, setBusinesses] = useState<BusinessEntity[]>(SEED_BUSINESSES);
  const [stores, setStores] = useState<StoreBranch[]>(SEED_STORES);
  const [employees, setEmployees] = useState<EmployeeRecord[]>(SEED_EMPLOYEES);
  const [products, setProducts] = useState<ProductItem[]>(SEED_PRODUCTS);
  const [transactions, setTransactions] = useState<SaleTransaction[]>(SEED_TRANSACTIONS);
  const [studioModels, setStudioModels] = useState<StudioModel[]>(SEED_STUDIO_MODELS);
  const [automations, setAutomations] = useState<WorkflowAutomation[]>(SEED_AUTOMATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(SEED_AUDIT_LOGS);
  const [erpRecords, setErpRecords] = useState<ErpRecord[]>(SEED_ERP_RECORDS);

  const [activeBusinessId, setActiveBusinessId] = useState<string>(SEED_BUSINESSES[0].id);
  const [activeStoreId, setActiveStoreId] = useState<string>(SEED_STORES[0].id);
  const [accountTier, setAccountTier] = useState<AccountTier>('admin');
  const [activeRole, setActiveRole] = useState<UserRole>('Owner');
  const [activeEmployee, setActiveEmployee] = useState<EmployeeRecord | null>(SEED_EMPLOYEES[0]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const [topTab, setTopTab] = useState<PrimaryWorkspaceTab>(initialPosShortcut ? 'pos' : 'apps');
  const [selectedModule, setSelectedModule] = useState<AppModuleMeta | null>(null);

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

  // Ensure Firestore user account & load owned cloud businesses upon Google Sign-In
  useEffect(() => {
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
            accountType: isBootstrappedAdmin ? 'admin' : 'employee',
            activeBusinessId,
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
          if (data?.accountType === 'admin' || data?.accountType === 'employee' || data?.accountType === 'user') {
            setAccountTier(data.accountType);
          }
        }

        // Load any Firestore businesses owned by this user
        const bizQuery = query(
          collection(db, 'businesses'),
          where('ownerId', '==', user.uid)
        );
        const bizSnap = await getDocs(bizQuery);
        if (!bizSnap.empty) {
          const cloudBusinesses = bizSnap.docs.map((d) => d.data() as BusinessEntity);
          setBusinesses((prev) => {
            const byId = new Map(prev.map((b) => [b.id, b]));
            for (const cb of cloudBusinesses) byId.set(cb.id, cb);
            return Array.from(byId.values());
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    });
    return () => unsub();
  }, [activeBusinessId]);

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
          setStudioModels(data.studioModels);
          setAutomations(data.automations);
          setAuditLogs(data.auditLogs);
          setErpRecords(data.erpRecords);
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
  }, []);

  // Initialize in-memory bearer session on role switch
  useEffect(() => {
    if (isOffline) return;
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: activeEmployee?.name || 'Amina Hassan',
        role: activeRole,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.token) setSessionToken(data.token);
      })
      .catch(() => {});
  }, [activeRole, activeEmployee?.name, isOffline]);

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

  const handleSelectBusiness = (bizId: string) => {
    setActiveBusinessId(bizId);
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
      if (selectedModule?.adminOnly) setSelectedModule(null);
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
        if (existing.exists() && ownerId !== firebaseUser.uid && firebaseUser.email !== 'misafatech@gmail.com') {
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
            installedModuleIds: biz.installedModuleIds,
            posConfig: biz.posConfig,
            paymentGateways: biz.paymentGateways,
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
    channel: 'POS' | 'Field Agent';
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
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        discountTotal: 0,
        total: Math.round(subtotal * 100) / 100,
        amountTendered: payload.amountTendered,
        changeDue: Math.max(0, Math.round((payload.amountTendered - subtotal) * 100) / 100),
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
  }) => {
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const data = await res.json();
    const createdBiz: BusinessEntity = {
      ...data.business,
      ownerId: firebaseUser?.uid,
    };
    setBusinesses((prev) => [...prev, createdBiz]);
    setStores((prev) => [...prev, data.store]);
    if (Array.isArray(data.employees)) setEmployees((prev) => [...prev, ...data.employees]);
    setProducts((prev) => [...data.products, ...prev]);
    setActiveBusinessId(createdBiz.id);
    setActiveStoreId(data.store.id);
    setShowLanding(false);
    setTopTab('apps');
    setSelectedModule(null);
    await syncBusinessDocToCloud(createdBiz);
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
    }
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
            setTopTab('apps');
            setSelectedModule(null);
            setShowLanding(false);
          }}
          onStartFreeOnboarding={() => {
            setShowLanding(false);
            setWizardOpen(true);
          }}
          onGoogleSignIn={handleGoogleSignIn}
          onOpenPortalSlug={(slug) => {
            const matched =
              businesses.find((b) => b.slug.toLowerCase() === slug.toLowerCase()) ||
              businesses[0];
            handleSelectBusiness(matched.id);
            setTopTab('apps');
            setSelectedModule(null);
            setShowLanding(false);
          }}
          firebaseUserEmail={firebaseUser?.email}
          onContinueSignedIn={() => setShowLanding(false)}
        />
        <OnboardingWizardModal
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreateBusiness={handleCreateBusiness}
        />
      </>
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
          : 'Enterprise Launcher';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar
        activeTab={selectedModule ? 'apps' : topTab}
        onSelectTab={handleSelectTopTab}
        onOpenWizard={() => setWizardOpen(true)}
        onGoLanding={() => setShowLanding(true)}
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
              records={erpRecords}
              accountTier={accountTier}
              activeRole={activeRole}
              onCreateProduct={handleCreateProduct}
              onTransferStock={handleTransferStock}
              onCreateEmployee={handleCreateEmployee}
              onReceivePurchaseOrder={handleReceivePurchaseOrder}
              onCreateRecord={handleCreateErpRecord}
            />
          )
        ) : topTab === 'pos' ? (
          <PosTerminal
            business={activeBusiness}
            store={activeStore}
            products={businessProducts}
            transactions={businessTransactions}
            employees={businessEmployees}
            activeEmployee={activeEmployee}
            onUnlockByPin={handleUnlockByPin}
            accountTier={accountTier}
            activeRole={activeRole}
            isOffline={isOffline}
            onUpdatePosConfig={handleUpdatePosConfig}
            onEmailReceipt={handleEmailReceipt}
            onCompleteCheckout={handleCheckout}
          />
        ) : topTab === 'etims' ? (
          <EtimsComplianceView
            business={activeBusiness}
            stores={businessStores}
            transactions={businessTransactions}
            erpRecords={erpRecords}
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
            MisafaRMS · https://{activeBusiness.slug}.misafarms.com/
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
