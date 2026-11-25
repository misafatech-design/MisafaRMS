import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Mail,
  MessageSquare,
  Send,
  Share2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  AppModuleMeta,
  BusinessEntity,
  CrmCustomerLead,
  MarketingCampaign,
  OnlineOrder,
  SaleTransaction,
  TenantCommsConfig,
} from '../types/erp';

interface MarketingWorkspaceProps {
  module: AppModuleMeta;
  business: BusinessEntity;
  campaigns: MarketingCampaign[];
  crmLeads: CrmCustomerLead[];
  transactions: SaleTransaction[];
  onlineOrders: OnlineOrder[];
  onSaveCommsConfig: (
    config: Partial<TenantCommsConfig> & {
      smtpPassword?: string;
      atApiKey?: string;
      clearSmtpPassword?: boolean;
      clearAtApiKey?: boolean;
    }
  ) => Promise<void>;
  onTestComms: (
    channel: 'email' | 'sms',
    target: string
  ) => Promise<{ ok: boolean; deliveryMode?: string; ref?: string }>;
  onCreateCampaign: (payload: {
    name: string;
    channel: MarketingCampaign['channel'];
    segment: MarketingCampaign['segment'];
    subject?: string;
    message: string;
    customRecipients?: string[];
    sendNow: boolean;
  }) => Promise<MarketingCampaign | null>;
  onSendCampaign: (campaignId: string) => Promise<void>;
}

function defaultChannelFromModule(moduleId: string): MarketingCampaign['channel'] {
  if (moduleId === 'sms_marketing') return 'sms';
  if (moduleId === 'social_marketing') return 'social';
  if (moduleId === 'survey') return 'survey';
  return 'email';
}

export const MarketingWorkspace: React.FC<MarketingWorkspaceProps> = ({
  module,
  business,
  campaigns,
  crmLeads,
  transactions,
  onlineOrders,
  onSaveCommsConfig,
  onTestComms,
  onCreateCampaign,
  onSendCampaign,
}) => {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'audience' | 'smtp' | 'africastalking'>(
    'campaigns'
  );

  // Campaign composer
  const [channel, setChannel] = useState<MarketingCampaign['channel']>(
    defaultChannelFromModule(module.id)
  );
  const [segment, setSegment] = useState<MarketingCampaign['segment']>('all');
  const [campName, setCampName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [customListRaw, setCustomListRaw] = useState('');
  const [submittingCamp, setSubmittingCamp] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [banner, setBanner] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // SMTP form state (strictly per-business — no system-level env defaults)
  const comms = business.commsConfig || {};
  const [smtpHost, setSmtpHost] = useState(comms.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(String(comms.smtpPort || 587));
  const [smtpSecure, setSmtpSecure] = useState(Boolean(comms.smtpSecure));
  const [smtpUsername, setSmtpUsername] = useState(comms.smtpUsername || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState(comms.smtpFromName || business.name);
  const [smtpFromEmail, setSmtpFromEmail] = useState(
    comms.smtpFromEmail || business.ownerEmail || ''
  );
  const [testEmailTarget, setTestEmailTarget] = useState(business.ownerEmail || '');

  // Africa's Talking SMS form state (strictly per-business — no system-level env defaults)
  const [atEnvironment, setAtEnvironment] = useState<'sandbox' | 'production'>(
    comms.atEnvironment || 'sandbox'
  );
  const [atUsername, setAtUsername] = useState(comms.atUsername || '');
  const [atSenderId, setAtSenderId] = useState(comms.atSenderId || '');
  const [atApiKey, setAtApiKey] = useState('');
  const [testSmsTarget, setTestSmsTarget] = useState('+254712345678');

  const [savingComms, setSavingComms] = useState(false);
  const [testingChannel, setTestingChannel] = useState<'email' | 'sms' | null>(null);

  useEffect(() => {
    setChannel(defaultChannelFromModule(module.id));
  }, [module.id]);

  useEffect(() => {
    const c = business.commsConfig || {};
    setSmtpHost(c.smtpHost || '');
    setSmtpPort(String(c.smtpPort || 587));
    setSmtpSecure(Boolean(c.smtpSecure));
    setSmtpUsername(c.smtpUsername || '');
    setSmtpFromName(c.smtpFromName || business.name);
    setSmtpFromEmail(c.smtpFromEmail || business.ownerEmail || '');
    setAtEnvironment(c.atEnvironment || 'sandbox');
    setAtUsername(c.atUsername || '');
    setAtSenderId(c.atSenderId || '');
  }, [business.id, business.commsConfig, business.name, business.ownerEmail]);

  // Real Audience Stats from CRM + POS + eCommerce
  const audienceStats = useMemo(() => {
    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();
    const crmContacts: Array<{ name: string; email?: string; phone?: string; source: string }> = [];

    for (const l of crmLeads) {
      if (l.email?.includes('@')) emailSet.add(l.email.toLowerCase());
      if (l.phone) phoneSet.add(l.phone);
      crmContacts.push({
        name: l.name,
        email: l.email,
        phone: l.phone,
        source: `CRM (${l.stage})`,
      });
    }
    for (const tx of transactions) {
      if (tx.customerEmail?.includes('@')) emailSet.add(tx.customerEmail.toLowerCase());
      if (tx.customerPhone) phoneSet.add(tx.customerPhone);
    }
    for (const ord of onlineOrders) {
      if (ord.customerEmail?.includes('@')) emailSet.add(ord.customerEmail.toLowerCase());
      if (ord.customerPhone) phoneSet.add(ord.customerPhone);
    }
    return {
      uniqueEmails: emailSet.size,
      uniquePhones: phoneSet.size,
      crmCount: crmLeads.length,
      posCount: transactions.filter((t) => Boolean(t.customerPhone || t.customerEmail)).length,
      onlineCount: onlineOrders.length,
      sampleContacts: crmContacts.slice(0, 12),
    };
  }, [crmLeads, transactions, onlineOrders]);

  const smsSegments = Math.max(1, Math.ceil(message.length / 160));

  const handleLaunchCampaign = async (sendNow: boolean) => {
    if (!campName.trim() || !message.trim()) {
      setErrorMsg('Enter a campaign name and message body.');
      return;
    }
    setErrorMsg('');
    setSubmittingCamp(true);
    try {
      const customRecipients =
        segment === 'custom'
          ? customListRaw
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      const created = await onCreateCampaign({
        name: campName.trim(),
        channel,
        segment,
        subject: channel === 'email' || channel === 'survey' ? subject.trim() || campName.trim() : undefined,
        message: message.trim(),
        customRecipients,
        sendNow,
      });
      if (created) {
        setCampName('');
        setSubject('');
        setMessage('');
        setCustomListRaw('');
        setBanner(
          sendNow
            ? `Dispatched "${created.name}" (${created.channel.toUpperCase()}) via ${created.deliveryMode || 'gateway'} to ${created.deliveredCount} recipients.`
            : `Saved draft campaign "${created.name}".`
        );
        setTimeout(() => setBanner(''), 4500);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create campaign.');
    } finally {
      setSubmittingCamp(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingComms(true);
    setErrorMsg('');
    try {
      await onSaveCommsConfig({
        smtpHost: smtpHost.trim(),
        smtpPort: Math.max(1, Number(smtpPort) || 587),
        smtpSecure,
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword.trim() || undefined,
        smtpFromName: smtpFromName.trim() || business.name,
        smtpFromEmail: smtpFromEmail.trim(),
      });
      setSmtpPassword('');
      setBanner('SMTP Email server settings & encrypted credentials saved.');
      setTimeout(() => setBanner(''), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save SMTP config.');
    } finally {
      setSavingComms(false);
    }
  };

  const handleSaveAfricasTalking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingComms(true);
    setErrorMsg('');
    try {
      await onSaveCommsConfig({
        smsProvider: 'africastalking',
        atEnvironment,
        atUsername: atUsername.trim() || 'sandbox',
        atSenderId: atSenderId.trim() || undefined,
        atApiKey: atApiKey.trim() || undefined,
      });
      setAtApiKey('');
      setBanner("Africa's Talking SMS credentials & Sender ID saved.");
      setTimeout(() => setBanner(''), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save SMS config.');
    } finally {
      setSavingComms(false);
    }
  };

  const handleTest = async (ch: 'email' | 'sms') => {
    const target = ch === 'email' ? testEmailTarget.trim() : testSmsTarget.trim();
    if (!target) {
      setErrorMsg(`Enter a test ${ch === 'email' ? 'email address' : 'phone number'} first.`);
      return;
    }
    setTestingChannel(ch);
    setErrorMsg('');
    try {
      const res = await onTestComms(ch, target);
      setBanner(
        ch === 'email'
          ? `SMTP test dispatched (${res.deliveryMode}) · Ref: ${res.ref}`
          : `Africa's Talking SMS test sent (${res.deliveryMode}) · Ref: ${res.ref}`
      );
      setTimeout(() => setBanner(''), 4500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Test dispatch failed.');
    } finally {
      setTestingChannel(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {module.name} · Omni-Channel Marketing &amp; Comms
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Run targeted Email (SMTP), SMS (Africa&apos;s Talking), Social, and Customer Survey campaigns for {business.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
          {(
            [
              { id: 'campaigns', label: 'Campaigns & Composer' },
              { id: 'audience', label: 'Audience Segments' },
              { id: 'smtp', label: 'SMTP Email Config' },
              { id: 'africastalking', label: "Africa's Talking SMS" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white dark:bg-teal-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {errorMsg && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMsg}
        </p>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Reachable Emails
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {audienceStats.uniqueEmails}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            SMS Subscribers (MSISDN)
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {audienceStats.uniquePhones}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            SMTP Gateway
          </p>
          <p className="mt-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
            {comms.hasSmtpPassword ? `${comms.smtpHost} ✓` : 'Local Spool / Ready to Bind'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Africa&apos;s Talking SMS
          </p>
          <p className="mt-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
            {comms.hasAtApiKey
              ? `${comms.atEnvironment?.toUpperCase()} (${comms.atUsername}) ✓`
              : 'Sandbox Simulator Ready'}
          </p>
        </div>
      </div>

      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Composer */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Create Broadcast Campaign
            </h2>

            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {(
                [
                  { id: 'email', label: 'Email', Icon: Mail },
                  { id: 'sms', label: 'SMS', Icon: MessageSquare },
                  { id: 'social', label: 'Social', Icon: Share2 },
                  { id: 'survey', label: 'Survey', Icon: ClipboardList },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChannel(id)}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 font-semibold ${
                    channel === id
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="e.g. End-Month Flash Offer — 15% Off"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Target Audience Segment
                </label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as MarketingCampaign['segment'])}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="all">
                    All Contacts (CRM + POS + eCommerce)
                  </option>
                  <option value="pos_customers">POS Receipt Customers</option>
                  <option value="online_buyers">eCommerce Storefront Buyers</option>
                  <option value="crm_leads">CRM Pipeline Leads ({crmLeads.length})</option>
                  <option value="custom">Custom Comma/Line List</option>
                </select>
              </div>

              {segment === 'custom' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Custom Recipients (Emails or +2547... Phones)
                  </label>
                  <textarea
                    rows={2}
                    value={customListRaw}
                    onChange={(e) => setCustomListRaw(e.target.value)}
                    placeholder="+254712345678, buyer@company.co.ke"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              {(channel === 'email' || channel === 'survey') && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={`Exclusive Offer from ${business.name}`}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label className="font-medium text-slate-700 dark:text-slate-300">
                    {channel === 'sms' ? 'SMS Message Body *' : 'Campaign Content *'}
                  </label>
                  {channel === 'sms' && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {message.length} chars · {smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    channel === 'sms'
                      ? `Shop ${business.name} online at https://misafarms.com/${business.slug}/${business.ecommercePrefix || 'shop'}!`
                      : 'Write your promotion, product announcement, or feedback link...'
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={submittingCamp}
                  onClick={() => handleLaunchCampaign(true)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submittingCamp ? 'Dispatching...' : 'Send Campaign Now'}</span>
                </button>
                <button
                  type="button"
                  disabled={submittingCamp}
                  onClick={() => handleLaunchCampaign(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Save Draft
                </button>
              </div>
            </div>
          </section>

          {/* Campaign History */}
          <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Campaign Dispatch Log ({campaigns.length})
              </h2>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                No campaigns created yet for {business.name}. Launch your first SMTP Email or Africa&apos;s Talking SMS blast on the left.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {campaigns.map((camp) => (
                  <div key={camp.id} className="space-y-1.5 px-5 py-4 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {camp.channel}
                          </span>
                          <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {camp.name}
                          </p>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{camp.message}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            camp.status === 'Sent'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {camp.status}
                        </span>
                        {camp.status !== 'Sent' && (
                          <button
                            type="button"
                            disabled={sendingId === camp.id}
                            onClick={async () => {
                              setSendingId(camp.id);
                              try {
                                await onSendCampaign(camp.id);
                                setBanner(`Campaign "${camp.name}" sent!`);
                                setTimeout(() => setBanner(''), 3500);
                              } finally {
                                setSendingId(null);
                              }
                            }}
                            className="rounded-lg bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                          >
                            {sendingId === camp.id ? 'Sending...' : 'Send Now'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-slate-500 tabular-nums">
                      <span>Segment: {camp.segment}</span>
                      <span>Recipients: {camp.recipientCount}</span>
                      <span>Delivered: {camp.deliveredCount}</span>
                      {camp.providerRef && <span>Ref: {camp.providerRef}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'audience' && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Synced Customer Audience ({audienceStats.crmCount} CRM · {audienceStats.posCount} POS · {audienceStats.onlineCount} Online)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-4 font-medium">Contact Name</th>
                  <th className="py-2 pr-4 font-medium">Email Address</th>
                  <th className="py-2 pr-4 font-medium">Phone (MSISDN)</th>
                  <th className="py-2 font-medium">Source Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {audienceStats.sampleContacts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Add leads in CRM or process POS/eCommerce receipts with customer contact details to grow your marketing list.
                    </td>
                  </tr>
                ) : (
                  audienceStats.sampleContacts.map((c, idx) => (
                    <tr key={`${c.name}-${idx}`}>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-300">
                        {c.email || '—'}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-300">
                        {c.phone || '—'}
                      </td>
                      <td className="py-2.5 text-teal-700 dark:text-teal-400">{c.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'smtp' && (
        <form
          onSubmit={handleSaveSmtp}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Custom SMTP Email Server (Receipts, Invoices &amp; Campaigns)
              </h2>
            </div>
            {comms.hasSmtpPassword && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" /> Password Secured in Vault
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                SMTP Host *
              </label>
              <input
                type="text"
                required
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com / mail.yourbrand.co.ke"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Port (587 STARTTLS / 465 SSL)
              </label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Use Implicit TLS / SSL (Port 465)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                SMTP Username
              </label>
              <input
                type="text"
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                placeholder="sales@yourbrand.co.ke"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                SMTP Password / App Password
              </label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={comms.hasSmtpPassword ? '•••••••• (Saved on Server)' : 'Enter SMTP password'}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Sender Display Name
              </label>
              <input
                type="text"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                From Email Address
              </label>
              <input
                type="email"
                value={smtpFromEmail}
                onChange={(e) => setSmtpFromEmail(e.target.value)}
                placeholder="receipts@yourbrand.co.ke"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={savingComms}
                className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {savingComms ? 'Saving SMTP...' : 'Save SMTP Settings'}
              </button>
              {comms.hasSmtpPassword && (
                <button
                  type="button"
                  disabled={savingComms}
                  onClick={async () => {
                    setSavingComms(true);
                    try {
                      await onSaveCommsConfig({ clearSmtpPassword: true });
                      setSmtpPassword('');
                      setBanner(`Cleared saved SMTP password for ${business.name}.`);
                      setTimeout(() => setBanner(''), 3500);
                    } finally {
                      setSavingComms(false);
                    }
                  }}
                  className="rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  Clear Password
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmailTarget}
                onChange={(e) => setTestEmailTarget(e.target.value)}
                placeholder="recipient@domain.com"
                className="w-52 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={testingChannel === 'email'}
                onClick={() => handleTest('email')}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {testingChannel === 'email' ? 'Testing...' : 'Send Test Email'}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'africastalking' && (
        <form
          onSubmit={handleSaveAfricasTalking}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-xs dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Africa&apos;s Talking Bulk SMS Gateway (Kenya &amp; East Africa)
              </h2>
            </div>
            {comms.hasAtApiKey && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" /> API Key Secured in Vault
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Environment
              </label>
              <select
                value={atEnvironment}
                onChange={(e) =>
                  setAtEnvironment(e.target.value === 'production' ? 'production' : 'sandbox')
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live SMS)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                AT App Username *
              </label>
              <input
                type="text"
                required
                value={atUsername}
                onChange={(e) => setAtUsername(e.target.value)}
                placeholder="sandbox or your_at_username"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Approved Sender ID / Shortcode
              </label>
              <input
                type="text"
                value={atSenderId}
                onChange={(e) => setAtSenderId(e.target.value)}
                placeholder="e.g. SAVANNAH (Optional)"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Africa&apos;s Talking API Key
              </label>
              <input
                type="password"
                value={atApiKey}
                onChange={(e) => setAtApiKey(e.target.value)}
                placeholder={comms.hasAtApiKey ? '•••••••• (Saved on Server)' : 'atsk_...'}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={savingComms}
                className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {savingComms ? 'Saving AT Keys...' : "Save Africa's Talking Config"}
              </button>
              {comms.hasAtApiKey && (
                <button
                  type="button"
                  disabled={savingComms}
                  onClick={async () => {
                    setSavingComms(true);
                    try {
                      await onSaveCommsConfig({ clearAtApiKey: true });
                      setAtApiKey('');
                      setBanner(`Cleared saved Africa's Talking API key for ${business.name}.`);
                      setTimeout(() => setBanner(''), 3500);
                    } finally {
                      setSavingComms(false);
                    }
                  }}
                  className="rounded-lg border border-rose-200 px-3 py-2 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  Clear API Key
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={testSmsTarget}
                onChange={(e) => setTestSmsTarget(e.target.value)}
                placeholder="+254712345678"
                className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={testingChannel === 'sms'}
                onClick={() => handleTest('sms')}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {testingChannel === 'sms' ? 'Sending...' : 'Send Test SMS'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
