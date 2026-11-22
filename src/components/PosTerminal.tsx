import React, { useMemo, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Mail,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  Send,
  Settings2,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  AccountTier,
  BusinessEntity,
  CartLine,
  EmployeeRecord,
  PaymentMethod,
  PosCustomizationConfig,
  ProductItem,
  SaleTransaction,
  StoreBranch,
  UserRole,
} from '../types/erp';
import { formatMoney, getTaxLabel, ROLE_PERMISSIONS } from '../utils/cryptoSync';

interface PosTerminalProps {
  business: BusinessEntity;
  store: StoreBranch;
  products: ProductItem[];
  transactions: SaleTransaction[];
  employees: EmployeeRecord[];
  activeEmployee: EmployeeRecord | null;
  onUnlockByPin: (pin: string) => EmployeeRecord | null;
  accountTier: AccountTier;
  activeRole: UserRole;
  isOffline: boolean;
  onUpdatePosConfig: (config: PosCustomizationConfig) => Promise<void>;
  onEmailReceipt: (txId: string, email: string) => Promise<void>;
  onCompleteCheckout: (payload: {
    lines: Array<{ productId: string; qty: number; discountPct: number }>;
    customerName: string;
    customerPin: string;
    customerPhone: string;
    customerEmail?: string;
    paymentMethod: PaymentMethod;
    paymentRef: string;
    amountTendered: number;
    channel: 'POS';
  }) => Promise<SaleTransaction | null>;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  business,
  store,
  products,
  transactions,
  employees,
  activeEmployee,
  onUnlockByPin,
  accountTier,
  activeRole,
  isOffline,
  onUpdatePosConfig,
  onEmailReceipt,
  onCompleteCheckout,
}) => {
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldCarts, setHeldCarts] = useState<
    Array<{ id: string; customer: string; lines: CartLine[] }>
  >([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPin, setCustomerPin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('254712345678');
  const [customerEmail, setCustomerEmail] = useState('');

  const enabledGateways = useMemo(
    () => business.paymentGateways.filter((g) => g.enabled),
    [business.paymentGateways]
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    enabledGateways[0]?.displayName || 'M-Pesa STK (Daraja)'
  );
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [stkPromptState, setStkPromptState] = useState<'idle' | 'sending' | 'confirmed'>('idle');
  const [stkRef, setStkRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedReceipt, setCompletedReceipt] = useState<SaleTransaction | null>(null);
  const [receiptEmailInput, setReceiptEmailInput] = useState('');
  const [emailStatusMsg, setEmailStatusMsg] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showZReport, setShowZReport] = useState(false);

  // PIN Lock & Shift Switcher
  const [isLocked, setIsLocked] = useState(business.posConfig.requirePinPerShift);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');

  // POS Customization & Shortcut Modal
  const [showCustomize, setShowCustomize] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PosCustomizationConfig>(business.posConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  const perms = activeEmployee?.permissions || ROLE_PERMISSIONS[activeRole];
  const canCustomizePos = accountTier === 'admin' || activeRole === 'Store Manager';

  const selectedGatewayObj = enabledGateways.find((g) => g.displayName === paymentMethod);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const p of products) {
      set.add(p.category);
    }
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = category === 'All' || p.category === category;
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      return catOk && qOk;
    });
  }, [products, category, search]);

  const addProductToCart = (product: ProductItem) => {
    setErrorMsg('');
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
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
      setErrorMsg('');
    } else {
      setErrorMsg(`No SKU or barcode matched "${barcodeInput}".`);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const updateDiscount = (productId: string, val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    if (clamped > perms.maxDiscountPct) {
      setErrorMsg(
        `${activeEmployee?.name || activeRole} is capped at ${perms.maxDiscountPct}% line discount. Unlock with Store Manager PIN (1234) for higher overrides.`
      );
      return;
    }
    setErrorMsg('');
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, discountPct: clamped } : l))
    );
  };

  const totals = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let vat = 0;
    for (const line of cart) {
      const lineGross = line.product.price * line.qty;
      const lineDisc = lineGross * (line.discountPct / 100);
      const lineNet = lineGross - lineDisc;
      const vatFraction =
        line.product.taxCode === 'B_16' ? business.vatRate / (100 + business.vatRate) : 0;
      gross += lineNet;
      discount += lineDisc;
      vat += lineNet * vatFraction;
    }
    return {
      total: Math.round(gross * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      netExclVat: Math.round((gross - vat) * 100) / 100,
    };
  }, [cart, business.vatRate]);

  const tenderedNumber =
    tenderedInput.trim() === '' ? totals.total : Math.max(0, Number(tenderedInput) || 0);
  const changeDue = Math.max(0, Math.round((tenderedNumber - totals.total) * 100) / 100);

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    setHeldCarts((prev) => [
      { id: `HOLD-${Date.now().toString().slice(-4)}`, customer: customerName, lines: cart },
      ...prev,
    ]);
    setCart([]);
    setCustomerName('Walk-in Customer');
    setCustomerPin('');
  };

  const handleRecallCart = (holdId: string) => {
    const found = heldCarts.find((h) => h.id === holdId);
    if (!found) return;
    setCart(found.lines);
    setCustomerName(found.customer);
    setHeldCarts((prev) => prev.filter((h) => h.id !== holdId));
  };

  const triggerStkPush = () => {
    if (!customerPhone || customerPhone.length < 9) {
      setErrorMsg('Enter a valid phone number (e.g. 254712345678).');
      return;
    }
    setErrorMsg('');
    setStkPromptState('sending');
    setTimeout(() => {
      const code = `${
        selectedGatewayObj?.provider === 'airtel_money' ? 'AIR' : 'SL'
      }${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setStkRef(code);
      setStkPromptState('confirmed');
    }, 600);
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
        channel: 'POS',
      });

      if (tx) {
        setCompletedReceipt(tx);
        setReceiptEmailInput(customerEmail.trim() || tx.customerEmail || '');
        setEmailStatusMsg(
          customerEmail.trim() ? `Auto-dispatched receipt to ${customerEmail.trim()}` : ''
        );
        setCart([]);
        setTenderedInput('');
        setStkPromptState('idle');
        setStkRef('');
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

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = onUnlockByPin(pinEntry.trim());
    if (matched) {
      setIsLocked(false);
      setPinEntry('');
      setPinError('');
    } else {
      setPinError('Invalid 4-digit Employee PIN.');
    }
  };

  const handleDownloadPosShortcut = (type: 'launcher' | 'cheatsheet') => {
    const portalUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/?pos=1` : `https://${business.slug}.misafarms.com/`;
    if (type === 'launcher') {
      const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${business.name} — POS Terminal</title></head>
<body style="font-family:sans-serif;text-align:center;padding:48px;">
  <h2>${business.name} · ${store.name}</h2>
  <p>Launching MisafaRMS Point of Sale (${store.registerId})...</p>
  <p><a href="${portalUrl}">${portalUrl}</a></p>
  <script>window.location.replace(${JSON.stringify(portalUrl)});</script>
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-pos-shortcut.html`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const txt = `MisafaRMS POS COUNTER SHORTCUTS & CONFIG
Business: ${business.name} (${business.slug}.misafarms.com)
Branch: ${store.name} (${store.code}) | Register: ${store.registerId}
KRA eTIMS Serial: ${store.vscuSerial} | PIN: ${business.taxPin}

KEYBOARD & WORKFLOW SHORTCUTS
- Barcode Scan Box: Auto-focus + Enter adds SKU immediately
- Hold Order: Park active customer basket and serve next buyer
- Lock Terminal: Switch cashier shift via 4-digit Employee PIN
- Enabled Payment Gateways: ${enabledGateways.map((g) => `${g.displayName} (${g.shortcodeOrTill})`).join(', ')}
`;
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-pos-shortcuts.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSavePosCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await onUpdatePosConfig(draftConfig);
      setShowCustomize(false);
    } finally {
      setSavingConfig(false);
    }
  };

  const storeShiftTransactions = useMemo(
    () => transactions.filter((t) => t.storeId === store.id),
    [transactions, store.id]
  );

  const shiftSummary = useMemo(() => {
    let totalGross = 0;
    let totalVat = 0;
    const byGateway: Record<string, number> = {};
    for (const tx of storeShiftTransactions) {
      totalGross += tx.total;
      totalVat += tx.taxAmount;
      byGateway[tx.paymentMethod] = (byGateway[tx.paymentMethod] || 0) + tx.total;
    }
    return {
      count: storeShiftTransactions.length,
      totalGross,
      totalVat,
      byGateway,
    };
  }, [storeShiftTransactions]);

  return (
    <div className="relative space-y-4">
      {/* POS Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Point of Sale · {store.name}
          </h1>
          <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
            Operator: <strong className="text-slate-800 dark:text-slate-200">{activeEmployee?.name || activeRole}</strong> ({activeEmployee?.role || activeRole}, Max Disc {perms.maxDiscountPct}%) · Register {store.registerId}
          </p>
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
            onClick={() => handleDownloadPosShortcut('launcher')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
            <span>Download Shortcut</span>
          </button>

          {canCustomizePos && (
            <button
              type="button"
              onClick={() => {
                setDraftConfig(business.posConfig);
                setShowCustomize(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Customize POS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsLocked(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            <span>Switch PIN</span>
          </button>

          <button
            type="button"
            onClick={() => setShowZReport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>X / Z Report</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Fast Barcode + Product Catalog */}
        <div className="space-y-4 lg:col-span-7">
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
              placeholder="Filter catalog by name or category..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
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

          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
              business.posConfig.gridDensity === 'compact' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
            }`}
          >
            {filteredProducts.map((product) => {
              const stockQty = product.stockByStore[store.id] ?? 0;
              const lowStock = stockQty <= product.reorderPoint;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProductToCart(product)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all hover:border-teal-600/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-slate-800 dark:bg-slate-900"
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
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between p-3">
                    <div>
                      <h3 className="line-clamp-2 font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        {product.sku} · {getTaxLabel(product.taxCode, business.vatRate)}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                      <span className="font-mono text-xs font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                        {formatMoney(product.price, business.currency)}
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          lowStock
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {stockQty} {product.unit}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Cart & Customizable Payment Gateways */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="space-y-2.5 border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Active Receipt ({cart.reduce((s, c) => s + c.qty, 0)} items)
              </h2>
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
                  onClick={() => setCart([])}
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
            style={{ maxHeight: '290px' }}
          >
            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Register ready for next customer
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Click a product tile or scan a barcode.
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

          {/* Totals & Dynamic Payment Methods */}
          <div className="space-y-3.5 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/90">
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
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                <span>Total Due</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(totals.total, business.currency)}
                </span>
              </div>
            </div>

            {/* Dynamic Payment Gateway Grid */}
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
              disabled={cart.length === 0 || isSubmitting}
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

      {/* Employee 4-Digit POS PIN Lock Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60">
                <KeyRound className="h-5 w-5 text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  POS Terminal PIN Lock
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter Employee 4-digit PIN to unlock shift
                </p>
              </div>
            </div>

            <form onSubmit={handleUnlockPin} className="mt-4 space-y-3">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={pinEntry}
                onChange={(e) => setPinEntry(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Enter PIN (e.g. 1234)"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-center font-mono text-lg tracking-widest text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              {/* Quick Test PIN Selector */}
              <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <p className="font-semibold">Active Staff PINs:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setPinEntry(emp.pinCode)}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] hover:border-teal-600 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {emp.name.split(' ')[0]} ({emp.role}): {emp.pinCode}
                    </button>
                  ))}
                </div>
              </div>

              {pinError && <p className="text-xs font-medium text-rose-600">{pinError}</p>}

              <button
                type="submit"
                className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Unlock Register
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Printable 80mm / A4 Receipt + Email Dispatch Modal */}
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
                  <p>Status: {completedReceipt.etimsStatus}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                  <QrCode className="h-11 w-11 text-slate-900 dark:text-slate-100" />
                </div>
              </div>

              <p className="mt-3 text-center text-[10px] text-slate-500">
                {business.posConfig.receiptFooter}
              </p>
            </div>

            {/* Send Receipt to Email Form */}
            <form onSubmit={handleSendReceiptEmail} className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={receiptEmailInput}
                  onChange={(e) => setReceiptEmailInput(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={sendingEmail}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sendingEmail ? 'Sending...' : 'Email Receipt'}</span>
              </button>
            </form>

            {emailStatusMsg && (
              <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {emailStatusMsg}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print ({business.posConfig.paperWidth})</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
              >
                Next Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Customization & Shortcut Export Modal */}
      {showCustomize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Customize POS & Export Counter Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePosCustomization} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Receipt Header Text
                </label>
                <input
                  type="text"
                  value={draftConfig.receiptHeader}
                  onChange={(e) =>
                    setDraftConfig((c) => ({ ...c, receiptHeader: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Receipt Footer Message
                </label>
                <input
                  type="text"
                  value={draftConfig.receiptFooter}
                  onChange={(e) =>
                    setDraftConfig((c) => ({ ...c, receiptFooter: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Receipt Paper Format
                  </label>
                  <select
                    value={draftConfig.paperWidth}
                    onChange={(e) =>
                      setDraftConfig((c) => ({
                        ...c,
                        paperWidth: e.target.value as '80mm' | 'A4',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="80mm">80mm Thermal Roll</option>
                    <option value="A4">A4 Tax Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Catalog Grid Density
                  </label>
                  <select
                    value={draftConfig.gridDensity}
                    onChange={(e) =>
                      setDraftConfig((c) => ({
                        ...c,
                        gridDensity: e.target.value as 'comfortable' | 'compact',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="comfortable">Comfortable (With Photos)</option>
                    <option value="compact">Compact (High-Speed Counter)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draftConfig.barcodeAutoFocus}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, barcodeAutoFocus: e.target.checked }))
                    }
                  />
                  <span>Auto-Focus Barcode Scanner</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draftConfig.requirePinPerShift}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, requirePinPerShift: e.target.checked }))
                    }
                  />
                  <span>Require Employee PIN on Open</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPosShortcut('launcher')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>POS Shortcut (.html)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPosShortcut('cheatsheet')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Key Guide (.txt)</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                >
                  {savingConfig ? 'Saving...' : 'Save Customization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamics RMS X / Z Shift Report Drawer */}
      {showZReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Dynamics RMS · X/Z Shift Reconciliation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {store.name} · Register {store.registerId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowZReport(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Shift Receipts</span>
                  <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {shiftSummary.count}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Gross Shift Revenue</span>
                  <p className="font-mono text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
                    {formatMoney(shiftSummary.totalGross, business.currency)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(shiftSummary.byGateway).map(([method, amt]) => (
                  <div key={method} className="flex justify-between py-2">
                    <span className="text-slate-600 dark:text-slate-400">{method}</span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatMoney(amt, business.currency)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold">
                  <span>KRA eTIMS Output VAT ({business.vatRate}%)</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(shiftSummary.totalVat, business.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowZReport(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white dark:bg-teal-600"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
