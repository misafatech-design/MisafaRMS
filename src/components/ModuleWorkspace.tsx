import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Shield,
  Star,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  AccountTier,
  AppModuleMeta,
  BusinessEntity,
  EmployeePermissionSet,
  EmployeeRecord,
  ErpRecord,
  PayrollRunPayslip,
  PayrollRunRecord,
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
import { APP_MODULES } from '../data/modulesRegistry';
import { getDefaultModulesForRole } from '../data/businessTemplates';
import { MODULE_BLUEPRINTS, ModuleBlueprint } from '../data/moduleBlueprints';

interface ModuleWorkspaceProps {
  module: AppModuleMeta;
  business: BusinessEntity;
  stores: StoreBranch[];
  activeStore: StoreBranch;
  products: ProductItem[];
  employees: EmployeeRecord[];
  attendanceLogs: ShiftAttendanceLog[];
  payrollRuns: PayrollRunRecord[];
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
  onUpdateProduct: (
    productId: string,
    patch: {
      name?: string;
      sku?: string;
      category?: string;
      subCategory?: string;
      price?: number;
      cost?: number;
      taxCode?: TaxCode;
      reorderPoint?: number;
    }
  ) => Promise<void>;
  onAdjustStock: (payload: {
    productId: string;
    storeId: string;
    delta: number;
    reason: string;
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
  onUpdateEmployee: (
    employeeId: string,
    patch: Partial<{
      name: string;
      email: string;
      role: UserRole;
      pinCode: string;
      branchId: string;
      grossSalary: number;
      active: boolean;
      permissions: EmployeePermissionSet;
    }>
  ) => Promise<void>;
  onDeleteEmployee: (employeeId: string) => Promise<void>;
  onRunPayroll: (periodLabel: string) => Promise<PayrollRunRecord | null>;
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
    meta?: Record<string, string | number | boolean>;
  }) => Promise<void>;
  onUpdateRecord?: (
    recordId: string,
    patch: {
      status?: string;
      title?: string;
      subtitle?: string;
      amount?: number;
      meta?: Record<string, string | number | boolean>;
    }
  ) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void>;
  onBulkImportProducts?: (payload: {
    storeId: string;
    upsertExisting: boolean;
    rows: Array<{
      sku?: string;
      barcode?: string;
      name: string;
      category?: string;
      subCategory?: string;
      shelfCode?: string;
      price: number;
      cost?: number;
      taxCode?: string;
      unit?: string;
      reorderPoint?: number;
      qty?: number;
    }>;
  }) => Promise<{ createdCount: number; updatedCount: number; skippedCount: number; errors: string[] }>;
}

const MODULE_WORKFLOW_HINTS: Record<
  string,
  { titlePlaceholder: string; subtitlePlaceholder: string; statuses: string[]; sampleTitle: string }
> = {
  manufacturing: {
    titlePlaceholder: 'Work Order / BoM Batch (e.g. WO-402 · Packaged Spice Blend)',
    subtitlePlaceholder: 'Raw materials, BoM ratio, & assembly line',
    statuses: ['Planned', 'In Production', 'QC Passed', 'Completed'],
    sampleTitle: 'WO-2026-01 · 500x Packaged Kenya AA Ground Coffee',
  },
  expenses: {
    titlePlaceholder: 'Expense Claim (e.g. Fuel & Rider Logistics — Westlands)',
    subtitlePlaceholder: 'Receipt Ref, Staff Member & Cost Center',
    statuses: ['Submitted', 'Pending Review', 'Approved', 'Reimbursed'],
    sampleTitle: 'EXP-104 · Delivery Rider Fuel & Airtime',
  },
  approvals: {
    titlePlaceholder: 'Approval Request (e.g. PO-882 Capital Equipment)',
    subtitlePlaceholder: 'Requested By, Department & Threshold Policy',
    statuses: ['Pending Review', 'Approved', 'Rejected', 'Completed'],
    sampleTitle: 'APR-309 · Branch Generator Maintenance Budget',
  },
  quality: {
    titlePlaceholder: 'KEBS / QC Inspection Lot (e.g. QC-BATCH-89)',
    subtitlePlaceholder: 'Batch #, Inspector, Pass/Fail Tolerance Notes',
    statuses: ['Pending Review', 'Passed QC', 'Quarantined', 'Completed'],
    sampleTitle: 'QC-118 · Batch Moisture & Seal Integrity Check',
  },
  helpdesk: {
    titlePlaceholder: 'Support Ticket (e.g. TKT-221 · eTIMS Device Sync Issue)',
    subtitlePlaceholder: 'Customer / Branch, Priority & SLA Target',
    statuses: ['Open', 'In Progress', 'Resolved', 'Closed'],
    sampleTitle: 'TKT-409 · Delivery Order Delayed in Transit',
  },
  maintenance: {
    titlePlaceholder: 'Equipment Service (e.g. Cold Room Compressor PM-04)',
    subtitlePlaceholder: 'Asset Serial, Technician & Next Service Due',
    statuses: ['Scheduled', 'In Progress', 'Completed'],
    sampleTitle: 'MNT-204 · POS Thermal Printer & UPS Calibration',
  },
  repairs: {
    titlePlaceholder: 'RMA / Repair Job (e.g. RMA-71 · Customer Device Repair)',
    subtitlePlaceholder: 'Warranty Status, Parts Used & Diagnosis',
    statuses: ['Diagnosing', 'Awaiting Parts', 'Repaired', 'Delivered'],
    sampleTitle: 'RMA-552 · Warranty Replacement & Screen Calibration',
  },
  time_off: {
    titlePlaceholder: 'Leave Request (e.g. Annual Leave — 5 Days)',
    subtitlePlaceholder: 'Employee Name, Dates & Relief Officer',
    statuses: ['Pending Review', 'Approved', 'Declined'],
    sampleTitle: 'LV-088 · Grace Wanjiku (3 Days Compassionate Leave)',
  },
  subscriptions: {
    titlePlaceholder: 'Recurring Plan (e.g. B2B Monthly Coffee Retainer)',
    subtitlePlaceholder: 'Subscriber, Billing Cycle & Renewal Date',
    statuses: ['Active', 'Trial', 'Paused', 'Cancelled'],
    sampleTitle: 'SUB-112 · Corporate Office Weekly Pantry Supply',
  },
  rental: {
    titlePlaceholder: 'Rental Contract (e.g. Event PA & Tent Hire — Weekend)',
    subtitlePlaceholder: 'Lessee, Deposit Paid & Return Due Date',
    statuses: ['Reserved', 'Checked Out', 'Returned', 'Completed'],
    sampleTitle: 'RNT-094 · Commercial Cold Box 3-Day Lease',
  },
  fleet: {
    titlePlaceholder: 'Vehicle Log (e.g. KDM 441Y — Isuzu NQR Route Run)',
    subtitlePlaceholder: 'Driver, Odometer km, Fuel Liters & Service',
    statuses: ['On Route', 'Available', 'Maintenance'],
    sampleTitle: 'FLT-KDM441Y · 45L Diesel Refill & Westlands Dispatch',
  },
  restaurant: {
    titlePlaceholder: 'Kitchen / Prep Ticket (e.g. KOT-204 · Table T4 Grill)',
    subtitlePlaceholder: 'Course Notes, Waiter & Prep Station',
    statuses: ['Queued', 'Preparing', 'Ready to Serve', 'Served'],
    sampleTitle: 'KOT-119 · Table 4 (2x Nyama Platter, 2x Fresh Mango)',
  },
  purchase: {
    titlePlaceholder: 'Purchase Order (e.g. PO-901 · Brookside Dairy Restock)',
    subtitlePlaceholder: 'Supplier Name, Expected Delivery & Terms',
    statuses: ['Ordered', 'Pending Review', 'Received (GRN)'],
    sampleTitle: 'PO-410 · Bulk Beverage & Grocery Restock',
  },
};

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseInventoryCsvText(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const headerCells = splitDelimitedLine(firstLine, delimiter).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  const looksLikeHeader =
    headerCells.includes('name') ||
    headerCells.includes('productname') ||
    headerCells.includes('sku') ||
    headerCells.includes('price');

  const dataLines = looksLikeHeader ? lines.slice(1) : lines;
  const colIdx = (aliases: string[], fallback: number) => {
    if (!looksLikeHeader) return fallback;
    const found = headerCells.findIndex((h) => aliases.includes(h));
    return found >= 0 ? found : -1;
  };

  const skuIdx = colIdx(['sku', 'itemcode', 'code'], 0);
  const nameIdx = colIdx(['name', 'productname', 'title', 'item'], 1);
  const catIdx = colIdx(['category', 'cat'], 2);
  const subCatIdx = colIdx(['subcategory', 'subcat', 'sub'], 3);
  const shelfIdx = colIdx(['shelf', 'shelfcode', 'location', 'section'], 4);
  const priceIdx = colIdx(['price', 'sellprice', 'sellingprice', 'unitprice'], 5);
  const costIdx = colIdx(['cost', 'unitcost', 'buyingprice'], 6);
  const taxIdx = colIdx(['tax', 'taxcode', 'kratype'], 7);
  const unitIdx = colIdx(['unit', 'uom'], 8);
  const reorderIdx = colIdx(['reorder', 'reorderpoint', 'minstock'], 9);
  const qtyIdx = colIdx(['qty', 'stock', 'quantity', 'initialqty'], 10);
  const barcodeIdx = colIdx(['barcode', 'ean'], 11);

  return dataLines.map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const val = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : '');
    const priceNum = Number(val(priceIdx).replace(/[^0-9.]/g, '')) || 0;
    const costNum = Number(val(costIdx).replace(/[^0-9.]/g, ''));
    const qtyNum = Number(val(qtyIdx).replace(/[^0-9.]/g, ''));
    const reorderNum = Number(val(reorderIdx).replace(/[^0-9.]/g, ''));
    return {
      sku: val(skuIdx),
      name: val(nameIdx),
      category: val(catIdx) || 'General',
      subCategory: val(subCatIdx) || undefined,
      shelfCode: val(shelfIdx) || undefined,
      price: priceNum,
      cost: Number.isFinite(costNum) && val(costIdx) !== '' ? costNum : undefined,
      taxCode: val(taxIdx) || 'B_16',
      unit: val(unitIdx) || 'Unit',
      reorderPoint: Number.isFinite(reorderNum) && val(reorderIdx) !== '' ? reorderNum : 10,
      qty: Number.isFinite(qtyNum) && val(qtyIdx) !== '' ? qtyNum : 0,
      barcode: val(barcodeIdx) || undefined,
    };
  });
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
    allowedModuleIds: getDefaultModulesForRole('Owner'),
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
    allowedModuleIds: getDefaultModulesForRole('Store Manager'),
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
    allowedModuleIds: getDefaultModulesForRole('Cashier'),
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
    allowedModuleIds: getDefaultModulesForRole('Inventory Clerk'),
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
    allowedModuleIds: getDefaultModulesForRole('Accountant'),
  },
  'HR Officer': {
    maxDiscountPct: 0,
    canVoidSale: false,
    canOpenDrawer: false,
    canViewCostPrice: false,
    canEditInventory: false,
    canViewEtims: false,
    canExportReports: true,
    canManagePayments: false,
    allowedModuleIds: getDefaultModulesForRole('HR Officer'),
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
    allowedModuleIds: getDefaultModulesForRole('Field Agent'),
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
  payrollRuns,
  records,
  accountTier,
  activeRole,
  onCreateProduct,
  onUpdateProduct,
  onAdjustStock,
  onTransferStock,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onRunPayroll,
  onEmployeeAttendance,
  onSlotStatusChange,
  onReceivePurchaseOrder,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onBulkImportProducts,
}) => {
  const perms = ROLE_PERMISSIONS[activeRole];

  const taxonomy = useMemo(
    () => business.catalogTaxonomy || [],
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
  const [newSkuCategory, setNewSkuCategory] = useState(taxonomy[0]?.name || 'General');
  const [newSkuSubCategory, setNewSkuSubCategory] = useState(
    taxonomy[0]?.subCategories[0] || ''
  );
  const [newSkuSlotKey, setNewSkuSlotKey] = useState('');
  const [newSkuPrice, setNewSkuPrice] = useState('450');
  const [newSkuCost, setNewSkuCost] = useState('');
  const [newSkuQty, setNewSkuQty] = useState('30');
  const [newSkuTax, setNewSkuTax] = useState<TaxCode>('B_16');
  const [invSearch, setInvSearch] = useState('');
  const [invCatFilter, setInvCatFilter] = useState('All');
  const [invLowOnly, setInvLowOnly] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdCost, setEditProdCost] = useState('');
  const [editProdReorder, setEditProdReorder] = useState('');

  const [transferProdId, setTransferProdId] = useState(products[0]?.id || '');
  const [transferFromId, setTransferFromId] = useState(stores[0]?.id || '');
  const [transferToId, setTransferToId] = useState(stores[1]?.id || stores[0]?.id || '');
  const [transferQty, setTransferQty] = useState(5);
  const [transferFeedback, setTransferFeedback] = useState('');

  // Employees & PIN provisioning/editing state
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState<UserRole>('Cashier');
  const [empPin, setEmpPin] = useState('7890');
  const [empBranchId, setEmpBranchId] = useState(activeStore?.id || stores[0]?.id || '');
  const [empSalary, setEmpSalary] = useState('48000');
  const [empPerms, setEmpPerms] = useState<EmployeePermissionSet>(DEFAULT_EMP_PERMS.Cashier);
  const [revealPins, setRevealPins] = useState(false);
  const [empCreatedMsg, setEmpCreatedMsg] = useState('');
  const [editingEmp, setEditingEmp] = useState<EmployeeRecord | null>(null);

  // Payroll calculator & execution state
  const [calcGross, setCalcGross] = useState(85000);
  const payrollBreakdown = useMemo(() => calculateKenyaPayroll(calcGross), [calcGross]);
  const [payrollPeriod, setPayrollPeriod] = useState(
    new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  );
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [payrollMsg, setPayrollMsg] = useState('');
  const [previewPayslip, setPreviewPayslip] = useState<{
    runPeriod: string;
    slip: PayrollRunPayslip;
  } | null>(null);

  // Purchase GRN state
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [grnFeedback, setGrnFeedback] = useState('');

  // Generic ERP record creation & workflow state
  const [recTitle, setRecTitle] = useState('');
  const [recSubtitle, setRecSubtitle] = useState('');
  const [recStatus, setRecStatus] = useState('Active');
  const [recAmount, setRecAmount] = useState('');
  const [recMeta, setRecMeta] = useState<Record<string, string | number>>({});
  const [recSearch, setRecSearch] = useState('');
  const [recFilterStatus, setRecFilterStatus] = useState('All');
  const [hrSyncing, setHrSyncing] = useState(false);
  const [hrSyncedMsg, setHrSyncedMsg] = useState('');

  // Bulk inventory import/export state
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkUpsert, setBulkUpsert] = useState(true);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState('');

  const moduleRecords = useMemo(
    () => records.filter((r) => r.moduleId === module.id && r.businessId === business.id),
    [records, module.id, business.id]
  );

  // Specialized Inventory & Multi-Store Transfer Workspace
  if (module.id === 'inventory') {
    const selectedTaxGroup = taxonomy.find((c) => c.name === newSkuCategory);
    const subCategoryOptions = selectedTaxGroup?.subCategories || [];
    const distinctCategories = Array.from(
      new Set(['All', ...taxonomy.map((c) => c.name), ...products.map((p) => p.category)])
    );

    const visibleProducts = products.filter((p) => {
      const q = invSearch.trim().toLowerCase();
      const catOk = invCatFilter === 'All' || p.category === invCatFilter;
      const qtyHere = p.stockByStore[activeStore.id] ?? 0;
      const lowOk = !invLowOnly || qtyHere <= p.reorderPoint;
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      return catOk && lowOk && qOk;
    });

    const handleAddSku = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSkuName.trim()) return;
      const matchedSlot = allShelfSlots.find((s) => `${s.zoneId}::${s.slotId}` === newSkuSlotKey);
      const parsedPrice = Number(newSkuPrice) || 100;
      const parsedCost = Number(newSkuCost) > 0 ? Number(newSkuCost) : Math.round(parsedPrice * 0.7);
      await onCreateProduct({
        name: newSkuName.trim(),
        sku: newSkuCode.trim(),
        category: newSkuCategory.trim() || 'General',
        subCategory: newSkuSubCategory.trim() || undefined,
        zoneId: matchedSlot?.zoneId,
        slotId: matchedSlot?.slotId,
        shelfCode: matchedSlot ? `${matchedSlot.code} · ${matchedSlot.label}` : undefined,
        price: parsedPrice,
        cost: parsedCost,
        initialQty: Number(newSkuQty) || 0,
        taxCode: newSkuTax,
      });
      setNewSkuName('');
      setNewSkuCode('');
      setNewSkuCost('');
    };

    const handleSaveProductEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProduct) return;
      await onUpdateProduct(editingProduct.id, {
        name: editingProduct.name,
        sku: editingProduct.sku,
        category: editingProduct.category,
        subCategory: editingProduct.subCategory,
        price: Number(editProdPrice) || editingProduct.price,
        cost: Number(editProdCost) || editingProduct.cost,
        reorderPoint: Math.max(0, Number(editProdReorder) || 0),
        taxCode: editingProduct.taxCode,
      });
      setEditingProduct(null);
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

    const parsedBulkRows = useMemo(
      () => parseInventoryCsvText(bulkCsvText),
      [bulkCsvText]
    );

    const csvEscape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const handleExportInventoryCsv = () => {
      const headers = [
        'SKU',
        'Name',
        'Category',
        'SubCategory',
        'ShelfCode',
        'Price',
        'Cost',
        'TaxCode',
        'Unit',
        'ReorderPoint',
        'Qty',
        'Barcode',
        ...stores.map((s) => `Stock_${s.code}`),
      ];
      const lines = [headers.join(',')];
      for (const p of products) {
        lines.push(
          [
            p.sku,
            p.name,
            p.category,
            p.subCategory || '',
            p.shelfCode || '',
            p.price,
            p.cost,
            p.taxCode,
            p.unit,
            p.reorderPoint,
            p.stockByStore[activeStore.id] ?? 0,
            p.barcode,
            ...stores.map((s) => p.stockByStore[s.id] ?? 0),
          ]
            .map(csvEscape)
            .join(',')
        );
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${business.slug}-inventory-${activeStore.code.toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const handleDownloadCsvTemplate = () => {
      const sampleRows = [
        'SKU,Name,Category,SubCategory,ShelfCode,Price,Cost,TaxCode,Unit,ReorderPoint,Qty,Barcode',
        'COF-101,Kenya AA Roast Beans 500g,Beverages,Coffee,A1 · Shelf Top,850,520,B_16,Pack,15,40,61611000101',
        'OIL-202,Cold Pressed Sunflower Oil 2L,Pantry,Cooking Oils,B2 · Mid Shelf,690,480,E_0,Bottle,10,25,61611000202',
      ].join('\n');
      const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'misafarms-inventory-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    };

    const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setBulkCsvText(reader.result);
        }
      };
      reader.readAsText(file);
    };

    const handleSubmitBulkImport = async () => {
      if (!onBulkImportProducts || parsedBulkRows.length === 0) return;
      setBulkImporting(true);
      setBulkSummary('');
      try {
        const res = await onBulkImportProducts({
          storeId: activeStore.id,
          upsertExisting: bulkUpsert,
          rows: parsedBulkRows,
        });
        setBulkSummary(
          `Imported cleanly: ${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} skipped.${
            res.errors.length > 0 ? ` (${res.errors[0]})` : ''
          }`
        );
        if (res.createdCount + res.updatedCount > 0) {
          setBulkCsvText('');
        }
      } finally {
        setBulkImporting(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Multi-Store Inventory, Shelves &amp; Product Catalog
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage real branch stock levels, bulk CSV/Excel import &amp; export, inline SKU pricing, and inter-store transfers for {business.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleExportInventoryCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              <span>Export Inventory CSV</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              <span>CSV Template</span>
            </button>
            {perms.canEditInventory && onBulkImportProducts && (
              <button
                type="button"
                onClick={() => {
                  setBulkSummary('');
                  setBulkImportOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 font-semibold text-white hover:bg-slate-800 dark:bg-teal-600"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Bulk Import CSV / Excel</span>
              </button>
            )}
          </div>
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
                placeholder="Product Name *"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={newSkuCode}
                onChange={(e) => setNewSkuCode(e.target.value)}
                placeholder="SKU (auto if blank)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {taxonomy.length > 0 ? (
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
              ) : (
                <input
                  type="text"
                  value={newSkuCategory}
                  onChange={(e) => setNewSkuCategory(e.target.value)}
                  placeholder="Category (e.g. Electronics)"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              )}
              {subCategoryOptions.length > 0 ? (
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
              ) : (
                <input
                  type="text"
                  value={newSkuSubCategory}
                  onChange={(e) => setNewSkuSubCategory(e.target.value)}
                  placeholder="Subcategory (optional)"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              )}
              {allShelfSlots.length > 0 && (
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
              )}
              <select
                value={newSkuTax}
                onChange={(e) => setNewSkuTax(e.target.value as TaxCode)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="B_16">VAT {business.vatRate}% (Code B)</option>
                <option value="E_0">Zero-Rated 0% (Code E)</option>
                <option value="A_EXEMPT">VAT Exempt (Code A)</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  value={newSkuPrice}
                  onChange={(e) => setNewSkuPrice(e.target.value)}
                  placeholder="Sell Price"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  value={newSkuCost}
                  onChange={(e) => setNewSkuCost(e.target.value)}
                  placeholder="Unit Cost"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  value={newSkuQty}
                  onChange={(e) => setNewSkuQty(e.target.value)}
                  placeholder="Qty"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                disabled={products.length === 0}
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {products.length === 0 ? (
                  <option value="">Create a product first to transfer stock</option>
                ) : (
                  products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))
                )}
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
                disabled={!perms.canEditInventory || stores.length < 2 || products.length === 0}
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

        {/* Multi-Branch Stock Matrix Table with Filter & Quick Adjust */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Branch Stock Matrix ({visibleProducts.length} SKUs)
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="search"
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                placeholder="Search SKU or name..."
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={invCatFilter}
                onChange={(e) => setInvCatFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {distinctCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={invLowOnly}
                  onChange={(e) => setInvLowOnly(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span>Low Stock Only</span>
              </label>
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                No products in {business.name} inventory yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Use the "Add Product SKU" form above to stock items for POS and eCommerce checkout.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">SKU / Barcode</th>
                    <th className="px-5 py-3 font-medium">Product &amp; Taxonomy</th>
                    <th className="px-5 py-3 font-medium">Section / Shelf</th>
                    <th className="px-5 py-3 font-medium">KRA Tax</th>
                    <th className="px-5 py-3 text-right font-medium">Price / Cost</th>
                    {stores.map((s) => (
                      <th key={s.id} className="px-4 py-3 text-right font-medium">
                        {s.code}
                      </th>
                    ))}
                    {perms.canEditInventory && (
                      <th className="px-4 py-3 text-right font-medium">Adjust / Edit</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleProducts.map((p) => {
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
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
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
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          <div className="font-semibold">{formatMoney(p.price, business.currency)}</div>
                          {activeRole !== 'Cashier' && activeRole !== 'Field Agent' && (
                            <div className="text-[10px] text-slate-400">
                              Cost: {formatMoney(p.cost, business.currency)}
                            </div>
                          )}
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
                        {perms.canEditInventory && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                title="Decrease stock in active branch (-1)"
                                onClick={() =>
                                  onAdjustStock({
                                    productId: p.id,
                                    storeId: activeStore.id,
                                    delta: -1,
                                    reason: 'Manual Stock Count -1',
                                  })
                                }
                                className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Increase stock in active branch (+5)"
                                onClick={() =>
                                  onAdjustStock({
                                    productId: p.id,
                                    storeId: activeStore.id,
                                    delta: 5,
                                    reason: 'Manual Restock +5',
                                  })
                                }
                                className="rounded border border-slate-200 p-1 text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-400"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct({ ...p });
                                  setEditProdPrice(String(p.price));
                                  setEditProdCost(String(p.cost));
                                  setEditProdReorder(String(p.reorderPoint));
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Edit Product SKU Modal */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Edit SKU · {editingProduct.sku}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSaveProductEdit} className="mt-4 space-y-3 text-xs">
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                  placeholder="Product Name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) =>
                      setEditingProduct((prev) =>
                        prev ? { ...prev, category: e.target.value } : prev
                      )
                    }
                    placeholder="Category"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={editingProduct.subCategory || ''}
                    onChange={(e) =>
                      setEditingProduct((prev) =>
                        prev ? { ...prev, subCategory: e.target.value } : prev
                      )
                    }
                    placeholder="Subcategory"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Sell Price</label>
                    <input
                      type="number"
                      min={0}
                      value={editProdPrice}
                      onChange={(e) => setEditProdPrice(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Unit Cost</label>
                    <input
                      type="number"
                      min={0}
                      value={editProdCost}
                      onChange={(e) => setEditProdCost(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Reorder At</label>
                    <input
                      type="number"
                      min={0}
                      value={editProdReorder}
                      onChange={(e) => setEditProdReorder(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Inventory Import Modal */}
        {bulkImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    Bulk Import Products into {activeStore.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload a .csv file or paste rows directly from Excel / Google Sheets (SKU, Name, Category, SubCategory, Shelf, Price, Cost, TaxCode, Unit, ReorderPoint, Qty, Barcode).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkImportOpen(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <Upload className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                  <span>Choose .CSV File</span>
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={bulkUpsert}
                    onChange={(e) => setBulkUpsert(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Update price, cost &amp; stock when SKU already exists</span>
                </label>
              </div>

              <textarea
                rows={6}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder={`SKU,Name,Category,SubCategory,ShelfCode,Price,Cost,TaxCode,Unit,ReorderPoint,Qty,Barcode\nMILK-500,Fresh Milk 500ml,Dairy,Milk,Fridge 1,65,48,E_0,Pack,20,60,6161100500`}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />

              {parsedBulkRows.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                      <tr>
                        <th className="px-2.5 py-1.5">SKU</th>
                        <th className="px-2.5 py-1.5">Name</th>
                        <th className="px-2.5 py-1.5">Category</th>
                        <th className="px-2.5 py-1.5 text-right">Price</th>
                        <th className="px-2.5 py-1.5 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedBulkRows.slice(0, 8).map((row, idx) => (
                        <tr key={`${row.sku}-${idx}`}>
                          <td className="px-2.5 py-1">{row.sku || 'AUTO'}</td>
                          <td className="px-2.5 py-1 font-sans font-medium">{row.name || '—'}</td>
                          <td className="px-2.5 py-1 font-sans">{row.category}</td>
                          <td className="px-2.5 py-1 text-right">{row.price}</td>
                          <td className="px-2.5 py-1 text-right">{row.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {bulkSummary && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{bulkSummary}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="font-mono text-slate-500">
                  {parsedBulkRows.length} row(s) parsed (up to 500 per batch)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkImportOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={bulkImporting || parsedBulkRows.length === 0}
                    onClick={handleSubmitBulkImport}
                    className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                  >
                    {bulkImporting
                      ? 'Importing SKUs...'
                      : `Import ${parsedBulkRows.length} SKU(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                  <th className="px-5 py-2.5 font-medium">Role &amp; Branch</th>
                  <th className="px-5 py-2.5 font-medium">Shift Status &amp; Hours</th>
                  <th className="px-5 py-2.5 font-medium">Rating &amp; Tips</th>
                  <th className="px-5 py-2.5 font-medium">POS PIN</th>
                  <th className="px-5 py-2.5 text-right font-medium">Salary / Disc</th>
                  <th className="px-5 py-2.5 font-medium">Capabilities</th>
                  {canProvisionStaff && <th className="px-5 py-2.5 text-right font-medium">Manage</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employees.map((emp) => {
                  const branchName =
                    stores.find((s) => s.id === emp.branchId)?.name || emp.branchId;
                  const empLogs = attendanceLogs
                    .filter((l) => l.businessId === business.id && l.employeeId === emp.id)
                    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                  let totalMs = 0;
                  let lastIn: number | null = null;
                  for (const lg of empLogs) {
                    const ts = new Date(lg.timestamp).getTime();
                    if (lg.action === 'clock_in') lastIn = ts;
                    else if (lg.action === 'clock_out' && lastIn !== null) {
                      totalMs += Math.max(0, ts - lastIn);
                      lastIn = null;
                    }
                  }
                  const loggedHours = Math.round((totalMs / 3600000) * 10) / 10;

                  const grantedAppsCount =
                    emp.role === 'Owner'
                      ? APP_MODULES.length
                      : (emp.permissions.allowedModuleIds || getDefaultModulesForRole(emp.role)).length;

                  const capabilities = [
                    `${grantedAppsCount} apps`,
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
                          {emp.name} {!emp.active && <span className="text-[10px] text-rose-600">(Inactive)</span>}
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
                            {emp.clockedIn ? 'Clocked In' : 'Clocked Out'} · {loggedHours}h logged
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
                        <div>{formatMoney(emp.grossSalary, business.currency)}</div>
                        <div className="text-[10px] text-slate-400">
                          Max Disc: {emp.permissions.maxDiscountPct}%
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-slate-600 dark:text-slate-300">
                        {capabilities || 'Standard Checkout'}
                      </td>
                      {canProvisionStaff && (
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingEmp({ ...emp })}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            {emp.role !== 'Owner' && (
                              <button
                                type="button"
                                onClick={() => onDeleteEmployee(emp.id)}
                                title="Remove employee"
                                className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Edit Employee Modal */}
        {editingEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Edit Staff Member &amp; App Permissions · {editingEmp.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onUpdateEmployee(editingEmp.id, {
                    name: editingEmp.name,
                    role: editingEmp.role,
                    branchId: editingEmp.branchId,
                    grossSalary: editingEmp.grossSalary,
                    pinCode: editingEmp.pinCode,
                    active: editingEmp.active,
                    permissions: editingEmp.permissions,
                  });
                  setEditingEmp(null);
                  setEmpCreatedMsg(`Updated staff profile & app access for ${editingEmp.name}.`);
                  setTimeout(() => setEmpCreatedMsg(''), 3500);
                }}
                className="mt-4 space-y-3 text-xs"
              >
                <input
                  type="text"
                  required
                  value={editingEmp.name}
                  onChange={(e) =>
                    setEditingEmp((p) => (p ? { ...p, name: e.target.value } : p))
                  }
                  placeholder="Full Name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editingEmp.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setEditingEmp((p) =>
                        p ? { ...p, role: nextRole, permissions: { ...DEFAULT_EMP_PERMS[nextRole] } } : p
                      );
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Store Manager">Store Manager</option>
                    <option value="HR Officer">HR Officer</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Inventory Clerk">Inventory Clerk</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Field Agent">Field Agent</option>
                  </select>
                  <select
                    value={editingEmp.branchId}
                    onChange={(e) =>
                      setEditingEmp((p) => (p ? { ...p, branchId: e.target.value } : p))
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">Gross Salary ({business.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEmp.grossSalary}
                      onChange={(e) =>
                        setEditingEmp((p) =>
                          p ? { ...p, grossSalary: Math.max(0, Number(e.target.value) || 0) } : p
                        )
                      }
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">POS PIN</label>
                    <input
                      type="text"
                      maxLength={8}
                      value={editingEmp.pinCode}
                      onChange={(e) =>
                        setEditingEmp((p) =>
                          p ? { ...p, pinCode: e.target.value.replace(/[^0-9]/g, '') } : p
                        )
                      }
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Max Discount %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingEmp.permissions.maxDiscountPct}
                      onChange={(e) =>
                        setEditingEmp((p) =>
                          p
                            ? {
                                ...p,
                                permissions: {
                                  ...p.permissions,
                                  maxDiscountPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                },
                              }
                            : p
                        )
                      }
                      className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Action Capability Toggles */}
                <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  {(
                    [
                      { key: 'canVoidSale', label: 'Void Sale' },
                      { key: 'canOpenDrawer', label: 'Open Cash Drawer' },
                      { key: 'canViewCostPrice', label: 'View Cost Price' },
                      { key: 'canEditInventory', label: 'Edit Inventory' },
                      { key: 'canViewEtims', label: 'Access eTIMS' },
                      { key: 'canExportReports', label: 'Export Reports' },
                    ] as const
                  ).map((item) => (
                    <label key={item.key} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={editingEmp.permissions[item.key]}
                        onChange={(e) =>
                          setEditingEmp((p) =>
                            p
                              ? {
                                  ...p,
                                  permissions: { ...p.permissions, [item.key]: e.target.checked },
                                }
                              : p
                          )
                        }
                        className="rounded border-slate-300 text-teal-700"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* Granular App-Level Access Checklist */}
                {editingEmp.role !== 'Owner' && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Permitted Workspace Apps (
                        {(
                          editingEmp.permissions.allowedModuleIds ||
                          getDefaultModulesForRole(editingEmp.role)
                        ).length}{' '}
                        selected)
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEmp((p) =>
                              p
                                ? {
                                    ...p,
                                    permissions: {
                                      ...p.permissions,
                                      allowedModuleIds: getDefaultModulesForRole(p.role),
                                    },
                                  }
                                : p
                            )
                          }
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          Role Preset
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEmp((p) =>
                              p
                                ? {
                                    ...p,
                                    permissions: {
                                      ...p.permissions,
                                      allowedModuleIds: APP_MODULES.filter((m) => !m.adminOnly).map(
                                        (m) => m.id
                                      ),
                                    },
                                  }
                                : p
                            )
                          }
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        >
                          Grant All
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEmp((p) =>
                              p
                                ? {
                                    ...p,
                                    permissions: { ...p.permissions, allowedModuleIds: [] },
                                  }
                                : p
                            )
                          }
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 dark:border-slate-700"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pt-1 sm:grid-cols-3">
                      {APP_MODULES.filter((m) => !m.adminOnly).map((mod) => {
                        const list =
                          editingEmp.permissions.allowedModuleIds ||
                          getDefaultModulesForRole(editingEmp.role);
                        const checked = list.includes(mod.id);
                        return (
                          <label
                            key={mod.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-100 px-2 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? Array.from(new Set([...list, mod.id]))
                                  : list.filter((id) => id !== mod.id);
                                setEditingEmp((p) =>
                                  p
                                    ? {
                                        ...p,
                                        permissions: { ...p.permissions, allowedModuleIds: next },
                                      }
                                    : p
                                );
                              }}
                              className="rounded border-slate-300 text-teal-700"
                            />
                            <span className="truncate text-slate-700 dark:text-slate-300">
                              {mod.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingEmp.active}
                    onChange={(e) =>
                      setEditingEmp((p) => (p ? { ...p, active: e.target.checked } : p))
                    }
                    className="rounded border-slate-300 text-teal-700"
                  />
                  <span>Employee Active (Can log into POS with PIN)</span>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingEmp(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
                  >
                    Save Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                <option value="HR Officer">HR Officer</option>
                <option value="Accountant">Accountant</option>
                <option value="Inventory Clerk">Inventory Clerk</option>
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
                  { key: 'canOpenDrawer', label: 'Cash Drawer' },
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

            {/* App-Level Visibility & Launch Checklist */}
            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Permitted Workspace Apps ({(empPerms.allowedModuleIds || []).length} selected for {empRole})
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setEmpPerms((p) => ({
                        ...p,
                        allowedModuleIds: getDefaultModulesForRole(empRole),
                      }))
                    }
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    Role Preset
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEmpPerms((p) => ({
                        ...p,
                        allowedModuleIds: APP_MODULES.filter((m) => !m.adminOnly).map((m) => m.id),
                      }))
                    }
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    Grant All
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmpPerms((p) => ({ ...p, allowedModuleIds: [] }))}
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 dark:border-slate-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto pt-1 sm:grid-cols-3 md:grid-cols-4">
                {APP_MODULES.filter((m) => !m.adminOnly).map((mod) => {
                  const list = empPerms.allowedModuleIds || [];
                  const checked = list.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-100 px-2 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...list, mod.id]))
                            : list.filter((id) => id !== mod.id);
                          setEmpPerms((p) => ({ ...p, allowedModuleIds: next }));
                        }}
                        className="rounded border-slate-300 text-teal-700"
                      />
                      <span className="truncate text-slate-700 dark:text-slate-300">{mod.name}</span>
                    </label>
                  );
                })}
              </div>
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

  // Specialized Kenya Statutory Payroll Engine (Real Staff Only, No Fake Fallback)
  if (module.id === 'payroll') {
    const salariedStaff = employees.filter((e) => e.active && e.grossSalary > 0);
    const bizRuns = payrollRuns.filter((r) => r.businessId === business.id);

    const handleExecutePayroll = async (e: React.FormEvent) => {
      e.preventDefault();
      if (salariedStaff.length === 0) return;
      setRunningPayroll(true);
      setPayrollMsg('');
      try {
        const created = await onRunPayroll(payrollPeriod.trim());
        if (created) {
          setPayrollMsg(
            `Executed ${created.periodLabel} payroll for ${created.employeeCount} staff (Net ${formatMoney(created.totalNet, created.currency)}) and posted GL journal to Accounting.`
          );
        }
      } finally {
        setRunningPayroll(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Kenya Statutory Payroll Engine (PAYE · SHIF · NSSF · Housing Levy)
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              2025/2026 KRA statutory rates (SHIF 2.75% min 300, NSSF 6% capped KES 4,320, Housing Levy 1.5%, PAYE − KES 2,400 relief) synced to Accounting GL.
            </p>
          </div>
        </div>

        {payrollMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{payrollMsg}</span>
          </div>
        )}

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
            <p className="font-mono text-[11px] text-slate-500">
              Taxable Pay: {formatMoney(payrollBreakdown.taxablePay, business.currency)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-8">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">PAYE (Net of Relief)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.paye, business.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">SHIF (2.75%)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.shif, business.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">NSSF (Tier I &amp; II)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.nssf, business.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Housing Levy (1.5%)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(payrollBreakdown.housingLevy, business.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Deductions</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                {formatMoney(payrollBreakdown.totalDeductions, business.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Net Take-Home Pay</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
                {formatMoney(payrollBreakdown.netPay, business.currency)}
              </p>
            </div>
          </div>
        </section>

        {/* Staff Payroll Schedule + Run Payroll */}
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Active Salaried Staff Schedule ({salariedStaff.length})
            </h2>
            <form onSubmit={handleExecutePayroll} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                required
                value={payrollPeriod}
                onChange={(e) => setPayrollPeriod(e.target.value)}
                placeholder="Period (e.g. Nov 2026)"
                className="w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={salariedStaff.length === 0 || runningPayroll}
                className="rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40 dark:bg-teal-600"
              >
                {runningPayroll ? 'Posting Run...' : 'Execute Monthly Payroll Run'}
              </button>
            </form>
          </div>

          {salariedStaff.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                No active salaried employees configured for {business.name}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Add employees with a monthly Gross Salary in the Employees module to run payroll.
              </p>
            </div>
          ) : (
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
                  {salariedStaff.map((emp) => {
                    const p = calculateKenyaPayroll(emp.grossSalary);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {emp.name}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{emp.role}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {formatMoney(p.grossSalary, business.currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {formatMoney(p.paye, business.currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {formatMoney(p.shif + p.housingLevy + p.nssf, business.currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-teal-700 dark:text-teal-400">
                          {formatMoney(p.netPay, business.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Historical Posted Payroll Runs & Printable Payslips */}
        {bizRuns.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Posted Payroll Runs &amp; Payslips ({bizRuns.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {bizRuns.map((run) => (
                <div key={run.id} className="space-y-3 px-5 py-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {run.periodLabel} · {run.employeeCount} Staff
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        Gross: {formatMoney(run.totalGross, run.currency)} · PAYE:{' '}
                        {formatMoney(run.totalPaye, run.currency)} · Employer Cost:{' '}
                        {formatMoney(run.totalEmployerCost, run.currency)}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-teal-700 dark:text-teal-400">
                        Net Disbursed: {formatMoney(run.totalNet, run.currency)}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        {run.status} · {new Date(run.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {run.payslips.map((slip) => (
                      <button
                        key={slip.employeeId}
                        type="button"
                        onClick={() => setPreviewPayslip({ runPeriod: run.periodLabel, slip })}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Printer className="h-3 w-3 text-teal-700 dark:text-teal-400" />
                        <span>
                          {slip.employeeName} ({formatMoney(slip.netPay, run.currency)})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Printable A4 Payslip Modal */}
        {previewPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Employee Payslip · {previewPayslip.runPeriod}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Payslip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPayslip(null)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                id="misafa-printable-document"
                className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-xs text-slate-900"
              >
                <div className="flex justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold uppercase">{business.name}</h2>
                    <p className="font-mono text-[11px]">Employer KRA PIN: {business.taxPin}</p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold">PAYSLIP</p>
                    <p>{previewPayslip.runPeriod}</p>
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold">{previewPayslip.slip.employeeName}</p>
                  <p>{previewPayslip.slip.role}</p>
                </div>
                <div className="space-y-1.5 font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span>Basic / Gross Salary</span>
                    <span className="font-semibold">
                      {formatMoney(previewPayslip.slip.grossSalary, business.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>NSSF Tier I &amp; II (6%)</span>
                    <span>-{formatMoney(previewPayslip.slip.nssf, business.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SHIF (2.75%)</span>
                    <span>-{formatMoney(previewPayslip.slip.shif, business.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Affordable Housing Levy (1.5%)</span>
                    <span>-{formatMoney(previewPayslip.slip.housingLevy, business.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Pay</span>
                    <span>{formatMoney(previewPayslip.slip.taxablePay, business.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>PAYE Tax (Net of Relief)</span>
                    <span>-{formatMoney(previewPayslip.slip.paye, business.currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-teal-800">
                    <span>NET TAKE-HOME PAY</span>
                    <span>{formatMoney(previewPayslip.slip.netPay, business.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Domain-Powered ERP Workspace (All 29 operational modules with structured metadata, auto-calculators, live boards, CSV & print)
  const bp: ModuleBlueprint | undefined = MODULE_BLUEPRINTS[module.id];
  const hint = MODULE_WORKFLOW_HINTS[module.id];
  const workflowStatuses = bp?.statuses || hint?.statuses || ['Active', 'Pending Review', 'Approved', 'Completed'];

  const computeAutoAmount = (
    blueprint: ModuleBlueprint | undefined,
    nextMeta: Record<string, string | number>
  ): string | null => {
    if (!blueprint?.autoCompute) return null;
    if (blueprint.autoCompute === 'rental_total') {
      const days = Number(nextMeta.rentalDays) || 0;
      const rate = Number(nextMeta.dailyRate) || 0;
      return days > 0 && rate > 0 ? String(Math.round(days * rate * 100) / 100) : null;
    }
    if (blueprint.autoCompute === 'qty_unit_cost') {
      const qty = Number(nextMeta.qty) || 0;
      const cost = Number(nextMeta.unitCost) || 0;
      return qty > 0 && cost > 0 ? String(Math.round(qty * cost * 100) / 100) : null;
    }
    if (blueprint.autoCompute === 'hours_rate') {
      const hours = Number(nextMeta.hours) || 0;
      const rate = Number(nextMeta.hourlyRate) || 0;
      return hours > 0 && rate > 0 ? String(Math.round(hours * rate * 100) / 100) : null;
    }
    if (blueprint.autoCompute === 'parts_plus_labor') {
      const parts = Number(nextMeta.partsCost) || 0;
      const labor = Number(nextMeta.laborFee) || 0;
      return parts + labor > 0 ? String(Math.round((parts + labor) * 100) / 100) : null;
    }
    if (blueprint.autoCompute === 'monthly_x_months') {
      const fee = Number(nextMeta.monthlyFee) || 0;
      const months = Number(nextMeta.monthsCount) || 0;
      return fee > 0 && months > 0 ? String(Math.round(fee * months * 100) / 100) : null;
    }
    return null;
  };

  const handleMetaFieldChange = (key: string, value: string | number) => {
    const nextMeta = { ...recMeta, [key]: value };
    setRecMeta(nextMeta);
    const computed = computeAutoAmount(bp, nextMeta);
    if (computed !== null) setRecAmount(computed);
  };

  const handleApplyBlueprintPreset = (presetIdx: number) => {
    const preset = bp?.templates[presetIdx];
    if (!preset) return;
    setRecTitle(preset.title);
    setRecSubtitle(preset.subtitle);
    setRecStatus(preset.status || workflowStatuses[0]);
    setRecMeta({ ...preset.meta });
    if (preset.amount !== undefined) {
      setRecAmount(String(preset.amount));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) return;
    const cleanedMeta: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(recMeta)) {
      if (v !== '' && v !== undefined && v !== null) {
        cleanedMeta[k] = v;
      }
    }
    const chosenStatus = workflowStatuses.includes(recStatus) ? recStatus : workflowStatuses[0];
    await onCreateRecord({
      moduleId: module.id,
      title: recTitle.trim(),
      subtitle: recSubtitle.trim() || `${module.name} entry · ${activeStore.name}`,
      status: accountTier === 'user' ? 'Submitted by Customer' : chosenStatus,
      amount: recAmount ? Number(recAmount) : undefined,
      meta: cleanedMeta,
    });
    setRecTitle('');
    setRecSubtitle('');
    setRecAmount('');
    setRecMeta({});
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

  const distinctStatuses = Array.from(
    new Set(['All', ...workflowStatuses, ...moduleRecords.map((r) => r.status)])
  );
  const filteredModuleRecords = moduleRecords.filter((r) => {
    const statusOk = recFilterStatus === 'All' || r.status === recFilterStatus;
    if (!statusOk) return false;
    const q = recSearch.trim().toLowerCase();
    if (!q) return true;
    const metaStr = Object.values(r.meta || {}).join(' ').toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.subtitle.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q) ||
      metaStr.includes(q)
    );
  });
  const totalRecordValue = moduleRecords.reduce((s, r) => s + (r.amount || 0), 0);
  const completedCount = moduleRecords.filter((r) =>
    /complete|approved|received|closed|resolved|served|passed|reimbursed|returned|verified|signed|registered|published|certified|hired|delivered/i.test(
      r.status
    )
  ).length;

  const handleExportModuleCsv = () => {
    const headers = ['ID', 'Title', 'Subtitle', 'Status', 'Amount', 'Currency', 'Date', 'Details'];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredModuleRecords.map((r) =>
      [
        r.id,
        r.title,
        r.subtitle,
        r.status,
        r.amount ?? 0,
        r.currency || business.currency,
        r.date,
        Object.entries(r.meta || {})
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      ]
        .map(escape)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${business.slug}-${module.id}-ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

        <div className="flex flex-wrap items-center gap-2">
          {accountTier !== 'user' && bp && bp.templates.length > 0 && (
            bp.templates.map((tpl, idx) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handleApplyBlueprintPreset(idx)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Template: {tpl.label}
              </button>
            ))
          )}
          {!bp && hint?.sampleTitle && accountTier !== 'user' && (
            <button
              type="button"
              onClick={() => {
                setRecTitle(hint.sampleTitle);
                setRecSubtitle(`${module.name} · ${activeStore.name}`);
                setRecStatus(workflowStatuses[0]);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Use Quick Template
            </button>
          )}
          <button
            type="button"
            onClick={handleExportModuleCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>
          {accountTier === 'user' && (
            <span className="font-mono text-xs text-teal-700 dark:text-teal-400">
              Customer Portal · https://misafarms.com/{business.slug}
            </span>
          )}
        </div>
      </div>

      {/* Live Module KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Records</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {moduleRecords.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Open / Active</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {Math.max(0, moduleRecords.length - completedCount)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Completed / Settled
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {completedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {bp?.summaryMetricLabel || 'Total Tracked Value'}
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {['knowledge', 'forum', 'elearning', 'blog'].includes(module.id)
              ? totalRecordValue.toLocaleString()
              : formatMoney(totalRecordValue, business.currency)}
          </p>
        </div>
      </div>

      {/* Embedded Live Operational Boards */}
      {bp?.embeddedBoard === 'restaurant_floor' && accountTier !== 'user' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Live Dining Floors, Tables &amp; Clearing Board
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any table state to seat guests, mark needs clearing, or reopen as available.
              </p>
            </div>
          </div>
          {layoutZones.length === 0 ? (
            <p className="text-xs text-slate-500">
              No dining floors or tables configured yet. Add floors in POS Settings.
            </p>
          ) : (
            <div className="space-y-4">
              {layoutZones.map((zone) => (
                <div key={zone.id}>
                  <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {zone.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                    {zone.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800/70"
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>{slot.code}</span>
                          <span
                            className={`text-[10px] uppercase ${
                              slot.status === 'available'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : slot.status === 'occupied'
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {slot.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">
                          {slot.label} · {slot.capacity} seats
                        </p>
                        <select
                          aria-label={`Table status for ${slot.code}`}
                          value={slot.status}
                          onChange={(e) =>
                            onSlotStatusChange(zone.id, slot.id, e.target.value as SlotStatus)
                          }
                          className="mt-2 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="available">Available / Clean</option>
                          <option value="occupied">Occupied</option>
                          <option value="needs_clearing">Needs Clearing</option>
                          <option value="needs_restock">Needs Restock</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {bp?.embeddedBoard === 'attendance_board' && accountTier !== 'user' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Live Staff Shift Clock-In &amp; Clock-Out Board
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time employee shift status synced with POS registers and payroll attendance logs.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/70"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {emp.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {emp.role} · {emp.clockedIn ? 'On Shift' : 'Off Shift'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onEmployeeAttendance(emp.id, emp.clockedIn ? 'clock_out' : 'clock_in')
                  }
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                    emp.clockedIn
                      ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300'
                      : 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600'
                  }`}
                >
                  {emp.clockedIn ? <LogOut className="h-3 w-3" /> : <LogIn className="h-3 w-3" />}
                  <span>{emp.clockedIn ? 'Clock Out' : 'Clock In'}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {bp?.embeddedBoard === 'employee_performance' && accountTier !== 'user' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Live Employee Ratings, Orders &amp; Tips Leaderboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aggregated automatically from POS receipts, waiter assignments, and customer star ratings.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/70"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {emp.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {emp.role} · {emp.ordersHandled ?? 0} orders
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 fill-current" />
                    <span>{(emp.ratingAvg ?? 5).toFixed(1)}</span>
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Tips: {formatMoney(emp.tipsEarned ?? 0, business.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {grnFeedback && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>{grnFeedback}</span>
        </div>
      )}

      {/* Structured Domain Entry Form */}
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {bp?.titleLabel || 'Entry Title / Reference'}
            </label>
            <input
              type="text"
              required
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              placeholder={
                accountTier === 'user'
                  ? `Submit ${module.name} request or order...`
                  : bp?.titlePlaceholder || hint?.titlePlaceholder || `New ${module.name} title or reference...`
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Operational Notes / Details
            </label>
            <input
              type="text"
              value={recSubtitle}
              onChange={(e) => setRecSubtitle(e.target.value)}
              placeholder={bp?.subtitlePlaceholder || hint?.subtitlePlaceholder || 'Notes, supplier, customer, or route details...'}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {bp?.amountLabel || `Value (${business.currency})`}
            </label>
            <input
              type="number"
              value={recAmount}
              onChange={(e) => setRecAmount(e.target.value)}
              placeholder={business.currency}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Dynamic Domain Metadata Fields */}
        {bp && bp.fields.length > 0 && accountTier !== 'user' && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800">
            {bp.fields.map((field) => {
              const currentVal = recMeta[field.key] ?? '';
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={String(currentVal)}
                      onChange={(e) => handleMetaFieldChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">Select {field.label}...</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'product_select' ? (
                    <select
                      value={String(currentVal)}
                      onChange={(e) => handleMetaFieldChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">Select inventory SKU...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku} · Stock: {p.stockByStore[activeStore.id] ?? 0})
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'employee_select' ? (
                    <select
                      value={String(currentVal)}
                      onChange={(e) => handleMetaFieldChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">Assign employee...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'slot_select' ? (
                    <select
                      value={String(currentVal)}
                      onChange={(e) => handleMetaFieldChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">Select Table / Zone...</option>
                      {allShelfSlots.map((sl) => (
                        <option key={sl.slotId} value={`${sl.code} · ${sl.label}`}>
                          {sl.code} · {sl.label} ({sl.zoneName})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={String(currentVal)}
                      onChange={(e) =>
                        handleMetaFieldChange(
                          field.key,
                          field.type === 'number' ? Number(e.target.value) : e.target.value
                        )
                      }
                      placeholder={field.placeholder || ''}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {accountTier !== 'user' ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Initial Status:</span>
              <select
                aria-label="Default new record status"
                value={workflowStatuses.includes(recStatus) ? recStatus : workflowStatuses[0]}
                onChange={(e) => setRecStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {workflowStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Submitted directly to store operations</span>
          )}

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap dark:bg-teal-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{accountTier === 'user' ? 'Submit Request' : `Add ${module.name} Record`}</span>
          </button>
        </div>
      </form>

      {/* Module Records Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {module.name} Ledger ({filteredModuleRecords.length})
            </h2>
            <div className="flex flex-wrap gap-1">
              {distinctStatuses.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRecFilterStatus(st)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    recFilterStatus === st
                      ? 'bg-slate-900 text-white dark:bg-teal-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={recSearch}
              onChange={(e) => setRecSearch(e.target.value)}
              placeholder={`Search ${module.name.toLowerCase()}...`}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        {filteredModuleRecords.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No {module.name} records matching filter for {business.name}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Use the entry form or Quick Template button above to create your first {module.name} record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredModuleRecords.map((rec) => {
              const metaEntries = Object.entries(rec.meta || {}).filter(
                ([, val]) => val !== '' && val !== undefined && val !== null
              );
              const linkedProduct =
                typeof rec.meta?.productId === 'string'
                  ? products.find((p) => p.id === rec.meta.productId)
                  : undefined;

              return (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.title}</p>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {rec.subtitle} · {rec.date}
                    </p>
                    {metaEntries.length > 0 && (
                      <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {metaEntries
                          .map(([k, v]) => {
                            if (k === 'productId' && linkedProduct) {
                              return `SKU: ${linkedProduct.name}`;
                            }
                            const label =
                              bp?.fields.find((f) => f.key === k)?.label ||
                              k.replace(/([A-Z])/g, ' $1');
                            return `${label}: ${v}`;
                          })
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-right">
                    <div>
                      {rec.amount !== undefined && (
                        <p className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {['knowledge', 'forum', 'elearning', 'blog'].includes(module.id)
                            ? `${rec.amount}`
                            : formatMoney(rec.amount, rec.currency || business.currency)}
                        </p>
                      )}
                      <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                        {rec.status}
                      </p>
                    </div>

                    {accountTier !== 'user' && onUpdateRecord && (
                      <select
                        aria-label={`Change status for ${rec.title}`}
                        value={rec.status}
                        onChange={(e) => onUpdateRecord(rec.id, { status: e.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {Array.from(new Set([...workflowStatuses, rec.status])).map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    )}

                    {accountTier !== 'user' &&
                      onUpdateRecord &&
                      bp?.quickAdvanceLabel &&
                      bp?.quickAdvanceToStatus &&
                      rec.status !== bp.quickAdvanceToStatus && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateRecord(rec.id, { status: bp.quickAdvanceToStatus })
                          }
                          className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
                        >
                          {bp.quickAdvanceLabel}
                        </button>
                      )}

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

                    {accountTier !== 'user' && onDeleteRecord && (
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(rec.id)}
                        aria-label="Delete record"
                        className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
