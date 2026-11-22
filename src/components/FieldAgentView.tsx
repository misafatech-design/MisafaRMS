import React, { useState } from 'react';
import { CheckCircle2, CloudOff, MapPin, Plus, RefreshCw, Smartphone } from 'lucide-react';
import {
  BusinessEntity,
  PaymentMethod,
  ProductItem,
  SaleTransaction,
  StoreBranch,
} from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface FieldAgentViewProps {
  business: BusinessEntity;
  store: StoreBranch;
  products: ProductItem[];
  transactions: SaleTransaction[];
  isOffline: boolean;
  offlineQueueCount: number;
  onSyncNow: () => void;
  onSubmitFieldOrder: (payload: {
    lines: Array<{ productId: string; qty: number; discountPct: number }>;
    customerName: string;
    customerPin: string;
    customerPhone: string;
    paymentMethod: PaymentMethod;
    paymentRef: string;
    amountTendered: number;
    channel: 'Field Agent';
  }) => Promise<SaleTransaction | null>;
}

export const FieldAgentView: React.FC<FieldAgentViewProps> = ({
  business,
  store,
  products,
  transactions,
  isOffline,
  offlineQueueCount,
  onSyncNow,
  onSubmitFieldOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('254722110044');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('M-Pesa STK');
  const [routeNote, setRouteNote] = useState('Nairobi Westlands Route · Stop #4');
  const [submitting, setSubmitting] = useState(false);
  const [lastTx, setLastTx] = useState<SaleTransaction | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const lineTotal = selectedProduct ? selectedProduct.price * qty : 0;

  const fieldTransactions = transactions.filter((t) => t.channel === 'Field Agent');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !customerName.trim()) return;
    setSubmitting(true);
    try {
      const tx = await onSubmitFieldOrder({
        lines: [{ productId: selectedProduct.id, qty, discountPct: 0 }],
        customerName: `${customerName.trim()} (${routeNote})`,
        customerPin: '',
        customerPhone,
        paymentMethod,
        paymentRef: `FLD-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        amountTendered: lineTotal,
        channel: 'Field Agent',
      });
      if (tx) {
        setLastTx(tx);
        setCustomerName('');
        setQty(1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Field Agent Mobile Handheld Console
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Responsive van-sales & route collection terminal with encrypted offline caching and automatic cloud sync.
          </p>
        </div>

        {offlineQueueCount > 0 && !isOffline && (
          <button
            type="button"
            onClick={onSyncNow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync {offlineQueueCount} Queued Field Receipts</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Handheld Mobile Frame Preview / Active Form */}
        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Handheld Order Entry
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isOffline ? (
                <>
                  <CloudOff className="h-3.5 w-3.5 text-amber-600" />
                  <span>Offline Encrypted</span>
                </>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{store.code} Live</span>
                </>
              )}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Customer / Shop Name
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Mama Mboga Wholesalers"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  M-Pesa Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="M-Pesa STK">M-Pesa STK</option>
                  <option value="Cash">Cash Collection</option>
                  <option value="Card / Pesapal">Card / Pesapal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                SKU / Item
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price, business.currency)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Route Tag
                </label>
                <input
                  type="text"
                  value={routeNote}
                  onChange={(e) => setRouteNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Collection Total
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-teal-700 dark:text-teal-400">
                {formatMoney(lineTotal, business.currency)}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
            >
              <Plus className="h-4 w-4" />
              <span>
                {isOffline ? 'Save Encrypted Field Order' : 'Record & Sync Field Order'}
              </span>
            </button>
          </form>

          {lastTx && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  Recorded {lastTx.receiptNo} ({lastTx.etimsStatus})
                </p>
                <p className="font-mono text-[11px]">{lastTx.etimsCuin}</p>
              </div>
            </div>
          )}
        </section>

        {/* Field Agent Dispatches Log */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Field Agent Collections ({fieldTransactions.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {fieldTransactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {tx.customerName}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {tx.receiptNo} · {tx.paymentMethod} · {tx.etimsStatus}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(tx.total, tx.currency)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {tx.encryptedOffline ? 'AES-256 Synced' : 'Direct Online'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
