import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Plus, Printer } from 'lucide-react';
import {
  BusinessEntity,
  ErpRecord,
  PayrollRunRecord,
  ProductItem,
  SaleTransaction,
  TaxInvoiceRecord,
} from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface AccountingWorkspaceProps {
  business: BusinessEntity;
  products: ProductItem[];
  transactions: SaleTransaction[];
  invoices: TaxInvoiceRecord[];
  payrollRuns: PayrollRunRecord[];
  erpRecords: ErpRecord[];
  onCreateJournal: (payload: {
    debitAccount: string;
    creditAccount: string;
    description: string;
    amount: number;
    date: string;
  }) => Promise<void>;
}

const CHART_OF_ACCOUNTS = [
  '101000 · Cash & Bank Clearing',
  '102000 · M-Pesa Paybill / Till Settlement',
  '120000 · Accounts Receivable',
  '140000 · Inventory Asset',
  '210000 · Accounts Payable',
  '220100 · KRA Output VAT Control',
  '220200 · PAYE / SHIF / NSSF / AHL Payable',
  '400000 · Retail & Online Sales Revenue',
  '500000 · Cost of Goods Sold (COGS)',
  '610100 · Salaries & Statutory Wages',
  '620000 · Rent, Utilities & Operating Expenses',
];

export const AccountingWorkspace: React.FC<AccountingWorkspaceProps> = ({
  business,
  products,
  transactions,
  invoices,
  payrollRuns,
  erpRecords,
  onCreateJournal,
}) => {
  const [debitAccount, setDebitAccount] = useState(CHART_OF_ACCOUNTS[10]);
  const [creditAccount, setCreditAccount] = useState(CHART_OF_ACCOUNTS[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [posting, setPosting] = useState(false);
  const [postedMsg, setPostedMsg] = useState('');

  const financials = useMemo(() => {
    const bizTx = transactions.filter((t) => t.businessId === business.id);
    const grossSales = bizTx.reduce((s, t) => s + t.total, 0);
    const outputVat = bizTx.reduce((s, t) => s + t.taxAmount, 0);
    const netRevenue = Math.round((grossSales - outputVat) * 100) / 100;

    // Estimated COGS using actual SKU cost * qty sold
    const prodCostMap = new Map(products.map((p) => [p.id, p.cost]));
    let cogs = 0;
    for (const tx of bizTx) {
      const sign = tx.etimsStatus === 'Credit Note' ? -1 : 1;
      for (const l of tx.lines) {
        const unitCost = prodCostMap.get(l.productId) ?? l.unitPrice * 0.68;
        cogs += sign * unitCost * l.qty;
      }
    }
    cogs = Math.round(cogs * 100) / 100;

    const bizPurchases = erpRecords.filter(
      (r) => r.businessId === business.id && r.moduleId === 'purchase'
    );
    const purchaseTotal = bizPurchases.reduce((s, r) => s + (r.amount || 0), 0);
    const inputVat = Math.round(purchaseTotal * (business.vatRate / (100 + business.vatRate)) * 100) / 100;

    const bizExpenses = erpRecords.filter(
      (r) => r.businessId === business.id && r.moduleId === 'expenses'
    );
    const operatingExpenses = bizExpenses.reduce((s, r) => s + (r.amount || 0), 0);

    const bizPayroll = payrollRuns.filter((r) => r.businessId === business.id);
    const payrollCost = bizPayroll.reduce((s, r) => s + r.totalEmployerCost, 0);

    const bizManualJournals = erpRecords.filter(
      (r) =>
        r.businessId === business.id &&
        r.moduleId === 'accounting' &&
        r.meta?.manual === 'true'
    );

    const receivables = invoices
      .filter((i) => i.businessId === business.id && i.status !== 'Void' && i.status !== 'Draft')
      .reduce((s, i) => s + i.balanceDue, 0);

    const inventoryValuation = products
      .filter((p) => p.businessId === business.id)
      .reduce((s, p) => {
        const qty = Object.values(p.stockByStore).reduce((a, b) => a + b, 0);
        return s + qty * p.cost;
      }, 0);

    const grossProfit = Math.round((netRevenue - cogs) * 100) / 100;
    const netProfit = Math.round((grossProfit - operatingExpenses - payrollCost) * 100) / 100;
    const netVatPayable = Math.round((outputVat - inputVat) * 100) / 100;

    return {
      netRevenue,
      outputVat: Math.round(outputVat * 100) / 100,
      inputVat,
      netVatPayable,
      cogs,
      grossProfit,
      operatingExpenses: Math.round(operatingExpenses * 100) / 100,
      payrollCost: Math.round(payrollCost * 100) / 100,
      netProfit,
      receivables: Math.round(receivables * 100) / 100,
      inventoryValuation: Math.round(inventoryValuation * 100) / 100,
      manualCount: bizManualJournals.length,
    };
  }, [business.id, business.vatRate, transactions, products, erpRecords, payrollRuns, invoices]);

  const glEntries = useMemo(
    () =>
      erpRecords.filter(
        (r) => r.businessId === business.id && r.moduleId === 'accounting'
      ),
    [erpRecords, business.id]
  );

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0 || debitAccount === creditAccount) return;
    setPosting(true);
    try {
      await onCreateJournal({
        debitAccount,
        creditAccount,
        description: description.trim() || `${debitAccount} / ${creditAccount}`,
        amount: num,
        date,
      });
      setDescription('');
      setAmount('');
      setPostedMsg('Double-entry journal posted to General Ledger.');
      setTimeout(() => setPostedMsg(''), 3500);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Accounting, KRA VAT3 &amp; General Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real-time P&amp;L, Inventory Valuation, Output vs. Input VAT3, and Double-Entry Journals for {business.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print Financial Statement</span>
        </button>
      </div>

      {postedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{postedMsg}</span>
        </div>
      )}

      {/* Printable Financial Summary (P&L + Balance Sheet + VAT3) */}
      <div id="misafa-printable-document" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            Income Statement (P&amp;L)
          </h2>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Net Sales (Excl. VAT)</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatMoney(financials.netRevenue, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Cost of Goods Sold</span>
              <span className="font-mono tabular-nums text-rose-700 dark:text-rose-400">
                -{formatMoney(financials.cogs, business.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-slate-800">
              <span>Gross Profit</span>
              <span className="font-mono tabular-nums">
                {formatMoney(financials.grossProfit, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Operating Expenses</span>
              <span className="font-mono tabular-nums">
                -{formatMoney(financials.operatingExpenses, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Payroll Employer Cost</span>
              <span className="font-mono tabular-nums">
                -{formatMoney(financials.payrollCost, business.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold dark:border-slate-700">
              <span>Net Operating Profit</span>
              <span
                className={`font-mono tabular-nums ${
                  financials.netProfit >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatMoney(financials.netProfit, business.currency)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            KRA VAT3 Return Summary ({business.vatRate}%)
          </h2>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Output VAT (Sales &amp; Credit Notes)</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatMoney(financials.outputVat, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Input VAT (Supplier GRNs)</span>
              <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                -{formatMoney(financials.inputVat, business.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold dark:border-slate-700">
              <span>Net VAT Payable to KRA</span>
              <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
                {formatMoney(financials.netVatPayable, business.currency)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            Working Capital Position
          </h2>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Inventory Asset (At Cost)</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatMoney(financials.inventoryValuation, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Accounts Receivable (Invoices)</span>
              <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {formatMoney(financials.receivables, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Posted GL Journal Rows</span>
              <span className="font-mono font-semibold tabular-nums">{glEntries.length}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Double-Entry Manual Journal Posting */}
      <form
        onSubmit={handlePostJournal}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Post Double-Entry Journal Voucher
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-6">
          <select
            value={debitAccount}
            onChange={(e) => setDebitAccount(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {CHART_OF_ACCOUNTS.map((acc) => (
              <option key={acc} value={acc}>
                Debit: {acc}
              </option>
            ))}
          </select>
          <select
            value={creditAccount}
            onChange={(e) => setCreditAccount(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {CHART_OF_ACCOUNTS.map((acc) => (
              <option key={acc} value={acc}>
                Credit: {acc}
              </option>
            ))}
          </select>
          <input
            type="number"
            required
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (${business.currency})`}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Journal narration / voucher reference..."
            className="sm:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={posting || debitAccount === creditAccount}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{posting ? 'Posting...' : 'Post Balanced Journal'}</span>
          </button>
        </div>
      </form>

      {/* General Ledger Feed */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            General Ledger Entries ({glEntries.length})
          </h2>
        </div>

        {glEntries.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              No General Ledger postings yet for {business.name}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              POS checkouts, Invoice payments, Online Orders, Payroll runs, and Manual Journals auto-post here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {glEntries.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.title}</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    {rec.subtitle} · {rec.date}
                  </p>
                </div>
                <div className="text-right">
                  {rec.amount !== undefined && (
                    <p className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(rec.amount, rec.currency || business.currency)}
                    </p>
                  )}
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {rec.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
