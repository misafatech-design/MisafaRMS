import React from 'react';
import {
  Building2,
  CloudOff,
  Globe,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Shield,
  Store,
  Sun,
  UserCheck,
  Wifi,
} from 'lucide-react';
import { AccountTier, BusinessEntity, StoreBranch, UserRole } from '../types/erp';

interface WorkspaceToolbarProps {
  businesses: BusinessEntity[];
  activeBusiness: BusinessEntity;
  onSelectBusiness: (id: string) => void;
  stores: StoreBranch[];
  activeStore: StoreBranch;
  onSelectStore: (id: string) => void;
  onAddStoreClick: () => void;
  accountTier: AccountTier;
  onSelectAccountTier: (tier: AccountTier) => void;
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  offlineQueueCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  breadcrumb: string;
  onBackToApps?: () => void;
  firebaseUserEmail?: string | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

const ROLES: UserRole[] = [
  'Owner',
  'Store Manager',
  'Cashier',
  'Inventory Clerk',
  'Accountant',
  'Field Agent',
];

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  businesses,
  activeBusiness,
  onSelectBusiness,
  stores,
  activeStore,
  onSelectStore,
  onAddStoreClick,
  accountTier,
  onSelectAccountTier,
  activeRole,
  onSelectRole,
  isOffline,
  onToggleOffline,
  offlineQueueCount,
  isSyncing,
  onSyncNow,
  darkMode,
  onToggleDarkMode,
  breadcrumb,
  onBackToApps,
  firebaseUserEmail,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  return (
    <div className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Contextual Breadcrumb & Business Access URL */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          {onBackToApps ? (
            <button
              type="button"
              onClick={onBackToApps}
              className="font-medium text-teal-700 hover:underline dark:text-teal-400"
            >
              Apps
            </button>
          ) : (
            <span className="font-medium text-slate-900 dark:text-slate-200">Apps</span>
          )}
          <span aria-hidden="true">/</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{breadcrumb}</span>
          <span aria-hidden="true" className="hidden md:inline">·</span>
          <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <Globe className="h-3 w-3 text-teal-700 dark:text-teal-400" />
            <span>misafarms.com/{activeBusiness.slug}</span>
          </span>
        </div>

        {/* Business, Branch, Account Tier (Admin vs Employee vs User), Role, Offline Sync, Firebase Auth */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <select
              aria-label="Select business entity"
              value={activeBusiness.id}
              onChange={(e) => onSelectBusiness(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none dark:text-slate-200"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id} className="dark:bg-slate-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <Store className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <select
              aria-label="Select store branch"
              value={activeStore?.id || ''}
              onChange={(e) => onSelectStore(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none dark:text-slate-200"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="dark:bg-slate-900">
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            {accountTier === 'admin' && (
              <button
                type="button"
                onClick={onAddStoreClick}
                title="Add new branch store"
                className="ml-1 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Account Tier Switcher: Admin vs Employee vs Portal User */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <UserCheck className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
            <select
              aria-label="Account access tier"
              value={accountTier}
              onChange={(e) => onSelectAccountTier(e.target.value as AccountTier)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none dark:text-slate-200"
            >
              <option value="admin" className="dark:bg-slate-900">
                Access: Business Admin
              </option>
              <option value="employee" className="dark:bg-slate-900">
                Access: Employee (Staff)
              </option>
              <option value="user" className="dark:bg-slate-900">
                Access: Portal User (Customer)
              </option>
            </select>
          </div>

          {accountTier !== 'user' && (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <Shield className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <select
                aria-label="Select employee role"
                value={activeRole}
                onChange={(e) => onSelectRole(e.target.value as UserRole)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none dark:text-slate-200"
              >
                {ROLES.filter((r) => accountTier === 'admin' || r !== 'Owner').map((r) => (
                  <option key={r} value={r} className="dark:bg-slate-900">
                    Role: {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleOffline}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isOffline
                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {isOffline ? (
              <CloudOff className="h-3.5 w-3.5" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{isOffline ? 'Offline' : 'Online'}</span>
          </button>

          {offlineQueueCount > 0 && (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isOffline || isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="tabular-nums">Sync {offlineQueueCount}</span>
            </button>
          )}

          {firebaseUserEmail ? (
            <button
              type="button"
              onClick={onGoogleSignOut}
              title={`Firebase signed in: ${firebaseUserEmail}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="max-w-[110px] truncate">{firebaseUserEmail}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <LogIn className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              <span>Firebase Sync</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
