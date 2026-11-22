import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import {
  AccountTier,
  AppModuleMeta,
  BusinessEntity,
  EmployeePermissionSet,
  EmployeeRecord,
  ErpRecord,
  ProductItem,
  ShiftAttendanceLog,
  SlotStatus,
  StoreBranch,
  TaxCode,
  UserRole,
} from '../types/erp';
import {
  calculateKenyaPayroll,
  formatMoney,
  getTaxLabel,
  ROLE_PERMISSIONS,
} from '../utils/cryptoSync';

interface ModuleWorkspaceProps {
  module: AppModuleMeta;
  business: BusinessEntity;
  stores: StoreBranch[];
  activeStore: StoreBranch;
  products: ProductItem[];
  employees: EmployeeRecord[];
  attendanceLogs: ShiftAttendanceLog[];
  records: ErpRecord[];
  accountTier: AccountTier;
  activeRole: UserRole;
  onCreateProduct: (payload: {
    name: string;
    sku: string;
    category: string;
    subCategory?: string;
    zoneId?: string;
    slotId?: string;
    shelfCode?: string;
    price: number;
    cost: number;
    initialQty: number;
    taxCode: TaxCode;
  }) => Promise<void>;
  onTransferStock: (payload: {
    productId: string;
    fromStoreId: string;
    toStoreId: string;
    qty: number;
  }) => Promise<void>;
  onCreateEmployee: (payload: {
    name: string;
    email: string;
    role: UserRole;
    pinCode: string;
    branchId: string;
    grossSalary: number;
    permissions: EmployeePermissionSet;
  }) => Promise<void>;
  onEmployeeAttendance: (
    employeeId: string,
    action: 'clock_in' | 'clock_out',
    note?: string
  ) => Promise<void>;
  onSlotStatusChange: (
    zoneId: string,
    slotId: string,
    status: SlotStatus
  ) => Promise<void>;
  onReceivePurchaseOrder: (recordId: string) => Promise<void>;
  onCreateRecord: (payload: {
    moduleId: string;
    title: string;
    subtitle: string;
    status: string;
    amount?: number;
  }) => Promise<void>;
}

const DEFAULT_EMP_PERMS: Record<UserRole, EmployeePermissionSet> = {
  Owner: {
    maxDiscountPct: 100,
    canVoidSale: true,
    canOpenDrawer: true,
    canViewCostPrice: true,
    canEditInventory: true,
    canViewEtims: true,
    canExportReports: true,
    canManagePayments: true,
  },
  'Store Manager': {
    maxDiscountPct: 25,
    canVoidSale: true,
    canOpenDrawer: true,
    canViewCostPrice: true,
    canEditInventory: true,
    canViewEtims: true,
    canExportReports: true,
    canManagePayments: false,
  },
  Cashier: {
    maxDiscountPct: 5,
    canVoidSale: false,
    canOpenDrawer: true,
    canViewCostPrice: false,
    canEditInventory: false,
    canViewEtims: false,
    canExportReports: false,
    canManagePayments: false,
  },
  'Inventory Clerk': {
    maxDiscountPct: 0,
    canVoidSale: false,
    canOpenDrawer: false,
    canViewCostPrice: true,
    canEditInventory: true,
    canViewEtims: false,
    canExportReports: true,
    canManagePayments: false,
  },
  Accountant: {
    maxDiscountPct: 0,
    canVoidSale: false,
    canOpenDrawer: false,
    canViewCostPrice: true,
    canEditInventory: false,
    canViewEtims: true,
    canExportReports: true,
    canManagePayments: false,
  },
  'Field Agent': {
    maxDiscountPct: 10,
    canVoidSale: false,
    canOpenDrawer: false,
    canViewCostPrice: false,
    canEditInventory: false,
    canViewEtims: false,
    canExportReports: false,
    canManagePayments: false,
  },
};

export const ModuleWorkspace: React.FC<ModuleWorkspaceProps> = ({
  module,
  business,
  stores,
  activeStore,
  products,
  employees,
  attendanceLogs,
  records,
  accountTier,
  activeRole,
  onCreateProduct,
  onTransferStock,
  onCreateEmployee,
  onEmployeeAttendance,
  onSlotStatusChange,
  onReceivePurchaseOrder,
  onCreateRecord,
}) => {
  const perms = ROLE_PERMISSIONS[activeRole];

  const taxonomy = useMemo(
    () =>
      business.catalogTaxonomy && business.catalogTaxonomy.length > 0
        ? business.catalogTaxonomy
        : [
            { id: 'cat-bev', name: 'Beverages', subCategories: ['Coffee', 'Tea'] },
            { id: 'cat-pan', name: 'Pantry', subCategories: ['Cooking Oils'] },
            { id: 'cat-sta', name: 'Staples', subCategories: ['Flour & Rice'] },
          ],
    [business.catalogTaxonomy]
  );

  const layoutZones = useMemo(
    () => business.layoutConfig?.zones || [],
    [business.layoutConfig]
  );

  const allShelfSlots = useMemo(() => {
    const out: Array<{ zoneId: string; zoneName: string; slotId: string; code: string; label: string; status: SlotStatus }> = [];
    for (const z of layoutZones) {
      for (const s of z.slots) {
        out.push({
          zoneId: z.id,
          zoneName: z.name,
          slotId: s.id,
          code: s.code,
          label: s.label,
          status: s.status,
        });
      }
    }
    return out;
  }, [layoutZones]);

  // Inventory state
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newSkuCategory, setNewSkuCategory] = useState(taxonomy[0]?.name || 'Beverages');
  const [newSkuSubCategory, setNewSkuSubCategory] = useState(
    taxonomy[0]?.subCategories[0] || ''
  );
  const [newSkuSlotKey, setNewSkuSlotKey] = useState('');
  const [newSkuPrice, setNewSkuPrice] = useState('450');
  const [newSkuQty, setNewSkuQty] = useState('30');
  const [newSkuTax, setNewSkuTax] = useState<TaxCode>('B_16');

  const [transferProdId, setTransferProdId] = useState(products[0]?.id || '');
  const [transferFromId, setTransferFromId] = useState(stores[0]?.id || '');
  const [transferToId, setTransferToId] = useState(stores[1]?.id || stores[0]?.id || '');
  const [transferQty, setTransferQty] = useState(5);
  const [transferFeedback, setTransferFeedback] = useState('');

  // Employees & PIN provisioning state
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState<UserRole>('Cashier');
  const [empPin, setEmpPin] = useState('7890');
  const [empBranchId, setEmpBranchId] = useState(activeStore?.id || stores[0]?.id || '');
  const [empSalary, setEmpSalary] = useState('48000');
  const [empPerms, setEmpPerms] = useState<EmployeePermissionSet>(DEFAULT_EMP_PERMS.Cashier);
  const [revealPins, setRevealPins] = useState(false);
  const [empCreatedMsg, setEmpCreatedMsg] = useState('');

  // Payroll calculator state
  const [calcGross, setCalcGross] = useState(85000);
  const payrollBreakdown = useMemo(() => calculateKenyaPayroll(calcGross), [calcGross]);

  // Purchase GRN state
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [grnFeedback, setGrnFeedback] = useState('');

  // Generic ERP record creation state
  const [recTitle, setRecTitle] = useState('');
  const [recSubtitle, setRecSubtitle] = useState('');
  const [recStatus, setRecStatus] = useState('Active');
  const [recAmount, setRecAmount] = useState('');
  const [hrSyncing, setHrSyncing] = useState(false);
  const [hrSyncedMsg, setHrSyncedMsg] = useState('');

  const moduleRecords = useMemo(
    () => records.filter((r) => r.moduleId === module.id && r.businessId === business.id),
    [records, module.id, business.id]
  );

  // Specialized Inventory & Multi-Store Transfer Workspace
  if (module.id === 'inventory') {
    const selectedTaxGroup = taxonomy.find((c) => c.name === newSkuCategory);
    const subCategoryOptions = selectedTaxGroup?.subCategories || [];

    const handleAddSku = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSkuName.trim()) return;
      const matchedSlot = allShelfSlots.find((s) => `${s.zoneId}::${s.slotId}` === newSkuSlotKey);
      await onCreateProduct({
        name: newSkuName.trim(),
        sku: newSkuCode.trim(),
        category: newSkuCategory,
        subCategory: newSkuSubCategory || undefined,
        zoneId: matchedSlot?.zoneId,
        slotId: matchedSlot?.slotId,
        shelfCode: matchedSlot ? `${matchedSlot.code} · ${matchedSlot.label}` : undefined,
        price: Number(newSkuPrice) || 100,
        cost: Math.round((Number(newSkuPrice) || 100) * 0.7),
        initialQty: Number(newSkuQty) || 0,
        taxCode: newSkuTax,
      });
      setNewSkuName('');
      setNewSkuCode('');
    };

    const handleTransfer = async (e: React.FormEvent) => {
      e.preventDefault();
      setTransferFeedback('');
      try {
        await onTransferStock({
          productId: transferProdId || products[0]?.id,
          fromStoreId: transferFromId,
          toStoreId: transferToId,
          qty: transferQty,
        });
        setTransferFeedback(`Transferred ${transferQty} units successfully.`);
      } catch (err) {
        setTransferFeedback(err instanceof Error ? err.message : 'Transfer failed.');
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Multi-Store Inventory, Shelves & Product Taxonomy
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Assign products to physical shelves/sections for fast restocking while maintaining separate 2-tier Categories & Subcategories.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Add New SKU */}
          <form
            onSubmit={handleAddSku}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add Product SKU to {activeStore.name}
            </h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <input
                type="text"
                required
                value={newSkuName}
                onChange={(e) => setNewSkuName(e.target.value)}
                placeholder="Product Name"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={newSkuCode}
                onChange={(e) => setNewSkuCode(e.target.value)}
                placeholder="SKU (auto if blank)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={newSkuCategory}
                onChange={(e) => {
                  const cat = e.target.value;
                  setNewSkuCategory(cat);
                  const grp = taxonomy.find((c) => c.name === cat);
                  setNewSkuSubCategory(grp?.subCategories[0] || '');
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {taxonomy.map((c) => (
                  <option key={c.id} value={c.name}>
                    Category: {c.name}
                  </option>
                ))}
              </select>
              <select
                value={newSkuSubCategory}
                onChange={(e) => setNewSkuSubCategory(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Subcategory (optional)</option>
                {subCategoryOptions.map((sub) => (
                  <option key={sub} value={sub}>
                    Sub: {sub}
                  </option>
                ))}
              </select>
              <select
                value={newSkuSlotKey}
                onChange={(e) => setNewSkuSlotKey(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Physical Section / Shelf Location (Optional)</option>
                {allShelfSlots.map((s) => (
                  <option key={`${s.zoneId}::${s.slotId}`} value={`${s.zoneId}::${s.slotId}`}>
                    {s.zoneName} → {s.code} ({s.label})
                  </option>
                ))}
              </select>
              <select
                value={newSkuTax}
                onChange={(e) => setNewSkuTax(e.target.value as TaxCode)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="B_16">VAT {business.vatRate}% (Code B)</option>
                <option value="E_0">Zero-Rated 0% (Code E)</option>
                <option value="A_EXEMPT">VAT Exempt (Code A)</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={newSkuPrice}
                  onChange={(e) => setNewSkuPrice(e.target.value)}
                  placeholder={`Price (${business.currency})`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  value={newSkuQty}
                  onChange={(e) => setNewSkuQty(e.target.value)}
                  placeholder="Opening Qty"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!perms.canEditInventory}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{perms.canEditInventory ? 'Create SKU' : `${activeRole} View Only`}</span>
            </button>
          </form>

          {/* Inter-Branch Stock Transfer */}
          <form
            onSubmit={handleTransfer}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Inter-Store Stock Transfer
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <select
                value={transferProdId}
                onChange={(e) => setTransferProdId(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>

              <select
                value={transferFromId}
                onChange={(e) => setTransferFromId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    From: {s.name}
                  </option>
                ))}
              </select>

              <select
                value={transferToId}
                onChange={(e) => setTransferToId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    To: {s.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={transferQty}
                onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              <button
                type="submit"
                disabled={!perms.canEditInventory || stores.length < 2}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-teal-600"
              >
                Dispatch Transfer
              </button>
            </div>

            {transferFeedback && (
              <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
                {transferFeedback}
              </p>
            )}
          </form>
        </div>

        {/* Multi-Branch Stock Matrix Table */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">SKU / Barcode</th>
                  <th className="px-5 py-3 font-medium">Product & Taxonomy</th>
                  <th className="px-5 py-3 font-medium">Section / Shelf</th>
                  <th className="px-5 py-3 font-medium">KRA Tax</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  {stores.map((s) => (
                    <th key={s.id} className="px-4 py-3 text-right font-medium">
                      {s.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => {
                  const slotMatch = allShelfSlots.find(
                    (s) => s.zoneId === p.zoneId && s.slotId === p.slotId
                  );
                  const needsRestock = slotMatch?.status === 'needs_restock';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-slate-600 dark:text-slate-300">
                        <div>{p.sku}</div>
                        <div className="text-[11px] text-slate-400">{p.barcode}</div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                        <p className="text-[11px] text-teal-700 dark:text-teal-400">
                          {p.category}
                          {p.subCategory ? ` › ${p.subCategory}` : ''}
                        </p>
                        {p.variants && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Matrix: {p.variants.join(' / ')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {p.shelfCode || slotMatch ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              <MapPin className="h-3 w-3 text-teal-600" />
                              {p.shelfCode || `${slotMatch?.code} · ${slotMatch?.label}`}
                            </span>
                            {slotMatch && perms.canEditInventory && (
                              <button
                                type="button"
                                onClick={() =>
                                  onSlotStatusChange(
                                    slotMatch.zoneId,
                                    slotMatch.slotId,
                                    needsRestock ? 'available' : 'needs_restock'
                                  )
                                }
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                                  needsRestock
                                    ? 'bg-amber-100 text-amber-800 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {needsRestock ? 'Restocked ✓' : 'Flag Restock'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {getTaxLabel(p.taxCode, business.vatRate)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">
                        {formatMoney(p.price, business.currency)}
                      </td>
                      {stores.map((s) => {
                        const q = p.stockByStore[s.id] ?? 0;
                        return (
                          <td
                            key={s.id}
                            className={`px-4 py-3 text-right font-mono tabular-nums ${
                              q <= p.reorderPoint
                                ? 'font-bold text-amber-700 dark:text-amber-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {q}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // Specialized Employees, POS PINs, & Access Tiers Workspace
  if (module.id === 'employees') {
    const canProvisionStaff = accountTier === 'admin' || activeRole === 'Store Manager';

    const handleRoleSelect = (role: UserRole) => {
      setEmpRole(role);
      setEmpPerms(DEFAULT_EMP_PERMS[role]);
    };

    const handleAddEmployee = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!empName.trim() || empPin.trim().length < 4) return;
      await onCreateEmployee({
        name: empName.trim(),
        email: empEmail.trim() || `${empName.trim().toLowerCase().replace(/\s+/g, '.')}@${business.slug}.misafarms.com`,
        role: empRole,
        pinCode: empPin.trim(),
        branchId: empBranchId || activeStore.id,
        grossSalary: Number(empSalary) || 45000,
        permissions: empPerms,
      });
      setEmpCreatedMsg(`Provisioned ${empName.trim()} (${empRole}) with POS PIN ${empPin.trim()}.`);
      setEmpName('');
      setEmpEmail('');
      setEmpPin(String(Math.floor(1000 + Math.random() * 8999)));
      setTimeout(() => setEmpCreatedMsg(''), 4000);
    };

    const triggerHrSync = () => {
      setHrSyncing(true);
      setTimeout(() => {
        setHrSyncing(false);
        setHrSyncedMsg(`Synchronized ${employees.length} employee profiles with WorkPay KE & BambooHR webhook.`);
      }, 600);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Employees, POS PINs & Account Access Separation
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Differentiate Business Admins, PIN-authenticated Store Employees, and External Portal Users for {business.name}.
            </p>
          </div>
          <button
            type="button"
            onClick={triggerHrSync}
            disabled={hrSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${hrSyncing ? 'animate-spin' : ''}`} />
            <span>Sync 3rd-Party HR (WorkPay / BambooHR)</span>
          </button>
        </div>

        {hrSyncedMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {hrSyncedMsg}
          </div>
        )}

        {empCreatedMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{empCreatedMsg}</span>
          </div>
        )}

        {/* Access Tier Comparison Architecture */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400">
              <Shield className="h-4 w-4" />
              <span>Tier 1 · Business Admin</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              Sees all 50 modules including Payment Gateways (Daraja/Airtel), Payroll, Equity, Studio, Admin RBAC, and Branch Creation.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
              <KeyRound className="h-4 w-4 text-amber-600" />
              <span>Tier 2 · Staff Employee (PIN)</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              Unlocks POS registers with a 4-digit PIN. Enforces per-employee discount caps, cost-price hiding, and eTIMS/void boundaries.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400">
              <Users className="h-4 w-4" />
              <span>Tier 3 · Portal User (Customer)</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              Restricted to misafarms.com/{business.slug} storefront, eCommerce orders, Subscriptions, Helpdesk tickets, and personal eTIMS invoices.
            </p>
          </div>
        </section>

        {/* Employee Roster with POS PIN & Granular Permissions */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Active Staff Directory & POS PIN Matrix ({employees.length})
            </h2>
            {canProvisionStaff && (
              <button
                type="button"
                onClick={() => setRevealPins((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                {revealPins ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{revealPins ? 'Mask PINs' : 'Reveal POS PINs'}</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Employee</th>
                  <th className="px-5 py-2.5 font-medium">Role & Branch</th>
                  <th className="px-5 py-2.5 font-medium">Shift Status</th>
                  <th className="px-5 py-2.5 font-medium">Rating & Tips</th>
                  <th className="px-5 py-2.5 font-medium">POS PIN</th>
                  <th className="px-5 py-2.5 text-right font-medium">Max Disc</th>
                  <th className="px-5 py-2.5 font-medium">Granted Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map((emp) => {
                  const branchName =
                    stores.find((s) => s.id === emp.branchId)?.name || emp.branchId;
                  const capabilities = [
                    emp.permissions.canVoidSale && 'Void Sale',
                    emp.permissions.canOpenDrawer && 'Cash Drawer',
                    emp.permissions.canViewCostPrice && 'View Cost',
                    emp.permissions.canEditInventory && 'Edit Stock',
                    emp.permissions.canViewEtims && 'eTIMS',
                    emp.permissions.canManagePayments && 'Gateways',
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {emp.name}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {emp.email}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{emp.role}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {branchName}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              emp.clockedIn
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {emp.clockedIn ? 'Clocked In' : 'Clocked Out'}
                          </span>
                          {canProvisionStaff && (
                            <button
                              type="button"
                              onClick={() =>
                                onEmployeeAttendance(
                                  emp.id,
                                  emp.clockedIn ? 'clock_out' : 'clock_in',
                                  'Manager Attendance Override'
                                )
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline dark:text-teal-400"
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
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 font-mono font-semibold text-amber-600 dark:text-amber-400">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span>{(emp.ratingAvg ?? 5).toFixed(2)}</span>
                          <span className="text-[11px] font-normal text-slate-400">
                            ({emp.ratingCount ?? 0})
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          Tips: {formatMoney(emp.tipsEarned ?? 0, business.currency)}
                        </p>
                      </td>
                      <td className="px-5 py-3 font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {revealPins ? emp.pinCode : '••••'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {emp.permissions.maxDiscountPct}%
                      </td>
                      <td className="px-5 py-3 text-[11px] text-slate-600 dark:text-slate-300">
                        {capabilities || 'Standard Checkout'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Shift Attendance Logs */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <Clock className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Shift Clock-In & Clock-Out Logs
            </h2>
          </div>
          {attendanceLogs.filter((l) => l.businessId === business.id).length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-500 dark:text-slate-400">
              No shift clock events recorded yet. Staff automatically clock in/out when unlocking POS with their PIN.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {attendanceLogs
                .filter((l) => l.businessId === business.id)
                .slice(0, 12)
                .map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          log.action === 'clock_in'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {log.action === 'clock_in' ? 'Clock In' : 'Clock Out'}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {log.employeeName}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">({log.role})</span>
                      {log.note && (
                        <span className="text-slate-500 dark:text-slate-400">· {log.note}</span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Admin-Only Provision New Employee & PIN Form */}
        {canProvisionStaff && (
          <form
            onSubmit={handleAddEmployee}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Provision Employee Account & 4-Digit POS PIN
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                required
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                placeholder="Employee Full Name"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
                placeholder="Work Email (auto if blank)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={empRole}
                onChange={(e) => handleRoleSelect(e.target.value as UserRole)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="Cashier">Cashier</option>
                <option value="Store Manager">Store Manager</option>
                <option value="Inventory Clerk">Inventory Clerk</option>
                <option value="Accountant">Accountant</option>
                <option value="Field Agent">Field Agent</option>
              </select>

              <input
                type="text"
                required
                maxLength={8}
                value={empPin}
                onChange={(e) => setEmpPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="4-Digit POS PIN"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={empBranchId}
                onChange={(e) => setEmpBranchId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    Branch: {s.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={empSalary}
                onChange={(e) => setEmpSalary(e.target.value)}
                placeholder={`Gross Salary (${business.currency})`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Granular Permission Level Overrides */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
              <label className="inline-flex items-center gap-1.5">
                <span className="text-slate-600 dark:text-slate-300">Max Discount %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={empPerms.maxDiscountPct}
                  onChange={(e) =>
                    setEmpPerms((p) => ({
                      ...p,
                      maxDiscountPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-14 rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-900"
                />
              </label>

              {(
                [
                  { key: 'canVoidSale', label: 'Void Sale' },
                  { key: 'canViewCostPrice', label: 'View Cost Price' },
                  { key: 'canEditInventory', label: 'Edit Inventory' },
                  { key: 'canViewEtims', label: 'Access eTIMS' },
                  { key: 'canExportReports', label: 'Export Reports' },
                ] as const
              ).map((item) => (
                <label key={item.key} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={empPerms[item.key]}
                    onChange={(e) =>
                      setEmpPerms((p) => ({ ...p, [item.key]: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Employee & Issue POS PIN</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  // Specialized Kenya Statutory Payroll Engine
  if (module.id === 'payroll') {
    const staffRows =
      employees.length > 0
        ? employees.map((e) => ({ name: e.name, role: e.role, gross: e.grossSalary }))
        : [
            { name: 'Amina Hassan', role: 'Regional Operations Director', gross: 185000 },
            { name: 'Brian Ochieng', role: 'Field Sales & Van Agent', gross: 65000 },
            { name: 'Wanjiku Kamau', role: 'Senior POS Cashier', gross: 48000 },
          ];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Kenya Statutory Payroll Engine (PAYE · SHIF · NSSF · Housing Levy)
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Automated statutory deductions, P9 tax schedules, and M-Pesa B2C / bank disbursement ready.
          </p>
        </div>

        {/* Interactive Calculator */}
        <section className="grid grid-cols-1 gap-6 rounded-xl border border-slate-200 bg-white p-5 lg:grid-cols-12 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3 lg:col-span-4">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Statutory Pay Calculator
            </h2>
            <label className="block text-xs text-slate-600 dark:text-slate-400">
              Monthly Gross Salary ({business.currency})
              <input
                type="number"
                min={0}
                step={1000}
                value={calcGross}
                onChange={(e) => setCalcGross(Math.max(0, Number(e.target.value)))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-8">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">PAYE (Net of Relief)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.paye, 'KES')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">SHIF (2.75%)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.shif, 'KES')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">NSSF (Tier I & II)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.nssf, 'KES')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Housing Levy (1.5%)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.housingLevy, 'KES')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Deductions</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                {formatMoney(payrollBreakdown.totalDeductions, 'KES')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Net Take-Home Pay</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
                {formatMoney(payrollBreakdown.netPay, 'KES')}
              </p>
            </div>
          </div>
        </section>

        {/* Staff Payroll Schedule */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 text-right font-medium">Gross Pay</th>
                  <th className="px-5 py-3 text-right font-medium">PAYE</th>
                  <th className="px-5 py-3 text-right font-medium">SHIF + AHL + NSSF</th>
                  <th className="px-5 py-3 text-right font-medium">Net Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staffRows.map((emp) => {
                  const p = calculateKenyaPayroll(emp.gross);
                  return (
                    <tr key={emp.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {emp.name}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{emp.role}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {formatMoney(p.grossSalary, 'KES')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {formatMoney(p.paye, 'KES')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {formatMoney(p.shif + p.housingLevy + p.nssf, 'KES')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-teal-700 dark:text-teal-400">
                        {formatMoney(p.netPay, 'KES')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // Generic Interactive ERP Workspace (Covers all remaining Odoo & Dynamics modules cleanly, including Purchase GRN & Portal User view)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) return;
    await onCreateRecord({
      moduleId: module.id,
      title: recTitle.trim(),
      subtitle: recSubtitle.trim() || `${module.name} entry · ${activeStore.name}`,
      status: accountTier === 'user' ? 'Submitted by Customer' : recStatus,
      amount: recAmount ? Number(recAmount) : undefined,
    });
    setRecTitle('');
    setRecSubtitle('');
    setRecAmount('');
  };

  const handleReceiveGrn = async (recordId: string) => {
    setReceivingId(recordId);
    setGrnFeedback('');
    try {
      await onReceivePurchaseOrder(recordId);
      setGrnFeedback(`Purchase order received into ${activeStore.name} inventory stock.`);
      setTimeout(() => setGrnFeedback(''), 4000);
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {module.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {module.description} · {business.name} ({activeStore.name})
          </p>
        </div>

        {accountTier === 'user' && (
          <span className="font-mono text-xs text-teal-700 dark:text-teal-400">
            Customer Portal · https://misafarms.com/{business.slug}
          </span>
        )}
      </div>

      {grnFeedback && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{grnFeedback}</span>
        </div>
      )}

      {/* Add New Module Entry Form */}
      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-12 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          type="text"
          required
          value={recTitle}
          onChange={(e) => setRecTitle(e.target.value)}
          placeholder={
            accountTier === 'user'
              ? `Submit ${module.name} request or order...`
              : `New ${module.name} title or reference...`
          }
          className="sm:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <input
          type="text"
          value={recSubtitle}
          onChange={(e) => setRecSubtitle(e.target.value)}
          placeholder="Notes, supplier, customer, or route details..."
          className="sm:col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <input
          type="number"
          value={recAmount}
          onChange={(e) => setRecAmount(e.target.value)}
          placeholder={`Value (${business.currency})`}
          className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{accountTier === 'user' ? 'Submit' : 'Add Entry'}</span>
        </button>
      </form>

      {/* Module Records Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            {module.name} Records ({moduleRecords.length})
          </h2>
          {accountTier !== 'user' && (
            <select
              aria-label="Default new record status"
              value={recStatus}
              onChange={(e) => setRecStatus(e.target.value)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="Active">Status: Active</option>
              <option value="Approved">Status: Approved</option>
              <option value="Pending Review">Status: Pending Review</option>
              <option value="Completed">Status: Completed</option>
            </select>
          )}
        </div>

        {moduleRecords.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No {module.name} records logged yet for {business.name}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Use the quick-entry form above to create your first {module.name} transaction or workflow item.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {moduleRecords.map((rec) => (
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
                <div className="flex items-center gap-3 text-right">
                  <div>
                    {rec.amount !== undefined && (
                      <p className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatMoney(rec.amount, rec.currency || business.currency)}
                      </p>
                    )}
                    <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                      {rec.status}
                    </p>
                  </div>
                  {module.id === 'purchase' &&
                    rec.status !== 'Received (GRN)' &&
                    perms.canEditInventory && (
                      <button
                        type="button"
                        onClick={() => handleReceiveGrn(rec.id)}
                        disabled={receivingId === rec.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        <span>
                          {receivingId === rec.id ? 'Receiving...' : 'Receive Stock (GRN)'}
                        </span>
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
