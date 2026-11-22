import React, { useState } from 'react';
import { CheckCircle2, Code2, Lock, Mail, Milestone, ShieldCheck } from 'lucide-react';
import { AuditLogEntry, UserRole } from '../types/erp';
import { ROLE_PERMISSIONS } from '../utils/cryptoSync';

interface EnterpriseGovernanceViewProps {
  mode: 'governance' | 'api' | 'timeline';
  auditLogs: AuditLogEntry[];
  activeRole: UserRole;
}

export const EnterpriseGovernanceView: React.FC<EnterpriseGovernanceViewProps> = ({
  mode,
  auditLogs,
  activeRole,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<'pos' | 'etims' | 'mpesa' | 'hr'>('pos');

  if (mode === 'timeline') {
    const phases = [
      {
        phase: 'Phase 1 · Weeks 1–2',
        title: 'Discovery, Multi-Store Architecture & KRA eTIMS Registration',
        deliverables:
          'Business onboarding, KRA OSCU/VSCU certificate provisioning, chart of accounts (KES/VAT), and RBAC policy matrix.',
        kes: 420000,
        usd: 3250,
      },
      {
        phase: 'Phase 2 · Weeks 3–5',
        title: 'Core POS, Inventory Matrix & Offline AES-256 Sync Engine',
        deliverables:
          'Dynamics-grade POS terminals, barcode hardware pairing, multi-branch stock transfers, and IndexedDB offline queue.',
        kes: 780000,
        usd: 6000,
      },
      {
        phase: 'Phase 3 · Weeks 6–7',
        title: 'Payment Gateways (M-Pesa Daraja, Pesapal) & Field Handheld App',
        deliverables:
          'Live STK Push & Paybill reconciliation webhooks, mobile field-agent order capture, and automated receipt emails.',
        kes: 540000,
        usd: 4150,
      },
      {
        phase: 'Phase 4 · Weeks 8–9',
        title: 'HR, Kenyan Statutory Payroll & Third-Party Connectors',
        deliverables:
          'PAYE/SHIF/NSSF/AHL payroll engine, WorkPay/BambooHR REST sync, and automated Studio approval workflows.',
        kes: 490000,
        usd: 3770,
      },
      {
        phase: 'Phase 5 · Weeks 10–11',
        title: 'Security Hardening, KDPA/GDPR Audit & Staff Training',
        deliverables:
          'End-to-end encryption verification, penetration testing, eLearning cashier certification, and UAT across branches.',
        kes: 360000,
        usd: 2770,
      },
      {
        phase: 'Phase 6 · Week 12',
        title: 'Multi-Branch Go-Live & Hypercare Support',
        deliverables:
          'Cutover across flagship and regional branches, KRA VAT3 parallel run validation, and 24/7 SLA transition.',
        kes: 260000,
        usd: 2000,
      },
    ];

    const totalKes = phases.reduce((s, p) => s + p.kes, 0);
    const totalUsd = phases.reduce((s, p) => s + p.usd, 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Enterprise Implementation Timeline & Budget Estimate
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              12-week phased rollout roadmap for MisafaRMS multi-store deployment with Kenya eTIMS certification and SMB-scalable licensing.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <Milestone className="h-4 w-4" />
            <span>12 Weeks · KES {totalKes.toLocaleString()} (USD {totalUsd.toLocaleString()})</span>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Implementation Budget</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              KES {totalKes.toLocaleString()}
            </p>
            <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
              Approx. USD {totalUsd.toLocaleString()} (Excl. KRA hardware if physical ETR)
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">SMB Starter SaaS Tier</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
              KES 6,500 / mo
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Single store · eTIMS + M-Pesa + Inventory included
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Enterprise Multi-Branch Tier</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              KES 24,000 / mo
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Unlimited SKUs, Studio customizer & dedicated SLA
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Timeline</th>
                  <th className="px-5 py-3 font-medium">Workstream</th>
                  <th className="px-5 py-3 font-medium">Key Deliverables</th>
                  <th className="px-5 py-3 text-right font-medium">Budget (KES)</th>
                  <th className="px-5 py-3 text-right font-medium">Budget (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {phases.map((p) => (
                  <tr key={p.phase} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono font-medium whitespace-nowrap text-teal-700 dark:text-teal-400">
                      {p.phase}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      {p.title}
                    </td>
                    <td className="max-w-md px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {p.deliverables}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {p.kes.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      ${p.usd.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (mode === 'api') {
    const snippets: Record<'pos' | 'etims' | 'mpesa' | 'hr', { method: string; path: string; body: string }> = {
      pos: {
        method: 'POST',
        path: '/api/pos/checkout',
        body: `{
  "businessId": "biz-savannah",
  "storeId": "store-nbo-cbd",
  "paymentMethod": "M-Pesa STK",
  "customerPhone": "254712345678",
  "lines": [
    { "productId": "prod-coffee", "qty": 2, "discountPct": 0 }
  ]
}`,
      },
      etims: {
        method: 'POST',
        path: '/api/etims/transmit',
        body: `{
  "transactionId": "tx-1003",
  "kraPin": "P051482910K",
  "bhfId": "02",
  "mode": "OSCU"
}`,
      },
      mpesa: {
        method: 'POST',
        path: '/api/webhooks/daraja-stk-callback',
        body: `{
  "MerchantRequestID": "29115-34620561-1",
  "ResultCode": 0,
  "MpesaReceiptNumber": "SL94K281MP",
  "Amount": 1450.00,
  "PhoneNumber": "254712345678"
}`,
      },
      hr: {
        method: 'POST',
        path: '/api/hr/sync-third-party',
        body: `{
  "provider": "WorkPay_KE",
  "syncStatutory": ["PAYE", "SHIF_2_75", "NSSF", "AHL_1_5"],
  "branchId": "store-nbo-cbd"
}`,
      },
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Developer API Documentation & Payment Gateways
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            RESTful endpoints, M-Pesa Daraja / Pesapal / Stripe connectors, and third-party HR webhooks.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-4">
            {(
              [
                { id: 'pos', title: 'POS Checkout & Stock Deduction', sub: 'POST /api/pos/checkout' },
                { id: 'etims', title: 'KRA eTIMS OSCU Transmission', sub: 'POST /api/etims/transmit' },
                { id: 'mpesa', title: 'M-Pesa Daraja STK Callback', sub: 'POST /api/webhooks/daraja-stk-callback' },
                { id: 'hr', title: 'Third-Party HR & Payroll Sync', sub: 'POST /api/hr/sync-third-party' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedEndpoint(item.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedEndpoint === item.id
                    ? 'border-teal-600 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {item.sub}
                </p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-slate-100 lg:col-span-8 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Code2 className="h-4 w-4 text-teal-400" />
                <span className="font-bold text-teal-400">{snippets[selectedEndpoint].method}</span>
                <span>{snippets[selectedEndpoint].path}</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Auth: Bearer Token · Content-Type: application/json
              </span>
            </div>
            <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-emerald-300">
              {snippets[selectedEndpoint].body}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // mode === 'governance'
  const roles = Object.entries(ROLE_PERMISSIONS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Security, RBAC Matrix, Encryption & Audit Logs
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          End-to-end AES-256-GCM offline vault encryption, Kenya Data Protection Act (KDPA 2019) & GDPR controls, SHA-256 audit chaining, and automated email alerts.
        </p>
      </div>

      {/* Compliance & Encryption Strip */}
      <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 text-teal-700 dark:text-teal-400" />
          <div>
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              AES-256-GCM Offline Encryption
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Offline receipts & customer PINs are encrypted via Web Crypto API before local persistence.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-400" />
          <div>
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              KDPA 2019 & GDPR Compliant
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Data minimization, role-scoped PII masking, and exportable audit history.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 text-sky-700 dark:text-sky-400" />
          <div>
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Automated Email Activity Alerts
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Dispatched on branch transfers, high-value sales, and new RBAC sessions.
            </p>
          </div>
        </div>
      </section>

      {/* RBAC Matrix */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Role-Based Access Control Matrix (Active Role: {activeRole})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-5 py-2.5 font-medium">Role</th>
                <th className="px-5 py-2.5 text-right font-medium">Max POS Discount</th>
                <th className="px-5 py-2.5 font-medium">Void Sale</th>
                <th className="px-5 py-2.5 font-medium">KRA eTIMS</th>
                <th className="px-5 py-2.5 font-medium">Inventory Edit</th>
                <th className="px-5 py-2.5 font-medium">Studio</th>
                <th className="px-5 py-2.5 font-medium">Payroll</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {roles.map(([roleName, perms]) => (
                <tr
                  key={roleName}
                  className={
                    roleName === activeRole
                      ? 'bg-teal-50/60 dark:bg-teal-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }
                >
                  <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {roleName}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">
                    {perms.maxDiscountPct}%
                  </td>
                  <td className="px-5 py-3">{perms.canVoidSale ? 'Allowed' : 'Restricted'}</td>
                  <td className="px-5 py-3">{perms.canViewEtims ? 'Allowed' : 'Restricted'}</td>
                  <td className="px-5 py-3">{perms.canEditInventory ? 'Allowed' : 'Restricted'}</td>
                  <td className="px-5 py-3">{perms.canUseStudio ? 'Allowed' : 'Restricted'}</td>
                  <td className="px-5 py-3">{perms.canViewPayroll ? 'Allowed' : 'Restricted'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Immutable Audit & Email Notification Trail */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Cryptographic Audit Log & Email Notification Dispatch
          </h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{log.action}</p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  {log.actor} ({log.role}) · {log.module} · {log.storeName} ·{' '}
                  <span className="font-mono">{log.hashPrefix}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
                {log.emailNotified && (
                  <p className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Emailed {log.recipientEmail}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
