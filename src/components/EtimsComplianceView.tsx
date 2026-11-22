import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileWarning, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { BusinessEntity, ErpRecord, SaleTransaction, StoreBranch } from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface EtimsComplianceViewProps {
  business: BusinessEntity;
  stores: StoreBranch[];
  transactions: SaleTransaction[];
  erpRecords: ErpRecord[];
  onRetransmit: (txId: string) => Promise<void>;
  onIssueCreditNote: (txId: string, reason: string) => Promise<void>;
}

export const EtimsComplianceView: React.FC<EtimsComplianceViewProps> = ({
  business,
  stores,
  transactions,
  erpRecords,
  onRetransmit,
  onIssueCreditNote,
}) => {
  const [reportTab, setReportTab] = useState<'sales' | 'purchases' | 'credit_notes' | 'vat3'>('sales');
  const [filterStatus, setFilterStatus] = useState<
    'All' | 'Transmitted' | 'Pending Retry' | 'Queued Offline'
  >('All');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [issuingCnId, setIssuingCnId] = useState<string | null>(null);

  const purchaseInvoices = useMemo(
    () => erpRecords.filter((r) => r.moduleId === 'purchase' && r.businessId === business.id),
    [erpRecords, business.id]
  );

  const creditNotes = useMemo(
    () => transactions.filter((t) => t.etimsStatus === 'Credit Note'),
    [transactions]
  );

  const salesTransactions = useMemo(
    () => transactions.filter((t) => t.etimsStatus !== 'Credit Note'),
    [transactions]
  );

  const taxBreakdown = useMemo(() => {
    let vatable16 = 0;
    let zeroRated = 0;
    let exempt = 0;
    let outputVat = 0;

    for (const tx of transactions) {
      outputVat += tx.taxAmount;
      for (const line of tx.lines) {
        const sign = tx.etimsStatus === 'Credit Note' ? -1 : 1;
        if (line.taxCode === 'B_16') vatable16 += line.lineTotal * sign;
        else if (line.taxCode === 'E_0') zeroRated += line.lineTotal * sign;
        else exempt += line.lineTotal * sign;
      }
    }

    const inputVat = purchaseInvoices.reduce((sum, p) => {
      const amt = p.amount || 0;
      return sum + Math.round((amt * (business.vatRate / (100 + business.vatRate))) * 100) / 100;
    }, 0);

    return {
      vatable16,
      zeroRated,
      exempt,
      outputVat,
      inputVat,
      netVatPayable: Math.round((outputVat - inputVat) * 100) / 100,
    };
  }, [transactions, purchaseInvoices, business.vatRate]);

  const filteredSales = useMemo(() => {
    if (filterStatus === 'All') return salesTransactions;
    return salesTransactions.filter((t) => t.etimsStatus === filterStatus);
  }, [salesTransactions, filterStatus]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await onRetransmit(id);
    } finally {
      setRetryingId(null);
    }
  };

  const handleCreditNote = async (id: string) => {
    setIssuingCnId(id);
    try {
      await onIssueCreditNote(id, 'Customer Return / Tax Adjustment');
    } finally {
      setIssuingCnId(null);
    }
  };

  const handleExportVat3Csv = () => {
    const header =
      'ReceiptNo,CUIN,Date,Branch,Customer,BuyerPIN,TaxStatus,VAT_KES,GrossTotal\n';
    const rows = transactions
      .map(
        (t) =>
          `"${t.receiptNo}","${t.etimsCuin}","${t.createdAt}","${t.storeName}","${t.customerName}","${
            t.customerPin || ''
          }","${t.etimsStatus}",${t.taxAmount.toFixed(2)},${t.total.toFixed(2)}`
      )
      .join('\n');
    const summary = `\n\nSUMMARY\nOutput VAT (16%),${taxBreakdown.outputVat.toFixed(
      2
    )}\nInput VAT (Purchases),${taxBreakdown.inputVat.toFixed(
      2
    )}\nNet VAT3 Payable,${taxBreakdown.netVatPayable.toFixed(2)}\n`;
    const blob = new Blob([header + rows + summary], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KRA-VAT3-eTIMS-${business.taxPin}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            KRA eTIMS Compliance & Tax Reports Suite
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real-time OSCU/VSCU invoices, purchase input VAT credits, credit notes, and downloadable iTax VAT3 schedules for {business.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
            PIN: <strong className="text-slate-900 dark:text-slate-100">{business.taxPin}</strong> · {business.etimsMode}
          </span>
          <button
            type="button"
            onClick={handleExportVat3Csv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export VAT3 CSV</span>
          </button>
        </div>
      </div>

      {/* VAT3 Return Summary Strip */}
      <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Taxable Sales (Code B · 16%)</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(taxBreakdown.vatable16, business.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Zero-Rated & Exempt (E / A)</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(taxBreakdown.zeroRated + taxBreakdown.exempt, business.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Output VAT Charged</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(taxBreakdown.outputVat, business.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Input VAT (eTIMS Purchases)</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            -{formatMoney(taxBreakdown.inputVat, business.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Net VAT3 Payable to KRA</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {formatMoney(taxBreakdown.netVatPayable, business.currency)}
          </p>
        </div>
      </section>

      {/* Report Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3 dark:border-slate-800">
        {(
          [
            { id: 'sales', label: `Sales Invoices (${salesTransactions.length})` },
            { id: 'purchases', label: `Input Tax Purchases (${purchaseInvoices.length})` },
            { id: 'credit_notes', label: `Credit Notes (${creditNotes.length})` },
            { id: 'vat3', label: `OSCU / VSCU Devices (${stores.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setReportTab(tab.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              reportTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reportTab === 'vat3' && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Branch</th>
                  <th className="px-5 py-2.5 font-medium">BHF ID</th>
                  <th className="px-5 py-2.5 font-medium">Control Unit Serial</th>
                  <th className="px-5 py-2.5 font-medium">M-Pesa Till</th>
                  <th className="px-5 py-2.5 font-medium">Compliance State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stores.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="px-5 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.etimsBhfId}
                    </td>
                    <td className="px-5 py-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {s.vscuSerial}
                    </td>
                    <td className="px-5 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {s.tillNumber}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>OSCU Handshake Active</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {reportTab === 'purchases' && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {purchaseInvoices.map((po) => (
              <div key={po.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{po.title}</p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    {po.subtitle} · {po.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold tabular-nums">
                    {formatMoney(po.amount || 0, po.currency || business.currency)}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    eTIMS Input Tax Claimable
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reportTab === 'credit_notes' && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {creditNotes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No KRA eTIMS Credit Notes issued yet. Use "Credit Note" on any transmitted Sales Invoice to reverse tax and restore stock.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {creditNotes.map((cn) => (
                <div key={cn.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                  <div>
                    <p className="font-mono font-semibold text-rose-700 dark:text-rose-400">
                      {cn.etimsCuin} (Ref: {cn.referenceCuin})
                    </p>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                      {cn.customerName} · {cn.storeName}
                    </p>
                  </div>
                  <div className="text-right font-mono font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                    {formatMoney(cn.total, cn.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {reportTab === 'sales' && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              eTIMS Sales & Fiscal Invoice Ledger
            </h2>
            <div className="flex items-center gap-1.5">
              {(['All', 'Transmitted', 'Pending Retry', 'Queued Offline'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white dark:bg-teal-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Receipt No</th>
                  <th className="px-5 py-2.5 font-medium">eTIMS CUIN</th>
                  <th className="px-5 py-2.5 font-medium">Branch & Channel</th>
                  <th className="px-5 py-2.5 font-medium">Buyer / PIN</th>
                  <th className="px-5 py-2.5 text-right font-medium">VAT</th>
                  <th className="px-5 py-2.5 text-right font-medium">Gross Total</th>
                  <th className="px-5 py-2.5 font-medium">KRA Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {tx.receiptNo}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {tx.etimsCuin}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {tx.storeName} · {tx.channel}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {tx.customerName}
                      {tx.customerPin ? ` (${tx.customerPin})` : ''}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {formatMoney(tx.taxAmount, tx.currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(tx.total, tx.currency)}
                    </td>
                    <td className="px-5 py-3">
                      {tx.etimsStatus === 'Transmitted' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Transmitted</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>{tx.etimsStatus}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {tx.etimsStatus !== 'Transmitted' ? (
                        <button
                          type="button"
                          onClick={() => handleRetry(tx.id)}
                          disabled={retryingId === tx.id}
                          className="inline-flex items-center gap-1 rounded bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${retryingId === tx.id ? 'animate-spin' : ''}`}
                          />
                          <span>Transmit</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCreditNote(tx.id)}
                          disabled={issuingCnId === tx.id}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                        >
                          {issuingCnId === tx.id ? (
                            <FileWarning className="h-3 w-3 animate-pulse" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          <span>Credit Note</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
