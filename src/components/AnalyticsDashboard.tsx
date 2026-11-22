import React, { useMemo } from 'react';
import { BusinessEntity, ProductItem, SaleTransaction, StoreBranch } from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface AnalyticsDashboardProps {
  business: BusinessEntity;
  stores: StoreBranch[];
  products: ProductItem[];
  transactions: SaleTransaction[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  business,
  stores,
  products,
  transactions,
}) => {
  const metrics = useMemo(() => {
    const revenue = transactions.reduce((s, t) => s + t.total, 0);
    const vat = transactions.reduce((s, t) => s + t.taxAmount, 0);
    const avgBasket = transactions.length > 0 ? revenue / transactions.length : 0;

    let inventoryValue = 0;
    const lowStockItems: Array<{ product: ProductItem; storeName: string; qty: number }> = [];

    for (const p of products) {
      for (const s of stores) {
        const qty = p.stockByStore[s.id] ?? 0;
        inventoryValue += qty * p.cost;
        if (qty <= p.reorderPoint) {
          lowStockItems.push({ product: p, storeName: s.name, qty });
        }
      }
    }

    const byStore = stores.map((s) => {
      const storeTx = transactions.filter((t) => t.storeId === s.id);
      const sum = storeTx.reduce((acc, t) => acc + t.total, 0);
      return { store: s, revenue: sum, count: storeTx.length };
    });

    const maxStoreRev = Math.max(1, ...byStore.map((x) => x.revenue));

    const byTender = ['M-Pesa STK', 'Cash', 'Card / Pesapal'].map((method) => {
      const total = transactions
        .filter((t) => t.paymentMethod === method)
        .reduce((acc, t) => acc + t.total, 0);
      return { method, total, pct: revenue > 0 ? Math.round((total / revenue) * 100) : 0 };
    });

    return {
      revenue,
      vat,
      avgBasket,
      inventoryValue,
      lowStockItems,
      byStore,
      maxStoreRev,
      byTender,
    };
  }, [transactions, products, stores]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Enterprise Retail Analytics & Dynamics BI
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Consolidated multi-branch sales velocity, inventory cost valuation, reorder risks, and tender mix for {business.name}.
        </p>
      </div>

      {/* Top 4 KPIs */}
      <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Gross Sales</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(metrics.revenue, business.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            Across {transactions.length} fiscal receipts
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Average Basket Value</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(metrics.avgBasket, business.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Omnichannel POS & Field Sales
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Inventory Cost Valuation</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {formatMoney(metrics.inventoryValue, business.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {products.length} active SKUs across {stores.length} stores
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Reorder Alerts</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {metrics.lowStockItems.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Branch SKUs at or below safety level
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Multi-Store Revenue Bar Comparison */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Branch Sales Performance
          </h2>
          <div className="mt-4 space-y-4">
            {metrics.byStore.map(({ store, revenue, count }) => {
              const widthPct = Math.max(6, Math.round((revenue / metrics.maxStoreRev) * 100));
              return (
                <div key={store.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {store.name} ({store.code}) · {count} orders
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(revenue, business.currency)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-teal-700 transition-all duration-300 dark:bg-teal-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Payment Gateway Mix */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Payment Gateway Settlement Mix
          </h2>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {metrics.byTender.map((t) => (
              <div key={t.method} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{t.method}</p>
                  <p className="text-slate-500 tabular-nums dark:text-slate-400">
                    {t.pct}% share of volume
                  </p>
                </div>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatMoney(t.total, business.currency)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Low Stock Reorder Watchlist */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Dynamics RMS Reorder Watchlist
          </h2>
        </div>
        {metrics.lowStockItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            All branch stock levels are currently above safety reorder thresholds.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-2.5 font-medium">SKU</th>
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-5 py-2.5 font-medium">Branch</th>
                  <th className="px-5 py-2.5 text-right font-medium">On Hand</th>
                  <th className="px-5 py-2.5 text-right font-medium">Reorder Point</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.lowStockItems.map((item, idx) => (
                  <tr key={`${item.product.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {item.product.sku}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {item.product.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {item.storeName}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {item.qty}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {item.product.reorderPoint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
