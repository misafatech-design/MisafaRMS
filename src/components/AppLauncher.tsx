import React, { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { ArrowRight, Check, Info, Search, ShieldAlert, X } from 'lucide-react';
import { APP_MODULES, MODULE_CATEGORIES } from '../data/modulesRegistry';
import { AccountTier, AppModuleMeta, BusinessEntity, StoreBranch } from '../types/erp';

interface AppLauncherProps {
  activeBusiness: BusinessEntity;
  activeStore: StoreBranch;
  accountTier: AccountTier;
  onLaunchModule: (mod: AppModuleMeta) => void;
  onToggleInstallModule: (moduleId: string) => Promise<void>;
  totalSalesToday: number;
  lowStockCount: number;
  queuedOfflineCount: number;
  onOpenWizard: () => void;
}

export const AppLauncher: React.FC<AppLauncherProps> = ({
  activeBusiness,
  activeStore,
  accountTier,
  onLaunchModule,
  onToggleInstallModule,
  totalSalesToday,
  lowStockCount,
  queuedOfflineCount,
  onOpenWizard,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [onlyInstalled, setOnlyInstalled] = useState(false);
  const [infoModule, setInfoModule] = useState<AppModuleMeta | null>(null);

  const visibleModulesPool = useMemo(() => {
    return APP_MODULES.filter((mod) => {
      if (accountTier === 'user') return Boolean(mod.portalVisible);
      if (accountTier === 'employee') return !mod.adminOnly;
      return true; // Business Admin sees all 50 modules
    });
  }, [accountTier]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: visibleModulesPool.length };
    for (const mod of visibleModulesPool) {
      counts[mod.category] = (counts[mod.category] || 0) + 1;
    }
    return counts;
  }, [visibleModulesPool]);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleModulesPool.filter((mod) => {
      const isInstalled = activeBusiness.installedModuleIds.includes(mod.id);
      if (onlyInstalled && !isInstalled) return false;
      const matchesCat = category === 'All' || mod.category === category;
      const matchesSearch =
        !q ||
        mod.name.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.category.toLowerCase().includes(q) ||
        (mod.kenyaHighlight?.toLowerCase().includes(q) ?? false);
      return matchesCat && matchesSearch;
    });
  }, [visibleModulesPool, activeBusiness.installedModuleIds, onlyInstalled, category, search]);

  const renderIcon = (name: string, className: string) => {
    const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      name
    ];
    if (!IconComp) return <Icons.Box className={className} />;
    return <IconComp className={className} />;
  };

  return (
    <div className="space-y-6">
      {/* Executive / Role-Aware KPI Strip */}
      <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        {accountTier === 'user' ? (
          <>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Customer Portal
              </p>
              <p className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {activeBusiness.name}
              </p>
              <p className="font-mono text-xs text-teal-700 dark:text-teal-400">
                https://{activeBusiness.slug}.misafarms.com/
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Available Services
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {visibleModulesPool.length} Portal Apps
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shop online, pay M-Pesa/Airtel, view eTIMS receipts
              </p>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Portal User mode restricts internal inventory costs, employee payroll, and admin settings.
              </p>
              <button
                type="button"
                onClick={() => {
                  const ecom = APP_MODULES.find((m) => m.id === 'ecommerce');
                  if (ecom) onLaunchModule(ecom);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                Browse Storefront
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Active Branch Revenue
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {activeBusiness.currency}{' '}
                {new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(totalSalesToday)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeStore.name} · Register {activeStore.registerId}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Fiscal Compliance Status
              </p>
              <p className="font-display text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                {activeBusiness.etimsEnabled
                  ? `KRA eTIMS ${activeBusiness.etimsMode} Ready`
                  : 'Standard VAT Active'}
              </p>
              <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                {activeStore.vscuSerial}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Inventory & Offline Queue
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {lowStockCount} Low Stock · {queuedOfflineCount} Queued
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeBusiness.installedModuleIds.length} active modules · AES-256 vault
              </p>
            </div>

            <div className="flex flex-col justify-between gap-2 sm:items-end">
              <div className="text-left sm:text-right">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {accountTier === 'admin' ? 'Admin Quick Actions' : 'Employee Shift Launch'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Open register or manage workspace
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const posMod = APP_MODULES.find((m) => m.id === 'pos');
                    if (posMod) onLaunchModule(posMod);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  <span>Open POS</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {accountTier === 'admin' && (
                  <button
                    type="button"
                    onClick={onOpenWizard}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    New Business
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Odoo-Style "Install a Module" Top Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            {accountTier === 'admin'
              ? 'Apps Catalog & Module Manager'
              : accountTier === 'employee'
                ? 'Employee Operational Workspace'
                : 'Customer & B2B Self-Service Portal'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filteredModules.length} of {visibleModulesPool.length} accessible apps ·{' '}
            {accountTier === 'admin'
              ? 'Admin mode: Install/uninstall modules and configure gateways.'
              : accountTier === 'employee'
                ? 'Employee mode: Admin settings and payroll are restricted.'
                : 'Portal User mode: External customer storefront and support only.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyInstalled((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              onlyInstalled
                ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            Installed Only ({activeBusiness.installedModuleIds.length})
          </button>

          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Odoo-Style Left Category Sidebar + Main Module Card Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Categories
            </p>
            <div className="mt-1 space-y-0.5">
              {MODULE_CATEGORIES.filter((cat) => (categoryCounts[cat] ?? 0) > 0).map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-teal-600 dark:text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        active ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {categoryCounts[cat] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main 3-Column Odoo-Style App Cards */}
        <div className="lg:col-span-9 xl:col-span-10">
          {filteredModules.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No modules matched your filter
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                  setOnlyInstalled(false);
                }}
                className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white dark:bg-teal-600"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredModules.map((mod) => {
                const isInstalled = activeBusiness.installedModuleIds.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-600/40 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                        {renderIcon(mod.iconName, `h-6 w-6 ${mod.accentColor}`)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                            {mod.name}
                          </h3>
                          {mod.adminOnly && (
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {mod.description}
                        </p>
                        {mod.kenyaHighlight && (
                          <p className="mt-1 text-[11px] font-medium text-teal-700 dark:text-teal-400">
                            {mod.kenyaHighlight}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        {isInstalled ? (
                          <button
                            type="button"
                            onClick={() => onLaunchModule(mod)}
                            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ) : accountTier === 'admin' ? (
                          <button
                            type="button"
                            onClick={() => onToggleInstallModule(mod.id)}
                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                          >
                            Install
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Not Installed</span>
                        )}

                        <button
                          type="button"
                          onClick={() => setInfoModule(mod)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Info className="h-3 w-3" />
                          <span>Module Info</span>
                        </button>
                      </div>

                      {accountTier === 'admin' && isInstalled && mod.id !== 'pos' && (
                        <button
                          type="button"
                          onClick={() => onToggleInstallModule(mod.id)}
                          title="Uninstall module"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-rose-600 dark:text-emerald-400"
                        >
                          <Check className="h-3 w-3" />
                          <span>Installed</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Module Info Drawer Modal */}
      {infoModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                {renderIcon(infoModule.iconName, `h-5 w-5 ${infoModule.accentColor}`)}
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    {infoModule.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Category: {infoModule.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoModule(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>{infoModule.description}</p>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Cross-Module Integration
                </p>
                <p className="mt-1">
                  Synchronized automatically with Inventory stock, POS registers, Accounting journals, KRA eTIMS fiscal logs, and RBAC permissions for {activeBusiness.name}.
                </p>
              </div>
              {infoModule.adminOnly && (
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Restricted to Business Admin tier only.</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInfoModule(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = infoModule;
                  setInfoModule(null);
                  onLaunchModule(target);
                }}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
              >
                Open {infoModule.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
