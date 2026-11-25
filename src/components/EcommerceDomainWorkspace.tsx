import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  LayoutTemplate,
  Minus,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import minimalHeroImg from '../assets/images/storefront_nairobi_minimal_1795478128422.jpg';
import farmHarvestHeroImg from '../assets/images/storefront_farm_harvest_1795478127987.jpg';
import boutiqueHeroImg from '../assets/images/storefront_boutique_lookbook_1795478128782.jpg';
import techGridHeroImg from '../assets/images/storefront_tech_grid_1795478128786.jpg';
import bistroHeroImg from '../assets/images/pos_coffee_beans_1795366673842.jpg';
import {
  BusinessEntity,
  EcommerceTemplateId,
  EcommerceUrlPrefix,
  OnlineOrder,
  ProductItem,
  StoreBranch,
  StorefrontSeoConfig,
} from '../types/erp';
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
    ecommercePrefix?: EcommerceUrlPrefix;
    ecommerceTemplateId?: EcommerceTemplateId;
    seoConfig?: StorefrontSeoConfig;
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

interface StorefrontTemplateSpec {
  id: EcommerceTemplateId;
  name: string;
  niche: string;
  recommendedPrefix: EcommerceUrlPrefix;
  schemaType: NonNullable<StorefrontSeoConfig['schemaType']>;
  heroImg: string;
  heroOverlayClass: string;
  badgeText: string;
  accentBgClass: string;
  cardClass: string;
  trustBadges: string[];
}

const STOREFRONT_TEMPLATES: StorefrontTemplateSpec[] = [
  {
    id: 'nairobi_minimal',
    name: 'Nairobi Minimal Commerce',
    niche: 'Supermarkets · Retail · Lifestyle',
    recommendedPrefix: 'shop',
    schemaType: 'Store',
    heroImg: minimalHeroImg,
    heroOverlayClass: 'from-slate-950/85 via-slate-900/55 to-transparent',
    badgeText: 'Fast Kenya Delivery · eTIMS Verified',
    accentBgClass: 'bg-teal-700 hover:bg-teal-800',
    cardClass: 'border-slate-200 dark:border-slate-800',
    trustBadges: ['Same-Day Nairobi Dispatch', 'KRA eTIMS Fiscal Receipt', 'M-Pesa STK Express'],
  },
  {
    id: 'farm_harvest',
    name: 'Savannah Organic & Grocery',
    niche: 'Fresh Produce · Agribusiness · Groceries',
    recommendedPrefix: 'market',
    schemaType: 'LocalBusiness',
    heroImg: farmHarvestHeroImg,
    heroOverlayClass: 'from-emerald-950/85 via-emerald-900/50 to-transparent',
    badgeText: 'Farm-Fresh Daily Harvest',
    accentBgClass: 'bg-emerald-700 hover:bg-emerald-800',
    cardClass: 'border-emerald-200/80 dark:border-emerald-900/50',
    trustBadges: ['Cold-Chain Freshness', 'Direct Farm Sourcing', 'Zero-Rated Staple Care'],
  },
  {
    id: 'boutique_editorial',
    name: 'Westlands Boutique Lookbook',
    niche: 'Fashion · Beauty · Luxury Goods',
    recommendedPrefix: 'store',
    schemaType: 'Store',
    heroImg: boutiqueHeroImg,
    heroOverlayClass: 'from-stone-950/85 via-stone-900/50 to-transparent',
    badgeText: 'Curated Seasonal Editions',
    accentBgClass: 'bg-stone-900 hover:bg-stone-800 dark:bg-amber-700',
    cardClass: 'border-stone-200 dark:border-stone-800',
    trustBadges: ['Complimentary Gift Wrap', 'Instant Branch Exchange', 'Verified Authentic'],
  },
  {
    id: 'tech_grid',
    name: 'Kilimani Tech & Hardware Grid',
    niche: 'Electronics · Hardware · B2B Wholesale',
    recommendedPrefix: 'catalogue',
    schemaType: 'Product',
    heroImg: techGridHeroImg,
    heroOverlayClass: 'from-slate-950/90 via-cyan-950/60 to-transparent',
    badgeText: 'Warranty-Backed Specs & Wholesale',
    accentBgClass: 'bg-cyan-700 hover:bg-cyan-800',
    cardClass: 'border-cyan-200/70 dark:border-cyan-900/40',
    trustBadges: ['1-Year Manufacturer Warranty', 'B2B KRA PIN Invoicing', 'Serial-Tracked Stock'],
  },
  {
    id: 'bistro_menu',
    name: 'Bistro & Coffee Express Menu',
    niche: 'Restaurants · Cafes · Bakeries',
    recommendedPrefix: 'menu',
    schemaType: 'Restaurant',
    heroImg: bistroHeroImg,
    heroOverlayClass: 'from-amber-950/85 via-stone-900/55 to-transparent',
    badgeText: 'Order Fresh · Ready in 20 Mins',
    accentBgClass: 'bg-amber-700 hover:bg-amber-800',
    cardClass: 'border-amber-200/80 dark:border-amber-900/40',
    trustBadges: ['Hot Rider Dispatch', 'Table & Counter Pickup', 'Instant Waiter Tipping'],
  },
];

const URL_PREFIX_OPTIONS: Array<{ value: EcommerceUrlPrefix; label: string; hint: string }> = [
  { value: 'shop', label: '/shop', hint: 'Standard Retail Shop' },
  { value: 'store', label: '/store', hint: 'Brand Flagship Store' },
  { value: 'market', label: '/market', hint: 'Grocery & Fresh Market' },
  { value: 'order', label: '/order', hint: 'Direct Express Order' },
  { value: 'menu', label: '/menu', hint: 'Restaurant & Cafe Menu' },
  { value: 'catalogue', label: '/catalogue', hint: 'Wholesale & B2B Specs' },
];

export const EcommerceDomainWorkspace: React.FC<EcommerceDomainWorkspaceProps> = ({
  business,
  stores,
  activeStore,
  products,
  isAdmin,
  onUpdateDomainConfig,
  onPlaceOnlineOrder,
}) => {
  const [tab, setTab] = useState<'storefront' | 'templates_seo' | 'domain'>(
    business.ecommerceEnabled ? 'storefront' : isAdmin ? 'templates_seo' : 'storefront'
  );
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');

  // Domain, Template, URL Prefix & SEO Form State
  const [urlPrefix, setUrlPrefix] = useState<EcommerceUrlPrefix>(
    business.ecommercePrefix || 'shop'
  );
  const [templateId, setTemplateId] = useState<EcommerceTemplateId>(
    business.ecommerceTemplateId || 'nairobi_minimal'
  );
  const [customDomain, setCustomDomain] = useState(business.customDomain || '');
  const [tagline, setTagline] = useState(
    business.storefrontTagline || `${business.name} — Official Online Store`
  );
  const [deliveryFee, setDeliveryFee] = useState(String(business.deliveryFee ?? 250));
  const [freeAbove, setFreeAbove] = useState(String(business.freeDeliveryAbove ?? 5000));
  const [pickupEnabled, setPickupEnabled] = useState(business.storefrontPickupEnabled !== false);

  const [metaTitle, setMetaTitle] = useState(
    business.seoConfig?.metaTitle || `${business.name} – Official Online Shop | Kenya`
  );
  const [metaDescription, setMetaDescription] = useState(
    business.seoConfig?.metaDescription ||
      `Shop verified products from ${business.name}. Pay via M-Pesa STK Push, PayHero, or cards with instant KRA eTIMS receipts.`
  );
  const [keywords, setKeywords] = useState(
    business.seoConfig?.keywords || `${business.name}, online shopping Kenya, M-Pesa checkout`
  );
  const [schemaType, setSchemaType] = useState<NonNullable<StorefrontSeoConfig['schemaType']>>(
    business.seoConfig?.schemaType || 'Store'
  );
  const [canonicalBase, setCanonicalBase] = useState(
    business.seoConfig?.canonicalBase || ''
  );
  const [seoIndexable, setSeoIndexable] = useState(business.seoConfig?.indexable !== false);

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
  const [onlinePayState, setOnlinePayState] = useState<'idle' | 'sending' | 'paid'>('idle');
  const [onlinePayRef, setOnlinePayRef] = useState('');
  const [onlinePayHint, setOnlinePayHint] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<OnlineOrder | null>(null);

  useEffect(() => {
    setUrlPrefix(business.ecommercePrefix || 'shop');
    setTemplateId(business.ecommerceTemplateId || 'nairobi_minimal');
    setCustomDomain(business.customDomain || '');
    setTagline(business.storefrontTagline || `${business.name} — Official Online Store`);
    setDeliveryFee(String(business.deliveryFee ?? 250));
    setFreeAbove(String(business.freeDeliveryAbove ?? 5000));
    setPickupEnabled(business.storefrontPickupEnabled !== false);
    setMetaTitle(
      business.seoConfig?.metaTitle || `${business.name} – Official Online Shop | Kenya`
    );
    setMetaDescription(
      business.seoConfig?.metaDescription ||
        `Shop verified products from ${business.name}. Pay via M-Pesa STK Push, PayHero, or cards with instant KRA eTIMS receipts.`
    );
    setKeywords(
      business.seoConfig?.keywords || `${business.name}, online shopping Kenya, M-Pesa checkout`
    );
    setSchemaType(business.seoConfig?.schemaType || 'Store');
    setCanonicalBase(business.seoConfig?.canonicalBase || '');
    setSeoIndexable(business.seoConfig?.indexable !== false);
  }, [business]);

  const activeTemplate =
    STOREFRONT_TEMPLATES.find((t) => t.id === templateId) || STOREFRONT_TEMPLATES[0];

  const resolvedPrefixUrl = `https://misafarms.com/${business.slug}/${urlPrefix}`;
  const activeCanonicalUrl =
    canonicalBase.trim() ||
    (business.customDomain && business.domainVerified
      ? `https://${business.customDomain}/${urlPrefix}`
      : resolvedPrefixUrl);

  // Live SEO <head> & Schema.org JSON-LD Injection when Storefront is rendered
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevTitle = document.title;
    const activeTitle = metaTitle.trim() || `${business.name} | Online Store`;
    const activeDesc =
      metaDescription.trim() || `${business.name} — Official Online Store`;

    document.title = activeTitle;

    const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    upsertMeta('name', 'description', activeDesc);
    if (keywords.trim()) upsertMeta('name', 'keywords', keywords.trim());
    upsertMeta('name', 'robots', seoIndexable ? 'index, follow' : 'noindex, nofollow');
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:title', activeTitle);
    upsertMeta('property', 'og:description', activeDesc);
    upsertMeta('property', 'og:url', activeCanonicalUrl);
    upsertMeta('property', 'og:site_name', business.name);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', activeTitle);
    upsertMeta('name', 'twitter:description', activeDesc);

    let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', activeCanonicalUrl);

    let ldScript = document.getElementById('misafa-store-jsonld') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.id = 'misafa-store-jsonld';
      ldScript.type = 'application/ld+json';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': schemaType,
      name: business.name,
      description: activeDesc,
      url: activeCanonicalUrl,
      priceRange: business.currency,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `${business.name} Catalog`,
        itemListElement: products.slice(0, 12).map((p, idx) => ({
          '@type': 'Offer',
          position: idx + 1,
          itemOffered: {
            '@type': 'Product',
            name: p.name,
            sku: p.sku,
            category: p.category,
          },
          price: p.price,
          priceCurrency: business.currency,
          availability:
            (p.stockByStore[fulfillStoreId] ?? 0) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
        })),
      },
    });

    return () => {
      document.title = prevTitle;
      const existingLd = document.getElementById('misafa-store-jsonld');
      if (existingLd) existingLd.remove();
    };
  }, [
    business.name,
    business.currency,
    metaTitle,
    metaDescription,
    keywords,
    seoIndexable,
    schemaType,
    activeCanonicalUrl,
    products,
    fulfillStoreId,
  ]);

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

  const handleSaveAllConfig = async (verifyNow = false) => {
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
        ecommercePrefix: urlPrefix,
        ecommerceTemplateId: templateId,
        seoConfig: {
          metaTitle: metaTitle.trim(),
          metaDescription: metaDescription.trim(),
          keywords: keywords.trim(),
          canonicalBase: canonicalBase.trim() || undefined,
          schemaType,
          indexable: seoIndexable,
        },
      });
      setConfigMsg(
        verifyNow
          ? 'Custom domain DNS verified & SSL activated!'
          : `Storefront launched on ${resolvedPrefixUrl} with "${activeTemplate.name}" & Schema.org SEO.`
      );
      setTimeout(() => setConfigMsg(''), 4500);
    } catch (err) {
      setConfigMsg(err instanceof Error ? err.message : 'Unable to save storefront config.');
    } finally {
      setSavingConfig(false);
    }
  };

  const selectedOnlineGateway = enabledGateways.find((g) => g.displayName === paymentMethod);

  const handleTriggerOnlineGatewayPay = async () => {
    if (!selectedOnlineGateway || bag.length === 0) return;
    if (selectedOnlineGateway.stkPushSupported && (!customerPhone || customerPhone.length < 9)) {
      setOrderError('Enter your M-Pesa phone number (e.g. 254712345678) first.');
      return;
    }
    setOrderError('');
    setOnlinePayState('sending');
    try {
      const endpoint =
        selectedOnlineGateway.provider === 'mpesa_daraja' || selectedOnlineGateway.stkPushSupported
          ? '/api/payments/daraja/stkpush'
          : '/api/payments/initiate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          gatewayId: selectedOnlineGateway.id,
          provider: selectedOnlineGateway.provider,
          phoneNumber: customerPhone.trim(),
          phone: customerPhone.trim(),
          amount: Math.max(1, Math.round(bagTotals.total)),
          currency: business.currency,
          email: customerEmail.trim() || business.ownerEmail || 'shopper@misafarms.com',
          accountReference: selectedOnlineGateway.accountPrefix || business.slug.toUpperCase(),
          description: `${business.name} Online Order`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOnlinePayState('idle');
        setOrderError(data.error || 'Payment initiation failed.');
        return;
      }
      const ref = data.receiptCode || data.reference || 'WEB-PAID';
      setOnlinePayRef(ref);
      setOnlinePayHint(
        `${data.mode === 'daraja_live' ? 'Daraja LIVE' : data.mode || 'Verified'} · Ref ${ref}`
      );
      setOnlinePayState('paid');
    } catch {
      setOnlinePayState('idle');
      setOrderError('Payment service temporarily unreachable.');
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
        paymentRef: onlinePayRef || undefined,
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
        setOnlinePayState('idle');
        setOnlinePayRef('');
        setOnlinePayHint('');
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
            eCommerce Storefront, SEO Templates &amp; Auto URL Prefixes
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Launch SEO-responsive web templates on custom domains or instant /{urlPrefix} routes synced to {business.name} real inventory &amp; KRA eTIMS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
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
            <>
              <button
                type="button"
                onClick={() => setTab('templates_seo')}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  tab === 'templates_seo'
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                Templates &amp; SEO
              </button>
              <button
                type="button"
                onClick={() => setTab('domain')}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  tab === 'domain'
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                Domain &amp; URL Prefix
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Storefront URL Bar & Responsive Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Auto Route:</span>
          <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
            {resolvedPrefixUrl}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {activeTemplate.name}
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

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'storefront' && (
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                  viewportMode === 'desktop'
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Monitor className="h-3 w-3" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                  viewportMode === 'mobile'
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Smartphone className="h-3 w-3" />
                <span>Mobile</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `/${business.slug}/${urlPrefix}`);
              }
              setTab('storefront');
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Preview /{urlPrefix}</span>
          </button>

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
              {business.ecommerceEnabled ? 'Storefront Online ✓' : 'Launch Storefront'}
            </button>
          )}
        </div>
      </div>

      {configMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{configMsg}</span>
        </div>
      )}

      {tab === 'templates_seo' && isAdmin ? (
        <div className="space-y-6">
          {/* SEO-Responsive Storefront Templates Gallery */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Choose an SEO-Responsive Storefront Template
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Includes Schema.org OfferCatalog JSON-LD, OpenGraph &amp; mobile responsive grid
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STOREFRONT_TEMPLATES.map((tpl) => {
                const selected = templateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setTemplateId(tpl.id);
                      setUrlPrefix(tpl.recommendedPrefix);
                      setSchemaType(tpl.schemaType);
                    }}
                    className={`group overflow-hidden rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-teal-700 ring-2 ring-teal-700/20 dark:border-teal-500'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                      <img
                        src={tpl.heroImg}
                        alt={tpl.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute bottom-2 left-2 rounded bg-slate-950/75 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                        /{tpl.recommendedPrefix}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-display text-xs font-bold text-slate-900 dark:text-slate-100">
                        {tpl.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {tpl.niche}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SEO Metadata, OpenGraph & Schema.org Config + Google SERP Preview */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-xs lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Search Engine Optimization (Meta, OpenGraph &amp; Schema.org)
                </h2>
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    SEO Page Title (Recommended 30–60 chars)
                  </label>
                  <span className="font-mono text-[10px] text-slate-500">
                    {metaTitle.length}/60 chars
                  </span>
                </div>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    Meta Description (Recommended 120–160 chars)
                  </label>
                  <span className="font-mono text-[10px] text-slate-500">
                    {metaDescription.length}/160 chars
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Schema.org Entity Type
                  </label>
                  <select
                    value={schemaType}
                    onChange={(e) =>
                      setSchemaType(
                        e.target.value as NonNullable<StorefrontSeoConfig['schemaType']>
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Store">Schema: Store (Retail + OfferCatalog)</option>
                    <option value="LocalBusiness">Schema: LocalBusiness</option>
                    <option value="Restaurant">Schema: Restaurant &amp; Menu</option>
                    <option value="Product">Schema: Product Catalogue</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Target Search Keywords
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={seoIndexable}
                    onChange={(e) => setSeoIndexable(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Allow Google &amp; Bing Indexing (robots: index, follow)</span>
                </label>

                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() => handleSaveAllConfig(false)}
                  className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {savingConfig ? 'Launching...' : 'Apply Template & Launch SEO'}
                </button>
              </div>
            </section>

            {/* Live Google SERP Preview */}
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-xs lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Live Google Search Snippet &amp; Rich Card Preview
                </h2>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="truncate font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                  {activeCanonicalUrl}
                </p>
                <p className="mt-1 font-display text-base font-semibold text-blue-700 dark:text-blue-400">
                  {metaTitle || `${business.name} — Official Store`}
                </p>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {metaDescription}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-2 font-mono text-[10px] text-slate-500 dark:border-slate-800">
                  <span>JSON-LD: {schemaType}</span>
                  <span>·</span>
                  <span>{products.length} Live Offers</span>
                  <span>·</span>
                  <span>OG + Twitter Card Active</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : tab === 'domain' && isAdmin ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Domain Binding, Auto URL Prefixes & DNS Verification */}
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Auto Storefront URL Prefix &amp; Custom Domain
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Select Auto-Generated Storefront URL Prefix
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {URL_PREFIX_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setUrlPrefix(opt.value)}
                        className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          urlPrefix === opt.value
                            ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <p className="font-mono font-bold">{opt.label}</p>
                        <p className="text-[10px] opacity-75">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Live Built-In Storefront URL
                  </label>
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <span>{resolvedPrefixUrl}</span>
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

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Custom Canonical Override URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={canonicalBase}
                    onChange={(e) => setCanonicalBase(e.target.value)}
                    placeholder={resolvedPrefixUrl}
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
                    onClick={() => handleSaveAllConfig(false)}
                    className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                  >
                    Save Domain, Prefix &amp; Settings
                  </button>
                  {customDomain.trim() && (
                    <button
                      type="button"
                      disabled={savingConfig}
                      onClick={() => handleSaveAllConfig(true)}
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
                <span>Allow customers to select &quot;Click &amp; Collect Branch Pickup&quot;</span>
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
            Enable the storefront in 1 click to launch {resolvedPrefixUrl} synced with Inventory &amp; KRA eTIMS.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleSaveAllConfig(false)}
              className="mt-4 rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Launch {resolvedPrefixUrl}
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            viewportMode === 'mobile'
              ? 'mx-auto max-w-md space-y-5 rounded-2xl border-2 border-slate-300 bg-slate-50 p-3 shadow-lg dark:border-slate-700 dark:bg-slate-950'
              : 'space-y-5'
          }
        >
          {/* Template-Driven Hero Banner */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <img
              src={activeTemplate.heroImg}
              alt={`${business.name} Storefront`}
              className="h-52 w-full object-cover sm:h-64"
            />
            <div
              className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t p-6 text-white ${activeTemplate.heroOverlayClass}`}
            >
              <span className="w-fit rounded bg-white/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide backdrop-blur-xs">
                {activeTemplate.badgeText}
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                {business.storefrontTagline || business.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/90">
                {activeTemplate.trustBadges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div
            className={
              viewportMode === 'mobile'
                ? 'grid grid-cols-1 gap-5'
                : 'grid grid-cols-1 gap-5 lg:grid-cols-12'
            }
          >
            {/* Left: Real Inventory Catalog */}
            <div className={viewportMode === 'mobile' ? 'space-y-4' : 'space-y-4 lg:col-span-8'}>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Fulfilling stock from:{' '}
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
                    Add or Bulk Import SKUs in Inventory and they appear automatically on {resolvedPrefixUrl}.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    viewportMode === 'mobile'
                      ? 'grid grid-cols-1 gap-3'
                      : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'
                  }
                >
                  {filteredProducts.map((p) => {
                    const avail = p.stockByStore[selectedFulfillStore.id] ?? 0;
                    return (
                      <div
                        key={p.id}
                        className={`flex flex-col justify-between rounded-xl border bg-white p-4 dark:bg-slate-900 ${activeTemplate.cardClass}`}
                      >
                        <div>
                          <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                            {p.category}
                            {p.subCategory ? ` · ${p.subCategory}` : ''}
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
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400 ${activeTemplate.accentBgClass}`}
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
            <div
              className={`rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${
                viewportMode === 'mobile' ? '' : 'lg:col-span-4'
              }`}
            >
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
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-2 py-2 text-xs"
                    >
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

              <form
                onSubmit={handleCheckoutOnline}
                className="mt-3 space-y-2.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-800"
              >
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
                  placeholder="Phone / M-Pesa (2547...) *"
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
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    setOnlinePayState('idle');
                    setOnlinePayRef('');
                    setOnlinePayHint('');
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {enabledGateways.map((gw) => (
                    <option key={gw.id} value={gw.displayName}>
                      {gw.displayName} ({gw.shortcodeOrTill || gw.mode})
                    </option>
                  ))}
                  <option value="Pay on Delivery (COD)">Pay on Delivery (COD)</option>
                </select>

                {selectedOnlineGateway && selectedOnlineGateway.mode !== 'Cash Drawer' && bag.length > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <span className="truncate font-mono text-[10px] text-emerald-900 dark:text-emerald-300">
                      {onlinePayHint ||
                        (selectedOnlineGateway.stkPushSupported
                          ? 'M-Pesa STK Express Prompt'
                          : `${selectedOnlineGateway.displayName} API`)}
                    </span>
                    <button
                      type="button"
                      disabled={onlinePayState === 'sending'}
                      onClick={handleTriggerOnlineGatewayPay}
                      className="shrink-0 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {onlinePayState === 'sending'
                        ? 'Sending...'
                        : onlinePayState === 'paid'
                          ? 'Paid ✓'
                          : selectedOnlineGateway.stkPushSupported
                            ? 'Pay Now (STK)'
                            : 'Authorize Now'}
                    </button>
                  </div>
                )}

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
                  className={`w-full rounded-lg py-2.5 text-xs font-semibold text-white disabled:opacity-40 ${activeTemplate.accentBgClass}`}
                >
                  {placingOrder
                    ? 'Placing Order...'
                    : `Checkout & Issue eTIMS Invoice · ${formatMoney(bagTotals.total, business.currency)}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
