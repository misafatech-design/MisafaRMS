import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { ArrowRight, CheckCircle2, Globe, Play, ShieldCheck, X } from 'lucide-react';
import { APP_MODULES } from '../data/modulesRegistry';
import { AppModuleMeta } from '../types/erp';

interface LandingPageProps {
  onLaunchDemoBusiness: () => void;
  onEmployeePosLogin: () => void;
  onStartFreeOnboarding: () => void;
  onGoogleSignIn: () => void;
  onOpenPortalSlug: (slug: string) => void;
  firebaseUserEmail?: string | null;
  onContinueSignedIn: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchDemoBusiness,
  onEmployeePosLogin,
  onStartFreeOnboarding,
  onGoogleSignIn,
  onOpenPortalSlug,
  firebaseUserEmail,
  onContinueSignedIn,
}) => {
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventRegName, setEventRegName] = useState('');
  const [eventRegEmail, setEventRegEmail] = useState('');
  const [eventRegistered, setEventRegistered] = useState(false);
  const [portalSlugInput, setPortalSlugInput] = useState('misafatech');

  const showcaseModules: AppModuleMeta[] = [
    'accounting',
    'knowledge',
    'sign',
    'crm',
    'studio',
    'subscriptions',
    'pos',
    'invoicing',
    'documents',
    'project',
    'timesheets',
    'planning',
    'helpdesk',
    'ecommerce',
    'website',
    'email_marketing',
    'purchase',
    'inventory',
    'manufacturing',
    'sales',
    'employees',
    'payroll',
    'etims',
    'payment_gateways',
  ]
    .map((id) => APP_MODULES.find((m) => m.id === id))
    .filter((m): m is AppModuleMeta => Boolean(m));

  const renderIcon = (name: string, className: string) => {
    const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      name
    ];
    if (!IconComp) return <Icons.Box className={className} />;
    return <IconComp className={className} />;
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventRegEmail.trim()) return;
    setEventRegistered(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Clean 3-Zone Top Bar */}
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-4 sm:px-6">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            MisafaRMS
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#apps-showcase" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Apps
            </a>
            <a href="#business-access" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Business Access
            </a>
            <a href="#kenya-etims" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Kenya eTIMS
            </a>
            <a href="#pricing-tiers" className="hover:text-slate-900 whitespace-nowrap shrink-0">
              Pricing
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            {firebaseUserEmail ? (
              <button
                type="button"
                onClick={onContinueSignedIn}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                Open Workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section Inspired by Odoo Reference */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-16">
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight text-slate-900 text-balance sm:text-5xl lg:text-6xl">
          All your business on{' '}
          <span className="relative inline-block px-2">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-1 -z-10 h-4 -rotate-1 rounded bg-amber-300/80 sm:h-5"
            />
            one platform.
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-700 sm:text-xl">
          Simple, efficient, yet{' '}
          <span className="underline decoration-sky-500 decoration-2 underline-offset-4">
            affordable
          </span>
          ! Built for Kenya eTIMS, M-Pesa & multi-store retail.
        </p>

        {/* Primary Action Row including Demo Business & Employee POS PIN Login */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStartFreeOnboarding}
            className="rounded-lg bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 whitespace-nowrap"
          >
            Start now - It&apos;s free
          </button>

          <button
            type="button"
            onClick={onLaunchDemoBusiness}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            <Play className="h-4 w-4 text-amber-300" />
            <span>Demo Business (MisafaTech)</span>
          </button>

          <button
            type="button"
            onClick={onEmployeePosLogin}
            className="rounded-lg border border-teal-700 bg-white px-5 py-3 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 whitespace-nowrap"
          >
            Employee POS (PIN)
          </button>

          <button
            type="button"
            onClick={firebaseUserEmail ? onContinueSignedIn : onGoogleSignIn}
            className="rounded-lg border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-200 whitespace-nowrap"
          >
            {firebaseUserEmail ? `Continue as ${firebaseUserEmail}` : 'Sign in with Google'}
          </button>
        </div>

        <p className="mt-3 font-mono text-xs text-slate-500">
          KES 950 / month (US$ 7.25) for starter retail · Multi-branch enterprise ready
        </p>
      </section>

      {/* Curved Light Gray App Showcase Canvas (matching screenshot layout) */}
      <section
        id="apps-showcase"
        className="relative border-t border-slate-200/80 bg-slate-50 pt-8 pb-16"
      >
        {/* Nairobi eTIMS Training Strip */}
        <div className="mx-auto mb-10 flex max-w-xl justify-center px-4">
          <div className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-xs">
            <div className="flex items-center gap-2.5 text-slate-800">
              <span aria-hidden="true" className="text-base">
                🇰🇪
              </span>
              <span className="font-semibold">Training eTIMS & POS - Nairobi</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">Dec 9, 2026</span>
            </div>
            <button
              type="button"
              onClick={() => setEventModalOpen(true)}
              className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline whitespace-nowrap shrink-0"
            >
              <span>Register</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Clean 6-Column Odoo-Style App Icon Grid */}
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-x-4 gap-y-7 px-4 sm:grid-cols-4 md:grid-cols-6 sm:px-6">
          {showcaseModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={onLaunchDemoBusiness}
              className="group flex flex-col items-center text-center focus-visible:outline-none"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:border-teal-600/40 group-hover:shadow-md">
                {renderIcon(mod.iconName, `h-7 w-7 ${mod.accentColor}`)}
              </div>
              <span className="mt-2.5 text-xs font-medium text-slate-800 group-hover:text-teal-700">
                {mod.name}
              </span>
            </button>
          ))}
        </div>

        {/* Business Access Portal Card (https://misafatech.misafarms.com/) */}
        <div
          id="business-access"
          className="mx-auto mt-14 max-w-4xl px-4 sm:px-6"
        >
          <div className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-12">
            <div className="space-y-2 md:col-span-7">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                <Globe className="h-4 w-4" />
                <span>Dedicated Business Subdomain Access</span>
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Connect directly to your company portal
              </h2>
              <p className="text-xs leading-relaxed text-slate-600">
                Every onboarded business gets an isolated workspace URL such as{' '}
                <span className="font-mono font-semibold text-slate-900">
                  https://misafatech.misafarms.com/
                </span>{' '}
                with separate Admin, Employee PIN, and Customer Portal access.
              </p>
            </div>

            <div className="space-y-2.5 md:col-span-5">
              <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                <span className="px-2.5 font-mono text-xs text-slate-500">https://</span>
                <input
                  type="text"
                  value={portalSlugInput}
                  onChange={(e) =>
                    setPortalSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  aria-label="Business portal subdomain"
                  className="w-full bg-white px-2 py-2 font-mono text-xs font-semibold text-slate-900 focus:outline-none"
                />
                <span className="px-2.5 font-mono text-xs text-slate-500">.misafarms.com</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenPortalSlug(portalSlugInput || 'misafatech')}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Enter Business Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Account Separation & Kenya Capabilities Row */}
        <div
          id="kenya-etims"
          className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-6"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              1. Business Admin Control
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Full governance over multi-branch stores, payment gateway keys (M-Pesa Daraja, Airtel Money), KRA eTIMS OSCU, Studio models, and module installation.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              2. Employee PIN & Role Access
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Cashiers, Store Managers, Inventory Clerks, Accountants, and Field Agents sign into POS terminals via 4-digit PINs with strict discount & cost-price boundaries.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              3. Customer & Portal Users
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              External buyers browse eCommerce catalogs, pay via M-Pesa/Airtel STK, download verified KRA eTIMS invoices, and open Helpdesk tickets without seeing internal ERP data.
            </p>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div
          id="pricing-tiers"
          className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 px-4 sm:grid-cols-3 sm:px-6"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-teal-700">For early-stage shops</p>
            <p className="mt-1 font-display text-lg font-bold text-slate-900">SMB Starter</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">KES 950 / mo</p>
            <p className="mt-2 text-xs text-slate-600">
              1 branch, POS with offline sync, M-Pesa Till, KRA eTIMS CUIN receipts, and Inventory.
            </p>
          </div>

          <div className="rounded-xl border border-teal-600 bg-white p-5">
            <p className="text-xs font-semibold text-teal-700">For growing retail chains</p>
            <p className="mt-1 font-display text-lg font-bold text-slate-900">Multi-Store Pro</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">KES 6,500 / mo</p>
            <p className="mt-2 text-xs text-slate-600">
              Up to 5 branches, all 50 Odoo/Dynamics apps, Daraja STK, Airtel Money, and Kenya Payroll.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-700">For enterprise groups</p>
            <p className="mt-1 font-display text-lg font-bold text-slate-900">Enterprise Suite</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">KES 24,000 / mo</p>
            <p className="mt-2 text-xs text-slate-600">
              Unlimited branches & businesses, Misafa Studio, Firebase cloud sync, and custom SLA.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-500 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-700" />
            <span>MisafaRMS · Enterprise Retail & KRA eTIMS Cloud Platform</span>
          </div>
          <span className="font-mono">https://misafatech.misafarms.com/</span>
        </div>
      </footer>

      {/* Nairobi Training Event Registration Modal */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">
                Training eTIMS & POS — Nairobi
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEventModalOpen(false);
                  setEventRegistered(false);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {eventRegistered ? (
              <div className="mt-4 space-y-3 text-xs text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Seat reserved for Dec 9, 2026 in Nairobi CBD!</span>
                </div>
                <p>Calendar invite and KRA eTIMS prep checklist dispatched to {eventRegEmail}.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEventModalOpen(false);
                    setEventRegistered(false);
                  }}
                  className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEventSubmit} className="mt-4 space-y-3">
                <p className="text-xs text-slate-600">
                  Hands-on workshop covering OSCU/VSCU integration, M-Pesa Daraja Paybill reconciliation, and multi-branch Dynamics POS rollout.
                </p>
                <input
                  type="text"
                  required
                  value={eventRegName}
                  onChange={(e) => setEventRegName(e.target.value)}
                  placeholder="Full Name / Business"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <input
                  type="email"
                  required
                  value={eventRegEmail}
                  onChange={(e) => setEventRegEmail(e.target.value)}
                  placeholder="Work Email"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-teal-700 py-2.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  Confirm Nairobi Seat
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
