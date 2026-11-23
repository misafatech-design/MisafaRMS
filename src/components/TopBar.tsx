import React from 'react';

export type PrimaryWorkspaceTab = 'apps' | 'pos' | 'etims' | 'analytics' | 'super_admin';

interface TopBarProps {
  activeTab: PrimaryWorkspaceTab;
  onSelectTab: (tab: PrimaryWorkspaceTab) => void;
  onOpenWizard: () => void;
  onGoLanding: () => void;
  showSuperAdmin?: boolean;
  allowedTabs?: PrimaryWorkspaceTab[];
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenWizard,
  onGoLanding,
  showSuperAdmin = true,
  allowedTabs,
}) => {
  const rawItems: Array<{ id: PrimaryWorkspaceTab; label: string }> = [
    { id: 'apps', label: 'Apps' },
    { id: 'pos', label: 'Point of Sale' },
    { id: 'etims', label: 'eTIMS & Tax' },
    { id: 'analytics', label: 'Analytics' },
    ...(showSuperAdmin ? ([{ id: 'super_admin', label: 'Super Admin' }] as const) : []),
  ];
  const navItems = allowedTabs
    ? rawItems.filter((item) => allowedTabs.includes(item.id))
    : rawItems;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onGoLanding}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-slate-100"
        >
          MisafaRMS
        </button>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Primary Workspace Navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-teal-700 dark:bg-teal-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenWizard}
            className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            New Business
          </button>
        </div>
      </div>
    </header>
  );
};
