import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Mail,
  Phone,
  Plus,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  BusinessEntity,
  CrmCustomerLead,
  OnlineOrder,
  SaleTransaction,
  TaxInvoiceRecord,
} from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';

interface CrmWorkspaceProps {
  business: BusinessEntity;
  transactions: SaleTransaction[];
  onlineOrders: OnlineOrder[];
  invoices: TaxInvoiceRecord[];
  crmLeads: CrmCustomerLead[];
  onCreateLead: (payload: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    kraPin?: string;
    stage: CrmCustomerLead['stage'];
    expectedValue: number;
    notes?: string;
    source: CrmCustomerLead['source'];
  }) => Promise<void>;
  onUpdateLead: (
    leadId: string,
    patch: { stage?: CrmCustomerLead['stage']; expectedValue?: number; notes?: string }
  ) => Promise<void>;
  onConvertLeadToInvoice?: (lead: CrmCustomerLead) => void;
}

interface AggregatedCustomer {
  key: string;
  name: string;
  phone?: string;
  email?: string;
  kraPin?: string;
  ordersCount: number;
  totalSpent: number;
  lastActivity: string;
  channels: string[];
}

const LEAD_STAGES: CrmCustomerLead['stage'][] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Customer',
];

export const CrmWorkspace: React.FC<CrmWorkspaceProps> = ({
  business,
  transactions,
  onlineOrders,
  invoices,
  crmLeads,
  onCreateLead,
  onUpdateLead,
  onConvertLeadToInvoice,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'pipeline'>('customers');
  const [search, setSearch] = useState('');

  // New Lead Form State
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [stage, setStage] = useState<CrmCustomerLead['stage']>('Lead');
  const [expectedValue, setExpectedValue] = useState('');
  const [source, setSource] = useState<CrmCustomerLead['source']>('Manual');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bizLeads = useMemo(
    () => crmLeads.filter((l) => l.businessId === business.id),
    [crmLeads, business.id]
  );

  // Aggregate real customers from POS/Field Transactions, Online Orders, and Tax Invoices
  const customers = useMemo<AggregatedCustomer[]>(() => {
    const map = new Map<string, AggregatedCustomer>();
    const upsert = (entry: {
      name: string;
      phone?: string;
      email?: string;
      kraPin?: string;
      amount: number;
      date: string;
      channel: string;
    }) => {
      const cleanName = entry.name.trim();
      if (!cleanName || cleanName.toLowerCase() === 'walk-in customer') return;
      const key =
        (entry.email && entry.email.toLowerCase()) ||
        (entry.phone && entry.phone.replace(/\s+/g, '')) ||
        cleanName.toLowerCase();

      const existing = map.get(key);
      if (existing) {
        existing.ordersCount += 1;
        existing.totalSpent = Math.round((existing.totalSpent + entry.amount) * 100) / 100;
        if (entry.date > existing.lastActivity) existing.lastActivity = entry.date;
        if (!existing.phone && entry.phone) existing.phone = entry.phone;
        if (!existing.email && entry.email) existing.email = entry.email;
        if (!existing.kraPin && entry.kraPin) existing.kraPin = entry.kraPin;
        if (!existing.channels.includes(entry.channel)) existing.channels.push(entry.channel);
      } else {
        map.set(key, {
          key,
          name: cleanName,
          phone: entry.phone,
          email: entry.email,
          kraPin: entry.kraPin,
          ordersCount: 1,
          totalSpent: Math.round(entry.amount * 100) / 100,
          lastActivity: entry.date,
          channels: [entry.channel],
        });
      }
    };

    for (const tx of transactions) {
      if (tx.businessId !== business.id || tx.etimsStatus === 'Credit Note') continue;
      upsert({
        name: tx.customerName,
        phone: tx.customerPhone,
        email: tx.customerEmail || tx.emailedTo,
        kraPin: tx.customerPin,
        amount: tx.total,
        date: tx.createdAt,
        channel: tx.channel,
      });
    }

    for (const ord of onlineOrders) {
      if (ord.businessId !== business.id || ord.fulfillmentStatus === 'Cancelled') continue;
      if (ord.linkedTransactionId) continue; // Avoid double-counting synced order
      upsert({
        name: ord.customerName,
        phone: ord.customerPhone,
        email: ord.customerEmail,
        kraPin: ord.customerPin,
        amount: ord.total,
        date: ord.createdAt,
        channel: 'Online Store',
      });
    }

    for (const inv of invoices) {
      if (inv.businessId !== business.id || inv.status === 'Void') continue;
      if (inv.linkedTransactionId) continue;
      upsert({
        name: inv.customerName,
        phone: inv.customerPhone,
        email: inv.customerEmail,
        kraPin: inv.customerPin,
        amount: inv.amountPaid > 0 ? inv.amountPaid : 0,
        date: inv.createdAt,
        channel: inv.docType,
      });
    }

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [business.id, transactions, onlineOrders, invoices]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.kraPin && c.kraPin.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const totalCustomerLtv = useMemo(
    () => customers.reduce((s, c) => s + c.totalSpent, 0),
    [customers]
  );

  const pipelineValue = useMemo(
    () => bizLeads.filter((l) => l.stage !== 'Customer').reduce((s, l) => s + l.expectedValue, 0),
    [bizLeads]
  );

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreateLead({
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        kraPin: kraPin.trim().toUpperCase() || undefined,
        stage,
        expectedValue: Math.max(0, Number(expectedValue) || 0),
        notes: notes.trim() || undefined,
        source,
      });
      setName('');
      setCompany('');
      setEmail('');
      setPhone('');
      setKraPin('');
      setExpectedValue('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            CRM &amp; Customer Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Live buyer directory aggregated from POS, eCommerce &amp; Tax Invoices plus B2B sales pipeline for {business.name}.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`rounded-md px-3 py-1.5 font-semibold ${
              activeTab === 'customers'
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Customer Directory ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`rounded-md px-3 py-1.5 font-semibold ${
              activeTab === 'pipeline'
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Leads Pipeline ({bizLeads.length})
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Named Active Customers
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {customers.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Computed from real sales &amp; online orders
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Customer Lifetime Spend
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {formatMoney(totalCustomerLtv, business.currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Excludes anonymous walk-in receipts &amp; credit notes
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Open B2B Pipeline Value
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(pipelineValue, business.currency)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {bizLeads.length} tracked deals &amp; accounts
          </p>
        </div>
      </div>

      {activeTab === 'customers' ? (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Verified Customer Accounts
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, phone, email, KRA PIN..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                No named customer purchases recorded yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Customers appear automatically when you record a named POS sale, Tax Invoice, or Online Store order.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-2.5 font-medium">Customer</th>
                    <th className="px-5 py-2.5 font-medium">Contact</th>
                    <th className="px-5 py-2.5 font-medium">KRA PIN</th>
                    <th className="px-5 py-2.5 font-medium">Channels</th>
                    <th className="px-5 py-2.5 text-right font-medium">Orders</th>
                    <th className="px-5 py-2.5 text-right font-medium">Total Spent</th>
                    <th className="px-5 py-2.5 text-right font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomers.map((c) => (
                    <tr key={c.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {c.phone && (
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {!c.phone && !c.email && <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-300">
                        {c.kraPin || '—'}
                      </td>
                      <td className="px-5 py-3 text-[11px] text-slate-600 dark:text-slate-300">
                        {c.channels.join(', ')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {c.ordersCount}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                        {formatMoney(c.totalSpent, business.currency)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(c.lastActivity).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {/* Add New CRM Lead */}
          <form
            onSubmit={handleAddLead}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add Customer Lead / B2B Opportunity
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contact Full Name *"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company / Organization"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (e.g. +2547...)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={kraPin}
                onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                placeholder="KRA PIN (Optional)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                placeholder={`Expected Value (${business.currency})`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as CrmCustomerLead['stage'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {LEAD_STAGES.map((st) => (
                  <option key={st} value={st}>
                    Stage: {st}
                  </option>
                ))}
              </select>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as CrmCustomerLead['source'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="Manual">Source: Manual Entry</option>
                <option value="B2B Referral">Source: B2B Referral</option>
                <option value="POS">Source: POS Walk-In</option>
                <option value="Online Store">Source: Online Store</option>
              </select>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Deal requirements / follow-up notes..."
                className="sm:col-span-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{submitting ? 'Saving...' : 'Add Lead'}</span>
              </button>
            </div>
          </form>

          {/* Pipeline List */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Active Sales Opportunities ({bizLeads.length})
              </h2>
            </div>

            {bizLeads.length === 0 ? (
              <div className="p-10 text-center">
                <UserCheck className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  No CRM leads logged for {business.name}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Add prospective corporate buyers, wholesale accounts, or repeat clients above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {bizLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {lead.name}
                        </span>
                        {lead.company && (
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {lead.company}
                          </span>
                        )}
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {lead.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {[lead.phone, lead.email, lead.kraPin && `PIN: ${lead.kraPin}`]
                          .filter(Boolean)
                          .join(' · ') || 'No contact info'}
                      </p>
                      {lead.notes && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {lead.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatMoney(lead.expectedValue, business.currency)}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <select
                        aria-label={`Stage for ${lead.name}`}
                        value={lead.stage}
                        onChange={(e) =>
                          onUpdateLead(lead.id, {
                            stage: e.target.value as CrmCustomerLead['stage'],
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {LEAD_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>

                      {onConvertLeadToInvoice && (
                        <button
                          type="button"
                          onClick={() => onConvertLeadToInvoice(lead)}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950/40"
                        >
                          <span>Create Invoice</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
