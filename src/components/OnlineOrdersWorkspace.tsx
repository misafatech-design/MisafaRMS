import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Package,
  Printer,
  ShoppingBag,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import {
  BusinessEntity,
  OnlineOrder,
  OnlineOrderFulfillmentStatus,
} from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface OnlineOrdersWorkspaceProps {
  business: BusinessEntity;
  onlineOrders: OnlineOrder[];
  onUpdateStatus: (
    orderId: string,
    status: OnlineOrderFulfillmentStatus
  ) => Promise<void>;
}

const STATUS_FILTERS: Array<'All' | OnlineOrderFulfillmentStatus> = [
  'All',
  'Pending',
  'Confirmed & Packed',
  'Dispatched',
  'Delivered',
  'Cancelled',
];

export const OnlineOrdersWorkspace: React.FC<OnlineOrdersWorkspaceProps> = ({
  business,
  onlineOrders,
  onUpdateStatus,
}) => {
  const [filter, setFilter] = useState<'All' | OnlineOrderFulfillmentStatus>('All');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [packingSlipOrder, setPackingSlipOrder] = useState<OnlineOrder | null>(null);
  const [feedback, setFeedback] = useState('');

  const bizOrders = useMemo(
    () => onlineOrders.filter((o) => o.businessId === business.id),
    [onlineOrders, business.id]
  );

  const filtered = useMemo(
    () =>
      filter === 'All'
        ? bizOrders
        : bizOrders.filter((o) => o.fulfillmentStatus === filter),
    [bizOrders, filter]
  );

  const metrics = useMemo(() => {
    const pending = bizOrders.filter((o) => o.fulfillmentStatus === 'Pending').length;
    const readyOrShipped = bizOrders.filter(
      (o) =>
        o.fulfillmentStatus === 'Confirmed & Packed' ||
        o.fulfillmentStatus === 'Dispatched'
    ).length;
    const deliveredRevenue = bizOrders
      .filter((o) => o.fulfillmentStatus === 'Delivered')
      .reduce((s, o) => s + o.total, 0);
    const codPending = bizOrders
      .filter(
        (o) =>
          o.paymentStatus === 'Pending COD' && o.fulfillmentStatus !== 'Cancelled'
      )
      .reduce((s, o) => s + o.total, 0);
    return { pending, readyOrShipped, deliveredRevenue, codPending };
  }, [bizOrders]);

  const handleTransition = async (
    order: OnlineOrder,
    nextStatus: OnlineOrderFulfillmentStatus
  ) => {
    setUpdatingId(order.id);
    setFeedback('');
    try {
      await onUpdateStatus(order.id, nextStatus);
      setFeedback(
        nextStatus === 'Cancelled'
          ? `Order ${order.orderNo} cancelled — branch stock restored & eTIMS Credit Note issued.`
          : `Order ${order.orderNo} updated to "${nextStatus}".`
      );
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Online Orders Manager &amp; Fulfillment Dispatch
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Dedicated order fulfillment for https://misafarms.com/{business.slug}/shop — synced with live branch inventory, Invoicing, Sales &amp; KRA eTIMS.
        </p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pending Confirmation</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {metrics.pending}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Packed / In Transit</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {metrics.readyOrShipped}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Delivered Web Revenue</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatMoney(metrics.deliveredRevenue, business.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cash on Delivery Pending</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(metrics.codPending, business.currency)}
          </p>
        </div>
      </div>

      {/* Filter & Orders List */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Web Orders Queue ({filtered.length})
          </h2>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilter(st)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  filter === st
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingBag className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              No online orders in "{filter}" for {business.name}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Orders placed from https://misafarms.com/{business.slug}/shop appear here immediately with stock already reserved.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((ord) => (
              <div
                key={ord.id}
                className="space-y-3 px-5 py-4 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                        {ord.orderNo}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {ord.fulfillmentStatus}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          ord.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : ord.paymentStatus === 'Refunded'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {ord.paymentStatus} · {ord.paymentMethod}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">
                      <strong>{ord.customerName}</strong> ({ord.customerPhone}) ·{' '}
                      {ord.deliveryMethod === 'pickup' ? 'Branch Pickup' : 'Delivery'}:{' '}
                      {ord.deliveryAddress}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      Branch: {ord.storeName} · CUIN: {ord.etimsCuin || 'Standard'} ·{' '}
                      {new Date(ord.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-base font-bold tabular-nums text-teal-700 dark:text-teal-400">
                      {formatMoney(ord.total, ord.currency)}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {ord.lines.reduce((s, l) => s + l.qty, 0)} items
                    </p>
                  </div>
                </div>

                {/* Line Items Summary */}
                <div className="flex flex-wrap gap-2">
                  {ord.lines.map((l) => (
                    <span
                      key={l.productId}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {l.qty}x {l.name} ({formatMoney(l.lineTotal, ord.currency)})
                    </span>
                  ))}
                </div>

                {/* Fulfillment Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {ord.fulfillmentStatus === 'Pending' && (
                    <button
                      type="button"
                      disabled={updatingId === ord.id}
                      onClick={() => handleTransition(ord, 'Confirmed & Packed')}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>Confirm &amp; Pack</span>
                    </button>
                  )}
                  {ord.fulfillmentStatus === 'Confirmed & Packed' && (
                    <button
                      type="button"
                      disabled={updatingId === ord.id}
                      onClick={() => handleTransition(ord, 'Dispatched')}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      <span>Dispatch Rider / Pickup Ready</span>
                    </button>
                  )}
                  {(ord.fulfillmentStatus === 'Confirmed & Packed' ||
                    ord.fulfillmentStatus === 'Dispatched') && (
                    <button
                      type="button"
                      disabled={updatingId === ord.id}
                      onClick={() => handleTransition(ord, 'Delivered')}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Delivered</span>
                    </button>
                  )}
                  {ord.fulfillmentStatus !== 'Cancelled' &&
                    ord.fulfillmentStatus !== 'Delivered' && (
                      <button
                        type="button"
                        disabled={updatingId === ord.id}
                        onClick={() => handleTransition(ord, 'Cancelled')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Cancel &amp; Restock</span>
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setPackingSlipOrder(ord)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Packing Slip / Invoice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Printable A4 Packing Slip / Dispatch Note */}
      {packingSlipOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Dispatch Packing Slip · {packingSlipOrder.orderNo}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPackingSlipOrder(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              id="misafa-printable-document"
              className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-xs text-slate-900"
            >
              <div className="flex justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold uppercase">{business.name}</h2>
                  <p>{packingSlipOrder.storeName}</p>
                  <p className="font-mono text-[11px]">KRA PIN: {business.taxPin}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold">PACKING SLIP &amp; INVOICE</p>
                  <p>{packingSlipOrder.orderNo}</p>
                  <p className="text-[11px]">CUIN: {packingSlipOrder.etimsCuin}</p>
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="font-bold">{packingSlipOrder.customerName}</p>
                <p>{packingSlipOrder.customerPhone}</p>
                <p>
                  {packingSlipOrder.deliveryMethod === 'pickup' ? 'Pickup: ' : 'Ship To: '}
                  {packingSlipOrder.deliveryAddress}
                </p>
                <p className="mt-1 font-mono text-[11px]">
                  Payment: {packingSlipOrder.paymentMethod} ({packingSlipOrder.paymentStatus})
                </p>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-1.5">SKU</th>
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-right">Qty</th>
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {packingSlipOrder.lines.map((l) => (
                    <tr key={l.productId}>
                      <td className="py-1.5 font-mono">{l.sku}</td>
                      <td className="py-1.5">{l.name}</td>
                      <td className="py-1.5 text-right font-mono">{l.qty}</td>
                      <td className="py-1.5 text-right font-mono font-semibold">
                        {formatMoney(l.lineTotal, packingSlipOrder.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end border-t border-slate-200 pt-3 font-mono font-bold">
                <span>
                  TOTAL: {formatMoney(packingSlipOrder.total, packingSlipOrder.currency)} (VAT Incl:{' '}
                  {formatMoney(packingSlipOrder.taxAmount, packingSlipOrder.currency)})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
