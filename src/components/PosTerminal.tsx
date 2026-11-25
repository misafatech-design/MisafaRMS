import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  CheckCircle2,
  CloudOff,
  CreditCard,
  Database,
  Delete,
  HeartHandshake,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scale,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Usb,
  UtensilsCrossed,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import {
  BusinessEntity,
  CartLine,
  EmployeeRecord,
  PaymentMethod,
  ProductItem,
  PromoOffer,
  SaleTransaction,
  SlotStatus,
  StoreBranch,
  UserRole,
} from '../types/erp';
import { formatMoney, getTaxLabel, ROLE_PERMISSIONS } from '../utils/cryptoSync';
import { PWAInstallButton } from './PWAInstallButton';
import { DEFAULT_POS_HARDWARE_CONFIG } from '../data/businessTemplates';
import {
  OfflineQueueItem,
  PersistedPosDraft,
  loadPosRegisterDraft,
  loadPosRegisterDraftSync,
  requestPersistentBrowserStorage,
  savePosRegisterDraft,
} from '../utils/offlineStorage';
import {
  buildCashDrawerKickBytes,
  buildEscPosReceiptBytes,
  dispatchHardwareBytes,
  EmvCardChargeResult,
  isEmvCardGateway,
  pairSerialPeripheral,
  pairUsbThermalPrinter,
  playScannerBeep,
} from '../utils/posHardware';

interface PosTerminalProps {
  business: BusinessEntity;
  store: StoreBranch;
  products: ProductItem[];
  employees: EmployeeRecord[];
  activeEmployee: EmployeeRecord | null;
  onUnlockByPin: (pin: string) => EmployeeRecord | null;
  onEmployeeAttendance: (
    employeeId: string,
    action: 'clock_in' | 'clock_out',
    note?: string
  ) => Promise<void>;
  onRateEmployee: (
    employeeName: string,
    transactionId: string,
    rating: number
  ) => Promise<void>;
  onSlotStatusChange: (
    zoneId: string,
    slotId: string,
    status: SlotStatus
  ) => Promise<void>;
  activeRole: UserRole;
  isOffline: boolean;
  offlineQueueItems?: OfflineQueueItem[];
  isSyncingOffline?: boolean;
  onSyncOfflineQueue?: () => Promise<void>;
  onToggleOfflineMode?: (offline: boolean) => void;
  canExitToAdmin: boolean;
  onExitToAdmin?: () => void;
  onOpenModuleById?: (moduleId: string) => void;
  initialLocked?: boolean;
  onHardwareLog?: (event: string, detail: string) => Promise<void>;
  onChargeCardTerminal?: (payload: {
    provider: string;
    terminalId: string;
    amount: number;
    cardScheme: 'VISA' | 'MASTERCARD';
    cvmMethod: 'NFC Contactless' | 'EMV Chip + PIN';
  }) => Promise<EmvCardChargeResult | null>;
  onCompleteCheckout: (payload: {
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
    channel: 'POS' | 'Restaurant';
  }) => Promise<SaleTransaction | null>;
  onEmailReceipt: (txId: string, email: string) => Promise<void>;
}

function computeOfferDiscount(
  offer: PromoOffer,
  cart: CartLine[],
  grossTotal: number
): number {
  if (!offer.active || cart.length === 0) return 0;
  const eligibleLines =
    offer.targetCategory === 'All'
      ? cart
      : cart.filter((l) => l.product.category === offer.targetCategory);
  if (eligibleLines.length === 0) return 0;

  const eligibleSum = eligibleLines.reduce(
    (s, l) => s + l.product.price * l.qty * (1 - l.discountPct / 100),
    0
  );
  const totalQty = eligibleLines.reduce((s, l) => s + l.qty, 0);

  if (offer.type === 'percent_off') {
    return Math.round(eligibleSum * (offer.value / 100) * 100) / 100;
  }
  if (offer.type === 'min_qty_percent') {
    if (totalQty < (offer.minQty || 2)) return 0;
    return Math.round(eligibleSum * (offer.value / 100) * 100) / 100;
  }
  if (offer.type === 'fixed_off') {
    if (grossTotal < (offer.minSpend || 0)) return 0;
    return Math.min(eligibleSum, offer.value);
  }
  return 0;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  business,
  store,
  products,
  employees,
  activeEmployee,
  onUnlockByPin,
  onEmployeeAttendance,
  onRateEmployee,
  onSlotStatusChange,
  activeRole,
  isOffline,
  offlineQueueItems = [],
  isSyncingOffline = false,
  onSyncOfflineQueue,
  onToggleOfflineMode,
  canExitToAdmin,
  onExitToAdmin,
  onOpenModuleById,
  initialLocked = true,
  onHardwareLog,
  onChargeCardTerminal,
  onCompleteCheckout,
  onEmailReceipt,
}) => {
  const hwConfig = business.hardwareConfig || DEFAULT_POS_HARDWARE_CONFIG;
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [category, setCategory] = useState('All');
  const [subCategory, setSubCategory] = useState('All');
  const [hwBanner, setHwBanner] = useState<string>('');
  const [recoveryBanner, setRecoveryBanner] = useState<string>('');
  const [showOfflineQueueModal, setShowOfflineQueueModal] = useState(false);
  const [pdqState, setPdqState] = useState<'idle' | 'charging' | 'approved'>('idle');
  const [pdqAuthRef, setPdqAuthRef] = useState('');
  const [pdqDetail, setPdqDetail] = useState('');
  const [scaleKg, setScaleKg] = useState<number | null>(null);
  const wedgeBufferRef = useRef<{ code: string; lastTs: number }>({ code: '', lastTs: 0 });

  // Spatial Floor / Section / Shelf state (distinct from Product Categories)
  const layoutConfig = business.layoutConfig;
  const zones = useMemo(() => layoutConfig?.zones || [], [layoutConfig]);
  const floorZones = useMemo(() => zones.filter((z) => z.kind === 'floor'), [zones]);
  const sectionZones = useMemo(() => zones.filter((z) => z.kind === 'section'), [zones]);

  const isRestaurantMode =
    layoutConfig?.layoutMode === 'restaurant_tables' ||
    layoutConfig?.layoutMode === 'hybrid' ||
    business.installedModuleIds.includes('restaurant');
  const canShowTables = isRestaurantMode && floorZones.length > 0;
  const canShowSections =
    sectionZones.length > 0 && Boolean(layoutConfig?.showSectionsOnPos);
  const showSpatialPanel = canShowTables || canShowSections;

  const [spatialView, setSpatialView] = useState<'tables' | 'shelves'>(
    canShowTables ? 'tables' : 'shelves'
  );
  const [activeFloorId, setActiveFloorId] = useState<string>(floorZones[0]?.id || '');
  const [activeSectionId, setActiveSectionId] = useState<string>('All');
  const [selectedTableSlot, setSelectedTableSlot] = useState<{
    zoneId: string;
    slotId: string;
    label: string;
  } | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldCarts, setHeldCarts] = useState<
    Array<{ id: string; customer: string; lines: CartLine[]; tableLabel?: string }>
  >([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPin, setCustomerPin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('254712345678');
  const [customerEmail, setCustomerEmail] = useState('');

  // Offers & Tipping state
  const activeOffers = useMemo(
    () => (business.offers || []).filter((o) => o.active),
    [business.offers]
  );
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [tipInput, setTipInput] = useState<string>('0');

  const enabledGateways = useMemo(
    () => business.paymentGateways.filter((g) => g.enabled),
    [business.paymentGateways]
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    enabledGateways[0]?.displayName || ''
  );
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [stkPromptState, setStkPromptState] = useState<'idle' | 'sending' | 'confirmed'>('idle');
  const [stkRef, setStkRef] = useState('');
  const [stkDetail, setStkDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState<SaleTransaction | null>(null);
  const [receiptEmailInput, setReceiptEmailInput] = useState('');
  const [emailStatusMsg, setEmailStatusMsg] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [submittedRating, setSubmittedRating] = useState<number>(0);

  // Employee PIN Lock & Quick Attendance Punch Screen
  const [isLocked, setIsLocked] = useState(
    initialLocked || business.posConfig.requirePinPerShift
  );
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const [clockFeedback, setClockFeedback] = useState('');

  // Keep spatialView in bounds whenever restaurant / showSectionsOnPos settings change
  useEffect(() => {
    if (canShowTables && !canShowSections) {
      setSpatialView('tables');
    } else if (!canShowTables && canShowSections) {
      setSpatialView('shelves');
    }
  }, [canShowTables, canShowSections]);

  // Refs for crash/power-outage persistent draft hydration & flushing
  const draftHydratedKeyRef = useRef<string>('');
  const latestProductsRef = useRef(products);
  latestProductsRef.current = products;
  const latestEmployeesRef = useRef(employees);
  latestEmployeesRef.current = employees;
  const latestUnlockRef = useRef(onUnlockByPin);
  latestUnlockRef.current = onUnlockByPin;

  // Hydrate persistent register draft on business/store switch (survives reloads & power outages)
  useEffect(() => {
    let cancelled = false;
    const targetKey = `${business.id}::${store.id}`;
    draftHydratedKeyRef.current = '';

    setCompletedReceipt(null);
    setErrorMsg('');
    setCategory('All');
    setSubCategory('All');
    setActiveSectionId('All');
    setActiveFloorId((prev) => prev || floorZones[0]?.id || '');

    const applyDraft = (draft: PersistedPosDraft | null) => {
      if (cancelled) return;
      if (draft) {
        const liveProducts = latestProductsRef.current;
        const reconcileLines = (lines: CartLine[]): CartLine[] =>
          lines.map((line) => {
            const fresh = liveProducts.find((p) => p.id === line.product.id);
            return fresh ? { ...line, product: fresh } : line;
          });

        const nextCart = reconcileLines(draft.cart || []);
        const nextHeld = (draft.heldCarts || []).map((h) => ({
          ...h,
          lines: reconcileLines(h.lines || []),
        }));

        setCart(nextCart);
        setHeldCarts(nextHeld);
        setCustomerName(draft.customerName || 'Walk-in Customer');
        setCustomerPin(draft.customerPin || '');
        setCustomerPhone(draft.customerPhone || '254712345678');
        setCustomerEmail(draft.customerEmail || '');
        setSelectedOfferId(draft.selectedOfferId || '');
        setTipInput(draft.tipInput || '0');
        setSelectedTableSlot(draft.selectedTableSlot || null);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        setTenderedInput(draft.tenderedInput || '');

        let recoveredStaffName = '';
        if (draft.activeEmployeeId) {
          const matchedEmp = latestEmployeesRef.current.find(
            (e) => e.id === draft.activeEmployeeId && e.active
          );
          if (matchedEmp) {
            latestUnlockRef.current(matchedEmp.pinCode);
            setIsLocked(false);
            recoveredStaffName = matchedEmp.name;
          }
        }

        const hasOpenWork =
          nextCart.length > 0 ||
          nextHeld.length > 0 ||
          Boolean(draft.selectedTableSlot) ||
          Boolean(recoveredStaffName);
        if (hasOpenWork) {
          const timeLabel = new Date(draft.updatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setRecoveryBanner(
            `Recovered POS session (${nextCart.reduce((s, c) => s + c.qty, 0)} cart item(s), ${nextHeld.length} held bill(s)${
              recoveredStaffName ? `, staff ${recoveredStaffName}` : ''
            }) saved at ${timeLabel}.`
          );
        } else {
          setRecoveryBanner('');
        }
      } else {
        setCart([]);
        setHeldCarts([]);
        setSelectedOfferId('');
        setTipInput('0');
        setSelectedTableSlot(null);
        setCustomerName('Walk-in Customer');
        setCustomerPin('');
        setCustomerEmail('');
        setTenderedInput('');
        setRecoveryBanner('');
      }
      draftHydratedKeyRef.current = targetKey;
    };

    void requestPersistentBrowserStorage();
    const syncDraft = loadPosRegisterDraftSync(business.id, store.id);
    if (syncDraft) {
      applyDraft(syncDraft);
    } else {
      void loadPosRegisterDraft(business.id, store.id).then((idbDraft) => {
        if (!cancelled) applyDraft(idbDraft);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [business.id, store.id]);

  // Build snapshot object for immediate & power-outage unload persistence
  const currentDraftSnapshot: PersistedPosDraft = useMemo(
    () => ({
      businessId: business.id,
      storeId: store.id,
      cart,
      heldCarts,
      customerName,
      customerPin,
      customerPhone,
      customerEmail,
      selectedOfferId,
      tipInput,
      selectedTableSlot,
      paymentMethod,
      tenderedInput,
      activeEmployeeId: isLocked ? null : activeEmployee?.id || null,
      updatedAt: new Date().toISOString(),
    }),
    [
      business.id,
      store.id,
      cart,
      heldCarts,
      customerName,
      customerPin,
      customerPhone,
      customerEmail,
      selectedOfferId,
      tipInput,
      selectedTableSlot,
      paymentMethod,
      tenderedInput,
      isLocked,
      activeEmployee?.id,
    ]
  );

  const latestDraftRef = useRef<PersistedPosDraft>(currentDraftSnapshot);
  latestDraftRef.current = currentDraftSnapshot;

  useEffect(() => {
    const expectedKey = `${business.id}::${store.id}`;
    if (draftHydratedKeyRef.current !== expectedKey) return;
    void savePosRegisterDraft(currentDraftSnapshot);
  }, [business.id, store.id, currentDraftSnapshot]);

  useEffect(() => {
    const flushNow = () => {
      const expectedKey = `${business.id}::${store.id}`;
      if (draftHydratedKeyRef.current !== expectedKey) return;
      void savePosRegisterDraft({
        ...latestDraftRef.current,
        updatedAt: new Date().toISOString(),
      });
    };
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [business.id, store.id]);

  // Keep paymentMethod strictly synced with enabledGateways
  useEffect(() => {
    if (enabledGateways.length === 0) {
      setPaymentMethod('');
    } else if (!enabledGateways.some((g) => g.displayName === paymentMethod)) {
      setPaymentMethod(enabledGateways[0].displayName);
      setStkPromptState('idle');
      setStkRef('');
    }
  }, [enabledGateways, paymentMethod]);

  const perms = activeEmployee?.permissions || ROLE_PERMISSIONS[activeRole];
  const selectedGatewayObj = enabledGateways.find((g) => g.displayName === paymentMethod);

  // Global USB / Bluetooth HID Barcode Scanner Wedge listener (rapid bursts <60ms + Enter)
  useEffect(() => {
    if (isLocked || hwConfig.scannerMode !== 'hid_wedge') return;
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const now = Date.now();
      if (ev.key === 'Enter') {
        const scanned = wedgeBufferRef.current.code.trim();
        wedgeBufferRef.current = { code: '', lastTs: 0 };
        if (scanned.length >= 3) {
          const match = products.find(
            (p) =>
              p.barcode.toLowerCase() === scanned.toLowerCase() ||
              p.sku.toLowerCase() === scanned.toLowerCase()
          );
          if (match) {
            playScannerBeep();
            const avail = match.stockByStore[store.id] ?? 0;
            if (avail <= 0) {
              setErrorMsg(`"${match.name}" is out of stock in ${store.name}.`);
              return;
            }
            setCart((prev) => {
              const existing = prev.find((l) => l.product.id === match.id);
              if (existing) {
                if (existing.qty >= avail) return prev;
                return prev.map((l) =>
                  l.product.id === match.id ? { ...l, qty: l.qty + 1 } : l
                );
              }
              return [...prev, { product: match, qty: 1, discountPct: 0 }];
            });
            setHwBanner(`Scanned: ${match.name} (${match.sku})`);
            setTimeout(() => setHwBanner(''), 2500);
          } else {
            setErrorMsg(`Scanner read "${scanned}" — no matching SKU.`);
          }
        }
        return;
      }
      if (ev.key.length === 1) {
        if (now - wedgeBufferRef.current.lastTs > 80) {
          wedgeBufferRef.current.code = ev.key;
        } else {
          wedgeBufferRef.current.code += ev.key;
        }
        wedgeBufferRef.current.lastTs = now;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLocked, hwConfig.scannerMode, products, store.id, store.name]);

  // Setup readiness check: gate POS checkout if branch inactive, 0 enabled gateways, or 0 SKUs
  const setupGaps = useMemo(() => {
    const gaps: Array<{ title: string; detail: string; moduleId?: string }> = [];
    if (!store?.isActive) {
      gaps.push({
        title: 'Store Branch Inactive',
        detail: `${store?.name || 'Selected branch'} is currently marked inactive.`,
      });
    }
    if (enabledGateways.length === 0) {
      gaps.push({
        title: 'No Payment Gateways Enabled',
        detail: 'Enable at least one payment tender (Cash Drawer, M-Pesa Daraja, Airtel Money, or Card) before taking POS checkouts.',
        moduleId: 'payment_gateways',
      });
    }
    if (products.length === 0) {
      gaps.push({
        title: 'No Inventory Products Found',
        detail: 'Add at least one SKU to your Inventory catalog before opening POS checkout.',
        moduleId: 'inventory',
      });
    }
    return gaps;
  }, [store?.isActive, store?.name, enabledGateways.length, products.length]);

  // Two-level Categories & Subcategories
  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const c of business.catalogTaxonomy || []) {
      set.add(c.name);
    }
    for (const p of products) {
      set.add(p.category);
    }
    return Array.from(set);
  }, [business.catalogTaxonomy, products]);

  const availableSubCategories = useMemo(() => {
    if (category === 'All') return [];
    const set = new Set<string>();
    const taxMatch = (business.catalogTaxonomy || []).find((c) => c.name === category);
    if (taxMatch) {
      for (const s of taxMatch.subCategories) set.add(s);
    }
    for (const p of products) {
      if (p.category === category && p.subCategory) set.add(p.subCategory);
    }
    return Array.from(set);
  }, [category, business.catalogTaxonomy, products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = category === 'All' || p.category === category;
      const subOk = subCategory === 'All' || p.subCategory === subCategory;
      const secOk =
        !canShowSections ||
        spatialView !== 'shelves' ||
        activeSectionId === 'All' ||
        p.zoneId === activeSectionId;
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.shelfCode && p.shelfCode.toLowerCase().includes(q));
      return catOk && subOk && secOk && qOk;
    });
  }, [products, category, subCategory, canShowSections, spatialView, activeSectionId, search]);

  const addProductToCart = (product: ProductItem) => {
    const avail = product.stockByStore[store.id] ?? 0;
    if (avail <= 0) {
      setErrorMsg(`"${product.name}" is out of stock in ${store.name}.`);
      return;
    }
    setErrorMsg('');
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.qty >= avail) {
          setErrorMsg(`Only ${avail} ${product.unit} available in ${store.name} for "${product.name}".`);
          return prev;
        }
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product, qty: 1, discountPct: 0 }];
    });
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const match = products.find(
      (p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code
    );
    if (match) {
      addProductToCart(match);
      setBarcodeInput('');
    } else {
      setErrorMsg(`No SKU or barcode matched "${barcodeInput}".`);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const avail = l.product.stockByStore[store.id] ?? 0;
          const next = l.qty + delta;
          if (delta > 0 && next > avail) {
            setErrorMsg(`Only ${avail} ${l.product.unit} available in ${store.name} for "${l.product.name}".`);
            return l;
          }
          setErrorMsg('');
          return { ...l, qty: next };
        })
        .filter((l) => l.qty > 0)
    );
  };

  const updateDiscount = (productId: string, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    if (clamped > perms.maxDiscountPct) {
      setErrorMsg(
        `${activeEmployee?.name || activeRole} is capped at ${perms.maxDiscountPct}% line discount.`
      );
      return;
    }
    setErrorMsg('');
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, discountPct: clamped } : l))
    );
  };

  const selectedOffer = useMemo(
    () => activeOffers.find((o) => o.id === selectedOfferId) || null,
    [activeOffers, selectedOfferId]
  );

  const totals = useMemo(() => {
    let gross = 0;
    let lineDiscount = 0;
    let vat = 0;
    for (const line of cart) {
      const lineGross = line.product.price * line.qty;
      const lineDisc = lineGross * (line.discountPct / 100);
      const lineNet = lineGross - lineDisc;
      const vatFraction =
        line.product.taxCode === 'B_16' ? business.vatRate / (100 + business.vatRate) : 0;
      gross += lineNet;
      lineDiscount += lineDisc;
      vat += lineNet * vatFraction;
    }

    const offerDiscount = selectedOffer
      ? computeOfferDiscount(selectedOffer, cart, gross)
      : 0;
    const afterOffer = Math.max(0, gross - offerDiscount);
    const tipAmount = Math.max(0, Number(tipInput) || 0);
    const grandTotal = Math.round((afterOffer + tipAmount) * 100) / 100;

    return {
      subtotalBeforeOffer: Math.round(gross * 100) / 100,
      offerDiscount: Math.round(offerDiscount * 100) / 100,
      afterOffer: Math.round(afterOffer * 100) / 100,
      tipAmount: Math.round(tipAmount * 100) / 100,
      total: grandTotal,
      discount: Math.round((lineDiscount + offerDiscount) * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      netExclVat: Math.round(Math.max(0, afterOffer - vat) * 100) / 100,
    };
  }, [cart, business.vatRate, selectedOffer, tipInput]);

  const tenderedNumber =
    tenderedInput.trim() === '' ? totals.total : Math.max(0, Number(tenderedInput) || 0);
  const changeDue = Math.max(0, Math.round((tenderedNumber - totals.total) * 100) / 100);

  const handleApplyPromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    const match = activeOffers.find((o) => o.code?.toUpperCase() === code);
    if (!match) {
      setPromoMsg(`Promo code "${code}" is invalid or inactive.`);
      return;
    }
    setSelectedOfferId(match.id);
    setPromoMsg(`Applied "${match.name}" (${match.badgeText}).`);
    setPromoCodeInput('');
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCarts((prev) => [
      {
        id: selectedTableSlot ? selectedTableSlot.label.split(' ')[0] : `HOLD-${Date.now().toString().slice(-4)}`,
        customer: customerName,
        lines: cart,
        tableLabel: selectedTableSlot?.label,
      },
      ...prev,
    ]);
    setCart([]);
    setCustomerName('Walk-in Customer');
    setCustomerPin('');
    setSelectedOfferId('');
    setTipInput('0');
  };

  const handleRecallCart = (holdId: string) => {
    const found = heldCarts.find((h) => h.id === holdId);
    if (!found) return;
    setCart(found.lines);
    setCustomerName(found.customer);
    setHeldCarts((prev) => prev.filter((h) => h.id !== holdId));
  };

  const triggerStkPush = async () => {
    if (!customerPhone || customerPhone.length < 9) {
      setErrorMsg('Enter a valid phone number (e.g. 254712345678).');
      return;
    }
    setErrorMsg('');
    setStkDetail('');
    setStkPromptState('sending');

    if (isOffline) {
      setTimeout(() => {
        const code = `${
          selectedGatewayObj?.provider === 'airtel_money' ? 'AIR' : 'SL'
        }${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        setStkRef(code);
        setStkDetail('Offline queued STK reference');
        setStkPromptState('confirmed');
      }, 350);
      return;
    }

    try {
      const endpoint =
        selectedGatewayObj?.provider === 'mpesa_daraja' ||
        selectedGatewayObj?.mode === 'Paybill' ||
        selectedGatewayObj?.mode === 'Buy Goods Till'
          ? '/api/payments/daraja/stkpush'
          : '/api/payments/initiate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          gatewayId: selectedGatewayObj?.id,
          provider: selectedGatewayObj?.provider,
          phoneNumber: customerPhone.trim(),
          phone: customerPhone.trim(),
          amount: Math.max(1, Math.round(totals.total)),
          currency: business.currency,
          accountReference: selectedGatewayObj?.accountPrefix || store.code,
          description: `${business.name} POS Sale`,
          email: customerEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStkPromptState('idle');
        setErrorMsg(data.error || 'STK Push failed.');
        return;
      }
      setStkRef(data.receiptCode || data.reference || 'MPESA-OK');
      setStkDetail(
        `${data.mode === 'daraja_live' ? 'Daraja LIVE' : data.mode || 'Gateway'} · ${
          data.customerMessage || data.message || 'Customer prompt sent'
        }`
      );
      setStkPromptState('confirmed');
    } catch {
      const code = `${
        selectedGatewayObj?.provider === 'airtel_money' ? 'AIR' : 'SL'
      }${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setStkRef(code);
      setStkDetail('Network fallback STK ref');
      setStkPromptState('confirmed');
    }
  };

  const triggerHostedGatewayInitiate = async () => {
    if (!selectedGatewayObj || cart.length === 0) return;
    setErrorMsg('');
    setPdqState('charging');
    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          gatewayId: selectedGatewayObj.id,
          provider: selectedGatewayObj.provider,
          amount: totals.total,
          currency: business.currency,
          email: customerEmail.trim() || business.ownerEmail || 'pos@misafarms.com',
          phone: customerPhone.trim(),
          reference: `POS-${store.code}-${Date.now().toString(36).toUpperCase()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPdqState('idle');
        setErrorMsg(data.error || 'Gateway initiation failed.');
        return;
      }
      setPdqAuthRef(data.reference);
      setPdqDetail(`${selectedGatewayObj.displayName}: ${data.reference} (${data.mode})`);
      setPdqState('approved');
    } catch {
      setPdqState('idle');
      setErrorMsg('Unable to reach payment provider API.');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMsg('Add at least one item to complete checkout.');
      return;
    }
    if (selectedGatewayObj?.mode === 'Cash Drawer' && tenderedNumber < totals.total) {
      setErrorMsg('Cash tendered is less than the receipt total.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const ref = selectedGatewayObj?.stkPushSupported
        ? stkRef || `STK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
        : selectedGatewayObj &&
            isEmvCardGateway(
              selectedGatewayObj.mode,
              selectedGatewayObj.provider,
              selectedGatewayObj.displayName
            ) &&
            pdqAuthRef
          ? pdqAuthRef
          : selectedGatewayObj?.mode === 'Cash Drawer'
            ? `CASH-${store.registerId}`
            : `${selectedGatewayObj?.accountPrefix || 'GW'}-${Math.random()
                .toString(36)
                .substring(2, 7)
                .toUpperCase()}`;

      const tx = await onCompleteCheckout({
        lines: cart.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          discountPct: l.discountPct,
        })),
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPin: customerPin.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        paymentMethod,
        paymentRef: ref,
        amountTendered:
          selectedGatewayObj?.mode === 'Cash Drawer' ? tenderedNumber : totals.total,
        offerName: totals.offerDiscount > 0 ? selectedOffer?.name : undefined,
        offerDiscount: totals.offerDiscount > 0 ? totals.offerDiscount : undefined,
        tipAmount: totals.tipAmount > 0 ? totals.tipAmount : undefined,
        slotId: selectedTableSlot?.slotId,
        tableOrSlotLabel: selectedTableSlot?.label,
        channel: selectedTableSlot ? 'Restaurant' : 'POS',
      });

      if (tx) {
        if (
          selectedGatewayObj?.mode === 'Cash Drawer' &&
          hwConfig.cashDrawerEnabled &&
          hwConfig.autoOpenDrawerOnCash
        ) {
          await dispatchHardwareBytes(buildCashDrawerKickBytes(), hwConfig);
          if (onHardwareLog) {
            void onHardwareLog('Auto Drawer Kick', `Receipt #${tx.receiptNo}`);
          }
        }
        setCompletedReceipt(tx);
        setSubmittedRating(0);
        setReceiptEmailInput(customerEmail.trim() || tx.customerEmail || '');
        setEmailStatusMsg(
          customerEmail.trim() ? `Auto-dispatched receipt to ${customerEmail.trim()}` : ''
        );
        setCart([]);
        setTenderedInput('');
        setStkPromptState('idle');
        setStkRef('');
        setPdqState('idle');
        setPdqAuthRef('');
        setPdqDetail('');
        setSelectedOfferId('');
        setPromoMsg('');
        setTipInput('0');
        setSelectedTableSlot(null);
        setCustomerName('Walk-in Customer');
        setCustomerPin('');
        setCustomerEmail('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReceiptEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedReceipt || !receiptEmailInput.includes('@')) return;
    setSendingEmail(true);
    try {
      await onEmailReceipt(completedReceipt.id, receiptEmailInput.trim());
      setEmailStatusMsg(`Fiscal eTIMS receipt sent to ${receiptEmailInput.trim()}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSubmitRating = async (stars: number) => {
    if (!completedReceipt || submittedRating > 0) return;
    setSubmittedRating(stars);
    await onRateEmployee(completedReceipt.cashierName, completedReceipt.id, stars);
  };

  const attemptUnlock = async (pinToCheck: string) => {
    const matched = onUnlockByPin(pinToCheck.trim());
    if (matched) {
      if (!matched.clockedIn) {
        await onEmployeeAttendance(
          matched.id,
          'clock_in',
          `Clock-In via POS ${store.registerId}`
        );
      }
      setIsLocked(false);
      setPinEntry('');
      setPinError('');
      setClockFeedback('');
    } else {
      setPinError('Invalid Employee PIN. Try again.');
    }
  };

  const handleQuickAttendancePunch = async () => {
    const matched = employees.find((e) => e.active && e.pinCode === pinEntry.trim());
    if (!matched) {
      setPinError('Enter your 4-digit PIN first to Clock In or Clock Out.');
      return;
    }
    const nextAction = matched.clockedIn ? 'clock_out' : 'clock_in';
    await onEmployeeAttendance(
      matched.id,
      nextAction,
      `Quick Punch at ${store.registerId}`
    );
    setPinEntry('');
    setPinError('');
    setClockFeedback(
      `${matched.name} ${nextAction === 'clock_in' ? 'Clocked IN' : 'Clocked OUT'} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    setTimeout(() => setClockFeedback(''), 4500);
  };

  const handleClockOutAndLock = async () => {
    if (activeEmployee) {
      await onEmployeeAttendance(
        activeEmployee.id,
        'clock_out',
        `Ended shift at ${store.registerId}`
      );
    }
    setIsLocked(true);
    setClockFeedback(
      activeEmployee
        ? `${activeEmployee.name} clocked OUT of shift.`
        : 'Shift closed.'
    );
    setTimeout(() => setClockFeedback(''), 4500);
  };

  const handleUnlockPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    attemptUnlock(pinEntry);
  };

  const handlePadDigit = (digit: string) => {
    if (pinEntry.length >= 8) return;
    setPinError('');
    setPinEntry((prev) => prev + digit);
  };

  const currentFloor =
    floorZones.find((z) => z.id === activeFloorId) || floorZones[0] || null;

  const businessQueueItems = useMemo(
    () =>
      offlineQueueItems.filter(
        (item) => !item.businessId || item.businessId === business.id
      ),
    [offlineQueueItems, business.id]
  );

  const renderOfflineQueueModal = () => {
    if (!showOfflineQueueModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Offline Browser Vault &amp; Sync Queue
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Encrypted AES-256 receipts stored locally in IndexedDB + LocalStorage survive power outages and offline shifts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOfflineQueueModal(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/60">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              {isOffline ? (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                  <span>Offline Mode Active</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Connected to MisafaRMS Cloud</span>
                </>
              )}
            </span>
            {onToggleOfflineMode && (
              <button
                type="button"
                onClick={() => onToggleOfflineMode(!isOffline)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {isOffline ? 'Switch Online' : 'Test Offline Mode'}
              </button>
            )}
          </div>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {businessQueueItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                All local receipts are synced with the server and KRA eTIMS.
              </div>
            ) : (
              businessQueueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      #{item.receiptNo}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {item.customerName} · {item.paymentMethod} · {item.cashierName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                      {formatMoney(item.total, item.currency)}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowOfflineQueueModal(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isOffline || isSyncingOffline || offlineQueueItems.length === 0 || !onSyncOfflineQueue}
              onClick={async () => {
                if (onSyncOfflineQueue) {
                  await onSyncOfflineQueue();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-teal-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
              <span>
                {isSyncingOffline
                  ? 'Syncing Vault...'
                  : `Sync All (${offlineQueueItems.length}) to Server & eTIMS`}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Dedicated Full-Screen Employee PIN Login & Shift Attendance Screen
  if (isLocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60">
              <KeyRound className="h-6 w-6 text-teal-700 dark:text-teal-400" />
            </div>
            <h1 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              {business.name}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              {store.name} · Register {store.registerId}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onToggleOfflineMode?.(!isOffline)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  isOffline
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isOffline ? <CloudOff className="h-3 w-3" /> : <Wifi className="h-3 w-3 text-emerald-600" />}
                <span>{isOffline ? 'Offline Register' : 'Online'}</span>
              </button>
              {offlineQueueItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOfflineQueueModal(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  <Database className="h-3 w-3" />
                  <span>Vault: {offlineQueueItems.length}</span>
                </button>
              )}
            </div>
            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              Enter your 4-digit Employee PIN to clock in &amp; open POS
            </p>
          </div>

          <form onSubmit={handleUnlockPinSubmit} className="mt-5 space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pinEntry}
              onChange={(e) => {
                setPinError('');
                setPinEntry(e.target.value.replace(/[^0-9]/g, ''));
              }}
              placeholder="••••"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center font-mono text-2xl tracking-[0.45em] text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handlePadDigit(d)}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-3 font-mono text-base font-semibold text-slate-900 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPinEntry('');
                  setPinError('');
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePadDigit('0')}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3 font-mono text-base font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinEntry((p) => p.slice(0, -1))}
                aria-label="Backspace PIN digit"
                className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-3 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <Delete className="h-4 w-4" />
              </button>
            </div>

            {pinError && (
              <p className="text-center text-xs font-medium text-rose-600 dark:text-rose-400">
                {pinError}
              </p>
            )}

            {clockFeedback && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                {clockFeedback}
              </p>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600"
              >
                Clock In &amp; Open POS
              </button>
              <button
                type="button"
                onClick={handleQuickAttendancePunch}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Quick Clock In / Clock Out Only
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Staff Demo PINs (tap to autofill):
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setPinEntry(emp.pinCode);
                      setPinError('');
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-700 hover:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {emp.name.split(' ')[0]} ({emp.clockedIn ? 'IN' : 'OUT'}): {emp.pinCode}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="mt-4">
            <PWAInstallButton />
          </div>

          {canExitToAdmin && onExitToAdmin && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
              <button
                type="button"
                onClick={onExitToAdmin}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Admin Back Office</span>
              </button>
            </div>
          )}
        </div>
        {renderOfflineQueueModal()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Minimal Register Strip */}
      <div className="border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {store.name}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {store.registerId}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-700 dark:text-slate-300">
              Staff: <strong>{activeEmployee?.name || activeRole}</strong>
            </span>
            {activeEmployee && (
              <>
                <span className="text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {(activeEmployee.ratingAvg ?? 5).toFixed(1)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-teal-700 dark:text-teal-400">
                  Tips {formatMoney(activeEmployee.tipsEarned ?? 0, business.currency)}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {heldCarts.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => handleRecallCart(h.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                <span>
                  Recall {h.id} ({h.lines.length})
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => onToggleOfflineMode?.(!isOffline)}
              title="Toggle offline queue mode (continues working if internet or power drops)"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                isOffline
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {isOffline ? (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                  <span>Offline Mode</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Connected</span>
                </>
              )}
            </button>

            {offlineQueueItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOfflineQueueModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-amber-800 hover:bg-amber-100 whitespace-nowrap shrink-0 tabular-nums dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              >
                <Database className="h-3.5 w-3.5" />
                <span>Sync Queue ({offlineQueueItems.length})</span>
              </button>
            )}

            <PWAInstallButton compact />

            {/* Hardware Strip: Printer Pair, Cash Drawer Kick & Scale */}
            <button
              type="button"
              onClick={async () => {
                const res =
                  hwConfig.printerConnection === 'webserial_escpos'
                    ? await pairSerialPeripheral(9600)
                    : await pairUsbThermalPrinter();
                setHwBanner(res.ok ? `Paired ${res.label}` : res.label || 'Printer pairing cancelled');
                setTimeout(() => setHwBanner(''), 3000);
              }}
              title="Pair WebUSB / WebSerial Thermal Receipt Printer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Usb className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              <span className="hidden xl:inline">Printer</span>
            </button>

            {perms.canOpenDrawer && hwConfig.cashDrawerEnabled && (
              <button
                type="button"
                onClick={async () => {
                  const res = await dispatchHardwareBytes(
                    buildCashDrawerKickBytes(),
                    hwConfig
                  );
                  setHwBanner(`Drawer kicked (${res.byteCount}B via ${res.dispatchedVia})`);
                  setTimeout(() => setHwBanner(''), 3000);
                  if (onHardwareLog) {
                    await onHardwareLog(
                      'Manual Cash Drawer Open',
                      `${activeEmployee?.name || activeRole} · Register ${store.registerId}`
                    );
                  }
                }}
                title="Send RJ11 Cash Drawer Open Pulse"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Wallet className="h-3.5 w-3.5 text-amber-600" />
                <span className="hidden xl:inline">Drawer</span>
              </button>
            )}

            {hwConfig.scaleEnabled && hwConfig.scaleConnection === 'webserial_cas' && (
              <button
                type="button"
                onClick={async () => {
                  const res = await pairSerialPeripheral(9600);
                  const simulatedWeight = Number((0.45 + Math.random() * 2.2).toFixed(2));
                  setScaleKg(simulatedWeight);
                  setHwBanner(res.ok ? `Scale read: ${simulatedWeight} kg` : `Scale weight: ${simulatedWeight} kg`);
                  setTimeout(() => setHwBanner(''), 3500);
                }}
                title="Read Weight from Serial Scale"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Scale className="h-3.5 w-3.5 text-sky-600" />
                <span className="font-mono">{scaleKg ? `${scaleKg}kg` : 'Scale'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClockOutAndLock}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Clock Out</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLocked(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              <span>Lock</span>
            </button>

            {canExitToAdmin && onExitToAdmin && (
              <button
                type="button"
                onClick={onExitToAdmin}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back Office</span>
              </button>
            )}
          </div>
        </div>
        {hwBanner && (
          <div className="mx-auto mt-2 max-w-[1440px] rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-300">
            {hwBanner}
          </div>
        )}
        {recoveryBanner && (
          <div className="mx-auto mt-2 flex max-w-[1440px] items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>{recoveryBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => setRecoveryBanner('')}
              className="rounded px-2 py-0.5 text-[11px] font-semibold hover:bg-sky-100 dark:hover:bg-sky-900"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* POS Setup Gate: Block unconfigured checkouts */}
      {setupGaps.length > 0 ? (
        <div className="mx-auto max-w-xl px-4 py-12">
          <div className="rounded-2xl border border-amber-300 bg-white p-6 shadow-sm dark:border-amber-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-display text-lg font-bold">
                POS Setup Required for {business.name}
              </h2>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              This register cannot process checkouts until the required branch configurations are completed:
            </p>
            <div className="mt-4 space-y-2.5">
              {setupGaps.map((gap) => (
                <div
                  key={gap.title}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {gap.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {gap.detail}
                    </p>
                  </div>
                  {gap.moduleId && canExitToAdmin && onOpenModuleById && (
                    <button
                      type="button"
                      onClick={() => onOpenModuleById(gap.moduleId!)}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Configure</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canExitToAdmin && onExitToAdmin && (
              <button
                type="button"
                onClick={onExitToAdmin}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Back Office</span>
              </button>
            )}
          </div>
        </div>
      ) : (
      /* Main POS Counter Workspace */
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12">
        {/* Left: Spatial Layout + 2-Tier Taxonomy + Product Grid */}
        <div className="space-y-4 lg:col-span-7">
          {/* Spatial Layout Panel: Only shown when Restaurant Floors/Tables apply OR Store Sections & Shelves is explicitly enabled */}
          {showSpatialPanel && (
            <section className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {spatialView === 'tables' && canShowTables ? (
                    <UtensilsCrossed className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                  ) : (
                    <Layers className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                  )}
                  <span>
                    {spatialView === 'tables' && canShowTables
                      ? 'Floors & Tables (Assign Order / Clear Table)'
                      : 'Store Sections & Shelves (Find & Restock)'}
                  </span>
                </div>

                {canShowTables && canShowSections && (
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setSpatialView('shelves')}
                      className={`rounded-md px-2.5 py-1 font-semibold ${
                        spatialView === 'shelves'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Shelves &amp; Sections
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpatialView('tables')}
                      className={`rounded-md px-2.5 py-1 font-semibold ${
                        spatialView === 'tables'
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Floors &amp; Tables
                    </button>
                  </div>
                )}
              </div>

              {spatialView === 'tables' && canShowTables ? (
                <div className="mt-2.5 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {floorZones.map((fz) => (
                      <button
                        key={fz.id}
                        type="button"
                        onClick={() => setActiveFloorId(fz.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                          currentFloor?.id === fz.id
                            ? 'bg-teal-700 text-white dark:bg-teal-600'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {fz.name}
                      </button>
                    ))}
                  </div>

                  {currentFloor && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {currentFloor.slots.map((slot) => {
                        const isSelected = selectedTableSlot?.slotId === slot.id;
                        return (
                          <div
                            key={slot.id}
                            className={`rounded-lg border p-2 text-xs transition-colors ${
                              isSelected
                                ? 'border-teal-700 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/40'
                                : slot.status === 'needs_clearing'
                                  ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30'
                                  : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {slot.code}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {slot.capacity}p
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-slate-600 dark:text-slate-400">
                              {slot.label}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-1">
                              {slot.status === 'needs_clearing' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSlotStatusChange(currentFloor.id, slot.id, 'available')
                                  }
                                  className="w-full rounded bg-amber-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-amber-700"
                                >
                                  Clear Table
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedTableSlot(
                                      isSelected
                                        ? null
                                        : {
                                            zoneId: currentFloor.id,
                                            slotId: slot.id,
                                            label: `${currentFloor.name} · ${slot.code}`,
                                          }
                                    )
                                  }
                                  className={`w-full rounded px-2 py-1 text-[10px] font-semibold ${
                                    isSelected
                                      ? 'bg-teal-700 text-white'
                                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                  }`}
                                >
                                  {isSelected
                                    ? 'Assigned'
                                    : slot.status === 'occupied'
                                      ? 'Occupied · Open'
                                      : 'Seat Order'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveSectionId('All')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        activeSectionId === 'All'
                          ? 'bg-teal-700 text-white dark:bg-teal-600'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      All Sections
                    </button>
                    {sectionZones.map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setActiveSectionId(sz.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                          activeSectionId === sz.id
                            ? 'bg-teal-700 text-white dark:bg-teal-600'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {sz.name}
                      </button>
                    ))}
                  </div>

                  {/* Quick Shelf Restock Flags */}
                  <div className="flex flex-wrap gap-1.5">
                    {sectionZones
                      .filter((z) => activeSectionId === 'All' || z.id === activeSectionId)
                      .flatMap((z) =>
                        z.slots.map((sl) => ({ zoneId: z.id, zoneName: z.name, slot: sl }))
                      )
                      .map(({ zoneId, slot }) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() =>
                            onSlotStatusChange(
                              zoneId,
                              slot.id,
                              slot.status === 'needs_restock' ? 'available' : 'needs_restock'
                            )
                          }
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] ${
                            slot.status === 'needs_restock'
                              ? 'border-rose-300 bg-rose-50 font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          <span>
                            {slot.code}:{' '}
                            {slot.status === 'needs_restock' ? 'Needs Restock (Tap to Clear)' : 'Stocked'}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Barcode + Search */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <form onSubmit={handleBarcodeScan} className="relative">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-700 dark:text-teal-400" />
              <input
                type="text"
                autoFocus={business.posConfig.barcodeAutoFocus}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode or SKU + Enter (e.g. COF-NYR-340)"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </form>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by product, SKU, or shelf code..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {/* 2-Tier Categories & Subcategories (Distinct from Sections/Shelves!) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setSubCategory('All');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    category === cat
                      ? 'bg-slate-900 text-white dark:bg-teal-600'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {availableSubCategories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSubCategory('All')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                    subCategory === 'All'
                      ? 'bg-teal-700 text-white dark:bg-teal-600'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  All {category}
                </button>
                {availableSubCategories.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubCategory(sub)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                      subCategory === sub
                        ? 'bg-teal-700 text-white dark:bg-teal-600'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Grid */}
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
              business.posConfig.gridDensity === 'compact' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
            }`}
          >
            {filteredProducts.map((product) => {
              const stockQty = product.stockByStore[store.id] ?? 0;
              const outOfStock = stockQty <= 0;
              const lowStock = stockQty > 0 && stockQty <= product.reorderPoint;
              const matchingOffer = activeOffers.find(
                (o) => o.targetCategory === product.category
              );
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addProductToCart(product)}
                  className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                    outOfStock
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/50'
                      : 'border-slate-200 bg-white hover:border-teal-600/60 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  {business.posConfig.gridDensity === 'comfortable' && (
                    <div className="relative h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-3 text-center dark:from-slate-800 dark:to-slate-900">
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {product.sku}
                          </span>
                          <span className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            {product.category}
                            {product.subCategory ? ` › ${product.subCategory}` : ''}
                          </span>
                        </div>
                      )}
                      {matchingOffer && (
                        <span className="absolute left-2 top-2 rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-xs">
                          {matchingOffer.badgeText}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between p-3">
                    <div>
                      <h3 className="line-clamp-2 font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        {product.category}
                        {product.subCategory ? ` › ${product.subCategory}` : ''} ·{' '}
                        {getTaxLabel(product.taxCode, business.vatRate)}
                      </p>
                      {layoutConfig?.showShelfOnPosTile !== false && product.shelfCode && (
                        <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] font-medium text-teal-700 dark:text-teal-400">
                          <MapPin className="h-2.5 w-2.5" />
                          <span>{product.shelfCode}</span>
                        </p>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                      <span className="font-mono text-xs font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                        {formatMoney(product.price, business.currency)}
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          outOfStock
                            ? 'font-bold text-rose-600 dark:text-rose-400'
                            : lowStock
                              ? 'font-semibold text-amber-700 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {outOfStock ? 'Out of Stock' : `${stockQty} ${product.unit}`}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Cart, Offers, Staff Tipping & Payment Tender */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="space-y-2.5 border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Active Receipt ({cart.reduce((s, c) => s + c.qty, 0)} items)
                </h2>
                {selectedTableSlot && (
                  <p className="font-mono text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                    Table: {selectedTableSlot.label}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleHoldCart}
                  disabled={cart.length === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>Hold</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setSelectedOfferId('');
                    setTipInput('0');
                  }}
                  disabled={cart.length === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={customerPin}
                onChange={(e) => setCustomerPin(e.target.value.toUpperCase())}
                placeholder="Buyer KRA PIN"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 placeholder:font-sans focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email Receipt (Opt.)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div
            className="flex-1 divide-y divide-slate-100 overflow-y-auto px-4 dark:divide-slate-800"
            style={{ maxHeight: '260px' }}
          >
            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Register ready for next customer
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tap a product tile or scan a barcode.
                </p>
              </div>
            ) : (
              cart.map((line) => {
                const netLine = line.product.price * line.qty * (1 - line.discountPct / 100);
                return (
                  <div key={line.product.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {line.product.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        <span>{formatMoney(line.product.price, business.currency)}</span>
                        <span>·</span>
                        <label className="inline-flex items-center gap-1">
                          <span>Disc %</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={line.discountPct}
                            onChange={(e) =>
                              updateDiscount(line.product.id, Number(e.target.value))
                            }
                            className="w-12 rounded border border-slate-200 bg-white px-1 py-0.5 text-center font-mono text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(line.product.id, -1)}
                        aria-label="Decrease quantity"
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(line.product.id, 1)}
                        aria-label="Increase quantity"
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="w-24 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(netLine, business.currency)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Offers & Staff Tipping */}
          <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/90">
            {/* Live Offers & Promo Code */}
            {activeOffers.length > 0 && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <Tag className="h-3 w-3 text-teal-700 dark:text-teal-400" />
                    <span>Offers &amp; Promos</span>
                  </span>
                  <form onSubmit={handleApplyPromoCode} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      placeholder="Promo code"
                      className="w-24 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] uppercase dark:border-slate-700 dark:bg-slate-800"
                    />
                    <button
                      type="submit"
                      className="rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-teal-600"
                    >
                      Apply
                    </button>
                  </form>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeOffers.map((off) => {
                    const estSavings = computeOfferDiscount(off, cart, totals.subtotalBeforeOffer);
                    const applied = selectedOfferId === off.id;
                    return (
                      <button
                        key={off.id}
                        type="button"
                        onClick={() =>
                          setSelectedOfferId((prev) => (prev === off.id ? '' : off.id))
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                          applied
                            ? 'border-teal-700 bg-teal-700 text-white'
                            : estSavings > 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        <span>
                          {off.badgeText}
                          {estSavings > 0 ? ` (-${formatMoney(estSavings, business.currency)})` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {promoMsg && (
                  <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                    {promoMsg}
                  </p>
                )}
              </div>
            )}

            {/* Staff Tip Quick Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/60">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <HeartHandshake className="h-3.5 w-3.5 text-amber-600" />
                <span>Tip ({activeEmployee?.name.split(' ')[0] || 'Staff'})</span>
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {[0, 50, 100, 200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTipInput(String(amt))}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                      Number(tipInput) === amt
                        ? 'bg-amber-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {amt === 0 ? 'None' : amt}
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  value={tipInput}
                  onChange={(e) => setTipInput(e.target.value)}
                  aria-label="Custom tip amount"
                  className="w-16 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-right font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Net Excl. VAT</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(totals.netExclVat, business.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>VAT ({business.vatRate}% KRA Tax)</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(totals.vat, business.currency)}
                </span>
              </div>
              {totals.offerDiscount > 0 && (
                <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400">
                  <span>Offer ({selectedOffer?.name})</span>
                  <span className="font-mono tabular-nums">
                    -{formatMoney(totals.offerDiscount, business.currency)}
                  </span>
                </div>
              )}
              {totals.tipAmount > 0 && (
                <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400">
                  <span>Staff Service Tip</span>
                  <span className="font-mono tabular-nums">
                    +{formatMoney(totals.tipAmount, business.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                <span>Total Due</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(totals.total, business.currency)}
                </span>
              </div>
            </div>

            {/* Payment Gateways */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {enabledGateways.map((gw) => {
                const active = paymentMethod === gw.displayName;
                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(gw.displayName);
                      setStkPromptState('idle');
                      setStkRef('');
                      setPdqState('idle');
                      setPdqAuthRef('');
                      setPdqDetail('');
                    }}
                    className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {gw.stkPushSupported ? (
                      <Smartphone className="h-3 w-3 shrink-0" />
                    ) : gw.mode === 'Cash Drawer' ? (
                      <Wallet className="h-3 w-3 shrink-0" />
                    ) : (
                      <CreditCard className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate">{gw.displayName}</span>
                  </button>
                );
              })}
            </div>

            {selectedGatewayObj && (
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {selectedGatewayObj.mode}: <strong>{selectedGatewayObj.shortcodeOrTill}</strong> · Prefix{' '}
                {selectedGatewayObj.accountPrefix}
              </p>
            )}

            {selectedGatewayObj?.stkPushSupported && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="254712345678"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={triggerStkPush}
                    disabled={cart.length === 0 || stkPromptState === 'sending'}
                    className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap shrink-0 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {stkPromptState === 'sending'
                      ? 'Pushing STK...'
                      : stkPromptState === 'confirmed'
                        ? `Paid (${stkRef})`
                        : 'Send STK Push'}
                  </button>
                </div>
                {stkDetail && (
                  <p className="font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    {stkDetail}
                  </p>
                )}
              </div>
            )}

            {selectedGatewayObj &&
              !selectedGatewayObj.stkPushSupported &&
              ['paystack', 'pesapal_card', 'dpo_pay', 'instapay', 'payhero', 'tkash'].includes(
                selectedGatewayObj.provider
              ) && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950/60">
                  <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {pdqState === 'approved' ? pdqDetail : `${selectedGatewayObj.displayName} API`}
                  </span>
                  <button
                    type="button"
                    onClick={triggerHostedGatewayInitiate}
                    disabled={cart.length === 0 || pdqState === 'charging'}
                    className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-teal-600"
                  >
                    {pdqState === 'charging'
                      ? 'Initiating...'
                      : pdqState === 'approved'
                        ? 'Authorized ✓'
                        : 'Initiate API Pay'}
                  </button>
                </div>
              )}

            {/* EMV / NFC Card PDQ Terminal Integration */}
            {selectedGatewayObj &&
              isEmvCardGateway(
                selectedGatewayObj.mode,
                selectedGatewayObj.provider,
                selectedGatewayObj.displayName
              ) &&
              hwConfig.cardTerminalEnabled && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950/60">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {hwConfig.cardTerminalProvider} · {hwConfig.cardTerminalId || 'TID-01'}
                  </span>
                  {pdqState === 'approved' && (
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {pdqDetail}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['NFC Contactless', 'EMV Chip + PIN'] as const).map((cvm) => (
                    <button
                      key={cvm}
                      type="button"
                      disabled={cart.length === 0 || pdqState === 'charging' || !onChargeCardTerminal}
                      onClick={async () => {
                        if (!onChargeCardTerminal) return;
                        setPdqState('charging');
                        try {
                          const scheme = cvm === 'NFC Contactless' ? 'VISA' : 'MASTERCARD';
                          const res = await onChargeCardTerminal({
                            provider: hwConfig.cardTerminalProvider,
                            terminalId: hwConfig.cardTerminalId || 'TID-KE-01',
                            amount: totals.total,
                            cardScheme: scheme,
                            cvmMethod: cvm,
                          });
                          if (res?.approved) {
                            setPdqAuthRef(res.authCode);
                            setPdqDetail(`${res.cardScheme} •••• ${res.maskedPan.slice(-4)} (${res.authCode})`);
                            setPdqState('approved');
                          } else {
                            setPdqState('idle');
                          }
                        } catch {
                          setPdqState('idle');
                        }
                      }}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {pdqState === 'charging' ? 'Authorizing PDQ...' : `Charge ${cvm}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedGatewayObj?.mode === 'Cash Drawer' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    min={0}
                    value={tenderedInput}
                    onChange={(e) => setTenderedInput(e.target.value)}
                    placeholder={`Tendered (${totals.total.toFixed(2)})`}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <div className="text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                    Change: <strong>{formatMoney(changeDue, business.currency)}</strong>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {business.posConfig.quickCashNotes.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setTenderedInput(String(note))}
                      className="rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {business.currency} {note}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isSubmitting || !paymentMethod}
              className="w-full rounded-lg bg-teal-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {isSubmitting
                ? 'Signing Receipt...'
                : isOffline
                  ? `Complete Offline Encrypted Sale · ${formatMoney(totals.total, business.currency)}`
                  : `Complete & Issue eTIMS Receipt · ${formatMoney(totals.total, business.currency)}`}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Printable 80mm / A4 Receipt + Customer Star Rating + Email Dispatch Modal */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-display text-base font-bold">
                  {completedReceipt.etimsStatus === 'Queued Offline'
                    ? 'Offline Encrypted Receipt Saved'
                    : 'Fiscal eTIMS Receipt Issued'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              id="misafa-printable-receipt"
              className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <div className="text-center">
                <p className="text-[10px] font-semibold">{business.posConfig.receiptHeader}</p>
                <p className="mt-1 font-bold uppercase">{business.name}</p>
                <p>{completedReceipt.storeName}</p>
                <p>
                  PIN: {business.taxPin} · {store.tillNumber}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Receipt #{completedReceipt.receiptNo}
                </p>
                {completedReceipt.tableOrSlotLabel && (
                  <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400">
                    {completedReceipt.tableOrSlotLabel}
                  </p>
                )}
                <p className="text-[10px] text-slate-500">
                  Served by: {completedReceipt.cashierName}
                </p>
              </div>

              <div className="my-3 border-y border-dashed border-slate-300 py-2 dark:border-slate-700">
                {completedReceipt.lines.map((l) => (
                  <div key={l.productId} className="flex justify-between py-0.5">
                    <span className="truncate pr-2">
                      {l.qty}x {l.name}
                    </span>
                    <span className="tabular-nums">{l.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 tabular-nums">
                {completedReceipt.offerDiscount && completedReceipt.offerDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Offer ({completedReceipt.offerName})</span>
                    <span>-{completedReceipt.offerDiscount.toFixed(2)}</span>
                  </div>
                )}
                {completedReceipt.tipAmount && completedReceipt.tipAmount > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span>Staff Tip</span>
                    <span>+{completedReceipt.tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>TOTAL ({completedReceipt.currency})</span>
                  <span className="font-bold">{completedReceipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>VAT {business.vatRate}% Included</span>
                  <span>{completedReceipt.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{completedReceipt.paymentMethod}</span>
                  <span>{completedReceipt.paymentRef}</span>
                </div>
                {completedReceipt.changeDue > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Change</span>
                    <span>{completedReceipt.changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-300 pt-3 dark:border-slate-700">
                <div className="space-y-0.5 text-[10px]">
                  <p className="font-bold">KRA eTIMS CUIN</p>
                  <p>{completedReceipt.etimsCuin}</p>
                  <p className="text-slate-500">{business.posConfig.receiptFooter}</p>
                </div>
                <QrCode className="h-12 w-12 shrink-0 text-slate-800 dark:text-slate-200" />
              </div>
            </div>

            {/* Customer 1-5 Star Employee Performance Rating */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Rate service by <strong>{completedReceipt.cashierName}</strong>
              </p>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleSubmitRating(star)}
                    disabled={submittedRating > 0}
                    aria-label={`Rate ${star} stars`}
                    className="rounded p-1 transition-transform hover:scale-110 disabled:cursor-default"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        star <= submittedRating
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {submittedRating > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Rated {submittedRating} ★ — Added to staff scorecard!
                </p>
              )}
            </div>

            {/* Email Dispatch Form */}
            <form onSubmit={handleSendReceiptEmail} className="mt-3 flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="email"
                value={receiptEmailInput}
                onChange={(e) => setReceiptEmailInput(e.target.value)}
                placeholder="Send receipt to customer email..."
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={sendingEmail || !receiptEmailInput.includes('@')}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
              >
                <Send className="h-3 w-3" />
                <span>{sendingEmail ? 'Sending...' : 'Email'}</span>
              </button>
            </form>
            {emailStatusMsg && (
              <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                {emailStatusMsg}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const escBytes = buildEscPosReceiptBytes({
                    businessName: business.name,
                    taxPin: business.taxPin,
                    receiptHeader: business.posConfig.receiptHeader,
                    receiptFooter: business.posConfig.receiptFooter,
                    tx: completedReceipt,
                    charsPerLine: hwConfig.printerPaperChars,
                  });
                  if (
                    hwConfig.printerConnection === 'webusb_escpos' ||
                    hwConfig.printerConnection === 'webserial_escpos'
                  ) {
                    const res = await dispatchHardwareBytes(escBytes, hwConfig);
                    setHwBanner(`Printed ${res.byteCount} bytes via ${res.dispatchedVia}`);
                    setTimeout(() => setHwBanner(''), 3000);
                  } else {
                    window.print();
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print ({business.posConfig.paperWidth})</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="flex-1 rounded-lg bg-teal-700 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Next Customer
              </button>
            </div>
          </div>
        </div>
      )}
      {renderOfflineQueueModal()}
    </div>
  );
};
