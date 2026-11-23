import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  FolderTree,
  Layers,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Plus,
  Printer,
  ScanBarcode,
  Settings2,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Usb,
} from 'lucide-react';
import {
  BusinessEntity,
  BusinessLayoutConfig,
  BusinessZone,
  CategoryGroup,
  EmployeeRecord,
  LayoutMode,
  PosCustomizationConfig,
  PosHardwareConfig,
  PromoOffer,
  SaleTransaction,
  ShiftAttendanceLog,
  SlotStatus,
  StoreBranch,
} from '../types/erp';
import { formatMoney } from '../utils/cryptoSync';
import {
  BUSINESS_INDUSTRY_TEMPLATES,
  DEFAULT_POS_HARDWARE_CONFIG,
} from '../data/businessTemplates';
import {
  buildCashDrawerKickBytes,
  buildEscPosReceiptBytes,
  dispatchHardwareBytes,
  pairSerialPeripheral,
  pairUsbThermalPrinter,
} from '../utils/posHardware';

type AdminTab = 'terminal' | 'hardware' | 'layout' | 'categories' | 'offers' | 'staff';

interface PosAdminConsoleProps {
  business: BusinessEntity;
  stores: StoreBranch[];
  activeStore: StoreBranch;
  transactions: SaleTransaction[];
  employees: EmployeeRecord[];
  attendanceLogs: ShiftAttendanceLog[];
  onUpdatePosConfig: (config: PosCustomizationConfig) => Promise<void>;
  onUpdateHardwareConfig: (hw: PosHardwareConfig) => Promise<void>;
  onApplyTemplate?: (templateId: string, seedStarterProducts: boolean) => Promise<void>;
  onHardwareLog?: (event: string, detail: string) => Promise<void>;
  onUpdateLayoutConfig: (layoutConfig: BusinessLayoutConfig) => Promise<void>;
  onUpdateTaxonomy: (taxonomy: CategoryGroup[]) => Promise<void>;
  onUpdateOffers: (offers: PromoOffer[]) => Promise<void>;
  onSlotStatusChange: (zoneId: string, slotId: string, status: SlotStatus) => Promise<void>;
  onEmployeeAttendance: (employeeId: string, action: 'clock_in' | 'clock_out', note?: string) => Promise<void>;
  onLaunchPosRegister: () => void;
}

export const PosAdminConsole: React.FC<PosAdminConsoleProps> = ({
  business,
  stores,
  activeStore,
  transactions,
  employees,
  attendanceLogs,
  onUpdatePosConfig,
  onUpdateHardwareConfig,
  onApplyTemplate,
  onHardwareLog,
  onUpdateLayoutConfig,
  onUpdateTaxonomy,
  onUpdateOffers,
  onSlotStatusChange,
  onEmployeeAttendance,
  onLaunchPosRegister,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('terminal');
  const [draftConfig, setDraftConfig] = useState<PosCustomizationConfig>(business.posConfig);
  const [draftHw, setDraftHw] = useState<PosHardwareConfig>(
    business.hardwareConfig || DEFAULT_POS_HARDWARE_CONFIG
  );
  const [pairedDeviceName, setPairedDeviceName] = useState<string>('');
  const [hwStatusMsg, setHwStatusMsg] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    business.templateId || 'supermarket'
  );
  const [seedTemplateSkus, setSeedTemplateSkus] = useState<boolean>(true);
  const [applyingTemplate, setApplyingTemplate] = useState<boolean>(false);
  const [quickNotesInput, setQuickNotesInput] = useState(
    business.posConfig.quickCashNotes.join(', ')
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [reportStoreId, setReportStoreId] = useState<string>(activeStore.id);

  // Layout config state (Floors/Tables & Sections/Shelves)
  const layout: BusinessLayoutConfig = business.layoutConfig || {
    layoutMode: 'hybrid',
    zoneLabel: 'Floor / Section',
    slotLabel: 'Table / Shelf',
    autoMarkTableNeedsClearing: true,
    showShelfOnPosTile: true,
    zones: [],
  };
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneKind, setNewZoneKind] = useState<'floor' | 'section'>('floor');
  const [newZoneStoreId, setNewZoneStoreId] = useState(activeStore.id);
  const [newSlotZoneId, setNewSlotZoneId] = useState(layout.zones[0]?.id || '');
  const [newSlotCode, setNewSlotCode] = useState('');
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [newSlotCapacity, setNewSlotCapacity] = useState('4');

  // Category & Subcategory state
  const taxonomy: CategoryGroup[] = business.catalogTaxonomy || [];
  const [newCategoryName, setNewCategoryName] = useState('');
  const [subCatTargetId, setSubCatTargetId] = useState(taxonomy[0]?.id || '');
  const [newSubCatName, setNewSubCatName] = useState('');

  // Offers & Promotions state
  const offers: PromoOffer[] = business.offers || [];
  const [offerName, setOfferName] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [offerType, setOfferType] = useState<PromoOffer['type']>('percent_off');
  const [offerValue, setOfferValue] = useState('15');
  const [offerMinQty, setOfferMinQty] = useState('2');
  const [offerMinSpend, setOfferMinSpend] = useState('2000');
  const [offerTargetCat, setOfferTargetCat] = useState('All');

  const notifySaved = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 4000);
  };

  const reportStore = useMemo(
    () => stores.find((s) => s.id === reportStoreId) || activeStore,
    [stores, reportStoreId, activeStore]
  );

  const shiftSummary = useMemo(() => {
    const branchTxs = transactions.filter(
      (t) => t.storeId === reportStore.id && t.etimsStatus !== 'Credit Note'
    );
    let totalGross = 0;
    let totalVat = 0;
    let totalTips = 0;
    const byGateway: Record<string, number> = {};
    for (const tx of branchTxs) {
      totalGross += tx.total;
      totalVat += tx.taxAmount;
      totalTips += tx.tipAmount || 0;
      byGateway[tx.paymentMethod] = (byGateway[tx.paymentMethod] || 0) + tx.total;
    }
    return {
      count: branchTxs.length,
      totalGross,
      totalVat,
      totalTips,
      byGateway,
    };
  }, [transactions, reportStore.id]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedNotes = quickNotesInput
        .split(',')
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      await onUpdatePosConfig({
        ...draftConfig,
        quickCashNotes: parsedNotes.length > 0 ? parsedNotes : [500, 1000, 2000, 5000],
      });
      notifySaved('POS configuration saved and synced to all branch registers.');
    } finally {
      setSaving(false);
    }
  };

  const posOnlyPath = `/pos?biz=${encodeURIComponent(business.slug)}&store=${encodeURIComponent(reportStore.id)}`;

  const handleDownloadPosShortcut = (type: 'launcher' | 'cheatsheet') => {
    const portalUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${posOnlyPath}`
        : `https://${business.slug}.misafarms.com${posOnlyPath}`;

    if (type === 'launcher') {
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${business.name} — POS Register (${reportStore.code})</title>
  <meta name="theme-color" content="#0f766e">
</head>
<body style="font-family:sans-serif;text-align:center;padding:48px;background:#f8fafc;color:#0f172a;">
  <h2>${business.name} · ${reportStore.name}</h2>
  <p>Opening dedicated POS-only register (${reportStore.registerId})...</p>
  <p><a href="${portalUrl}">${portalUrl}</a></p>
  <script>window.location.replace(${JSON.stringify(portalUrl)});</script>
</body>
</html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-${reportStore.code.toLowerCase()}-pos-shortcut.html`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const enabledGateways = business.paymentGateways
        .filter((g) => g.enabled)
        .map((g) => `${g.displayName} (${g.shortcodeOrTill})`)
        .join(', ');
      const txt = `MisafaRMS POS COUNTER SHORTCUTS & CONFIG
Business: ${business.name} (${business.slug}.misafarms.com)
Branch: ${reportStore.name} (${reportStore.code}) | Register: ${reportStore.registerId}
KRA eTIMS Serial: ${reportStore.vscuSerial} | PIN: ${business.taxPin}

CASHIER WORKFLOW
- Login with 4-digit Employee PIN at counter terminal (auto clocks in shift)
- Scan barcode + Enter to add SKU immediately
- Use Floor/Tables or Sections/Shelves switcher to clear tables or flag shelf restocks
- Apply active Offers/Promo codes and optional Staff Tips on checkout
- Clock Out or Lock terminal when ending shift
- Enabled Payment Gateways: ${enabledGateways}
`;
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-pos-shortcuts.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleLayoutModeChange = async (mode: LayoutMode) => {
    const labels =
      mode === 'restaurant_tables'
        ? { zoneLabel: 'Floor', slotLabel: 'Table' }
        : mode === 'retail_shelves'
          ? { zoneLabel: 'Section / Aisle', slotLabel: 'Shelf / Bin' }
          : { zoneLabel: 'Floor / Section', slotLabel: 'Table / Shelf' };
    await onUpdateLayoutConfig({
      ...layout,
      layoutMode: mode,
      ...labels,
    });
    notifySaved(`Updated store spatial layout mode to ${mode.replace('_', ' ')}.`);
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    const zone: BusinessZone = {
      id: `zone-${Date.now().toString(36)}`,
      storeId: newZoneStoreId || activeStore.id,
      name: newZoneName.trim(),
      kind: newZoneKind,
      slots: [],
    };
    await onUpdateLayoutConfig({
      ...layout,
      zones: [...layout.zones, zone],
    });
    setNewSlotZoneId(zone.id);
    setNewZoneName('');
    notifySaved(`Added ${newZoneKind === 'floor' ? 'Floor' : 'Section'} "${zone.name}".`);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetZoneId = newSlotZoneId || layout.zones[0]?.id;
    if (!targetZoneId || !newSlotCode.trim()) return;
    const updatedZones = layout.zones.map((z) => {
      if (z.id !== targetZoneId) return z;
      return {
        ...z,
        slots: [
          ...z.slots,
          {
            id: `slot-${Date.now().toString(36)}`,
            code: newSlotCode.trim().toUpperCase(),
            label: newSlotLabel.trim() || newSlotCode.trim().toUpperCase(),
            capacity: Math.max(1, Number(newSlotCapacity) || 4),
            status: 'available' as SlotStatus,
          },
        ],
      };
    });
    await onUpdateLayoutConfig({ ...layout, zones: updatedZones });
    setNewSlotCode('');
    setNewSlotLabel('');
    notifySaved('Added table/shelf slot to POS layout.');
  };

  const handleDeleteSlot = async (zoneId: string, slotId: string) => {
    const updatedZones = layout.zones.map((z) =>
      z.id === zoneId ? { ...z, slots: z.slots.filter((s) => s.id !== slotId) } : z
    );
    await onUpdateLayoutConfig({ ...layout, zones: updatedZones });
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const next: CategoryGroup = {
      id: `cat-${Date.now().toString(36)}`,
      name: newCategoryName.trim(),
      subCategories: [],
    };
    await onUpdateTaxonomy([...taxonomy, next]);
    setSubCatTargetId(next.id);
    setNewCategoryName('');
    notifySaved(`Added product category "${next.name}".`);
  };

  const handleAddSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = subCatTargetId || taxonomy[0]?.id;
    if (!targetId || !newSubCatName.trim()) return;
    const updated = taxonomy.map((c) => {
      if (c.id !== targetId) return c;
      if (c.subCategories.includes(newSubCatName.trim())) return c;
      return { ...c, subCategories: [...c.subCategories, newSubCatName.trim()] };
    });
    await onUpdateTaxonomy(updated);
    setNewSubCatName('');
    notifySaved(`Added subcategory "${newSubCatName.trim()}".`);
  };

  const handleRemoveSubCategory = async (catId: string, subName: string) => {
    const updated = taxonomy.map((c) =>
      c.id === catId ? { ...c, subCategories: c.subCategories.filter((s) => s !== subName) } : c
    );
    await onUpdateTaxonomy(updated);
  };

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerName.trim()) return;
    const val = Math.max(1, Number(offerValue) || 10);
    const created: PromoOffer = {
      id: `off-${Date.now().toString(36)}`,
      name: offerName.trim(),
      code: offerCode.trim().toUpperCase() || undefined,
      type: offerType,
      value: val,
      minQty: offerType === 'min_qty_percent' ? Math.max(2, Number(offerMinQty) || 2) : undefined,
      minSpend: offerType === 'fixed_off' ? Math.max(0, Number(offerMinSpend) || 0) : undefined,
      targetCategory: offerTargetCat,
      active: true,
      badgeText:
        offerType === 'fixed_off'
          ? `${business.currency} ${val} OFF`
          : offerType === 'min_qty_percent'
            ? `${offerMinQty}+ GET ${val}%`
            : `${val}% OFF`,
    };
    await onUpdateOffers([created, ...offers]);
    setOfferName('');
    setOfferCode('');
    notifySaved(`Created live POS offer "${created.name}".`);
  };

  const handleToggleOffer = async (offerId: string) => {
    await onUpdateOffers(
      offers.map((o) => (o.id === offerId ? { ...o, active: !o.active } : o))
    );
  };

  const handleDeleteOffer = async (offerId: string) => {
    await onUpdateOffers(offers.filter((o) => o.id !== offerId));
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'terminal', label: 'POS Setup & Z-Reports', icon: <Settings2 className="h-3.5 w-3.5" /> },
    { id: 'hardware', label: 'Hardware & Card PDQ', icon: <Printer className="h-3.5 w-3.5" /> },
    { id: 'layout', label: 'Floors / Tables & Shelves', icon: <Layers className="h-3.5 w-3.5" /> },
    { id: 'categories', label: 'Categories & Subcategories', icon: <FolderTree className="h-3.5 w-3.5" /> },
    { id: 'offers', label: 'Offers & Promos', icon: <Tag className="h-3.5 w-3.5" /> },
    { id: 'staff', label: 'Shifts, Ratings & Tips', icon: <Award className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Business Config: Store Layout, Catalog, Offers & POS Operations
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configure Floors/Tables, Retail Sections/Shelves, Categories & Subcategories, Live Offers, and Staff Attendance/Tips for {business.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={onLaunchPosRegister}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
        >
          <MonitorSmartphone className="h-4 w-4" />
          <span>Launch Counter POS</span>
        </button>
      </div>

      {/* Console Sub-Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-teal-600'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* TAB 1: TERMINAL SETUP & Z-REPORTS */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveConfig}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Settings2 className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Receipt Template, Counter Layout & Terminal Shortcuts
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Receipt Header Text
                </label>
                <input
                  type="text"
                  value={draftConfig.receiptHeader}
                  onChange={(e) =>
                    setDraftConfig((c) => ({ ...c, receiptHeader: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Receipt Footer Message
                </label>
                <input
                  type="text"
                  value={draftConfig.receiptFooter}
                  onChange={(e) =>
                    setDraftConfig((c) => ({ ...c, receiptFooter: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Receipt Paper Width
                  </label>
                  <select
                    value={draftConfig.paperWidth}
                    onChange={(e) =>
                      setDraftConfig((c) => ({
                        ...c,
                        paperWidth: e.target.value as '80mm' | 'A4',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="80mm">80mm Thermal Roll</option>
                    <option value="A4">A4 Tax Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Catalog Grid Density
                  </label>
                  <select
                    value={draftConfig.gridDensity}
                    onChange={(e) =>
                      setDraftConfig((c) => ({
                        ...c,
                        gridDensity: e.target.value as 'comfortable' | 'compact',
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="comfortable">Comfortable (With Photos)</option>
                    <option value="compact">Compact (High-Speed Counter)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Quick Cash Denominations
                  </label>
                  <input
                    type="text"
                    value={quickNotesInput}
                    onChange={(e) => setQuickNotesInput(e.target.value)}
                    placeholder="500, 1000, 2000, 5000"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={draftConfig.barcodeAutoFocus}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, barcodeAutoFocus: e.target.checked }))
                    }
                  />
                  <span>Auto-Focus Barcode Scanner</span>
                </label>

                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={draftConfig.requirePinPerShift}
                    onChange={(e) =>
                      setDraftConfig((c) => ({ ...c, requirePinPerShift: e.target.checked }))
                    }
                  />
                  <span>Require Employee 4-Digit PIN on Open</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={posOnlyPath}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
                >
                  <MonitorSmartphone className="h-3.5 w-3.5" />
                  <span>Open Installable POS (/pos)</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleDownloadPosShortcut('launcher')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Download POS Shortcut (.html)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPosShortcut('cheatsheet')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Key Guide (.txt)</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
              >
                {saving ? 'Saving...' : 'Save POS Setup'}
              </button>
            </div>
          </form>

          {/* Right: X / Z Shift Reconciliation Report */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  X / Z Shift Reconciliation
                </h2>
              </div>

              <select
                aria-label="Filter report by branch"
                value={reportStore.id}
                onChange={(e) => setReportStoreId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3.5 dark:bg-slate-800/60">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Receipts</span>
                <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {shiftSummary.count}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Gross Revenue</span>
                <p className="font-mono text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
                  {formatMoney(shiftSummary.totalGross, business.currency)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Staff Tips</span>
                <p className="font-mono text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatMoney(shiftSummary.totalTips, business.currency)}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {Object.keys(shiftSummary.byGateway).length === 0 ? (
                <p className="py-4 text-center text-slate-500 dark:text-slate-400">
                  No transactions posted for {reportStore.name} yet.
                </p>
              ) : (
                Object.entries(shiftSummary.byGateway).map(([method, amt]) => (
                  <div key={method} className="flex justify-between py-2.5">
                    <span className="text-slate-600 dark:text-slate-400">{method}</span>
                    <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(amt, business.currency)}
                    </span>
                  </div>
                ))
              )}
              <div className="flex justify-between py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                <span>KRA eTIMS Output VAT ({business.vatRate}%)</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(shiftSummary.totalVat, business.currency)}
                </span>
              </div>
            </div>
          </section>

          {/* Ready-to-Use Industry Blueprint Switcher */}
          {onApplyTemplate && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-12 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Ready-to-Use Industry Blueprints
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Apply a pre-configured sector template (zones, categories, live offers, POS hardware defaults, and optional starter SKUs) without starting from scratch.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={seedTemplateSkus}
                    onChange={(e) => setSeedTemplateSkus(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Also seed starter industry catalog SKUs</span>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {BUSINESS_INDUSTRY_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                      selectedTemplateId === tpl.id
                        ? 'border-teal-700 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/40'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40'
                    }`}
                  >
                    <p className="font-display font-semibold text-slate-900 dark:text-slate-100">
                      {tpl.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {tpl.tagline}
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={applyingTemplate}
                  onClick={async () => {
                    setApplyingTemplate(true);
                    try {
                      await onApplyTemplate(selectedTemplateId, seedTemplateSkus);
                      notifySaved(`Applied "${selectedTemplateId}" industry template to ${business.name}.`);
                    } finally {
                      setApplyingTemplate(false);
                    }
                  }}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-700"
                >
                  {applyingTemplate ? 'Applying Blueprint...' : 'Apply Selected Industry Template'}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: HARDWARE PERIPHERALS (PRINTERS, DRAWERS, SCANNERS, SCALES, CARD PDQ) */}
      {activeTab === 'hardware' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await onUpdateHardwareConfig(draftHw);
                notifySaved('Saved POS hardware & EMV Card PDQ terminal configuration.');
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Printer className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                POS Hardware Peripherals &amp; EMV Card Terminal Settings
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Thermal Receipt Printer Connection
                </label>
                <select
                  value={draftHw.printerConnection}
                  onChange={(e) =>
                    setDraftHw((h) => ({
                      ...h,
                      printerEnabled: true,
                      printerConnection: e.target.value as PosHardwareConfig['printerConnection'],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="browser_print">Browser / OS Thermal Queue (80mm / A4)</option>
                  <option value="webusb_escpos">Direct WebUSB ESC/POS Thermal Printer</option>
                  <option value="webserial_escpos">Direct Serial (RS-232 / COM) ESC/POS Printer</option>
                  <option value="network_ip">LAN / Wi-Fi Network Printer (Port 9100)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Printer Paper Width &amp; Network IP (if LAN)
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={draftHw.printerPaperChars}
                    onChange={(e) =>
                      setDraftHw((h) => ({
                        ...h,
                        printerPaperChars: Number(e.target.value) as 32 | 42 | 48,
                      }))
                    }
                    className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value={42}>80mm (42c)</option>
                    <option value={48}>80mm (48c)</option>
                    <option value={32}>58mm (32c)</option>
                  </select>
                  <input
                    type="text"
                    value={draftHw.printerNetworkIp || ''}
                    onChange={(e) =>
                      setDraftHw((h) => ({ ...h, printerNetworkIp: e.target.value }))
                    }
                    placeholder="e.g. 192.168.1.250"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Barcode Scanner Interface
                </label>
                <select
                  value={draftHw.scannerMode}
                  onChange={(e) =>
                    setDraftHw((h) => ({
                      ...h,
                      barcodeScannerEnabled: true,
                      scannerMode: e.target.value as PosHardwareConfig['scannerMode'],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="hid_wedge">USB / Bluetooth HID Keyboard Wedge (Instant)</option>
                  <option value="webserial">WebSerial COM Port Scanner</option>
                  <option value="camera_manual">Camera / Manual Entry</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Weighing Scale Integration
                </label>
                <select
                  value={draftHw.scaleConnection}
                  onChange={(e) => {
                    const val = e.target.value as PosHardwareConfig['scaleConnection'];
                    setDraftHw((h) => ({
                      ...h,
                      scaleEnabled: val !== 'none',
                      scaleConnection: val,
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="none">Disabled (Standard Units)</option>
                  <option value="webserial_cas">WebSerial Digital Scale (Kg Readout)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  EMV / NFC Card PDQ Terminal Provider
                </label>
                <select
                  value={draftHw.cardTerminalEnabled ? draftHw.cardTerminalProvider : 'disabled'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'disabled') {
                      setDraftHw((h) => ({ ...h, cardTerminalEnabled: false }));
                    } else {
                      setDraftHw((h) => ({
                        ...h,
                        cardTerminalEnabled: true,
                        cardTerminalProvider: v as PosHardwareConfig['cardTerminalProvider'],
                      }));
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="pesapal_sabi">Pesapal Sabi Android PDQ</option>
                  <option value="ingenico_ecr">Ingenico Move / Desk EMV</option>
                  <option value="verifone_ecr">Verifone VX / T650c</option>
                  <option value="kcb_pdq">KCB Merchant PDQ</option>
                  <option value="custom_emv">Custom EMV Terminal</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Assigned PDQ Terminal ID (TID)
                </label>
                <input
                  type="text"
                  value={draftHw.cardTerminalId || ''}
                  onChange={(e) =>
                    setDraftHw((h) => ({ ...h, cardTerminalId: e.target.value }))
                  }
                  placeholder="e.g. TID-KE-88401"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draftHw.cashDrawerEnabled}
                  onChange={(e) =>
                    setDraftHw((h) => ({ ...h, cashDrawerEnabled: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Enable RJ11 Cash Drawer Kick (`ESC p 0`)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={draftHw.autoOpenDrawerOnCash}
                  onChange={(e) =>
                    setDraftHw((h) => ({ ...h, autoOpenDrawerOnCash: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Auto-open Cash Drawer on Cash Sale Completion</span>
              </label>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
              >
                {saving ? 'Saving...' : 'Save Hardware & PDQ Settings'}
              </button>
            </div>
          </form>

          {/* Right: Live Hardware Pairing & Test Bench */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Usb className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Device Pairing &amp; Diagnostics
              </h2>
            </div>

            {hwStatusMsg && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
                {hwStatusMsg}
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <button
                type="button"
                onClick={async () => {
                  if (draftHw.printerConnection === 'webserial_escpos') {
                    const res = await pairSerialPeripheral(9600);
                    setPairedDeviceName(res.label);
                    setHwStatusMsg(res.ok ? `Paired ${res.label}.` : res.label);
                  } else {
                    const res = await pairUsbThermalPrinter();
                    setPairedDeviceName(res.label);
                    setHwStatusMsg(res.ok ? `Paired ${res.label}.` : res.label);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="inline-flex items-center gap-2">
                  <Usb className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <span>Pair Thermal Printer (WebUSB / WebSerial)</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {pairedDeviceName || 'Click to Pair'}
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const nowIso = new Date().toISOString();
                  const sampleBytes = buildEscPosReceiptBytes({
                    businessName: business.name,
                    taxPin: business.taxPin,
                    receiptHeader: business.posConfig.receiptHeader,
                    receiptFooter: business.posConfig.receiptFooter,
                    charsPerLine: draftHw.printerPaperChars,
                    tx: {
                      id: 'diag-test',
                      receiptNo: 'TEST-ESC-001',
                      businessId: business.id,
                      storeId: activeStore.id,
                      storeName: activeStore.name,
                      cashierRole: 'Owner',
                      cashierName: 'Hardware Test',
                      customerName: 'Diagnostic Print',
                      channel: 'POS',
                      paymentMethod: 'Diagnostic Print',
                      paymentRef: 'ESC-TEST',
                      currency: business.currency,
                      subtotal: 86.21,
                      taxAmount: 13.79,
                      discountTotal: 0,
                      total: 100,
                      amountTendered: 100,
                      changeDue: 0,
                      etimsCuin: 'DIAG-CUIN-001',
                      etimsStatus: 'Transmitted',
                      etimsQrData: 'TEST',
                      lines: [
                        {
                          productId: 'diag-sku',
                          sku: 'DIAG-01',
                          name: 'ESC/POS Hardware Diagnostics Line',
                          qty: 1,
                          unitPrice: 100,
                          discountPct: 0,
                          taxCode: 'B_16',
                          lineTotal: 100,
                        },
                      ],
                      createdAt: nowIso,
                    },
                  });
                  const res = await dispatchHardwareBytes(sampleBytes, draftHw);
                  const msg = `Dispatched ${res.byteCount} ESC/POS bytes via ${res.dispatchedVia}`;
                  setHwStatusMsg(msg);
                  if (onHardwareLog) {
                    await onHardwareLog('Thermal Test Print', `${draftHw.printerConnection} (${msg})`);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="inline-flex items-center gap-2">
                  <Printer className="h-4 w-4 text-sky-700 dark:text-sky-400" />
                  <span>Print ESC/POS Receipt Test</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {draftHw.printerPaperChars === 32 ? '58mm' : '80mm'} ({draftHw.printerPaperChars}c)
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const res = await dispatchHardwareBytes(buildCashDrawerKickBytes(), draftHw);
                  const msg = `Triggered RJ11 pulse (${res.byteCount} bytes via ${res.dispatchedVia})`;
                  setHwStatusMsg(`Cash Drawer Kick: ${msg}`);
                  if (onHardwareLog) {
                    await onHardwareLog('Cash Drawer Kick Test', `Pin-2 RJ11 pulse via ${draftHw.printerConnection}`);
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  <span>Test RJ11 Cash Drawer Kick Pulse</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">ESC p 0</span>
              </button>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <ScanBarcode className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <span>Barcode Wedge &amp; EMV Card PDQ Ready</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  USB/Bluetooth HID scanners automatically add items on the Counter POS screen without clicking the search bar. Card gateways route directly to{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {draftHw.cardTerminalProvider} ({draftHw.cardTerminalId || 'Unassigned'})
                  </span>.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: GENERIC FLOORS / TABLES & SECTIONS / SHELVES CONFIG */}
      {activeTab === 'layout' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Spatial Operations Mode (Separate from Product Categories)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Configure physical Restaurant Floors & Tables (for quick table clearing) or Retail Sections & Shelves (for fast restocking & picking).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'retail_shelves', label: 'Retail Sections & Shelves' },
                    { id: 'restaurant_tables', label: 'Restaurant Floors & Tables' },
                    { id: 'hybrid', label: 'Hybrid (Cafe + Retail Shelves)' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleLayoutModeChange(m.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      layout.layoutMode === m.id
                        ? 'bg-teal-700 text-white dark:bg-teal-600'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={layout.autoMarkTableNeedsClearing}
                  onChange={(e) =>
                    onUpdateLayoutConfig({
                      ...layout,
                      autoMarkTableNeedsClearing: e.target.checked,
                    })
                  }
                />
                <span>Auto-mark restaurant table &ldquo;Needs Clearing&rdquo; after POS payment</span>
              </label>

              <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={layout.showShelfOnPosTile}
                  onChange={(e) =>
                    onUpdateLayoutConfig({
                      ...layout,
                      showShelfOnPosTile: e.target.checked,
                    })
                  }
                />
                <span>Show Shelf / Aisle location on POS product tiles</span>
              </label>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Add Floor or Section */}
            <form
              onSubmit={handleAddZone}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Add Floor or Store Section
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="e.g. Rooftop Floor or Aisle 4"
                  className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <select
                  value={newZoneKind}
                  onChange={(e) => setNewZoneKind(e.target.value as 'floor' | 'section')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="floor">Restaurant Floor</option>
                  <option value="section">Retail Section / Aisle</option>
                </select>
                <select
                  value={newZoneStoreId}
                  onChange={(e) => setNewZoneStoreId(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      Branch: {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Zone</span>
                </button>
              </div>
            </form>

            {/* Add Table or Shelf inside Zone */}
            <form
              onSubmit={handleAddSlot}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Add Table, Shelf or Bin Slot
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                <select
                  value={newSlotZoneId || layout.zones[0]?.id || ''}
                  onChange={(e) => setNewSlotZoneId(e.target.value)}
                  className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {layout.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.kind === 'floor' ? 'Floor' : 'Section'}: {z.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newSlotCode}
                  onChange={(e) => setNewSlotCode(e.target.value)}
                  placeholder="Code (T-05 / SH-C1)"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={1}
                  value={newSlotCapacity}
                  onChange={(e) => setNewSlotCapacity(e.target.value)}
                  placeholder="Seats / Cap"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={newSlotLabel}
                  onChange={(e) => setNewSlotLabel(e.target.value)}
                  placeholder="Descriptive label (e.g. Corner 4-Top or Eye-Level Dairy)"
                  className="sm:col-span-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Slot</span>
                </button>
              </div>
            </form>
          </div>

          {/* Live Floors & Sections Board */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {layout.zones.map((zone) => (
              <section
                key={zone.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <span className="font-mono text-[11px] font-semibold uppercase text-teal-700 dark:text-teal-400">
                      {zone.kind === 'floor' ? 'Restaurant Floor' : 'Retail Section / Aisle'}
                    </span>
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {zone.name}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {zone.slots.length} {zone.kind === 'floor' ? 'tables' : 'shelves'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {zone.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {slot.code}
                          </span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {slot.label} · Cap {slot.capacity}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(zone.id, slot.id)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label={`Remove ${slot.code}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2 dark:border-slate-700/60">
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            slot.status === 'needs_clearing'
                              ? 'text-amber-700 dark:text-amber-400'
                              : slot.status === 'needs_restock'
                                ? 'text-rose-700 dark:text-rose-400'
                                : slot.status === 'occupied'
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {slot.status === 'needs_clearing'
                            ? 'Needs Clearing'
                            : slot.status === 'needs_restock'
                              ? 'Needs Restock'
                              : slot.status === 'occupied'
                                ? 'Occupied'
                                : 'Available / Stocked'}
                        </span>

                        {slot.status !== 'available' ? (
                          <button
                            type="button"
                            onClick={() => onSlotStatusChange(zone.id, slot.id, 'available')}
                            className="rounded border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          >
                            {zone.kind === 'floor' ? 'Clear Table' : 'Mark Restocked'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onSlotStatusChange(
                                zone.id,
                                slot.id,
                                zone.kind === 'floor' ? 'needs_clearing' : 'needs_restock'
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {zone.kind === 'floor' ? 'Flag Clear' : 'Flag Restock'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORIES & SUBCATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <form
              onSubmit={handleAddCategory}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Create Product Category
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Fresh Bakery, Cold Drinks, Cosmetics"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
                >
                  Add Category
                </button>
              </div>
            </form>

            <form
              onSubmit={handleAddSubCategory}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Add Subcategory Inside Category
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select
                  value={subCatTargetId || taxonomy[0]?.id || ''}
                  onChange={(e) => setSubCatTargetId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {taxonomy.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newSubCatName}
                  onChange={(e) => setNewSubCatName(e.target.value)}
                  placeholder="e.g. Espresso Blends"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
                >
                  Add Subcategory
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {taxonomy.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {cat.name}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {cat.subCategories.length} subcategories shown on POS & Inventory
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cat.subCategories.length === 0 ? (
                    <span className="text-xs text-slate-400">No subcategories yet.</span>
                  ) : (
                    cat.subCategories.map((sub) => (
                      <span
                        key={sub}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubCategory(cat.id, sub)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label={`Remove ${sub}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: OFFERS & PROMOTIONS ENGINE */}
      {activeTab === 'offers' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddOffer}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Create POS Offer or Promo Code
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-6">
              <input
                type="text"
                required
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="Offer Title (e.g. Happy Hour Tea 15% Off)"
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={offerCode}
                onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
                placeholder="Promo Code (HAPPY15)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={offerType}
                onChange={(e) => setOfferType(e.target.value as PromoOffer['type'])}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="percent_off">% Off Category/Cart</option>
                <option value="min_qty_percent">Buy X+ Items % Off</option>
                <option value="fixed_off">Fixed {business.currency} Off</option>
              </select>
              <input
                type="number"
                min={1}
                value={offerValue}
                onChange={(e) => setOfferValue(e.target.value)}
                placeholder={offerType === 'fixed_off' ? `Amount (${business.currency})` : 'Discount %'}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={offerTargetCat}
                onChange={(e) => setOfferTargetCat(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="All">All Categories</option>
                {taxonomy.map((c) => (
                  <option key={c.id} value={c.name}>
                    Category: {c.name}
                  </option>
                ))}
              </select>
            </div>

            {offerType === 'min_qty_percent' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-400">Minimum Item Qty in Basket:</span>
                <input
                  type="number"
                  min={2}
                  value={offerMinQty}
                  onChange={(e) => setOfferMinQty(e.target.value)}
                  className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            {offerType === 'fixed_off' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-400">Minimum Spend ({business.currency}):</span>
                <input
                  type="number"
                  min={0}
                  value={offerMinSpend}
                  onChange={(e) => setOfferMinSpend(e.target.value)}
                  className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Publish Live Offer to POS</span>
            </button>
          </form>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {offers.map((o) => (
              <div
                key={o.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                      {o.badgeText}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {o.code ? `Code: ${o.code}` : 'Auto-Eligible'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    {o.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Target: {o.targetCategory}
                    {o.minQty ? ` · Min ${o.minQty} items` : ''}
                    {o.minSpend ? ` · Min ${formatMoney(o.minSpend, business.currency)}` : ''}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleToggleOffer(o.id)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      o.active
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {o.active ? 'Active on POS' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOffer(o.id)}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label={`Delete ${o.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: STAFF ATTENDANCE (CLOCK IN / OUT), RATINGS & TIPS */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Employee Shift Status, Customer Ratings & Performance Tips
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">Employee</th>
                    <th className="px-5 py-3 font-medium">Shift Status</th>
                    <th className="px-5 py-3 text-right font-medium">Orders</th>
                    <th className="px-5 py-3 text-right font-medium">Customer Rating</th>
                    <th className="px-5 py-3 text-right font-medium">Tips Earned</th>
                    <th className="px-5 py-3 text-right font-medium">Manager Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{emp.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {emp.role} · PIN ****
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`font-semibold ${
                            emp.clockedIn
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {emp.clockedIn ? 'Clocked In (On Shift)' : 'Clocked Out'}
                        </span>
                        <p className="font-mono text-[10px] text-slate-400">
                          {emp.clockedIn && emp.lastClockInAt
                            ? `In: ${new Date(emp.lastClockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : emp.lastClockOutAt
                              ? `Out: ${new Date(emp.lastClockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'No punch today'}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {emp.ordersHandled ?? 0}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          {(emp.ratingAvg ?? 5).toFixed(1)} ({emp.ratingCount ?? 0})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-teal-700 dark:text-teal-400">
                        {formatMoney(emp.tipsEarned ?? 0, business.currency)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onEmployeeAttendance(
                              emp.id,
                              emp.clockedIn ? 'clock_out' : 'clock_in',
                              emp.clockedIn ? 'Manager Clock-Out' : 'Manager Clock-In'
                            )
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                            emp.clockedIn
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {emp.clockedIn ? (
                            <>
                              <LogOut className="h-3 w-3" />
                              <span>Clock Out</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="h-3 w-3" />
                              <span>Clock In</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <Clock className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Employee Login / Logout & Shift Punches ({attendanceLogs.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {attendanceLogs.slice(0, 12).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.employeeName}
                    </span>{' '}
                    <span className="text-slate-500">({log.role})</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{log.note}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        log.action === 'clock_in'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {log.action === 'clock_in' ? 'CLOCK IN' : 'CLOCK OUT'}
                    </span>
                    <p className="font-mono text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
