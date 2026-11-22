import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { BusinessEntity, OnlineOrder, ProductItem, StoreBranch } from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface EcommerceDomainWorkspaceProps {
  business: BusinessEntity;
  stores: StoreBranch[];
  activeStore: StoreBranch;
  products: ProductItem[];
  isAdmin: boolean;
  onUpdateDomainConfig: (patch: {
    ecommerceEnabled?: boolean;
    customDomain?: string;
    verifyDomain?: boolean;
    storefrontTagline?: string;
    deliveryFee?: number;
    freeDeliveryAbove?: number;
    storefrontPickupEnabled?: boolean;
  }) => Promise<void>;
  onPlaceOnlineOrder: (payload: {
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
  }) => Promise<OnlineOrder | null>;
}

export const EcommerceDomainWorkspace: React.FC<EcommerceDomainWorkspaceProps> = ({
  business,
  stores,
  activeStore,
  products,
  isAdmin,
  onUpdateDomainConfig,
  onPlaceOnlineOrder,
}) => {
  const [tab, setTab] = useState<'storefront' | 'domain'>(
    business.ecommerceEnabled ? 'storefront' : isAdmin ? 'domain' : 'storefront'
  );

  // Domain & Storefront Settings Form
  const [customDomain, setCustomDomain] = useState(business.customDomain || '');
  const [tagline, setTagline] = useState(
    business.storefrontTagline || `${business.name} — Official Online Store`
  );
  const [deliveryFee, setDeliveryFee] = useState(String(business.deliveryFee ?? 250));
  const [freeAbove, setFreeAbove] = useState(String(business.freeDeliveryAbove ?? 5000));
  const [pickupEnabled, setPickupEnabled] = useState(business.storefrontPickupEnabled !== false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  // Storefront Shopping Cart State
  const [fulfillStoreId, setFulfillStoreId] = useState(activeStore.id);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [bag, setBag] = useState<Array<{ product: ProductItem; qty: number }>>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPin, setCustomerPin] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const enabledGateways = useMemo(
    () => business.paymentGateways.filter((g) => g.enabled),
    [business.paymentGateways]
  );
  const [paymentMethod, setPaymentMethod] = useState(
    enabledGateways[0]?.displayName || 'Pay on Delivery (COD)'
  );
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<OnlineOrder | null>(null);

  const selectedFulfillStore =
    stores.find((s) => s.id === fulfillStoreId) || activeStore;

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const p of products) set.add(p.category);
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = categoryFilter === 'All' || p.category === categoryFilter;
      const qOk =
        !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [products, categoryFilter, search]);

  const bagTotals = useMemo(() => {
    const subtotal = bag.reduce((s, item) => s + item.product.price * item.qty, 0);
    const feeBase = Number(business.deliveryFee) || 0;
    const freeThresh = Number(business.freeDeliveryAbove) || 0;
    const shipping =
      bag.length === 0 || deliveryMethod === 'pickup'
        ? 0
        : freeThresh > 0 && subtotal >= freeThresh
          ? 0
          : feeBase;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping,
      total: Math.round((subtotal + shipping) * 100) / 100,
    };
  }, [bag, deliveryMethod, business.deliveryFee, business.freeDeliveryAbove]);

  const addToBag = (product: ProductItem) => {
    const avail = product.stockByStore[selectedFulfillStore.id] ?? 0;
    if (avail <= 0) return;
    setBag((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.qty >= avail) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateBagQty = (productId: string, delta: number) => {
    setBag((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const maxAvail = item.product.stockByStore[selectedFulfillStore.id] ?? 0;
          const next = Math.min(maxAvail, item.qty + delta);
          return { ...item, qty: next };
        })
        .filter((i) => i.qty > 0)
    );
  };

  const handleSaveDomain = async (verifyNow = false) => {
    setSavingConfig(true);
    setConfigMsg('');
    try {
      await onUpdateDomainConfig({
        ecommerceEnabled: true,
        customDomain: customDomain.trim(),
        verifyDomain: verifyNow,
        storefrontTagline: tagline.trim(),
        deliveryFee: Math.max(0, Number(deliveryFee) || 0),
        freeDeliveryAbove: Math.max(0, Number(freeAbove) || 0),
        storefrontPickupEnabled: pickupEnabled,
      });
      setConfigMsg(
        verifyNow
          ? 'Custom domain DNS verified & SSL activated!'
          : 'eCommerce Storefront & Domain settings saved.'
      );
      setTimeout(() => setConfigMsg(''), 4000);
    } catch (err) {
      setConfigMsg(err instanceof Error ? err.message : 'Unable to save domain settings.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCheckoutOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');
    if (bag.length === 0) return;
    setPlacingOrder(true);
    try {
      const created = await onPlaceOnlineOrder({
        storeId: selectedFulfillStore.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPin: customerPin.trim().toUpperCase() || undefined,
        deliveryMethod,
        deliveryAddress:
          deliveryMethod === 'pickup'
            ? `Store Pickup: ${selectedFulfillStore.name}`
            : deliveryAddress.trim(),
        paymentMethod,
        lines: bag.map((i) => ({ productId: i.product.id, qty: i.qty })),
      });
      if (created) {
        setConfirmedOrder(created);
        setBag([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerPin('');
        setDeliveryAddress('');
      }
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Unable to place online order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            eCommerce Storefront &amp; Domain Setup
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            1-click online shop synchronized with {business.name} real inventory, KRA eTIMS invoicing, and Accounting.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('storefront')}
            className={`rounded-md px-3 py-1.5 font-semibold ${
              tab === 'storefront'
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Live Storefront
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTab('domain')}
              className={`rounded-md px-3 py-1.5 font-semibold ${
                tab === 'domain'
                  ? 'bg-slate-900 text-white dark:bg-teal-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Domain &amp; Store Config
            </button>
          )}
        </div>
      </div>

      {/* Live Storefront URL Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Storefront URL:</span>
          <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
            https://misafarms.com/{business.slug}/shop
          </span>
          {business.customDomain && (
            <>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                https://{business.customDomain}{' '}
                {business.domainVerified ? '(SSL Active ✓)' : '(DNS Pending)'}
              </span>
            </>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() =>
              onUpdateDomainConfig({ ecommerceEnabled: !business.ecommerceEnabled })
            }
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              business.ecommerceEnabled
                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-teal-600'
            }`}
          >
            {business.ecommerceEnabled ? 'Storefront Online ✓' : 'Enable Storefront'}
          </button>
        )}
      </div>

      {tab === 'domain' && isAdmin ? (
        <div className="space-y-5">
          {configMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>{configMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Domain Binding & DNS Verification */}
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Custom Domain &amp; Instant Slug Setup
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Built-in MisafaRMS Shop Address (Always Active)
                  </label>
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <span>https://misafarms.com/{business.slug}/shop</span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Connect Your Custom Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="e.g. shop.yourbrand.co.ke"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {customDomain.trim() && (
                  <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="font-sans font-semibold text-slate-700 dark:text-slate-200">
                      DNS Records to Add at Your Registrar:
                    </p>
                    <p>
                      CNAME <strong>{customDomain.trim()}</strong> →{' '}
                      <span className="text-teal-700 dark:text-teal-400">shops.misafarms.com</span>
                    </p>
                    <p>
                      TXT <strong>_misafa-verify</strong> →{' '}
                      <span className="text-teal-700 dark:text-teal-400">
                        {business.dnsToken || `misafa-verify=${business.slug}`}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingConfig}
                    onClick={() => handleSaveDomain(false)}
                    className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                  >
                    Save Domain &amp; Settings
                  </button>
                  {customDomain.trim() && (
                    <button
                      type="button"
                      disabled={savingConfig}
                      onClick={() => handleSaveDomain(true)}
                      className="rounded-lg border border-teal-700 px-4 py-2 font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400"
                    >
                      Verify DNS &amp; Activate SSL
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Delivery & Storefront Policy */}
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Storefront Tagline &amp; Delivery Rules
                </h2>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Storefront Headline / Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Flat Delivery Fee ({business.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Free Delivery Above ({business.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={freeAbove}
                    onChange={(e) => setFreeAbove(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 pt-1 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={pickupEnabled}
                  onChange={(e) => setPickupEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Allow customers to select "Click &amp; Collect Branch Pickup"</span>
              </label>
            </section>
          </div>
        </div>
      ) : !business.ecommerceEnabled ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Store className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-slate-100">
            Online Storefront Is Currently Paused
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enable the storefront in 1 click to start accepting live online orders synced to your Inventory &amp; KRA eTIMS.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onUpdateDomainConfig({ ecommerceEnabled: true })}
              className="mt-4 rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Launch https://misafarms.com/{business.slug}/shop
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Real Inventory Catalog */}
          <div className="space-y-4 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {business.storefrontTagline || business.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fulfilling live stock from:{' '}
                  <select
                    value={fulfillStoreId}
                    onChange={(e) => {
                      setFulfillStoreId(e.target.value);
                      setBag([]);
                    }}
                    className="ml-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </p>
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 sm:w-56 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white dark:bg-teal-600'
                      : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  No products published in inventory yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Add SKUs in the Inventory module and they will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((p) => {
                  const avail = p.stockByStore[selectedFulfillStore.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div>
                        <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                          {p.category}
                        </p>
                        <h3 className="mt-0.5 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </h3>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          SKU: {p.sku} · {avail > 0 ? `${avail} in stock` : 'Out of Stock'}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatMoney(p.price, business.currency)}
                        </span>
                        <button
                          type="button"
                          disabled={avail <= 0}
                          onClick={() => addToBag(p)}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-teal-600"
                        >
                          {avail > 0 ? 'Add to Bag' : 'Sold Out'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Live Storefront Bag & Real Checkout */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <ShoppingBag className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Online Basket ({bag.reduce((s, i) => s + i.qty, 0)})
              </h2>
            </div>

            {confirmedOrder && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <p className="font-bold">Order {confirmedOrder.orderNo} Confirmed!</p>
                <p className="mt-0.5">
                  Synced to {confirmedOrder.storeName} inventory, Tax Invoice &amp; Online Orders Manager (CUIN: {confirmedOrder.etimsCuin}).
                </p>
              </div>
            )}

            <div className="divide-y divide-slate-100 py-2 dark:divide-slate-800">
              {bag.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Add in-stock items from the catalog to place a live online order.
                </p>
              ) : (
                bag.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {item.product.name}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {formatMoney(item.product.price, business.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateBagQty(item.product.id, -1)}
                        className="rounded border border-slate-200 p-1 dark:border-slate-700"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-semibold">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateBagQty(item.product.id, 1)}
                        className="rounded border border-slate-200 p-1 dark:border-slate-700"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCheckoutOnline} className="mt-3 space-y-2.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`rounded-lg border py-1.5 font-semibold ${
                    deliveryMethod === 'delivery'
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  Delivery
                </button>
                {business.storefrontPickupEnabled !== false && (
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`rounded-lg border py-1.5 font-semibold ${
                      deliveryMethod === 'pickup'
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Branch Pickup
                  </button>
                )}
              </div>

              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your Full Name *"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone (e.g. +2547...) *"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Receipt Email (Optional)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={customerPin}
                onChange={(e) => setCustomerPin(e.target.value.toUpperCase())}
                placeholder="Buyer KRA PIN (Optional)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {deliveryMethod === 'delivery' && (
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Delivery Estate, Street & Building *"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              )}

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {enabledGateways.map((gw) => (
                  <option key={gw.id} value={gw.displayName}>
                    {gw.displayName} ({gw.shortcodeOrTill || gw.mode})
                  </option>
                ))}
                <option value="Pay on Delivery (COD)">Pay on Delivery (COD)</option>
              </select>

              <div className="space-y-1 border-t border-slate-200 pt-2 font-mono tabular-nums dark:border-slate-800">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatMoney(bagTotals.subtotal, business.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Delivery</span>
                  <span>
                    {bagTotals.shipping === 0
                      ? 'Free'
                      : formatMoney(bagTotals.shipping, business.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span>Total</span>
                  <span>{formatMoney(bagTotals.total, business.currency)}</span>
                </div>
              </div>

              {orderError && (
                <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                  {orderError}
                </p>
              )}

              <button
                type="submit"
                disabled={bag.length === 0 || placingOrder}
                className="w-full rounded-lg bg-teal-700 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-600"
              >
                {placingOrder
                  ? 'Placing Order...'
                  : `Checkout & Issue eTIMS Invoice · ${formatMoney(bagTotals.total, business.currency)}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
