import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_CATALOG_TAXONOMY,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_PAYMENT_GATEWAYS,
  DEFAULT_POS_CONFIG,
  DEFAULT_PROMO_OFFERS,
  SEED_ATTENDANCE_LOGS,
  SEED_AUDIT_LOGS,
  SEED_AUTOMATIONS,
  SEED_BUSINESSES,
  SEED_EMPLOYEES,
  SEED_ERP_RECORDS,
  SEED_PRODUCTS,
  SEED_STORES,
  SEED_STUDIO_MODELS,
  SEED_TRANSACTIONS,
} from './src/data/seedData';
import {
  AuditLogEntry,
  BusinessEntity,
  EmployeeRecord,
  ErpRecord,
  ProductItem,
  SaleTransaction,
  ShiftAttendanceLog,
  SlotStatus,
  StoreBranch,
  StudioModel,
  UserRole,
  WorkflowAutomation,
} from './src/types/erp';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface ServerDatabase {
  businesses: BusinessEntity[];
  stores: StoreBranch[];
  employees: EmployeeRecord[];
  attendanceLogs: ShiftAttendanceLog[];
  products: ProductItem[];
  transactions: SaleTransaction[];
  studioModels: StudioModel[];
  automations: WorkflowAutomation[];
  auditLogs: AuditLogEntry[];
  erpRecords: ErpRecord[];
  activeSessions: Map<string, { actor: string; role: UserRole; issuedAt: string }>;
}

const db: ServerDatabase = {
  businesses: structuredClone(SEED_BUSINESSES),
  stores: structuredClone(SEED_STORES),
  employees: structuredClone(SEED_EMPLOYEES),
  attendanceLogs: structuredClone(SEED_ATTENDANCE_LOGS),
  products: structuredClone(SEED_PRODUCTS),
  transactions: structuredClone(SEED_TRANSACTIONS),
  studioModels: structuredClone(SEED_STUDIO_MODELS),
  automations: structuredClone(SEED_AUTOMATIONS),
  auditLogs: structuredClone(SEED_AUDIT_LOGS),
  erpRecords: structuredClone(SEED_ERP_RECORDS),
  activeSessions: new Map(),
};

function computeAuditHash(entry: Omit<AuditLogEntry, 'hashPrefix'>): string {
  const prevHash = db.auditLogs[0]?.hashPrefix || 'genesis';
  const digest = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${prevHash}|${entry.timestamp}|${entry.actor}|${entry.action}`)
    .digest('hex');
  return `sha256:${digest.slice(0, 10)}`;
}

function appendAudit(params: {
  actor: string;
  role: UserRole;
  action: string;
  module: string;
  storeName: string;
  ipOrDevice?: string;
  emailNotified?: boolean;
  recipientEmail?: string;
}) {
  const timestamp = new Date().toISOString();
  const base: Omit<AuditLogEntry, 'hashPrefix'> = {
    id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    timestamp,
    actor: params.actor,
    role: params.role,
    action: params.action,
    module: params.module,
    storeName: params.storeName,
    ipOrDevice: params.ipOrDevice || 'Web Terminal',
    emailNotified: Boolean(params.emailNotified),
    recipientEmail: params.recipientEmail,
  };
  const entry: AuditLogEntry = {
    ...base,
    hashPrefix: computeAuditHash(base),
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 200) db.auditLogs.pop();
  return entry;
}

const ROLE_MAX_DISCOUNT: Record<UserRole, number> = {
  Owner: 100,
  'Store Manager': 25,
  Cashier: 5,
  'Inventory Clerk': 0,
  Accountant: 0,
  'Field Agent': 10,
};

function isValidRole(role: unknown): role is UserRole {
  return (
    typeof role === 'string' &&
    ['Owner', 'Store Manager', 'Cashier', 'Inventory Clerk', 'Accountant', 'Field Agent'].includes(
      role
    )
  );
}

function sanitizeText(val: unknown, maxLen = 160): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'MisafaRMS Enterprise API',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/auth/session', (req: Request, res: Response) => {
    const actor = sanitizeText(req.body?.actor, 80) || 'Amina Hassan';
    const role: UserRole = isValidRole(req.body?.role) ? req.body.role : 'Owner';
    const token = crypto.randomBytes(24).toString('hex');
    db.activeSessions.set(token, {
      actor,
      role,
      issuedAt: new Date().toISOString(),
    });
    res.json({ token, actor, role });
  });

  app.get('/api/workspace', (_req: Request, res: Response) => {
    res.json({
      businesses: db.businesses,
      stores: db.stores,
      employees: db.employees,
      attendanceLogs: db.attendanceLogs,
      products: db.products,
      transactions: db.transactions,
      studioModels: db.studioModels,
      automations: db.automations,
      auditLogs: db.auditLogs,
      erpRecords: db.erpRecords,
    });
  });

  app.post('/api/businesses', (req: Request, res: Response) => {
    const name = sanitizeText(req.body?.name, 100);
    const country = req.body?.country;
    const currency = req.body?.currency;
    const taxPin = sanitizeText(req.body?.taxPin, 40) || 'P051000001Z';
    const etimsEnabled = Boolean(req.body?.etimsEnabled);
    const etimsMode = req.body?.etimsMode === 'VSCU' ? 'VSCU' : etimsEnabled ? 'OSCU' : 'Standard';
    const paybillOrTill = sanitizeText(req.body?.paybillOrTill, 80) || 'Till 500100';
    const branchName = sanitizeText(req.body?.branchName, 80) || 'Main Branch';
    const branchLocation = sanitizeText(req.body?.branchLocation, 100) || 'Nairobi CBD';
    const vatRate = Number.isFinite(Number(req.body?.vatRate)) ? Number(req.body.vatRate) : 16;

    if (!name || !['KE', 'UG', 'TZ', 'GB', 'US'].includes(country)) {
      res.status(400).json({ error: 'Valid business name and country are required.' });
      return;
    }

    const bizId = `biz-${crypto.randomUUID().slice(0, 8)}`;
    const slug =
      sanitizeText(req.body?.slug, 64)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-') ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32) ||
      bizId;

    const newBiz: BusinessEntity = {
      id: bizId,
      slug,
      name,
      country,
      currency: ['KES', 'UGX', 'TZS', 'GBP', 'USD'].includes(currency) ? currency : 'KES',
      taxAuthority: country === 'KE' ? 'Kenya Revenue Authority (KRA)' : 'National Tax Authority',
      taxPin,
      vatRate,
      etimsEnabled,
      etimsMode,
      paybillOrTill,
      installedModuleIds: [
        'pos',
        'pos_settings',
        'inventory',
        'invoicing',
        'accounting',
        'purchase',
        'sales',
        'crm',
        'employees',
        'payroll',
        'etims',
        'analytics',
        'field_service',
        'payment_gateways',
        'security',
        'studio',
        'ecommerce',
        'website',
      ],
      posConfig: structuredClone(DEFAULT_POS_CONFIG),
      paymentGateways: structuredClone(DEFAULT_PAYMENT_GATEWAYS),
      layoutConfig: structuredClone(DEFAULT_LAYOUT_CONFIG),
      catalogTaxonomy: structuredClone(DEFAULT_CATALOG_TAXONOMY),
      offers: structuredClone(DEFAULT_PROMO_OFFERS),
      createdAt: new Date().toISOString(),
    };

    const storeId = `store-${crypto.randomUUID().slice(0, 8)}`;
    const newStore: StoreBranch = {
      id: storeId,
      businessId: bizId,
      name: branchName,
      code: `${name.slice(0, 3).toUpperCase()}-01`,
      location: branchLocation,
      etimsBhfId: '00',
      vscuSerial: etimsEnabled ? `KRA-${etimsMode}-${Math.floor(10000 + Math.random() * 89999)}` : 'STD-POS-01',
      tillNumber: paybillOrTill,
      registerId: 'REG-01',
      isActive: true,
    };

    const starterEmployees: EmployeeRecord[] = [
      {
        id: `emp-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        name: sanitizeText(req.body?.ownerName, 80) || 'Business Admin',
        email: sanitizeText(req.body?.ownerEmail, 120) || `admin@${slug}.misafarms.com`,
        role: 'Store Manager',
        pinCode: '1234',
        branchId: storeId,
        grossSalary: 120000,
        active: true,
        permissions: {
          maxDiscountPct: 25,
          canVoidSale: true,
          canOpenDrawer: true,
          canViewCostPrice: true,
          canEditInventory: true,
          canViewEtims: true,
          canExportReports: true,
          canManagePayments: true,
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: `emp-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        name: 'Front Desk Cashier',
        email: `cashier@${slug}.misafarms.com`,
        role: 'Cashier',
        pinCode: '2026',
        branchId: storeId,
        grossSalary: 42000,
        active: true,
        permissions: {
          maxDiscountPct: 5,
          canVoidSale: false,
          canOpenDrawer: true,
          canViewCostPrice: false,
          canEditInventory: false,
          canViewEtims: false,
          canExportReports: false,
          canManagePayments: false,
        },
        createdAt: new Date().toISOString(),
      },
    ];

    const starterProducts: ProductItem[] = [
      {
        id: `prod-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        sku: 'STR-COF-001',
        barcode: `6169${Math.floor(10000000 + Math.random() * 89999999)}`,
        name: 'Signature Roast Coffee 340g',
        category: 'Beverages',
        price: newBiz.currency === 'KES' ? 1200 : 14,
        cost: newBiz.currency === 'KES' ? 750 : 7,
        taxCode: 'B_16',
        unit: 'Pouch',
        reorderPoint: 15,
        imageUrl: '/src/assets/images/pos_coffee_beans_1795366673842.jpg',
        stockByStore: { [storeId]: 50 },
      },
      {
        id: `prod-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        sku: 'STR-OIL-002',
        barcode: `6169${Math.floor(10000000 + Math.random() * 89999999)}`,
        name: 'Cold-Pressed Cooking Oil 500ml',
        category: 'Pantry',
        price: newBiz.currency === 'KES' ? 980 : 11,
        cost: newBiz.currency === 'KES' ? 620 : 6,
        taxCode: 'B_16',
        unit: 'Bottle',
        reorderPoint: 15,
        imageUrl: '/src/assets/images/pos_olive_oil_1795366674395.jpg',
        stockByStore: { [storeId]: 40 },
      },
      {
        id: `prod-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        sku: 'STR-STA-003',
        barcode: `6169${Math.floor(10000000 + Math.random() * 89999999)}`,
        name: 'Essential Household Pack',
        category: 'Staples',
        price: newBiz.currency === 'KES' ? 250 : 4,
        cost: newBiz.currency === 'KES' ? 190 : 2.5,
        taxCode: 'E_0',
        unit: 'Pack',
        reorderPoint: 25,
        stockByStore: { [storeId]: 120 },
      },
    ];

    db.businesses.push(newBiz);
    db.stores.push(newStore);
    db.employees.push(...starterEmployees);
    db.products.push(...starterProducts);

    appendAudit({
      actor: sanitizeText(req.body?.ownerName, 80) || 'Business Owner',
      role: 'Owner',
      action: `Onboarded "${newBiz.name}" (${slug}.misafarms.com) with branch "${newStore.name}"`,
      module: 'Onboarding Wizard',
      storeName: newStore.name,
      emailNotified: true,
      recipientEmail: sanitizeText(req.body?.ownerEmail, 120) || 'admin@misafarms.co.ke',
    });

    res.status(201).json({
      business: newBiz,
      store: newStore,
      employees: starterEmployees,
      products: starterProducts,
    });
  });

  app.patch('/api/businesses/:id/config', (req: Request, res: Response) => {
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }

    if (Array.isArray(req.body?.installedModuleIds)) {
      biz.installedModuleIds = req.body.installedModuleIds
        .filter((id: unknown) => typeof id === 'string')
        .slice(0, 80);
    }
    if (req.body?.posConfig && typeof req.body.posConfig === 'object') {
      biz.posConfig = { ...biz.posConfig, ...req.body.posConfig };
    }
    if (Array.isArray(req.body?.paymentGateways)) {
      biz.paymentGateways = req.body.paymentGateways.slice(0, 20);
    }
    if (req.body?.layoutConfig && typeof req.body.layoutConfig === 'object') {
      biz.layoutConfig = req.body.layoutConfig;
    }
    if (Array.isArray(req.body?.catalogTaxonomy)) {
      biz.catalogTaxonomy = req.body.catalogTaxonomy.slice(0, 100);
    }
    if (Array.isArray(req.body?.offers)) {
      biz.offers = req.body.offers.slice(0, 100);
    }
    if (typeof req.body?.etimsMode === 'string' && ['OSCU', 'VSCU', 'Standard'].includes(req.body.etimsMode)) {
      biz.etimsMode = req.body.etimsMode as BusinessEntity['etimsMode'];
      biz.etimsEnabled = biz.etimsMode !== 'Standard';
    }
    if (typeof req.body?.taxPin === 'string' && req.body.taxPin.trim()) {
      biz.taxPin = sanitizeText(req.body.taxPin, 40);
    }

    appendAudit({
      actor: 'Business Admin',
      role: 'Owner',
      action: `Updated workspace configuration for ${biz.name}`,
      module: 'Administration',
      storeName: 'Enterprise Global',
    });

    res.json({ business: biz });
  });

  app.post('/api/businesses/:id/slot-status', (req: Request, res: Response) => {
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz || !biz.layoutConfig) {
      res.status(404).json({ error: 'Business layout configuration not found.' });
      return;
    }
    const zoneId = sanitizeText(req.body?.zoneId, 60);
    const slotId = sanitizeText(req.body?.slotId, 60);
    const status = req.body?.status as SlotStatus;
    if (!['available', 'occupied', 'needs_clearing', 'needs_restock'].includes(status)) {
      res.status(400).json({ error: 'Invalid slot status.' });
      return;
    }
    let updatedLabel = '';
    for (const z of biz.layoutConfig.zones) {
      if (zoneId && z.id !== zoneId) continue;
      const slot = z.slots.find((s) => s.id === slotId);
      if (slot) {
        slot.status = status;
        slot.lastUpdatedAt = new Date().toISOString();
        if (typeof req.body?.assignedEmployeeName === 'string') {
          slot.assignedEmployeeName = sanitizeText(req.body.assignedEmployeeName, 80) || undefined;
        }
        if (status === 'available') {
          slot.activeOrderTotal = undefined;
          slot.assignedEmployeeName = undefined;
        } else if (req.body?.activeOrderTotal !== undefined) {
          slot.activeOrderTotal = Number(req.body.activeOrderTotal) || undefined;
        }
        updatedLabel = `${z.name} · ${slot.code}`;
      }
    }
    if (!updatedLabel) {
      res.status(404).json({ error: 'Table or shelf slot not found.' });
      return;
    }
    appendAudit({
      actor: sanitizeText(req.body?.actor, 80) || 'Floor Staff',
      role: 'Cashier',
      action: `Updated ${updatedLabel} status to "${status}"`,
      module: 'POS Floor & Shelves',
      storeName: biz.name,
    });
    res.json({ business: biz });
  });

  app.post('/api/employees/attendance', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const employeeId = sanitizeText(req.body?.employeeId, 60);
    const pinCode = sanitizeText(req.body?.pinCode, 8);
    const action = req.body?.action === 'clock_out' ? 'clock_out' : 'clock_in';
    const note = sanitizeText(req.body?.note, 140);

    const emp = db.employees.find(
      (e) =>
        e.businessId === businessId &&
        (employeeId ? e.id === employeeId : pinCode ? e.pinCode === pinCode : false)
    );
    if (!emp) {
      res.status(404).json({ error: 'Employee not found for attendance update.' });
      return;
    }
    const now = new Date().toISOString();
    emp.clockedIn = action === 'clock_in';
    if (action === 'clock_in') emp.lastClockInAt = now;
    else emp.lastClockOutAt = now;

    const log: ShiftAttendanceLog = {
      id: `att-${crypto.randomUUID().slice(0, 8)}`,
      businessId,
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      branchId: emp.branchId,
      action,
      timestamp: now,
      note: note || (action === 'clock_in' ? 'POS Shift Clock-In' : 'POS Shift Clock-Out'),
    };
    db.attendanceLogs.unshift(log);
    if (db.attendanceLogs.length > 200) db.attendanceLogs.pop();

    appendAudit({
      actor: emp.name,
      role: emp.role,
      action: `${action === 'clock_in' ? 'Clocked IN' : 'Clocked OUT'} (${log.note})`,
      module: 'Attendance',
      storeName: db.stores.find((s) => s.id === emp.branchId)?.name || 'Branch',
    });

    res.json({ employee: emp, log, attendanceLogs: db.attendanceLogs.slice(0, 60) });
  });

  app.post('/api/employees/rate', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const employeeName = sanitizeText(req.body?.employeeName, 100);
    const transactionId = sanitizeText(req.body?.transactionId, 60);
    const rating = Math.max(1, Math.min(5, Math.round(Number(req.body?.rating) || 5)));

    const emp = db.employees.find(
      (e) => e.businessId === businessId && e.name.toLowerCase() === employeeName.toLowerCase()
    );
    if (emp) {
      const prevCount = emp.ratingCount ?? 0;
      const prevAvg = emp.ratingAvg ?? 5;
      const nextCount = prevCount + 1;
      emp.ratingAvg = Math.round(((prevAvg * prevCount + rating) / nextCount) * 100) / 100;
      emp.ratingCount = nextCount;
    }
    const tx = db.transactions.find((t) => t.id === transactionId);
    if (tx) {
      tx.staffRating = rating;
    }

    res.json({ employee: emp || null, transaction: tx || null });
  });

  app.post('/api/employees', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const name = sanitizeText(req.body?.name, 100);
    const email = sanitizeText(req.body?.email, 160);
    const role: UserRole = isValidRole(req.body?.role) ? req.body.role : 'Cashier';
    const pinCode = sanitizeText(req.body?.pinCode, 8).replace(/[^0-9]/g, '') || '1122';
    const branchId = sanitizeText(req.body?.branchId, 60);
    const grossSalary = Math.max(0, Number(req.body?.grossSalary) || 45000);

    if (!businessId || !name || pinCode.length < 4) {
      res.status(400).json({ error: 'Business ID, employee name, and 4+ digit PIN required.' });
      return;
    }

    const emp: EmployeeRecord = {
      id: `emp-${crypto.randomUUID().slice(0, 8)}`,
      businessId,
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@misafarms.com`,
      role,
      pinCode,
      branchId: branchId || db.stores.find((s) => s.businessId === businessId)?.id || 'store-nbo-cbd',
      grossSalary,
      active: true,
      permissions: req.body?.permissions || {
        maxDiscountPct: ROLE_MAX_DISCOUNT[role],
        canVoidSale: role === 'Owner' || role === 'Store Manager',
        canOpenDrawer: role === 'Cashier' || role === 'Store Manager' || role === 'Owner',
        canViewCostPrice: role !== 'Cashier' && role !== 'Field Agent',
        canEditInventory: role === 'Owner' || role === 'Store Manager' || role === 'Inventory Clerk',
        canViewEtims: role === 'Owner' || role === 'Store Manager' || role === 'Accountant',
        canExportReports: role === 'Owner' || role === 'Store Manager' || role === 'Accountant',
        canManagePayments: role === 'Owner',
      },
      createdAt: new Date().toISOString(),
    };

    db.employees.push(emp);
    appendAudit({
      actor: 'Business Admin',
      role: 'Owner',
      action: `Provisioned Employee "${emp.name}" (${emp.role}, PIN ****)`,
      module: 'Employees',
      storeName: 'HR Directory',
    });

    res.status(201).json({ employee: emp });
  });

  app.post('/api/stores', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const name = sanitizeText(req.body?.name, 80);
    const location = sanitizeText(req.body?.location, 100);
    const tillNumber = sanitizeText(req.body?.tillNumber, 40) || '849299';
    const business = db.businesses.find((b) => b.id === businessId);
    if (!business || !name) {
      res.status(400).json({ error: 'Valid businessId and branch name required.' });
      return;
    }

    const branchCount = db.stores.filter((s) => s.businessId === businessId).length;
    const store: StoreBranch = {
      id: `store-${crypto.randomUUID().slice(0, 8)}`,
      businessId,
      name,
      code: `BR-${String(branchCount + 1).padStart(2, '0')}`,
      location: location || 'Kenya',
      etimsBhfId: String(branchCount).padStart(2, '0'),
      vscuSerial: business.etimsEnabled
        ? `KRA-${business.etimsMode}-${Math.floor(10000 + Math.random() * 89999)}`
        : 'STD-POS',
      tillNumber,
      registerId: `REG-0${branchCount + 1}`,
      isActive: true,
    };

    db.stores.push(store);
    for (const p of db.products) {
      if (p.businessId === businessId) {
        p.stockByStore[store.id] = p.stockByStore[store.id] ?? 10;
      }
    }

    appendAudit({
      actor: 'Operations Director',
      role: 'Owner',
      action: `Added branch "${store.name}" (${store.etimsBhfId}) to ${business.name}`,
      module: 'Multi-Store Admin',
      storeName: store.name,
      emailNotified: true,
      recipientEmail: 'ops@misafatech.misafarms.com',
    });

    res.status(201).json({ store });
  });

  app.post('/api/products', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const name = sanitizeText(req.body?.name, 120);
    const sku = sanitizeText(req.body?.sku, 40) || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const barcode =
      sanitizeText(req.body?.barcode, 40) || `61611${Math.floor(1000000 + Math.random() * 8999999)}`;
    const category = sanitizeText(req.body?.category, 50) || 'General';
    const subCategory = sanitizeText(req.body?.subCategory, 50) || undefined;
    const zoneId = sanitizeText(req.body?.zoneId, 60) || undefined;
    const slotId = sanitizeText(req.body?.slotId, 60) || undefined;
    const shelfCode = sanitizeText(req.body?.shelfCode, 60) || undefined;
    const price = Number(req.body?.price);
    const cost = Number(req.body?.cost) || Math.round(price * 0.72);
    const initialQty = Math.max(0, Math.floor(Number(req.body?.initialQty) || 0));
    const taxCode = ['B_16', 'E_0', 'A_EXEMPT'].includes(req.body?.taxCode)
      ? req.body.taxCode
      : 'B_16';

    if (!businessId || !name || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Valid businessId, product name, and positive price required.' });
      return;
    }

    const stockByStore: Record<string, number> = {};
    for (const s of db.stores.filter((st) => st.businessId === businessId)) {
      stockByStore[s.id] = s.id === storeId ? initialQty : 0;
    }

    const product: ProductItem = {
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      businessId,
      sku,
      barcode,
      name,
      category,
      subCategory,
      zoneId,
      slotId,
      shelfCode,
      price,
      cost,
      taxCode,
      unit: sanitizeText(req.body?.unit, 20) || 'Unit',
      reorderPoint: Math.max(1, Math.floor(Number(req.body?.reorderPoint) || 10)),
      stockByStore,
    };

    db.products.unshift(product);
    appendAudit({
      actor: 'Inventory Clerk',
      role: 'Inventory Clerk',
      action: `Created SKU ${product.sku} (${product.name})`,
      module: 'Inventory',
      storeName: db.stores.find((s) => s.id === storeId)?.name || 'Catalog',
    });

    res.status(201).json({ product });
  });

  app.post('/api/inventory/transfer', (req: Request, res: Response) => {
    const productId = sanitizeText(req.body?.productId, 60);
    const fromStoreId = sanitizeText(req.body?.fromStoreId, 60);
    const toStoreId = sanitizeText(req.body?.toStoreId, 60);
    const qty = Math.floor(Number(req.body?.qty));

    if (!productId || !fromStoreId || !toStoreId || fromStoreId === toStoreId || qty <= 0) {
      res.status(400).json({ error: 'Invalid stock transfer parameters.' });
      return;
    }

    const product = db.products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const currentSource = product.stockByStore[fromStoreId] ?? 0;
    if (currentSource < qty) {
      res.status(400).json({ error: `Insufficient stock in source branch (${currentSource} available).` });
      return;
    }

    product.stockByStore[fromStoreId] = currentSource - qty;
    product.stockByStore[toStoreId] = (product.stockByStore[toStoreId] ?? 0) + qty;

    const fromName = db.stores.find((s) => s.id === fromStoreId)?.name || fromStoreId;
    const toName = db.stores.find((s) => s.id === toStoreId)?.name || toStoreId;

    appendAudit({
      actor: 'Branch Operations',
      role: 'Store Manager',
      action: `Transferred ${qty}x ${product.sku} from ${fromName} to ${toName}`,
      module: 'Inventory',
      storeName: fromName,
      emailNotified: true,
      recipientEmail: 'warehouse@misafatech.misafarms.com',
    });

    res.json({ product });
  });

  function processSingleSale(payload: any): { transaction?: SaleTransaction; error?: string } {
    const businessId = sanitizeText(payload?.businessId, 60);
    const storeId = sanitizeText(payload?.storeId, 60);
    const role: UserRole = isValidRole(payload?.cashierRole) ? payload.cashierRole : 'Cashier';
    const business = db.businesses.find((b) => b.id === businessId);
    const store = db.stores.find((s) => s.id === storeId && s.businessId === businessId);

    if (!business || !store) {
      return { error: 'Valid business and store branch required.' };
    }

    const items = Array.isArray(payload?.lines) ? payload.lines : [];
    if (items.length === 0) {
      return { error: 'At least one cart line is required.' };
    }

    const maxAllowedDiscount = ROLE_MAX_DISCOUNT[role] ?? 5;
    let subtotal = 0;
    let discountTotal = 0;
    let taxAmount = 0;
    const computedLines: SaleTransaction['lines'] = [];

    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId && p.businessId === businessId);
      const qty = Number(item.qty);
      const discountPct = Math.max(0, Math.min(100, Number(item.discountPct) || 0));

      if (!product || !Number.isFinite(qty) || qty <= 0) {
        return { error: 'Invalid product or quantity in cart.' };
      }
      if (discountPct > maxAllowedDiscount) {
        return {
          error: `Role "${role}" cannot exceed ${maxAllowedDiscount}% line discount without Manager override.`,
        };
      }

      const grossLine = product.price * qty;
      const discAmount = grossLine * (discountPct / 100);
      const netLine = Math.round((grossLine - discAmount) * 100) / 100;
      const vatFraction = product.taxCode === 'B_16' ? business.vatRate / (100 + business.vatRate) : 0;
      const lineTax = Math.round(netLine * vatFraction * 100) / 100;

      subtotal += netLine;
      discountTotal += discAmount;
      taxAmount += lineTax;

      const prevStock = product.stockByStore[store.id] ?? 0;
      product.stockByStore[store.id] = Math.max(0, prevStock - qty);

      computedLines.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        qty,
        unitPrice: product.price,
        discountPct,
        taxCode: product.taxCode,
        lineTotal: netLine,
      });
    }

    const offerName = sanitizeText(payload?.offerName, 100) || undefined;
    const offerDiscount = Math.max(0, Math.min(subtotal, Number(payload?.offerDiscount) || 0));
    const tipAmount = Math.max(0, Number(payload?.tipAmount) || 0);
    const slotId = sanitizeText(payload?.slotId, 60) || undefined;
    const tableOrSlotLabel = sanitizeText(payload?.tableOrSlotLabel, 80) || undefined;

    const discountedSubtotal = Math.max(0, Math.round((subtotal - offerDiscount) * 100) / 100);
    const total = Math.round((discountedSubtotal + tipAmount) * 100) / 100;
    const amountTendered = Math.max(total, Number(payload?.amountTendered) || total);
    const changeDue = Math.round((amountTendered - total) * 100) / 100;
    const seq = String(db.transactions.length + 4913).padStart(6, '0');
    const cuin = business.etimsEnabled
      ? `${store.vscuSerial.slice(0, 14)}-${seq}`
      : `INV-${store.code}-${seq}`;

    const customerEmail = sanitizeText(payload?.customerEmail, 140) || undefined;
    const cashierName = sanitizeText(payload?.cashierName, 80) || 'Active Staff';

    const tx: SaleTransaction = {
      id: sanitizeText(payload?.id, 60) || `tx-${crypto.randomUUID().slice(0, 8)}`,
      receiptNo:
        sanitizeText(payload?.receiptNo, 40) ||
        `${store.code.replace('-', '')}-2026-${seq}`,
      businessId: business.id,
      storeId: store.id,
      storeName: store.name,
      cashierRole: role,
      cashierName,
      customerName: sanitizeText(payload?.customerName, 80) || 'Walk-in Customer',
      customerPin: sanitizeText(payload?.customerPin, 20) || undefined,
      customerPhone: sanitizeText(payload?.customerPhone, 20) || undefined,
      customerEmail,
      emailedTo: customerEmail,
      channel: ['POS', 'Field Agent', 'eCommerce', 'Restaurant'].includes(payload?.channel)
        ? payload.channel
        : 'POS',
      paymentMethod: sanitizeText(payload?.paymentMethod, 60) || 'M-Pesa STK (Daraja)',
      paymentRef:
        sanitizeText(payload?.paymentRef, 40) ||
        `MP${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      currency: business.currency,
      subtotal: discountedSubtotal,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discountTotal: Math.round((discountTotal + offerDiscount) * 100) / 100,
      offerName,
      offerDiscount: offerDiscount > 0 ? Math.round(offerDiscount * 100) / 100 : undefined,
      tipAmount: tipAmount > 0 ? Math.round(tipAmount * 100) / 100 : undefined,
      tableOrSlotLabel,
      total,
      amountTendered,
      changeDue,
      etimsCuin: cuin,
      etimsStatus: 'Transmitted',
      etimsQrData: `https://etims.kra.go.ke/verify?cuin=${encodeURIComponent(cuin)}&pin=${encodeURIComponent(
        business.taxPin
      )}`,
      lines: computedLines,
      createdAt: sanitizeText(payload?.createdAt, 40) || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      encryptedOffline: Boolean(payload?.encryptedOffline),
    };

    db.transactions.unshift(tx);

    // Credit employee tip & completed order performance counter
    const emp = db.employees.find(
      (e) => e.businessId === business.id && e.name.toLowerCase() === cashierName.toLowerCase()
    );
    if (emp) {
      emp.ordersHandled = (emp.ordersHandled ?? 0) + 1;
      if (tipAmount > 0) {
        emp.tipsEarned = Math.round(((emp.tipsEarned ?? 0) + tipAmount) * 100) / 100;
      }
    }

    // Update restaurant floor table status to needs_clearing after payment if applicable
    if (slotId && business.layoutConfig) {
      for (const z of business.layoutConfig.zones) {
        const s = z.slots.find((sl) => sl.id === slotId);
        if (s && z.kind === 'floor' && business.layoutConfig.autoMarkTableNeedsClearing) {
          s.status = 'needs_clearing';
          s.activeOrderTotal = undefined;
          s.lastUpdatedAt = new Date().toISOString();
        }
      }
    }

    // Cross-module sync: Automatically post Accounting General Ledger journal entry!
    db.erpRecords.unshift({
      id: `rec-acc-${crypto.randomUUID().slice(0, 6)}`,
      moduleId: 'accounting',
      businessId: business.id,
      title: `JRNL-${tx.receiptNo} · ${tx.channel} Settlement (${tx.paymentMethod})`,
      subtitle: `Auto-posted from ${tx.channel} · Credit Revenue ${(tx.total - tx.taxAmount).toFixed(2)} & VAT ${tx.taxAmount.toFixed(2)}`,
      status: 'Posted',
      amount: tx.total,
      currency: tx.currency,
      date: tx.createdAt.slice(0, 10),
      meta: { cuin: tx.etimsCuin, store: store.name },
    });

    appendAudit({
      actor: tx.cashierName,
      role: tx.cashierRole,
      action: `${tx.channel} Sale ${tx.receiptNo} (${tx.currency} ${tx.total.toFixed(2)}) · ${tx.paymentMethod} · CUIN ${tx.etimsCuin}`,
      module: tx.channel === 'Field Agent' ? 'Field Service' : 'Point of Sale',
      storeName: store.name,
      emailNotified: Boolean(customerEmail || tx.total >= 25000),
      recipientEmail: customerEmail || (tx.total >= 25000 ? 'finance@misafatech.misafarms.com' : undefined),
    });

    return { transaction: tx };
  }

  app.post('/api/pos/checkout', (req: Request, res: Response) => {
    const result = processSingleSale(req.body);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      transaction: result.transaction,
      businesses: db.businesses,
      employees: db.employees,
      products: db.products,
      auditLogs: db.auditLogs.slice(0, 30),
      erpRecords: db.erpRecords.slice(0, 60),
    });
  });

  app.post('/api/pos/sync-offline', (req: Request, res: Response) => {
    const queue = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
    const synced: SaleTransaction[] = [];
    const errors: string[] = [];

    for (const item of queue) {
      const result = processSingleSale({ ...item, encryptedOffline: true });
      if (result.transaction) {
        synced.push(result.transaction);
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    res.json({
      syncedCount: synced.length,
      synced,
      errors,
      products: db.products,
      auditLogs: db.auditLogs.slice(0, 30),
      erpRecords: db.erpRecords.slice(0, 60),
    });
  });

  app.post('/api/receipts/email', (req: Request, res: Response) => {
    const txId = sanitizeText(req.body?.transactionId, 60);
    const recipientEmail = sanitizeText(req.body?.email, 160);

    if (!recipientEmail || !recipientEmail.includes('@')) {
      res.status(400).json({ error: 'Valid recipient email address is required.' });
      return;
    }

    const tx = db.transactions.find((t) => t.id === txId);
    if (tx) {
      tx.emailedTo = recipientEmail;
      tx.customerEmail = recipientEmail;
    }

    const log = appendAudit({
      actor: tx?.cashierName || 'POS Terminal',
      role: tx?.cashierRole || 'Cashier',
      action: `Emailed fiscal eTIMS receipt ${tx?.receiptNo || txId} (CUIN ${tx?.etimsCuin || 'N/A'}) to ${recipientEmail}`,
      module: 'Email Receipt Dispatch',
      storeName: tx?.storeName || 'POS Terminal',
      emailNotified: true,
      recipientEmail,
    });

    res.json({
      sent: true,
      recipientEmail,
      sentAt: new Date().toISOString(),
      auditLog: log,
    });
  });

  app.post('/api/etims/transmit', (req: Request, res: Response) => {
    const txId = sanitizeText(req.body?.transactionId, 60);
    const tx = db.transactions.find((t) => t.id === txId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    tx.etimsStatus = 'Transmitted';
    tx.syncedAt = new Date().toISOString();
    appendAudit({
      actor: 'Tax Compliance Officer',
      role: 'Accountant',
      action: `Retransmitted eTIMS Invoice ${tx.etimsCuin} to KRA OSCU`,
      module: 'KRA eTIMS Hub',
      storeName: tx.storeName,
    });
    res.json({ transaction: tx });
  });

  app.post('/api/etims/credit-note', (req: Request, res: Response) => {
    const txId = sanitizeText(req.body?.transactionId, 60);
    const reason = sanitizeText(req.body?.reason, 120) || 'Customer Return / Price Adjustment';
    const orig = db.transactions.find((t) => t.id === txId);
    if (!orig) {
      res.status(404).json({ error: 'Original transaction not found.' });
      return;
    }

    const seq = String(db.transactions.length + 4913).padStart(6, '0');
    const cnCuin = `KRA-CN-${seq}`;

    // Restore branch inventory for returned items
    for (const line of orig.lines) {
      const prod = db.products.find((p) => p.id === line.productId);
      if (prod) {
        prod.stockByStore[orig.storeId] = (prod.stockByStore[orig.storeId] ?? 0) + line.qty;
      }
    }

    const creditNote: SaleTransaction = {
      ...structuredClone(orig),
      id: `cn-${crypto.randomUUID().slice(0, 8)}`,
      receiptNo: `CN-${orig.receiptNo}`,
      subtotal: -Math.abs(orig.subtotal),
      taxAmount: -Math.abs(orig.taxAmount),
      total: -Math.abs(orig.total),
      etimsCuin: cnCuin,
      etimsStatus: 'Credit Note',
      referenceCuin: orig.etimsCuin,
      customerName: `${orig.customerName} (${reason})`,
      createdAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    db.transactions.unshift(creditNote);
    appendAudit({
      actor: 'Tax Compliance Officer',
      role: 'Accountant',
      action: `Issued KRA eTIMS Credit Note ${cnCuin} against ${orig.etimsCuin}`,
      module: 'KRA eTIMS Hub',
      storeName: orig.storeName,
      emailNotified: true,
      recipientEmail: 'tax@misafatech.misafarms.com',
    });

    res.status(201).json({ creditNote, products: db.products });
  });

  app.post('/api/purchase/receive', (req: Request, res: Response) => {
    const recordId = sanitizeText(req.body?.recordId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const rec = db.erpRecords.find((r) => r.id === recordId);
    if (!rec) {
      res.status(404).json({ error: 'Purchase order not found.' });
      return;
    }

    rec.status = 'Received (GRN)';
    const productId = String(rec.meta?.productId || '');
    const qty = Number(rec.meta?.qty || 10);
    const prod = db.products.find((p) => p.id === productId);
    if (prod && storeId) {
      prod.stockByStore[storeId] = (prod.stockByStore[storeId] ?? 0) + qty;
    }

    appendAudit({
      actor: 'Inventory Clerk',
      role: 'Inventory Clerk',
      action: `Received GRN for ${rec.title} (+${qty} units to stock)`,
      module: 'Purchase',
      storeName: db.stores.find((s) => s.id === storeId)?.name || 'Warehouse',
    });

    res.json({ record: rec, products: db.products });
  });

  app.post('/api/studio/models', (req: Request, res: Response) => {
    const name = sanitizeText(req.body?.name, 80);
    const category = sanitizeText(req.body?.category, 50) || 'Customizations';
    const description = sanitizeText(req.body?.description, 200);
    const fields = Array.isArray(req.body?.fields) ? req.body.fields : [];

    if (!name || fields.length === 0) {
      res.status(400).json({ error: 'Model name and at least one field are required.' });
      return;
    }

    const model: StudioModel = {
      id: `mod-${crypto.randomUUID().slice(0, 8)}`,
      name,
      technicalName: `x_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      category,
      description: description || 'Custom business data model built in Misafa Studio.',
      fields,
      recordsCount: 0,
    };

    db.studioModels.unshift(model);
    appendAudit({
      actor: 'System Architect',
      role: 'Owner',
      action: `Created Studio model "${model.name}" (${model.technicalName})`,
      module: 'Studio',
      storeName: 'Enterprise Global',
    });

    res.status(201).json({ model });
  });

  app.post('/api/studio/automations', (req: Request, res: Response) => {
    const name = sanitizeText(req.body?.name, 100);
    const trigger = sanitizeText(req.body?.trigger, 80);
    const condition = sanitizeText(req.body?.condition, 120);
    const action = sanitizeText(req.body?.action, 120);

    if (!name || !trigger || !action) {
      res.status(400).json({ error: 'Automation name, trigger, and action are required.' });
      return;
    }

    const automation: WorkflowAutomation = {
      id: `auto-${crypto.randomUUID().slice(0, 8)}`,
      name,
      trigger,
      condition: condition || 'Always',
      action,
      active: true,
      executions: 0,
    };
    db.automations.unshift(automation);
    res.status(201).json({ automation });
  });

  app.post('/api/erp/records', (req: Request, res: Response) => {
    const moduleId = sanitizeText(req.body?.moduleId, 40);
    const businessId = sanitizeText(req.body?.businessId, 60);
    const title = sanitizeText(req.body?.title, 120);
    const subtitle = sanitizeText(req.body?.subtitle, 160);
    const status = sanitizeText(req.body?.status, 40) || 'Active';
    const amount = req.body?.amount !== undefined ? Number(req.body.amount) : undefined;
    const currency = sanitizeText(req.body?.currency, 10) || 'KES';

    if (!moduleId || !businessId || !title) {
      res.status(400).json({ error: 'moduleId, businessId, and title are required.' });
      return;
    }

    const record: ErpRecord = {
      id: `rec-${crypto.randomUUID().slice(0, 8)}`,
      moduleId,
      businessId,
      title,
      subtitle: subtitle || 'Created via MisafaRMS Workspace',
      status,
      amount: Number.isFinite(amount) ? amount : undefined,
      currency,
      date: new Date().toISOString().slice(0, 10),
      meta: typeof req.body?.meta === 'object' && req.body.meta ? req.body.meta : {},
    };

    db.erpRecords.unshift(record);
    appendAudit({
      actor: 'Workspace User',
      role: 'Store Manager',
      action: `Created record "${record.title}" in ${moduleId}`,
      module: moduleId,
      storeName: 'Enterprise Global',
    });

    res.status(201).json({ record });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MisafaRMS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MisafaRMS server:', err);
  process.exit(1);
});
