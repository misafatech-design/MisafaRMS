import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Plus,
  Printer,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  BusinessEntity,
  ProductItem,
  StoreBranch,
  TaxCode,
  TaxInvoiceRecord,
} from '../types/erp';
import { formatMoney, getTaxLabel } from '../utils/cryptoSync';

interface InvoicingWorkspaceProps {
  business: BusinessEntity;
  activeStore: StoreBranch;
  products: ProductItem[];
  invoices: TaxInvoiceRecord[];
  initialCustomer?: {
    name?: string;
    email?: string;
    phone?: string;
    kraPin?: string;
  } | null;
  onCreateInvoice: (payload: {
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
  }) => Promise<TaxInvoiceRecord | null>;
  onPayInvoice: (
    invoiceId: string,
    payload: { amount: number; paymentMethod: string; paymentRef: string }
  ) => Promise<void>;
}

interface DraftLine {
  key: string;
  productId?: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  taxCode: TaxCode;
}

export const InvoicingWorkspace: React.FC<InvoicingWorkspaceProps> = ({
  business,
  activeStore,
  products,
  invoices,
  initialCustomer,
  onCreateInvoice,
  onPayInvoice,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | TaxInvoiceRecord['status']>('All');
  const [showBuilder, setShowBuilder] = useState(Boolean(initialCustomer?.name));

  // New Invoice Form
  const [docType, setDocType] = useState<'Tax Invoice' | 'Proforma Quote'>('Tax Invoice');
  const [customerName, setCustomerName] = useState(initialCustomer?.name || '');
  const [customerEmail, setCustomerEmail] = useState(initialCustomer?.email || '');
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.phone || '');
  const [customerPin, setCustomerPin] = useState(initialCustomer?.kraPin || '');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: `ln-${Date.now()}`,
      productId: products[0]?.id,
      sku: products[0]?.sku || 'SRV-01',
      name: products[0]?.name || '',
      qty: 1,
      unitPrice: products[0]?.price || 0,
      taxCode: products[0]?.taxCode || 'B_16',
    },
  ]);
  const [creating, setCreating] = useState(false);

  // Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<TaxInvoiceRecord | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState(
    business.paymentGateways.find((g) => g.enabled)?.displayName || 'Bank Transfer / EFT'
  );
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  // Printable Document Modal State
  const [previewInvoice, setPreviewInvoice] = useState<TaxInvoiceRecord | null>(null);
  const [feedback, setFeedback] = useState('');

  const bizInvoices = useMemo(
    () => invoices.filter((i) => i.businessId === business.id),
    [invoices, business.id]
  );

  const filteredInvoices = useMemo(
    () =>
      statusFilter === 'All'
        ? bizInvoices
        : bizInvoices.filter((i) => i.status === statusFilter),
    [bizInvoices, statusFilter]
  );

  const metrics = useMemo(() => {
    const active = bizInvoices.filter((i) => i.status !== 'Void' && i.status !== 'Draft');
    const billed = active.reduce((s, i) => s + i.total, 0);
    const collected = active.reduce((s, i) => s + i.amountPaid, 0);
    const outstanding = active.reduce((s, i) => s + i.balanceDue, 0);
    return { billed, collected, outstanding };
  }, [bizInvoices]);

  const draftTotals = useMemo(() => {
    let total = 0;
    let vat = 0;
    for (const l of lines) {
      const lineTotal = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
      total += lineTotal;
      if (l.taxCode === 'B_16') {
        vat += lineTotal * (business.vatRate / (100 + business.vatRate));
      }
    }
    return {
      total: Math.round(total * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      net: Math.round((total - vat) * 100) / 100,
    };
  }, [lines, business.vatRate]);

  const handleSelectProduct = (lineKey: string, prodId: string) => {
    if (prodId === '__custom__') {
      setLines((prev) =>
        prev.map((l) =>
          l.key === lineKey ? { ...l, productId: undefined, sku: 'CUSTOM-01', name: '' } : l
        )
      );
      return;
    }
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    setLines((prev) =>
      prev.map((l) =>
        l.key === lineKey
          ? {
              ...l,
              productId: prod.id,
              sku: prod.sku,
              name: prod.name,
              unitPrice: prod.price,
              taxCode: prod.taxCode,
            }
          : l
      )
    );
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.name.trim() && l.qty > 0);
    if (!customerName.trim() || validLines.length === 0) return;
    setCreating(true);
    try {
      const created = await onCreateInvoice({
        storeId: activeStore.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerPin: customerPin.trim().toUpperCase() || undefined,
        docType,
        dueDate,
        lines: validLines.map((l) => ({
          productId: l.productId,
          sku: l.sku.trim() || 'SRV-01',
          name: l.name.trim(),
          qty: Number(l.qty) || 1,
          unitPrice: Math.max(0, Number(l.unitPrice) || 0),
          taxCode: l.taxCode,
        })),
      });
      if (created) {
        setFeedback(`Issued ${created.docType} ${created.invoiceNo} (${formatMoney(created.total, created.currency)}).`);
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setCustomerPin('');
        setShowBuilder(false);
        setPreviewInvoice(created);
        setTimeout(() => setFeedback(''), 4000);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleOpenPayModal = (inv: TaxInvoiceRecord) => {
    setPayingInvoice(inv);
    setPayAmount(String(inv.balanceDue));
    setPayRef('');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setPaying(true);
    try {
      await onPayInvoice(payingInvoice.id, {
        amount: Math.max(0.01, Number(payAmount) || payingInvoice.balanceDue),
        paymentMethod: payMethod,
        paymentRef: payRef.trim() || `INV-${Date.now().toString().slice(-5)}`,
      });
      setFeedback(`Payment recorded on ${payingInvoice.invoiceNo} and synced to Accounting & eTIMS.`);
      setPayingInvoice(null);
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setPaying(false);
    }
  };

  const paymentOptions = useMemo(() => {
    const enabled = business.paymentGateways.filter((g) => g.enabled).map((g) => g.displayName);
    return Array.from(new Set([...enabled, 'Bank Transfer / EFT', 'Cheque / RTGS']));
  }, [business.paymentGateways]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Invoicing, Quotes &amp; Accounts Receivable
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Issue KRA eTIMS Tax Invoices &amp; Proforma Quotes, record split payments, and print A4 client statements for {business.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBuilder((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{showBuilder ? 'Close Invoice Builder' : 'New Tax Invoice / Quote'}</span>
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Receivable KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Billed</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(metrics.billed, business.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Collected Cash / Bank</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatMoney(metrics.collected, business.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Outstanding Receivables</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatMoney(metrics.outstanding, business.currency)}
          </p>
        </div>
      </div>

      {/* Create Invoice Form */}
      {showBuilder && (
        <form
          onSubmit={handleSubmitInvoice}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Draft Invoice / Proforma Builder ({activeStore.name})
            </h2>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as 'Tax Invoice' | 'Proforma Quote')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="Tax Invoice">KRA eTIMS Tax Invoice</option>
              <option value="Proforma Quote">Proforma Quotation (Draft)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer / Client Name *"
              className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              type="text"
              value={customerPin}
              onChange={(e) => setCustomerPin(e.target.value.toUpperCase())}
              placeholder="Buyer KRA PIN"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Client Email"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="space-y-2">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-12 dark:border-slate-800 dark:bg-slate-800/40"
              >
                {products.length > 0 && (
                  <select
                    value={line.productId || '__custom__'}
                    onChange={(e) => handleSelectProduct(line.key, e.target.value)}
                    className="sm:col-span-3 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="__custom__">Custom Item / Service</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  required
                  value={line.name}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l) => (l.key === line.key ? { ...l, name: e.target.value } : l))
                    )
                  }
                  placeholder="Line item description"
                  className={`${
                    products.length > 0 ? 'sm:col-span-3' : 'sm:col-span-6'
                  } rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
                />
                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key ? { ...l, qty: Math.max(1, Number(e.target.value)) } : l
                      )
                    )
                  }
                  placeholder="Qty"
                  className="sm:col-span-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-right font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, unitPrice: Math.max(0, Number(e.target.value)) }
                          : l
                      )
                    )
                  }
                  placeholder="Unit Price"
                  className="sm:col-span-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-right font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <select
                  value={line.taxCode}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key ? { ...l, taxCode: e.target.value as TaxCode } : l
                      )
                    )
                  }
                  className="sm:col-span-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="B_16">VAT {business.vatRate}%</option>
                  <option value="E_0">Zero 0%</option>
                  <option value="A_EXEMPT">Exempt</option>
                </select>
                <div className="flex items-center justify-end sm:col-span-1">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    key: `ln-${Date.now()}-${prev.length}`,
                    sku: 'SRV-01',
                    name: '',
                    qty: 1,
                    unitPrice: 0,
                    taxCode: 'B_16',
                  },
                ])
              }
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <Plus className="h-3 w-3" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex gap-6 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
              <span>Net: {formatMoney(draftTotals.net, business.currency)}</span>
              <span>VAT: {formatMoney(draftTotals.vat, business.currency)}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Total: {formatMoney(draftTotals.total, business.currency)}
              </span>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
            >
              {creating ? 'Issuing...' : `Issue ${docType}`}
            </button>
          </div>
        </form>
      )}

      {/* Invoice Ledger Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Invoices &amp; Quotes ({filteredInvoices.length})
          </h2>
          <div className="flex flex-wrap gap-1">
            {(['All', 'Unpaid', 'Partial', 'Paid', 'Draft', 'Void'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              No invoices found for {business.name}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Click "New Tax Invoice / Quote" above to issue a B2B client invoice or quotation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Invoice # / CUIN</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Due Date</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5 text-right font-medium">Balance Due</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {inv.invoiceNo}
                      </p>
                      <p className="text-[10px] text-slate-400">{inv.etimsCuin || inv.docType}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {inv.customerName}
                      </p>
                      {inv.customerPin && (
                        <p className="font-mono text-[10px] text-slate-500">PIN: {inv.customerPin}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {inv.dueDate}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">
                      {formatMoney(inv.total, inv.currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatMoney(inv.balanceDue, inv.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : inv.status === 'Void'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {(inv.status === 'Unpaid' || inv.status === 'Partial' || inv.status === 'Draft') &&
                          inv.balanceDue > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(inv)}
                              className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <Wallet className="h-3 w-3" />
                              <span>Pay</span>
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Printer className="h-3 w-3" />
                          <span>A4 Print</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Record Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Record Payment · {payingInvoice.invoiceNo}
              </h3>
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmPayment} className="mt-4 space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Customer: <strong>{payingInvoice.customerName}</strong> · Balance:{' '}
                <strong className="font-mono">
                  {formatMoney(payingInvoice.balanceDue, payingInvoice.currency)}
                </strong>
              </p>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Amount Received ({payingInvoice.currency})
                </label>
                <input
                  type="number"
                  required
                  min={0.01}
                  max={payingInvoice.balanceDue}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {paymentOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Payment Reference / M-Pesa Code
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value.toUpperCase())}
                  placeholder="e.g. SL94K281P or EFT-8821"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {paying ? 'Posting...' : 'Post Payment & Sync eTIMS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable A4 Tax Invoice Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                A4 Fiscal Tax Invoice Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              id="misafa-printable-document"
              className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-xs text-slate-900"
            >
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold uppercase">{business.name}</h2>
                  <p className="text-slate-600">{previewInvoice.storeName}</p>
                  <p className="font-mono text-[11px] text-slate-600">
                    Tax PIN: {business.taxPin} · {business.taxAuthority}
                  </p>
                  <p className="font-mono text-[11px] text-slate-600">
                    Paybill / Till: {business.paybillOrTill}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-teal-800">
                    {previewInvoice.docType.toUpperCase()}
                  </p>
                  <p className="font-mono font-semibold">{previewInvoice.invoiceNo}</p>
                  <p className="text-[11px] text-slate-500">
                    Issued: {new Date(previewInvoice.createdAt).toLocaleDateString()} · Due:{' '}
                    {previewInvoice.dueDate}
                  </p>
                  <p className="mt-1 font-mono text-[11px] font-semibold">
                    Status: {previewInvoice.status}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Bill To</p>
                  <p className="mt-0.5 font-bold">{previewInvoice.customerName}</p>
                  {previewInvoice.customerPin && (
                    <p className="font-mono text-[11px]">Buyer PIN: {previewInvoice.customerPin}</p>
                  )}
                  {previewInvoice.customerPhone && <p>{previewInvoice.customerPhone}</p>}
                  {previewInvoice.customerEmail && <p>{previewInvoice.customerEmail}</p>}
                </div>
                <div className="text-right font-mono text-[11px]">
                  <p className="font-sans text-[10px] font-semibold uppercase text-slate-500">
                    KRA eTIMS Fiscal Control
                  </p>
                  <p className="mt-0.5 font-bold">
                    {previewInvoice.etimsCuin || 'PROFORMA / NOT TRANSMITTED'}
                  </p>
                  <p className="text-slate-500">Portal: misafarms.com/{business.slug}</p>
                </div>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-2 font-semibold">SKU</th>
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 font-semibold">Tax</th>
                    <th className="py-2 text-right font-semibold">Qty</th>
                    <th className="py-2 text-right font-semibold">Unit Price</th>
                    <th className="py-2 text-right font-semibold">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewInvoice.lines.map((l, idx) => (
                    <tr key={`${l.sku}-${idx}`}>
                      <td className="py-2 font-mono">{l.sku}</td>
                      <td className="py-2 font-medium">{l.name}</td>
                      <td className="py-2">{getTaxLabel(l.taxCode, business.vatRate)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{l.qty}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatMoney(l.unitPrice, previewInvoice.currency)}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold tabular-nums">
                        {formatMoney(l.lineTotal, previewInvoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <div className="w-64 space-y-1 font-mono tabular-nums">
                  <div className="flex justify-between text-slate-600">
                    <span>Net Excl. VAT</span>
                    <span>
                      {formatMoney(
                        previewInvoice.total - previewInvoice.taxAmount,
                        previewInvoice.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({business.vatRate}%)</span>
                    <span>{formatMoney(previewInvoice.taxAmount, previewInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-bold">
                    <span>INVOICE TOTAL</span>
                    <span>{formatMoney(previewInvoice.total, previewInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Amount Paid</span>
                    <span>{formatMoney(previewInvoice.amountPaid, previewInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-700">
                    <span>Balance Due</span>
                    <span>{formatMoney(previewInvoice.balanceDue, previewInvoice.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
