import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_CATALOG_TAXONOMY,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_PAYMENT_GATEWAYS,
  DEFAULT_PLATFORM_BILLING_GATEWAYS,
  DEFAULT_POS_CONFIG,
  DEFAULT_PROMO_OFFERS,
  DEFAULT_SUBSCRIPTION_PLANS,
  SEED_ATTENDANCE_LOGS,
  SEED_AUDIT_LOGS,
  SEED_AUTOMATIONS,
  SEED_BACKUPS,
  SEED_BUSINESSES,
  SEED_CRM_LEADS,
  SEED_EMPLOYEES,
  SEED_ERP_RECORDS,
  SEED_INVOICES,
  SEED_ONLINE_ORDERS,
  SEED_PAYROLL_RUNS,
  SEED_PLATFORM_USERS,
  SEED_PRODUCTS,
  SEED_STORES,
  SEED_STUDIO_MODELS,
  SEED_SUBSCRIPTION_INVOICES,
  SEED_TRANSACTIONS,
} from './src/data/seedData';
import {
  DEFAULT_POS_HARDWARE_CONFIG,
  getDefaultModulesForRole,
  getIndustryTemplateById,
} from './src/data/businessTemplates';
import {
  AuditLogEntry,
  BackupSnapshot,
  BusinessEntity,
  CrmCustomerLead,
  EmployeeRecord,
  ErpRecord,
  OnlineOrder,
  OnlineOrderFulfillmentStatus,
  PayrollRunPayslip,
  PayrollRunRecord,
  PlatformBillingGateway,
  PlatformUserRecord,
  ProductItem,
  SaleTransaction,
  ShiftAttendanceLog,
  SlotStatus,
  StoreBranch,
  StudioModel,
  SubscriptionInvoice,
  SubscriptionPlanId,
  SubscriptionPlanTier,
  TaxInvoiceRecord,
  UserRole,
  WorkflowAutomation,
} from './src/types/erp';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const RESERVED_SLUGS = new Set([
  'pos',
  'admin',
  'superadmin',
  'super-admin',
  'api',
  'login',
  'logout',
  'signup',
  'register',
  'pricing',
  'apps',
  'etims',
  'analytics',
  'assets',
  'manifest',
  'settings',
  'billing',
  'health',
  'support',
  'docs',
]);

interface ServerDatabase {
  businesses: BusinessEntity[];
  stores: StoreBranch[];
  employees: EmployeeRecord[];
  attendanceLogs: ShiftAttendanceLog[];
  products: ProductItem[];
  transactions: SaleTransaction[];
  onlineOrders: OnlineOrder[];
  invoices: TaxInvoiceRecord[];
  crmLeads: CrmCustomerLead[];
  payrollRuns: PayrollRunRecord[];
  backups: BackupSnapshot[];
  studioModels: StudioModel[];
  automations: WorkflowAutomation[];
  auditLogs: AuditLogEntry[];
  erpRecords: ErpRecord[];
  platformUsers: PlatformUserRecord[];
  subscriptionPlans: SubscriptionPlanTier[];
  platformBillingGateways: PlatformBillingGateway[];
  subscriptionInvoices: SubscriptionInvoice[];
  platformGatewaySecrets: Map<string, { consumerKey?: string; secretConfiguredAt: string }>;
  activeSessions: Map<string, { actor: string; role: UserRole; isSuperAdmin: boolean; issuedAt: string }>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'misafarms-state.json');

function createSeedDatabase(): ServerDatabase {
  return {
    businesses: structuredClone(SEED_BUSINESSES),
    stores: structuredClone(SEED_STORES),
    employees: structuredClone(SEED_EMPLOYEES),
    attendanceLogs: structuredClone(SEED_ATTENDANCE_LOGS),
    products: structuredClone(SEED_PRODUCTS),
    transactions: structuredClone(SEED_TRANSACTIONS),
    onlineOrders: structuredClone(SEED_ONLINE_ORDERS),
    invoices: structuredClone(SEED_INVOICES),
    crmLeads: structuredClone(SEED_CRM_LEADS),
    payrollRuns: structuredClone(SEED_PAYROLL_RUNS),
    backups: structuredClone(SEED_BACKUPS),
    studioModels: structuredClone(SEED_STUDIO_MODELS),
    automations: structuredClone(SEED_AUTOMATIONS),
    auditLogs: structuredClone(SEED_AUDIT_LOGS),
    erpRecords: structuredClone(SEED_ERP_RECORDS),
    platformUsers: structuredClone(SEED_PLATFORM_USERS),
    subscriptionPlans: structuredClone(DEFAULT_SUBSCRIPTION_PLANS),
    platformBillingGateways: structuredClone(DEFAULT_PLATFORM_BILLING_GATEWAYS),
    subscriptionInvoices: structuredClone(SEED_SUBSCRIPTION_INVOICES),
    platformGatewaySecrets: new Map(),
    activeSessions: new Map(),
  };
}

function loadDatabase(): ServerDatabase {
  const initial = createSeedDatabase();
  try {
    if (!fs.existsSync(STATE_FILE)) return initial;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      businesses: Array.isArray(parsed.businesses) ? (parsed.businesses as BusinessEntity[]) : initial.businesses,
      stores: Array.isArray(parsed.stores) ? (parsed.stores as StoreBranch[]) : initial.stores,
      employees: Array.isArray(parsed.employees) ? (parsed.employees as EmployeeRecord[]) : initial.employees,
      attendanceLogs: Array.isArray(parsed.attendanceLogs) ? (parsed.attendanceLogs as ShiftAttendanceLog[]) : initial.attendanceLogs,
      products: Array.isArray(parsed.products) ? (parsed.products as ProductItem[]) : initial.products,
      transactions: Array.isArray(parsed.transactions) ? (parsed.transactions as SaleTransaction[]) : initial.transactions,
      onlineOrders: Array.isArray(parsed.onlineOrders) ? (parsed.onlineOrders as OnlineOrder[]) : initial.onlineOrders,
      invoices: Array.isArray(parsed.invoices) ? (parsed.invoices as TaxInvoiceRecord[]) : initial.invoices,
      crmLeads: Array.isArray(parsed.crmLeads) ? (parsed.crmLeads as CrmCustomerLead[]) : initial.crmLeads,
      payrollRuns: Array.isArray(parsed.payrollRuns) ? (parsed.payrollRuns as PayrollRunRecord[]) : initial.payrollRuns,
      backups: Array.isArray(parsed.backups) ? (parsed.backups as BackupSnapshot[]) : initial.backups,
      studioModels: Array.isArray(parsed.studioModels) ? (parsed.studioModels as StudioModel[]) : initial.studioModels,
      automations: Array.isArray(parsed.automations) ? (parsed.automations as WorkflowAutomation[]) : initial.automations,
      auditLogs: Array.isArray(parsed.auditLogs) ? (parsed.auditLogs as AuditLogEntry[]) : initial.auditLogs,
      erpRecords: Array.isArray(parsed.erpRecords) ? (parsed.erpRecords as ErpRecord[]) : initial.erpRecords,
      platformUsers: Array.isArray(parsed.platformUsers) ? (parsed.platformUsers as PlatformUserRecord[]) : initial.platformUsers,
      subscriptionPlans: Array.isArray(parsed.subscriptionPlans) ? (parsed.subscriptionPlans as SubscriptionPlanTier[]) : initial.subscriptionPlans,
      platformBillingGateways: Array.isArray(parsed.platformBillingGateways) ? (parsed.platformBillingGateways as PlatformBillingGateway[]) : initial.platformBillingGateways,
      subscriptionInvoices: Array.isArray(parsed.subscriptionInvoices) ? (parsed.subscriptionInvoices as SubscriptionInvoice[]) : initial.subscriptionInvoices,
      platformGatewaySecrets: new Map(
        Array.isArray(parsed.platformGatewaySecrets) ? (parsed.platformGatewaySecrets as Array<[string, { consumerKey?: string; secretConfiguredAt: string }]>) : []
      ),
      activeSessions: new Map(
        Array.isArray(parsed.activeSessions) ? (parsed.activeSessions as Array<[string, { actor: string; role: UserRole; isSuperAdmin: boolean; issuedAt: string }]>) : []
      ),
    };
  } catch (err) {
    console.warn('Could not load saved MisafaRMS state, starting from seed:', err);
    return initial;
  }
}

const db: ServerDatabase = loadDatabase();

function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serializable = {
      ...db,
      platformGatewaySecrets: Array.from(db.platformGatewaySecrets.entries()),
      activeSessions: Array.from(db.activeSessions.entries()).slice(-100),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist MisafaRMS state:', err);
  }
}

function computeServerKenyaPayroll(grossSalary: number) {
  const gross = Math.max(0, Number(grossSalary) || 0);
  const pensionablePay = Math.min(gross, 72000);
  const nssf = Math.round(pensionablePay * 0.06 * 100) / 100;
  const shif = gross > 0 ? Math.max(300, Math.round(gross * 0.0275 * 100) / 100) : 0;
  const housingLevy = Math.round(gross * 0.015 * 100) / 100;
  const taxablePay = Math.max(0, Math.round((gross - nssf - shif - housingLevy) * 100) / 100);

  let remaining = taxablePay;
  let grossTax = 0;
  const band1 = Math.min(remaining, 24000);
  grossTax += band1 * 0.1;
  remaining -= band1;
  if (remaining > 0) {
    const band2 = Math.min(remaining, 8333);
    grossTax += band2 * 0.25;
    remaining -= band2;
  }
  if (remaining > 0) {
    const band3 = Math.min(remaining, 467667);
    grossTax += band3 * 0.3;
    remaining -= band3;
  }
  if (remaining > 0) {
    const band4 = Math.min(remaining, 300000);
    grossTax += band4 * 0.325;
    remaining -= band4;
  }
  if (remaining > 0) {
    grossTax += remaining * 0.35;
  }

  const paye = gross > 0 ? Math.max(0, Math.round((grossTax - 2400) * 100) / 100) : 0;
  const totalDeductions = Math.round((paye + shif + nssf + housingLevy) * 100) / 100;
  const netPay = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);
  return {
    grossSalary: gross,
    nssf,
    shif,
    housingLevy,
    taxablePay,
    paye,
    totalDeductions,
    netPay,
    employerTotal: Math.round((gross + nssf + housingLevy) * 100) / 100,
  };
}

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
  'HR Officer': 0,
  'Field Agent': 10,
};

function isValidRole(role: unknown): role is UserRole {
  return (
    typeof role === 'string' &&
    [
      'Owner',
      'Store Manager',
      'Cashier',
      'Inventory Clerk',
      'Accountant',
      'HR Officer',
      'Field Agent',
    ].includes(role)
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

  function normalizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
  }

  function evaluateSlugAvailability(rawSlug: string, rawName = '') {
    const slug = normalizeSlug(rawSlug || rawName);
    if (!slug || slug.length < 2) {
      return {
        slug,
        available: false,
        reason: 'Domain handle must be at least 2 characters (letters, numbers, or hyphens).',
        fullUrl: `https://misafarms.com/${slug || 'your-business'}`,
        suggestions: [] as string[],
      };
    }

    const isReserved = RESERVED_SLUGS.has(slug);
    const slugTaken = db.businesses.some((b) => b.slug.toLowerCase() === slug);
    const nameTaken =
      rawName.trim().length >= 3 &&
      db.businesses.some((b) => b.name.toLowerCase() === rawName.trim().toLowerCase());

    const available = !isReserved && !slugTaken;
    const suggestions: string[] = [];
    if (!available) {
      const candidates = [
        `${slug}-ke`,
        `${slug}-retail`,
        `${slug}-mart`,
        `${slug}-hq`,
        `${slug}-store`,
      ];
      for (const c of candidates) {
        const cleaned = normalizeSlug(c);
        if (
          cleaned.length >= 2 &&
          !RESERVED_SLUGS.has(cleaned) &&
          !db.businesses.some((b) => b.slug.toLowerCase() === cleaned)
        ) {
          suggestions.push(cleaned);
        }
        if (suggestions.length >= 3) break;
      }
    }

    return {
      slug,
      available,
      nameTaken,
      reason: isReserved
        ? `"${slug}" is a reserved MisafaRMS platform route.`
        : slugTaken
          ? `misafarms.com/${slug} is already claimed by another business.`
          : nameTaken
            ? `Domain misafarms.com/${slug} is available, though a similar business name exists.`
            : undefined,
      fullUrl: `https://misafarms.com/${slug}`,
      suggestions,
    };
  }

  function isSuperAdminAuthorized(req: Request): boolean {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return false;
    const sess = db.activeSessions.get(token);
    return Boolean(sess && (sess.isSuperAdmin || sess.role === 'Owner'));
  }

  app.post('/api/auth/session', (req: Request, res: Response) => {
    const actor = sanitizeText(req.body?.actor, 80) || 'Amina Hassan';
    const role: UserRole = isValidRole(req.body?.role) ? req.body.role : 'Owner';
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const isSuperAdmin = email === 'misafatech@gmail.com' || role === 'Owner';
    const token = crypto.randomBytes(24).toString('hex');
    db.activeSessions.set(token, {
      actor,
      role,
      isSuperAdmin,
      issuedAt: new Date().toISOString(),
    });
    res.json({ token, actor, role, isSuperAdmin });
  });

  app.get('/api/workspace', (_req: Request, res: Response) => {
    res.json({
      businesses: db.businesses,
      stores: db.stores,
      employees: db.employees,
      attendanceLogs: db.attendanceLogs,
      products: db.products,
      transactions: db.transactions,
      onlineOrders: db.onlineOrders,
      invoices: db.invoices,
      crmLeads: db.crmLeads,
      payrollRuns: db.payrollRuns,
      backups: db.backups,
      studioModels: db.studioModels,
      automations: db.automations,
      auditLogs: db.auditLogs,
      erpRecords: db.erpRecords,
      platformUsers: db.platformUsers,
      subscriptionPlans: db.subscriptionPlans,
      platformBillingGateways: db.platformBillingGateways,
      subscriptionInvoices: db.subscriptionInvoices,
    });
  });

  app.get('/api/businesses/check-slug', (req: Request, res: Response) => {
    const rawSlug = sanitizeText(req.query.slug, 64);
    const rawName = sanitizeText(req.query.name, 100);
    const result = evaluateSlugAvailability(rawSlug, rawName);
    res.json(result);
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
    const ownerName = sanitizeText(req.body?.ownerName, 80) || 'Business Owner';
    const ownerEmail = sanitizeText(req.body?.ownerEmail, 160) || 'owner@misafarms.com';
    const vatRate = Number.isFinite(Number(req.body?.vatRate)) ? Number(req.body.vatRate) : 16;

    const requestedPlan: SubscriptionPlanId = ['Trial', 'Starter', 'Multi-Store Pro', 'Enterprise'].includes(
      req.body?.subscriptionPlan
    )
      ? req.body.subscriptionPlan
      : 'Trial';
    const rawTemplateId = sanitizeText(req.body?.templateId, 40);
    const setupMode: 'clean' | 'starter' =
      req.body?.setupMode === 'starter' || (rawTemplateId && rawTemplateId !== 'custom')
        ? 'starter'
        : 'clean';
    const template = getIndustryTemplateById(
      rawTemplateId || (setupMode === 'starter' ? 'supermarket' : 'custom')
    );
    const ownerPin = sanitizeText(req.body?.ownerPin, 8).replace(/[^0-9]/g, '') || '1234';
    const ecommerceEnabled = Boolean(req.body?.ecommerceEnabled);
    const planMeta =
      db.subscriptionPlans.find((p) => p.id === requestedPlan) || db.subscriptionPlans[0];

    if (!name || !['KE', 'UG', 'TZ', 'GB', 'US'].includes(country)) {
      res.status(400).json({ error: 'Valid business name and country are required.' });
      return;
    }

    const bizId = `biz-${crypto.randomUUID().slice(0, 8)}`;
    const storeId = `store-${crypto.randomUUID().slice(0, 8)}`;
    const requestedSlug = sanitizeText(req.body?.slug, 64);
    const check = evaluateSlugAvailability(requestedSlug || name, name);
    if (!check.available) {
      res.status(409).json({
        error: check.reason || 'Requested misafarms.com domain handle is unavailable.',
        suggestions: check.suggestions,
      });
      return;
    }
    const slug = check.slug;
    const now = new Date();
    const renewsAt = new Date(
      now.getTime() + (requestedPlan === 'Trial' ? 14 : 30) * 86400000
    )
      .toISOString()
      .slice(0, 10);

    // Template-driven gateways: enable starter Cash/M-Pesa/Card rails only when template enables them
    const initialGateways = structuredClone(DEFAULT_PAYMENT_GATEWAYS).map((gw) => ({
      ...gw,
      enabled: template.enableStarterGateways ? gw.enabled : false,
      shortcodeOrTill: template.enableStarterGateways
        ? gw.shortcodeOrTill
        : gw.mode === 'Cash Drawer'
          ? 'DRAWER-01'
          : '',
    }));

    // Bind spatial zones to the new branch storeId
    const initialLayout = {
      ...structuredClone(template.layoutConfig),
      zones: template.layoutConfig.zones.map((z, idx) => ({
        ...structuredClone(z),
        id: `zone-${bizId.slice(-4)}-${idx + 1}`,
        storeId,
        slots: z.slots.map((sl, sIdx) => ({
          ...structuredClone(sl),
          id: `slot-${bizId.slice(-4)}-${idx + 1}-${sIdx + 1}`,
        })),
      })),
    };

    const newBiz: BusinessEntity = {
      id: bizId,
      ownerName,
      ownerEmail,
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
      subscriptionPlan: requestedPlan,
      subscriptionStatus: requestedPlan === 'Trial' ? 'trial' : 'active',
      monthlyFee: planMeta.monthlyPriceKes,
      branchLimit: planMeta.branchLimit,
      subscriptionRenewsAt: renewsAt,
      ecommerceEnabled,
      dnsToken: `misafa-verify=${crypto.randomBytes(5).toString('hex')}`,
      storefrontTagline: `${name} — Official Storefront`,
      deliveryFee: 0,
      freeDeliveryAbove: 0,
      storefrontPickupEnabled: true,
      templateId: template.id,
      installedModuleIds: [...template.installedModuleIds],
      posConfig: {
        ...structuredClone(DEFAULT_POS_CONFIG),
        gridDensity: template.posGridDensity,
        receiptHeader: `${name.toUpperCase()} · ${etimsEnabled ? 'KRA eTIMS FISCAL RECEIPT' : 'OFFICIAL RECEIPT'}`,
        receiptFooter: `Thank you for shopping at ${name}.`,
      },
      hardwareConfig: {
        ...structuredClone(DEFAULT_POS_HARDWARE_CONFIG),
        ...structuredClone(template.hardwareDefaults),
      },
      supportAccess: {
        status: 'none',
        allowPiiView: false,
        allowWorkspaceEnter: false,
      },
      paymentGateways: initialGateways,
      layoutConfig: initialLayout,
      catalogTaxonomy: structuredClone(template.catalogTaxonomy),
      offers: structuredClone(template.offers),
      createdAt: now.toISOString(),
    };

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

    // Only provision the actual business Owner / Admin (no fake staff in clean mode)
    const starterEmployees: EmployeeRecord[] = [
      {
        id: `emp-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        name: ownerName,
        email: ownerEmail || `admin@${slug}.misafarms.com`,
        role: 'Owner',
        pinCode: ownerPin.length >= 4 ? ownerPin : '1234',
        branchId: storeId,
        grossSalary: 0,
        active: true,
        permissions: {
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
        createdAt: now.toISOString(),
      },
    ];

    const currencyMultiplier =
      newBiz.currency === 'KES'
        ? 1
        : newBiz.currency === 'UGX'
          ? 28
          : newBiz.currency === 'TZS'
            ? 20
            : 0.008;

    const starterProducts: ProductItem[] = template.starterProducts.map((sp) => {
      const firstZone = initialLayout.zones[0];
      const firstSlot = firstZone?.slots[0];
      return {
        id: `prod-${crypto.randomUUID().slice(0, 8)}`,
        businessId: bizId,
        sku: sp.sku,
        barcode: `6169${Math.floor(10000000 + Math.random() * 89999999)}`,
        name: sp.name,
        category: sp.category,
        subCategory: sp.subCategory,
        zoneId: firstZone?.id,
        slotId: firstSlot?.id,
        shelfCode: firstSlot ? `${firstSlot.code} · ${firstZone.name}` : undefined,
        price: Math.max(1, Math.round(sp.priceKes * currencyMultiplier * 100) / 100),
        cost: Math.max(0, Math.round(sp.costKes * currencyMultiplier * 100) / 100),
        taxCode: sp.taxCode,
        unit: sp.unit,
        reorderPoint: 10,
        stockByStore: { [storeId]: sp.initialQty },
      };
    });

    const ownerUser: PlatformUserRecord = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name: ownerName,
      email: ownerEmail,
      tier: 'admin',
      role: 'Owner',
      businessId: bizId,
      businessName: newBiz.name,
      businessSlug: slug,
      status: 'active',
      emailVerified: true,
      lastActiveAt: now.toISOString(),
      createdAt: now.toISOString(),
    };

    const starterInvoice: SubscriptionInvoice = {
      id: `subinv-${crypto.randomUUID().slice(0, 8)}`,
      invoiceNo: `MSF-SUB-${now.getFullYear()}-${String(db.subscriptionInvoices.length + 1101)}`,
      businessId: bizId,
      businessName: newBiz.name,
      businessSlug: slug,
      planId: requestedPlan,
      amount: planMeta.monthlyPriceKes,
      currency: 'KES',
      status: requestedPlan === 'Trial' ? 'paid' : 'pending',
      paymentMethod:
        db.platformBillingGateways.find((g) => g.enabled)?.displayName ||
        'Safaricom M-Pesa Daraja (SaaS C2B Paybill)',
      paymentRef: requestedPlan === 'Trial' ? 'TRIAL-14D' : 'PENDING-SUB',
      periodLabel: now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      dueDate: renewsAt,
      paidAt: requestedPlan === 'Trial' ? now.toISOString() : undefined,
    };

    db.businesses.push(newBiz);
    db.stores.push(newStore);
    db.employees.push(...starterEmployees);
    if (starterProducts.length > 0) db.products.push(...starterProducts);
    db.platformUsers.unshift(ownerUser);
    db.subscriptionInvoices.unshift(starterInvoice);

    appendAudit({
      actor: ownerName,
      role: 'Owner',
      action: `Onboarded "${newBiz.name}" (misafarms.com/${slug}, mode=${setupMode}) on ${requestedPlan} plan`,
      module: 'Onboarding Wizard',
      storeName: newStore.name,
      emailNotified: true,
      recipientEmail: ownerEmail,
    });
    saveDatabase();

    res.status(201).json({
      business: newBiz,
      store: newStore,
      employees: starterEmployees,
      products: starterProducts,
      platformUser: ownerUser,
      subscriptionInvoice: starterInvoice,
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
    if (req.body?.hardwareConfig && typeof req.body.hardwareConfig === 'object') {
      biz.hardwareConfig = {
        ...(biz.hardwareConfig || structuredClone(DEFAULT_POS_HARDWARE_CONFIG)),
        ...req.body.hardwareConfig,
      };
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
    saveDatabase();

    res.json({ business: biz });
  });

  // Apply an Industry Template to an existing business
  app.post('/api/businesses/:id/apply-template', (req: Request, res: Response) => {
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }
    const templateId = sanitizeText(req.body?.templateId, 40);
    const seedStarterProducts = Boolean(req.body?.seedStarterProducts);
    const template = getIndustryTemplateById(templateId);
    const primaryStore = db.stores.find((s) => s.businessId === biz.id);
    const targetStoreId = primaryStore?.id || 'store-main';

    biz.templateId = template.id;
    biz.installedModuleIds = Array.from(
      new Set([...biz.installedModuleIds, ...template.installedModuleIds])
    );
    biz.posConfig = { ...biz.posConfig, gridDensity: template.posGridDensity };
    biz.hardwareConfig = {
      ...(biz.hardwareConfig || structuredClone(DEFAULT_POS_HARDWARE_CONFIG)),
      ...structuredClone(template.hardwareDefaults),
    };
    biz.catalogTaxonomy = structuredClone(template.catalogTaxonomy);
    biz.offers = structuredClone(template.offers);
    biz.layoutConfig = {
      ...structuredClone(template.layoutConfig),
      zones: template.layoutConfig.zones.map((z, idx) => ({
        ...structuredClone(z),
        id: `zone-${biz.id.slice(-4)}-${Date.now().toString(36)}-${idx + 1}`,
        storeId: targetStoreId,
        slots: z.slots.map((sl, sIdx) => ({
          ...structuredClone(sl),
          id: `slot-${biz.id.slice(-4)}-${idx + 1}-${sIdx + 1}`,
        })),
      })),
    };

    const createdProducts: ProductItem[] = [];
    if (seedStarterProducts && template.starterProducts.length > 0) {
      const existingSkus = new Set(
        db.products.filter((p) => p.businessId === biz.id).map((p) => p.sku.toLowerCase())
      );
      const firstZone = biz.layoutConfig.zones[0];
      const firstSlot = firstZone?.slots[0];
      for (const sp of template.starterProducts) {
        if (existingSkus.has(sp.sku.toLowerCase())) continue;
        const prod: ProductItem = {
          id: `prod-${crypto.randomUUID().slice(0, 8)}`,
          businessId: biz.id,
          sku: sp.sku,
          barcode: `6169${Math.floor(10000000 + Math.random() * 89999999)}`,
          name: sp.name,
          category: sp.category,
          subCategory: sp.subCategory,
          zoneId: firstZone?.id,
          slotId: firstSlot?.id,
          shelfCode: firstSlot ? `${firstSlot.code} · ${firstZone.name}` : undefined,
          price: sp.priceKes,
          cost: sp.costKes,
          taxCode: sp.taxCode,
          unit: sp.unit,
          reorderPoint: 10,
          stockByStore: { [targetStoreId]: sp.initialQty },
        };
        db.products.push(prod);
        createdProducts.push(prod);
      }
    }

    appendAudit({
      actor: 'Business Admin',
      role: 'Owner',
      action: `Applied "${template.name}" template (${template.catalogTaxonomy.length} categories, ${biz.layoutConfig.zones.length} zones)`,
      module: 'Business Templates',
      storeName: primaryStore?.name || biz.name,
    });
    saveDatabase();
    res.json({ business: biz, createdProducts });
  });

  // Zero-Trust Super Admin Support Access Request & Business Owner Consent
  app.post('/api/super-admin/businesses/:id/request-access', (req: Request, res: Response) => {
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }
    const requestedByEmail = sanitizeText(req.body?.requestedByEmail, 160) || 'superadmin@misafarms.com';
    const reason = sanitizeText(req.body?.reason, 220) || 'Support & diagnostic assistance requested by tenant.';
    const durationHours = Math.max(1, Math.min(72, Number(req.body?.durationHours) || 4));
    biz.supportAccess = {
      status: 'pending_approval',
      requestedByEmail,
      requestedAt: new Date().toISOString(),
      reason,
      requestedDurationHours: durationHours,
      allowPiiView: false,
      allowWorkspaceEnter: false,
    };
    appendAudit({
      actor: requestedByEmail,
      role: 'Owner',
      action: `Super Admin requested ${durationHours}h support access to "${biz.name}" (Reason: ${reason}) — awaiting Owner consent`,
      module: 'Privacy & Consent',
      storeName: biz.name,
    });
    saveDatabase();
    res.json({ business: biz });
  });

  app.post('/api/businesses/:id/support-access', (req: Request, res: Response) => {
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }
    const decision = req.body?.decision as 'approve' | 'deny' | 'revoke' | 'grant';
    const actorName = sanitizeText(req.body?.actorName, 80) || biz.ownerName || 'Business Owner';
    const now = new Date();

    if (decision === 'approve' || decision === 'grant') {
      const hours = Math.max(
        1,
        Math.min(72, Number(req.body?.durationHours) || biz.supportAccess?.requestedDurationHours || 4)
      );
      biz.supportAccess = {
        ...(biz.supportAccess || {}),
        status: 'approved',
        requestedByEmail: biz.supportAccess?.requestedByEmail || 'platform-support@misafarms.com',
        reason: biz.supportAccess?.reason || sanitizeText(req.body?.reason, 200) || 'Owner-granted support window',
        approvedBy: actorName,
        approvedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + hours * 3600000).toISOString(),
        requestedDurationHours: hours,
        allowPiiView: true,
        allowWorkspaceEnter: true,
      };
      appendAudit({
        actor: actorName,
        role: 'Owner',
        action: `Owner APPROVED ${hours}h Super Admin support access for "${biz.name}"`,
        module: 'Privacy & Consent',
        storeName: biz.name,
      });
    } else {
      biz.supportAccess = {
        status: 'revoked',
        requestedByEmail: biz.supportAccess?.requestedByEmail,
        reason: biz.supportAccess?.reason,
        revokedAt: now.toISOString(),
        allowPiiView: false,
        allowWorkspaceEnter: false,
      };
      appendAudit({
        actor: actorName,
        role: 'Owner',
        action: `Owner ${decision === 'deny' ? 'DENIED' : 'REVOKED'} Super Admin support access for "${biz.name}"`,
        module: 'Privacy & Consent',
        storeName: biz.name,
      });
    }

    saveDatabase();
    res.json({ business: biz });
  });

  app.patch('/api/businesses/:id/domain', (req: Request, res: Response) => {
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }

    if (typeof req.body?.ecommerceEnabled === 'boolean') {
      biz.ecommerceEnabled = req.body.ecommerceEnabled;
    }
    if (typeof req.body?.customDomain === 'string') {
      const cleaned = req.body.customDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .slice(0, 120);
      if (cleaned !== (biz.customDomain || '')) {
        biz.customDomain = cleaned || undefined;
        biz.domainVerified = false;
        if (!biz.dnsToken) {
          biz.dnsToken = `misafa-verify=${crypto.randomBytes(5).toString('hex')}`;
        }
      }
    }
    if (req.body?.verifyDomain === true && biz.customDomain) {
      const validHost = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(biz.customDomain);
      if (!validHost) {
        res.status(400).json({ error: 'Enter a valid domain hostname (e.g. shop.giftmart.co.ke).' });
        return;
      }
      biz.domainVerified = true;
    }
    if (typeof req.body?.storefrontTagline === 'string') {
      biz.storefrontTagline = sanitizeText(req.body.storefrontTagline, 200);
    }
    if (req.body?.deliveryFee !== undefined && Number.isFinite(Number(req.body.deliveryFee))) {
      biz.deliveryFee = Math.max(0, Number(req.body.deliveryFee));
    }
    if (req.body?.freeDeliveryAbove !== undefined && Number.isFinite(Number(req.body.freeDeliveryAbove))) {
      biz.freeDeliveryAbove = Math.max(0, Number(req.body.freeDeliveryAbove));
    }
    if (typeof req.body?.storefrontPickupEnabled === 'boolean') {
      biz.storefrontPickupEnabled = req.body.storefrontPickupEnabled;
    }

    appendAudit({
      actor: 'Storefront Admin',
      role: 'Owner',
      action: `Updated eCommerce & Domain settings for ${biz.name} (${biz.customDomain || `misafarms.com/${biz.slug}`})`,
      module: 'eCommerce & Domain',
      storeName: biz.name,
    });
    saveDatabase();
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
    saveDatabase();
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

    saveDatabase();
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

    saveDatabase();
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

    const incomingPerms = req.body?.permissions || {};
    const sanitizedAllowedModules = Array.isArray(incomingPerms.allowedModuleIds)
      ? incomingPerms.allowedModuleIds.filter((id: unknown) => typeof id === 'string').slice(0, 80)
      : getDefaultModulesForRole(role);

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
      permissions: {
        maxDiscountPct:
          typeof incomingPerms.maxDiscountPct === 'number'
            ? incomingPerms.maxDiscountPct
            : ROLE_MAX_DISCOUNT[role],
        canVoidSale:
          typeof incomingPerms.canVoidSale === 'boolean'
            ? incomingPerms.canVoidSale
            : role === 'Owner' || role === 'Store Manager',
        canOpenDrawer:
          typeof incomingPerms.canOpenDrawer === 'boolean'
            ? incomingPerms.canOpenDrawer
            : role === 'Cashier' || role === 'Store Manager' || role === 'Owner',
        canViewCostPrice:
          typeof incomingPerms.canViewCostPrice === 'boolean'
            ? incomingPerms.canViewCostPrice
            : role !== 'Cashier' && role !== 'Field Agent' && role !== 'HR Officer',
        canEditInventory:
          typeof incomingPerms.canEditInventory === 'boolean'
            ? incomingPerms.canEditInventory
            : role === 'Owner' || role === 'Store Manager' || role === 'Inventory Clerk',
        canViewEtims:
          typeof incomingPerms.canViewEtims === 'boolean'
            ? incomingPerms.canViewEtims
            : role === 'Owner' || role === 'Store Manager' || role === 'Accountant',
        canExportReports:
          typeof incomingPerms.canExportReports === 'boolean'
            ? incomingPerms.canExportReports
            : role === 'Owner' || role === 'Store Manager' || role === 'Accountant' || role === 'HR Officer',
        canManagePayments:
          typeof incomingPerms.canManagePayments === 'boolean'
            ? incomingPerms.canManagePayments
            : role === 'Owner',
        allowedModuleIds: sanitizedAllowedModules,
      },
      createdAt: new Date().toISOString(),
    };

    db.employees.push(emp);
    const bizRef = db.businesses.find((b) => b.id === businessId);
    const pUser: PlatformUserRecord = {
      id: `usr-${emp.id}`,
      name: emp.name,
      email: emp.email,
      tier: 'employee',
      role: emp.role,
      businessId: emp.businessId,
      businessName: bizRef?.name,
      businessSlug: bizRef?.slug,
      status: 'active',
      emailVerified: true,
      lastActiveAt: emp.createdAt,
      createdAt: emp.createdAt,
    };
    db.platformUsers.unshift(pUser);

    appendAudit({
      actor: 'Business Admin',
      role: 'Owner',
      action: `Provisioned Employee "${emp.name}" (${emp.role}, ${sanitizedAllowedModules.length} apps permitted)`,
      module: 'Employees',
      storeName: 'HR Directory',
    });

    res.status(201).json({ employee: emp, platformUser: pUser });
    saveDatabase();
  });

  app.patch('/api/employees/:id', (req: Request, res: Response) => {
    const emp = db.employees.find((e) => e.id === req.params.id);
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      emp.name = sanitizeText(req.body.name, 100);
    }
    if (typeof req.body?.email === 'string' && req.body.email.trim()) {
      emp.email = sanitizeText(req.body.email, 160);
    }
    if (isValidRole(req.body?.role)) {
      emp.role = req.body.role;
    }
    if (typeof req.body?.pinCode === 'string') {
      const cleanedPin = req.body.pinCode.replace(/[^0-9]/g, '').slice(0, 8);
      if (cleanedPin.length >= 4) emp.pinCode = cleanedPin;
    }
    if (typeof req.body?.branchId === 'string' && req.body.branchId.trim()) {
      emp.branchId = sanitizeText(req.body.branchId, 60);
    }
    if (req.body?.grossSalary !== undefined && Number.isFinite(Number(req.body.grossSalary))) {
      emp.grossSalary = Math.max(0, Number(req.body.grossSalary));
    }
    if (typeof req.body?.active === 'boolean') {
      emp.active = req.body.active;
    }
    if (req.body?.permissions && typeof req.body.permissions === 'object') {
      const nextAllowed = Array.isArray(req.body.permissions.allowedModuleIds)
        ? req.body.permissions.allowedModuleIds
            .filter((id: unknown) => typeof id === 'string')
            .slice(0, 80)
        : emp.permissions.allowedModuleIds;
      emp.permissions = {
        ...emp.permissions,
        ...req.body.permissions,
        allowedModuleIds: nextAllowed,
      };
    }
    appendAudit({
      actor: 'HR Admin',
      role: 'Owner',
      action: `Updated employee profile & app permissions for ${emp.name} (${emp.role})`,
      module: 'Employees',
      storeName: db.stores.find((s) => s.id === emp.branchId)?.name || 'HR Directory',
    });
    saveDatabase();
    res.json({ employee: emp });
  });

  app.delete('/api/employees/:id', (req: Request, res: Response) => {
    const idx = db.employees.findIndex((e) => e.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    const [removed] = db.employees.splice(idx, 1);
    db.platformUsers = db.platformUsers.filter((u) => u.id !== `usr-${removed.id}`);
    appendAudit({
      actor: 'HR Admin',
      role: 'Owner',
      action: `Removed employee "${removed.name}" from roster`,
      module: 'Employees',
      storeName: 'HR Directory',
    });
    saveDatabase();
    res.json({ deletedId: removed.id });
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
        p.stockByStore[store.id] = p.stockByStore[store.id] ?? 0;
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
    saveDatabase();

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
    saveDatabase();
  });

  app.patch('/api/products/:id', (req: Request, res: Response) => {
    const prod = db.products.find((p) => p.id === req.params.id);
    if (!prod) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      prod.name = sanitizeText(req.body.name, 140);
    }
    if (typeof req.body?.sku === 'string' && req.body.sku.trim()) {
      prod.sku = sanitizeText(req.body.sku, 60);
    }
    if (typeof req.body?.category === 'string' && req.body.category.trim()) {
      prod.category = sanitizeText(req.body.category, 60);
    }
    if (req.body?.subCategory !== undefined) {
      prod.subCategory = sanitizeText(req.body.subCategory, 60) || undefined;
    }
    if (req.body?.zoneId !== undefined) prod.zoneId = sanitizeText(req.body.zoneId, 60) || undefined;
    if (req.body?.slotId !== undefined) prod.slotId = sanitizeText(req.body.slotId, 60) || undefined;
    if (req.body?.shelfCode !== undefined) prod.shelfCode = sanitizeText(req.body.shelfCode, 60) || undefined;
    if (req.body?.price !== undefined && Number.isFinite(Number(req.body.price))) {
      prod.price = Math.max(0, Number(req.body.price));
    }
    if (req.body?.cost !== undefined && Number.isFinite(Number(req.body.cost))) {
      prod.cost = Math.max(0, Number(req.body.cost));
    }
    if (['B_16', 'E_0', 'A_EXEMPT'].includes(req.body?.taxCode)) {
      prod.taxCode = req.body.taxCode;
    }
    if (req.body?.reorderPoint !== undefined && Number.isFinite(Number(req.body.reorderPoint))) {
      prod.reorderPoint = Math.max(0, Math.floor(Number(req.body.reorderPoint)));
    }
    appendAudit({
      actor: 'Inventory Clerk',
      role: 'Inventory Clerk',
      action: `Updated SKU ${prod.sku} (${prod.name})`,
      module: 'Inventory',
      storeName: 'Catalog',
    });
    saveDatabase();
    res.json({ product: prod });
  });

  app.post('/api/inventory/adjust', (req: Request, res: Response) => {
    const productId = sanitizeText(req.body?.productId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const delta = Math.trunc(Number(req.body?.delta));
    const reason = sanitizeText(req.body?.reason, 120) || 'Stock Count Adjustment';
    const prod = db.products.find((p) => p.id === productId);
    if (!prod || !storeId || !Number.isFinite(delta) || delta === 0) {
      res.status(400).json({ error: 'Valid productId, storeId, and non-zero delta required.' });
      return;
    }
    const prev = prod.stockByStore[storeId] ?? 0;
    const next = Math.max(0, prev + delta);
    prod.stockByStore[storeId] = next;
    appendAudit({
      actor: 'Inventory Clerk',
      role: 'Inventory Clerk',
      action: `Adjusted ${prod.sku} stock in ${storeId}: ${prev} -> ${next} (${reason})`,
      module: 'Inventory',
      storeName: db.stores.find((s) => s.id === storeId)?.name || storeId,
    });
    saveDatabase();
    res.json({ product: prod });
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
    saveDatabase();

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

    const channel = ['POS', 'Field Agent', 'eCommerce', 'Restaurant'].includes(payload?.channel)
      ? payload.channel
      : 'POS';
    const paymentMethodInput = sanitizeText(payload?.paymentMethod, 60);
    const enabledGateways = business.paymentGateways.filter((g) => g.enabled);

    if ((channel === 'POS' || channel === 'Restaurant') && !payload?.encryptedOffline) {
      if (enabledGateways.length === 0) {
        return { error: 'POS checkout is disabled: no payment gateways are configured and enabled for this business.' };
      }
      if (!paymentMethodInput || !enabledGateways.some((g) => g.displayName === paymentMethodInput)) {
        return { error: `Selected payment method "${paymentMethodInput || 'None'}" is not enabled on this business.` };
      }
    }

    const maxAllowedDiscount = ROLE_MAX_DISCOUNT[role] ?? 5;
    let subtotal = 0;
    let discountTotal = 0;
    let taxAmount = 0;
    const computedLines: SaleTransaction['lines'] = [];

    // Pre-validate every item and branch stock before mutating inventory
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
      const availableStock = product.stockByStore[store.id] ?? 0;
      if (!payload?.encryptedOffline && availableStock < qty) {
        return {
          error: `Insufficient stock for "${product.name}" (${availableStock} available in ${store.name}).`,
        };
      }
    }

    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId && p.businessId === businessId)!;
      const qty = Number(item.qty);
      const discountPct = Math.max(0, Math.min(100, Number(item.discountPct) || 0));

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
    saveDatabase();
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

    saveDatabase();
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

    saveDatabase();
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
    saveDatabase();
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

    saveDatabase();
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

    saveDatabase();
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

    saveDatabase();
    res.status(201).json({ record });
  });

  // Super Admin SaaS Control Plane Endpoints
  app.patch('/api/super-admin/businesses/:id', (req: Request, res: Response) => {
    if (!isSuperAdminAuthorized(req)) {
      res.status(403).json({ error: 'Super Admin session required.' });
      return;
    }
    const biz = db.businesses.find((b) => b.id === req.params.id);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }

    if (
      typeof req.body?.subscriptionPlan === 'string' &&
      ['Trial', 'Starter', 'Multi-Store Pro', 'Enterprise'].includes(req.body.subscriptionPlan)
    ) {
      const planId = req.body.subscriptionPlan as SubscriptionPlanId;
      biz.subscriptionPlan = planId;
      const planMeta = db.subscriptionPlans.find((p) => p.id === planId);
      if (planMeta) {
        biz.monthlyFee = planMeta.monthlyPriceKes;
        biz.branchLimit = planMeta.branchLimit;
      }
    }
    if (
      typeof req.body?.subscriptionStatus === 'string' &&
      ['active', 'trial', 'past_due', 'suspended'].includes(req.body.subscriptionStatus)
    ) {
      biz.subscriptionStatus = req.body.subscriptionStatus;
    }
    if (req.body?.branchLimit !== undefined && Number.isFinite(Number(req.body.branchLimit))) {
      biz.branchLimit = Math.max(1, Math.min(999, Math.floor(Number(req.body.branchLimit))));
    }
    if (req.body?.monthlyFee !== undefined && Number.isFinite(Number(req.body.monthlyFee))) {
      biz.monthlyFee = Math.max(0, Number(req.body.monthlyFee));
    }
    if (typeof req.body?.subscriptionRenewsAt === 'string' && req.body.subscriptionRenewsAt.trim()) {
      biz.subscriptionRenewsAt = sanitizeText(req.body.subscriptionRenewsAt, 40);
    }

    appendAudit({
      actor: 'Super Admin',
      role: 'Owner',
      action: `Updated SaaS subscription for "${biz.name}" (${biz.subscriptionPlan} · ${biz.subscriptionStatus})`,
      module: 'Super Admin',
      storeName: 'Platform Control',
    });

    saveDatabase();
    res.json({ business: biz });
  });

  app.post('/api/super-admin/users', (req: Request, res: Response) => {
    if (!isSuperAdminAuthorized(req)) {
      res.status(403).json({ error: 'Super Admin session required.' });
      return;
    }
    const name = sanitizeText(req.body?.name, 100);
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const tier = ['super_admin', 'admin', 'employee', 'user'].includes(req.body?.tier)
      ? req.body.tier
      : 'admin';
    const role = (sanitizeText(req.body?.role, 60) ||
      (tier === 'super_admin' ? 'Super Admin' : 'Owner')) as PlatformUserRecord['role'];
    const businessId = sanitizeText(req.body?.businessId, 60) || undefined;

    if (!name || !email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid name and email are required.' });
      return;
    }

    const biz = businessId ? db.businesses.find((b) => b.id === businessId) : undefined;
    const now = new Date().toISOString();
    const user: PlatformUserRecord = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      tier,
      role,
      businessId: biz?.id,
      businessName: biz?.name,
      businessSlug: biz?.slug,
      status: 'active',
      emailVerified: true,
      lastActiveAt: now,
      createdAt: now,
    };

    db.platformUsers.unshift(user);
    appendAudit({
      actor: 'Super Admin',
      role: 'Owner',
      action: `Provisioned SaaS user ${user.name} (${user.email}) as ${user.tier}`,
      module: 'Super Admin Users',
      storeName: biz?.name || 'Platform Global',
      emailNotified: true,
      recipientEmail: user.email,
    });

    saveDatabase();
    res.status(201).json({ user });
  });

  app.patch('/api/super-admin/users/:id', (req: Request, res: Response) => {
    if (!isSuperAdminAuthorized(req)) {
      res.status(403).json({ error: 'Super Admin session required.' });
      return;
    }
    const user = db.platformUsers.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Software user not found.' });
      return;
    }

    if (req.body?.status === 'active' || req.body?.status === 'suspended') {
      user.status = req.body.status;
    }
    if (['super_admin', 'admin', 'employee', 'user'].includes(req.body?.tier)) {
      user.tier = req.body.tier;
    }
    if (typeof req.body?.role === 'string' && req.body.role.trim()) {
      user.role = sanitizeText(req.body.role, 60) as PlatformUserRecord['role'];
    }
    if (typeof req.body?.businessId === 'string') {
      const biz = db.businesses.find((b) => b.id === req.body.businessId);
      user.businessId = biz?.id;
      user.businessName = biz?.name;
      user.businessSlug = biz?.slug;
    }

    appendAudit({
      actor: 'Super Admin',
      role: 'Owner',
      action: `Updated user "${user.email}" (${user.tier} · ${user.status})`,
      module: 'Super Admin Users',
      storeName: user.businessName || 'Platform Global',
    });

    saveDatabase();
    res.json({ user });
  });

  app.patch('/api/super-admin/plans', (req: Request, res: Response) => {
    if (!isSuperAdminAuthorized(req)) {
      res.status(403).json({ error: 'Super Admin session required.' });
      return;
    }
    if (!Array.isArray(req.body?.plans)) {
      res.status(400).json({ error: 'Plans array is required.' });
      return;
    }
    db.subscriptionPlans = req.body.plans.slice(0, 10).map((p: SubscriptionPlanTier) => ({
      id: p.id,
      name: sanitizeText(p.name, 60),
      tagline: sanitizeText(p.tagline, 120),
      monthlyPriceKes: Math.max(0, Number(p.monthlyPriceKes) || 0),
      monthlyPriceUsd: Math.max(0, Number(p.monthlyPriceUsd) || 0),
      branchLimit: Math.max(1, Math.floor(Number(p.branchLimit) || 1)),
      userLimit: Math.max(1, Math.floor(Number(p.userLimit) || 5)),
      etimsIncluded: Boolean(p.etimsIncluded),
      highlighted: Boolean(p.highlighted),
    }));

    appendAudit({
      actor: 'Super Admin',
      role: 'Owner',
      action: 'Updated SaaS subscription plan pricing & branch limits',
      module: 'Super Admin Billing',
      storeName: 'Platform Control',
    });

    saveDatabase();
    res.json({ subscriptionPlans: db.subscriptionPlans });
  });

  app.put('/api/super-admin/billing-gateways', (req: Request, res: Response) => {
    if (!isSuperAdminAuthorized(req)) {
      res.status(403).json({ error: 'Super Admin session required.' });
      return;
    }
    if (!Array.isArray(req.body?.gateways)) {
      res.status(400).json({ error: 'Gateways array is required.' });
      return;
    }

    const secretUpdates =
      req.body?.secretUpdates && typeof req.body.secretUpdates === 'object'
        ? (req.body.secretUpdates as Record<string, { consumerKey?: string }>)
        : {};

    db.platformBillingGateways = req.body.gateways.slice(0, 20).map((g: PlatformBillingGateway) => {
      const id = sanitizeText(g.id, 60) || `saas-gw-${crypto.randomUUID().slice(0, 6)}`;
      const incomingSecret = secretUpdates[id]?.consumerKey;
      if (typeof incomingSecret === 'string' && incomingSecret.trim().length > 0) {
        db.platformGatewaySecrets.set(id, {
          consumerKey: incomingSecret.trim(),
          secretConfiguredAt: new Date().toISOString(),
        });
      }
      return {
        id,
        provider: g.provider || 'custom',
        displayName: sanitizeText(g.displayName, 100),
        enabled: Boolean(g.enabled),
        mode: g.mode || 'Custom',
        shortcodeOrAccount: sanitizeText(g.shortcodeOrAccount, 80),
        accountPrefix: sanitizeText(g.accountPrefix, 40),
        currencies: Array.isArray(g.currencies) ? g.currencies.slice(0, 10) : ['KES'],
        environment: g.environment === 'Sandbox' ? 'Sandbox' : 'Production',
        webhookUrl: sanitizeText(g.webhookUrl, 200),
        hasSecretConfigured:
          Boolean(g.hasSecretConfigured) || db.platformGatewaySecrets.has(id),
        settlementSchedule: sanitizeText(g.settlementSchedule, 80) || 'T+1 Settlement',
        instructions: sanitizeText(g.instructions, 240) || undefined,
      };
    });

    appendAudit({
      actor: 'Super Admin',
      role: 'Owner',
      action: `Configured ${db.platformBillingGateways.filter((g) => g.enabled).length} SaaS subscription collection gateways`,
      module: 'Super Admin Billing Config',
      storeName: 'Platform Control',
    });

    saveDatabase();
    res.json({ platformBillingGateways: db.platformBillingGateways });
  });

  app.post('/api/subscriptions/pay', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const planId: SubscriptionPlanId = ['Trial', 'Starter', 'Multi-Store Pro', 'Enterprise'].includes(
      req.body?.planId
    )
      ? req.body.planId
      : 'Multi-Store Pro';
    const gatewayId = sanitizeText(req.body?.gatewayId, 60);
    const payerPhoneOrRef = sanitizeText(req.body?.payerRef, 60);

    const biz = db.businesses.find((b) => b.id === businessId);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }

    const gateway =
      db.platformBillingGateways.find((g) => g.id === gatewayId && g.enabled) ||
      db.platformBillingGateways.find((g) => g.enabled);
    if (!gateway) {
      res.status(400).json({ error: 'No enabled SaaS subscription payment gateway available.' });
      return;
    }

    const plan = db.subscriptionPlans.find((p) => p.id === planId) || db.subscriptionPlans[1];
    const now = new Date();
    const renewsAt = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const amount = biz.currency === 'USD' || biz.currency === 'GBP' ? plan.monthlyPriceUsd : plan.monthlyPriceKes;
    const currency = biz.currency === 'USD' || biz.currency === 'GBP' ? 'USD' : 'KES';

    biz.subscriptionPlan = plan.id;
    biz.subscriptionStatus = 'active';
    biz.monthlyFee = plan.monthlyPriceKes;
    biz.branchLimit = plan.branchLimit;
    biz.subscriptionRenewsAt = renewsAt;

    // Mark any pending invoice for this business as paid or create a fresh paid invoice
    const existingPending = db.subscriptionInvoices.find(
      (inv) => inv.businessId === biz.id && inv.status !== 'paid'
    );
    const paymentRef =
      payerPhoneOrRef || `SUB${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let invoice: SubscriptionInvoice;
    if (existingPending) {
      existingPending.planId = plan.id;
      existingPending.amount = amount;
      existingPending.currency = currency;
      existingPending.status = 'paid';
      existingPending.paymentMethod = gateway.displayName;
      existingPending.paymentRef = paymentRef;
      existingPending.paidAt = now.toISOString();
      invoice = existingPending;
    } else {
      invoice = {
        id: `subinv-${crypto.randomUUID().slice(0, 8)}`,
        invoiceNo: `MSF-SUB-${now.getFullYear()}-${String(db.subscriptionInvoices.length + 1101)}`,
        businessId: biz.id,
        businessName: biz.name,
        businessSlug: biz.slug,
        planId: plan.id,
        amount,
        currency,
        status: 'paid',
        paymentMethod: gateway.displayName,
        paymentRef,
        periodLabel: now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        dueDate: renewsAt,
        paidAt: now.toISOString(),
      };
      db.subscriptionInvoices.unshift(invoice);
    }

    appendAudit({
      actor: biz.ownerName || 'Business Owner',
      role: 'Owner',
      action: `Paid ${currency} ${amount} subscription (${plan.name}) via ${gateway.displayName} (Ref: ${paymentRef})`,
      module: 'SaaS Billing',
      storeName: biz.name,
      emailNotified: Boolean(biz.ownerEmail),
      recipientEmail: biz.ownerEmail,
    });
    saveDatabase();

    res.status(201).json({
      business: biz,
      invoice,
      subscriptionInvoices: db.subscriptionInvoices,
    });
  });

  // --- INVOICING & B2B TAX BILLING ---
  app.post('/api/invoices', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const biz = db.businesses.find((b) => b.id === businessId);
    const store = db.stores.find((s) => s.id === storeId && s.businessId === businessId) || db.stores.find((s) => s.businessId === businessId);
    if (!biz || !store) {
      res.status(400).json({ error: 'Valid business and branch required.' });
      return;
    }
    const rawLines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const customerName = sanitizeText(req.body?.customerName, 120);
    if (!customerName || rawLines.length === 0) {
      res.status(400).json({ error: 'Customer name and at least one invoice line required.' });
      return;
    }
    const docType = req.body?.docType === 'Proforma Quote' ? 'Proforma Quote' : 'Tax Invoice';

    let subtotal = 0;
    let taxAmount = 0;
    const lines: TaxInvoiceRecord['lines'] = [];
    for (const rl of rawLines) {
      const qty = Math.max(1, Number(rl.qty) || 1);
      const unitPrice = Math.max(0, Number(rl.unitPrice) || 0);
      const taxCode = ['B_16', 'E_0', 'A_EXEMPT'].includes(rl.taxCode) ? rl.taxCode : 'B_16';
      const lineTotal = Math.round(qty * unitPrice * 100) / 100;
      const vatFrac = taxCode === 'B_16' ? biz.vatRate / (100 + biz.vatRate) : 0;
      subtotal += lineTotal;
      taxAmount += Math.round(lineTotal * vatFrac * 100) / 100;
      lines.push({
        productId: rl.productId ? sanitizeText(rl.productId, 60) : undefined,
        sku: sanitizeText(rl.sku, 40) || 'SRV-01',
        name: sanitizeText(rl.name, 140) || 'Item',
        qty,
        unitPrice,
        taxCode,
        lineTotal,
      });
    }

    const total = Math.round(subtotal * 100) / 100;
    const seq = String(db.invoices.length + 102).padStart(4, '0');
    const cuin = docType === 'Tax Invoice' && biz.etimsEnabled ? `${store.vscuSerial.slice(0, 14)}-INV-${seq}` : undefined;

    const invoice: TaxInvoiceRecord = {
      id: `inv-${crypto.randomUUID().slice(0, 8)}`,
      invoiceNo: `${docType === 'Proforma Quote' ? 'QUO' : 'INV'}-${store.code.replace('-', '')}-${new Date().getFullYear()}-${seq}`,
      businessId: biz.id,
      storeId: store.id,
      storeName: store.name,
      customerName,
      customerEmail: sanitizeText(req.body?.customerEmail, 160) || undefined,
      customerPhone: sanitizeText(req.body?.customerPhone, 30) || undefined,
      customerPin: sanitizeText(req.body?.customerPin, 30) || undefined,
      docType,
      status: docType === 'Proforma Quote' ? 'Draft' : 'Unpaid',
      currency: biz.currency,
      lines,
      subtotal: total,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total,
      amountPaid: 0,
      balanceDue: total,
      dueDate: sanitizeText(req.body?.dueDate, 30) || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      etimsCuin: cuin,
      createdAt: new Date().toISOString(),
    };

    db.invoices.unshift(invoice);
    appendAudit({
      actor: 'Billing Desk',
      role: 'Accountant',
      action: `Created ${invoice.docType} ${invoice.invoiceNo} for ${invoice.customerName} (${invoice.currency} ${invoice.total.toFixed(2)})`,
      module: 'Invoicing',
      storeName: store.name,
    });
    saveDatabase();
    res.status(201).json({ invoice });
  });

  app.post('/api/invoices/:id/pay', (req: Request, res: Response) => {
    const inv = db.invoices.find((i) => i.id === req.params.id);
    if (!inv) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    if (inv.status === 'Paid' || inv.balanceDue <= 0) {
      res.status(400).json({ error: 'Invoice is already fully paid.' });
      return;
    }
    const biz = db.businesses.find((b) => b.id === inv.businessId);
    const store = db.stores.find((s) => s.id === inv.storeId) || db.stores.find((s) => s.businessId === inv.businessId);
    if (!biz || !store) {
      res.status(400).json({ error: 'Business or branch context missing.' });
      return;
    }

    const payAmount = Math.min(inv.balanceDue, Math.max(0.01, Number(req.body?.amount) || inv.balanceDue));
    const paymentMethod = sanitizeText(req.body?.paymentMethod, 60) || 'Bank / M-Pesa Invoice Settlement';
    const paymentRef = sanitizeText(req.body?.paymentRef, 60) || `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const wasUnpaid = inv.amountPaid === 0;
    inv.amountPaid = Math.round((inv.amountPaid + payAmount) * 100) / 100;
    inv.balanceDue = Math.max(0, Math.round((inv.total - inv.amountPaid) * 100) / 100);
    inv.status = inv.balanceDue <= 0.01 ? 'Paid' : 'Partial';
    if (inv.status === 'Paid') inv.paidAt = new Date().toISOString();

    // Deduct stock for linked product SKUs on first payment if Tax Invoice
    if (wasUnpaid) {
      for (const l of inv.lines) {
        if (!l.productId) continue;
        const prod = db.products.find((p) => p.id === l.productId && p.businessId === biz.id);
        if (prod) {
          prod.stockByStore[store.id] = Math.max(0, (prod.stockByStore[store.id] ?? 0) - l.qty);
        }
      }
    }

    const ratio = inv.total > 0 ? payAmount / inv.total : 1;
    const taxPortion = Math.round(inv.taxAmount * ratio * 100) / 100;
    const seq = String(db.transactions.length + 4913).padStart(6, '0');
    const cuin = inv.etimsCuin || `${store.vscuSerial.slice(0, 14)}-${seq}`;

    const tx: SaleTransaction = {
      id: `tx-inv-${crypto.randomUUID().slice(0, 8)}`,
      receiptNo: `${inv.invoiceNo}-RCPT`,
      businessId: biz.id,
      storeId: store.id,
      storeName: store.name,
      cashierRole: 'Accountant',
      cashierName: 'Accounts Receivable',
      customerName: inv.customerName,
      customerPin: inv.customerPin,
      customerPhone: inv.customerPhone,
      customerEmail: inv.customerEmail,
      channel: 'POS',
      paymentMethod,
      paymentRef,
      currency: inv.currency,
      subtotal: payAmount,
      taxAmount: taxPortion,
      discountTotal: 0,
      total: payAmount,
      amountTendered: payAmount,
      changeDue: 0,
      etimsCuin: cuin,
      etimsStatus: 'Transmitted',
      etimsQrData: `https://etims.kra.go.ke/verify?cuin=${encodeURIComponent(cuin)}&pin=${encodeURIComponent(biz.taxPin)}`,
      lines: inv.lines.map((l) => ({
        productId: l.productId || l.sku,
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: 0,
        taxCode: l.taxCode,
        lineTotal: l.lineTotal,
      })),
      createdAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };
    inv.linkedTransactionId = tx.id;
    db.transactions.unshift(tx);

    const glRecord: ErpRecord = {
      id: `rec-acc-${crypto.randomUUID().slice(0, 6)}`,
      moduleId: 'accounting',
      businessId: biz.id,
      title: `JRNL-${inv.invoiceNo} · Invoice Payment (${paymentMethod})`,
      subtitle: `Debit Bank/Cash ${payAmount.toFixed(2)} · Credit AR / Revenue & VAT ${taxPortion.toFixed(2)}`,
      status: 'Posted',
      amount: payAmount,
      currency: inv.currency,
      date: new Date().toISOString().slice(0, 10),
      meta: { invoiceNo: inv.invoiceNo, cuin, ref: paymentRef },
    };
    db.erpRecords.unshift(glRecord);

    appendAudit({
      actor: 'Accounts Receivable',
      role: 'Accountant',
      action: `Recorded ${inv.currency} ${payAmount.toFixed(2)} payment on ${inv.invoiceNo} (Status: ${inv.status})`,
      module: 'Invoicing',
      storeName: store.name,
    });
    saveDatabase();
    res.json({ invoice: inv, transaction: tx, products: db.products, erpRecord: glRecord });
  });

  // --- CRM PIPELINE ---
  app.post('/api/crm/leads', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const name = sanitizeText(req.body?.name, 100);
    if (!businessId || !name) {
      res.status(400).json({ error: 'businessId and contact name required.' });
      return;
    }
    const lead: CrmCustomerLead = {
      id: `lead-${crypto.randomUUID().slice(0, 8)}`,
      businessId,
      name,
      company: sanitizeText(req.body?.company, 100) || undefined,
      email: sanitizeText(req.body?.email, 160) || undefined,
      phone: sanitizeText(req.body?.phone, 30) || undefined,
      kraPin: sanitizeText(req.body?.kraPin, 30) || undefined,
      stage: ['Lead', 'Qualified', 'Proposal', 'Won', 'Customer'].includes(req.body?.stage)
        ? req.body.stage
        : 'Lead',
      expectedValue: Math.max(0, Number(req.body?.expectedValue) || 0),
      notes: sanitizeText(req.body?.notes, 240) || undefined,
      source: ['POS', 'Online Store', 'Manual', 'B2B Referral'].includes(req.body?.source)
        ? req.body.source
        : 'Manual',
      createdAt: new Date().toISOString(),
    };
    db.crmLeads.unshift(lead);
    saveDatabase();
    res.status(201).json({ lead });
  });

  app.patch('/api/crm/leads/:id', (req: Request, res: Response) => {
    const lead = db.crmLeads.find((l) => l.id === req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'CRM lead not found.' });
      return;
    }
    if (['Lead', 'Qualified', 'Proposal', 'Won', 'Customer'].includes(req.body?.stage)) {
      lead.stage = req.body.stage;
    }
    if (typeof req.body?.notes === 'string') lead.notes = sanitizeText(req.body.notes, 240);
    if (req.body?.expectedValue !== undefined && Number.isFinite(Number(req.body.expectedValue))) {
      lead.expectedValue = Math.max(0, Number(req.body.expectedValue));
    }
    saveDatabase();
    res.json({ lead });
  });

  // --- KENYA STATUTORY PAYROLL RUN ---
  app.post('/api/payroll/run', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const biz = db.businesses.find((b) => b.id === businessId);
    if (!biz) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }
    const periodLabel =
      sanitizeText(req.body?.periodLabel, 60) ||
      new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const activeStaff = db.employees.filter((e) => e.businessId === businessId && e.active && e.grossSalary > 0);
    if (activeStaff.length === 0) {
      res.status(400).json({ error: 'No active salaried employees found for this business.' });
      return;
    }

    const payslips: PayrollRunPayslip[] = [];
    let totalGross = 0;
    let totalPaye = 0;
    let totalShif = 0;
    let totalNssf = 0;
    let totalHousingLevy = 0;
    let totalNet = 0;
    let totalEmployerCost = 0;

    for (const emp of activeStaff) {
      const calc = computeServerKenyaPayroll(emp.grossSalary);
      totalGross += calc.grossSalary;
      totalPaye += calc.paye;
      totalShif += calc.shif;
      totalNssf += calc.nssf;
      totalHousingLevy += calc.housingLevy;
      totalNet += calc.netPay;
      totalEmployerCost += calc.employerTotal;
      payslips.push({
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        grossSalary: calc.grossSalary,
        nssf: calc.nssf,
        shif: calc.shif,
        housingLevy: calc.housingLevy,
        taxablePay: calc.taxablePay,
        paye: calc.paye,
        totalDeductions: calc.totalDeductions,
        netPay: calc.netPay,
      });
    }

    const run: PayrollRunRecord = {
      id: `payrun-${crypto.randomUUID().slice(0, 8)}`,
      businessId: biz.id,
      periodLabel,
      employeeCount: payslips.length,
      currency: biz.currency,
      totalGross: Math.round(totalGross * 100) / 100,
      totalPaye: Math.round(totalPaye * 100) / 100,
      totalShif: Math.round(totalShif * 100) / 100,
      totalNssf: Math.round(totalNssf * 100) / 100,
      totalHousingLevy: Math.round(totalHousingLevy * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
      status: 'Posted',
      payslips,
      createdAt: new Date().toISOString(),
    };
    db.payrollRuns.unshift(run);

    const glRecord: ErpRecord = {
      id: `rec-acc-${crypto.randomUUID().slice(0, 6)}`,
      moduleId: 'accounting',
      businessId: biz.id,
      title: `JRNL-PAY-${periodLabel.toUpperCase()} · Payroll Statutory Settlement`,
      subtitle: `Debit 610100 Salaries (${run.totalGross.toFixed(2)}) · Credit Net Pay (${run.totalNet.toFixed(2)}), PAYE (${run.totalPaye.toFixed(2)}), SHIF/NSSF/AHL`,
      status: 'Posted',
      amount: run.totalEmployerCost,
      currency: biz.currency,
      date: new Date().toISOString().slice(0, 10),
      meta: { period: periodLabel, employees: run.employeeCount },
    };
    db.erpRecords.unshift(glRecord);

    appendAudit({
      actor: 'Payroll Officer',
      role: 'Accountant',
      action: `Executed ${periodLabel} Kenya payroll for ${run.employeeCount} staff (Net: ${biz.currency} ${run.totalNet.toFixed(2)})`,
      module: 'Payroll',
      storeName: biz.name,
    });
    saveDatabase();
    res.status(201).json({ payrollRun: run, erpRecord: glRecord });
  });

  // --- ACCOUNTING DOUBLE-ENTRY MANUAL JOURNAL ---
  app.post('/api/accounting/journal', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const debitAccount = sanitizeText(req.body?.debitAccount, 80);
    const creditAccount = sanitizeText(req.body?.creditAccount, 80);
    const description = sanitizeText(req.body?.description, 160);
    const amount = Math.max(0.01, Number(req.body?.amount) || 0);
    const date = sanitizeText(req.body?.date, 20) || new Date().toISOString().slice(0, 10);
    const biz = db.businesses.find((b) => b.id === businessId);

    if (!biz || !debitAccount || !creditAccount || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Valid business, debit account, credit account, and positive amount required.' });
      return;
    }

    const record: ErpRecord = {
      id: `rec-acc-${crypto.randomUUID().slice(0, 8)}`,
      moduleId: 'accounting',
      businessId: biz.id,
      title: `JRNL-MAN-${Math.floor(1000 + Math.random() * 8999)} · ${description || `${debitAccount} / ${creditAccount}`}`,
      subtitle: `Debit ${debitAccount} · Credit ${creditAccount}`,
      status: 'Posted',
      amount: Math.round(amount * 100) / 100,
      currency: biz.currency,
      date,
      meta: { debitAccount, creditAccount, manual: 'true' },
    };
    db.erpRecords.unshift(record);
    appendAudit({
      actor: 'Accountant',
      role: 'Accountant',
      action: `Posted journal entry (${biz.currency} ${record.amount?.toFixed(2)}): Debit ${debitAccount} / Credit ${creditAccount}`,
      module: 'Accounting',
      storeName: biz.name,
    });
    saveDatabase();
    res.status(201).json({ record });
  });

  // --- ONLINE ORDERS MANAGER & REAL STOREFRONT CHECKOUT ---
  app.get('/api/online-orders', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.query.businessId, 60);
    const orders = businessId
      ? db.onlineOrders.filter((o) => o.businessId === businessId)
      : db.onlineOrders;
    res.json({ onlineOrders: orders });
  });

  app.post('/api/online-orders', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const biz = db.businesses.find((b) => b.id === businessId);
    const store = db.stores.find((s) => s.id === storeId && s.businessId === businessId) || db.stores.find((s) => s.businessId === businessId);
    if (!biz || !store) {
      res.status(400).json({ error: 'Valid business and fulfillment branch required.' });
      return;
    }
    if (!biz.ecommerceEnabled) {
      res.status(403).json({ error: 'eCommerce storefront is not activated for this business.' });
      return;
    }

    const customerName = sanitizeText(req.body?.customerName, 100);
    const customerPhone = sanitizeText(req.body?.customerPhone, 30);
    const deliveryMethod = req.body?.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';
    const deliveryAddress = sanitizeText(req.body?.deliveryAddress, 200) || (deliveryMethod === 'pickup' ? `Store Pickup: ${store.name}` : '');
    const items = Array.isArray(req.body?.lines) ? req.body.lines : [];

    if (!customerName || !customerPhone || items.length === 0) {
      res.status(400).json({ error: 'Customer name, phone, and at least one item required.' });
      return;
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress) {
      res.status(400).json({ error: 'Delivery address is required for home/office delivery.' });
      return;
    }

    // Validate stock first
    for (const item of items) {
      const prod = db.products.find((p) => p.id === item.productId && p.businessId === biz.id);
      const qty = Math.floor(Number(item.qty) || 0);
      if (!prod || qty <= 0) {
        res.status(400).json({ error: 'Invalid product or quantity in online basket.' });
        return;
      }
      const avail = prod.stockByStore[store.id] ?? 0;
      if (avail < qty) {
        res.status(400).json({ error: `Insufficient stock for "${prod.name}" (${avail} left at ${store.name}).` });
        return;
      }
    }

    let subtotal = 0;
    let taxAmount = 0;
    const lines: OnlineOrder['lines'] = [];

    for (const item of items) {
      const prod = db.products.find((p) => p.id === item.productId && p.businessId === biz.id)!;
      const qty = Math.floor(Number(item.qty));
      const lineTotal = Math.round(prod.price * qty * 100) / 100;
      const vatFrac = prod.taxCode === 'B_16' ? biz.vatRate / (100 + biz.vatRate) : 0;
      subtotal += lineTotal;
      taxAmount += Math.round(lineTotal * vatFrac * 100) / 100;
      prod.stockByStore[store.id] = Math.max(0, (prod.stockByStore[store.id] ?? 0) - qty);
      lines.push({
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        qty,
        unitPrice: prod.price,
        taxCode: prod.taxCode,
        lineTotal,
      });
    }

    const baseFee = Number(biz.deliveryFee) || 0;
    const freeThreshold = Number(biz.freeDeliveryAbove) || 0;
    const deliveryFee =
      deliveryMethod === 'pickup'
        ? 0
        : freeThreshold > 0 && subtotal >= freeThreshold
          ? 0
          : baseFee;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    const paymentMethod = sanitizeText(req.body?.paymentMethod, 60) || 'Pay on Delivery (COD)';
    const paymentStatus: OnlineOrder['paymentStatus'] =
      paymentMethod.toLowerCase().includes('cod') || paymentMethod.toLowerCase().includes('delivery')
        ? 'Pending COD'
        : 'Paid';
    const paymentRef =
      sanitizeText(req.body?.paymentRef, 60) ||
      `WEB${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const now = new Date().toISOString();
    const seq = String(db.transactions.length + 4913).padStart(6, '0');
    const orderNo = `WEB-${new Date().getFullYear()}-${String(db.onlineOrders.length + 8822)}`;
    const cuin = biz.etimsEnabled ? `${store.vscuSerial.slice(0, 14)}-${seq}` : `WEB-${store.code}-${seq}`;

    // Create synced SaleTransaction
    const tx: SaleTransaction = {
      id: `tx-web-${crypto.randomUUID().slice(0, 8)}`,
      receiptNo: orderNo,
      businessId: biz.id,
      storeId: store.id,
      storeName: store.name,
      cashierRole: 'Store Manager',
      cashierName: 'eCommerce Storefront',
      customerName,
      customerPhone,
      customerEmail: sanitizeText(req.body?.customerEmail, 160) || undefined,
      customerPin: sanitizeText(req.body?.customerPin, 30) || undefined,
      channel: 'eCommerce',
      paymentMethod,
      paymentRef,
      currency: biz.currency,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discountTotal: 0,
      total,
      amountTendered: paymentStatus === 'Paid' ? total : 0,
      changeDue: 0,
      etimsCuin: cuin,
      etimsStatus: 'Transmitted',
      etimsQrData: `https://etims.kra.go.ke/verify?cuin=${encodeURIComponent(cuin)}&pin=${encodeURIComponent(biz.taxPin)}`,
      lines: lines.map((l) => ({
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: 0,
        taxCode: l.taxCode,
        lineTotal: l.lineTotal,
      })),
      createdAt: now,
      syncedAt: now,
    };
    db.transactions.unshift(tx);

    // Create synced TaxInvoiceRecord
    const invSeq = String(db.invoices.length + 102).padStart(4, '0');
    const invoice: TaxInvoiceRecord = {
      id: `inv-web-${crypto.randomUUID().slice(0, 8)}`,
      invoiceNo: `INV-WEB-${new Date().getFullYear()}-${invSeq}`,
      businessId: biz.id,
      storeId: store.id,
      storeName: store.name,
      customerName,
      customerEmail: tx.customerEmail,
      customerPhone,
      customerPin: tx.customerPin,
      docType: 'Tax Invoice',
      status: paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
      currency: biz.currency,
      lines: lines.map((l) => ({
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxCode: l.taxCode,
        lineTotal: l.lineTotal,
      })),
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total,
      amountPaid: paymentStatus === 'Paid' ? total : 0,
      balanceDue: paymentStatus === 'Paid' ? 0 : total,
      dueDate: now.slice(0, 10),
      etimsCuin: cuin,
      linkedTransactionId: tx.id,
      createdAt: now,
      paidAt: paymentStatus === 'Paid' ? now : undefined,
    };
    db.invoices.unshift(invoice);

    // Create OnlineOrder
    const order: OnlineOrder = {
      id: `ord-${crypto.randomUUID().slice(0, 8)}`,
      orderNo,
      businessId: biz.id,
      storeId: store.id,
      storeName: store.name,
      customerName,
      customerPhone,
      customerEmail: tx.customerEmail,
      customerPin: tx.customerPin,
      deliveryMethod,
      deliveryAddress,
      fulfillmentStatus: 'Pending',
      paymentMethod,
      paymentRef,
      paymentStatus,
      currency: biz.currency,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      deliveryFee,
      total,
      lines,
      linkedTransactionId: tx.id,
      linkedInvoiceId: invoice.id,
      etimsCuin: cuin,
      notes: sanitizeText(req.body?.notes, 200) || undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.onlineOrders.unshift(order);

    // Sync Accounting GL
    const glRecord: ErpRecord = {
      id: `rec-acc-${crypto.randomUUID().slice(0, 6)}`,
      moduleId: 'accounting',
      businessId: biz.id,
      title: `JRNL-${order.orderNo} · Online Store Checkout (${paymentMethod})`,
      subtitle: `Auto-synced Online Order -> Inventory, Invoice ${invoice.invoiceNo}, CUIN ${cuin}`,
      status: 'Posted',
      amount: total,
      currency: biz.currency,
      date: now.slice(0, 10),
      meta: { orderNo, cuin, channel: 'eCommerce' },
    };
    db.erpRecords.unshift(glRecord);

    appendAudit({
      actor: customerName,
      role: 'Cashier',
      action: `Placed Online Order ${order.orderNo} (${biz.currency} ${total.toFixed(2)}) -> Deducted ${store.name} stock & issued ${invoice.invoiceNo}`,
      module: 'Online Orders',
      storeName: store.name,
    });
    saveDatabase();

    res.status(201).json({
      onlineOrder: order,
      transaction: tx,
      invoice,
      products: db.products,
      erpRecord: glRecord,
    });
  });

  app.patch('/api/online-orders/:id/status', (req: Request, res: Response) => {
    const order = db.onlineOrders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Online order not found.' });
      return;
    }
    const nextStatus = req.body?.fulfillmentStatus as OnlineOrderFulfillmentStatus;
    if (!['Pending', 'Confirmed & Packed', 'Dispatched', 'Delivered', 'Cancelled'].includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid fulfillment status.' });
      return;
    }
    const prevStatus = order.fulfillmentStatus;
    order.fulfillmentStatus = nextStatus;
    order.updatedAt = new Date().toISOString();

    let creditNote: SaleTransaction | undefined;
    const linkedInv = order.linkedInvoiceId
      ? db.invoices.find((i) => i.id === order.linkedInvoiceId)
      : undefined;

    if (nextStatus === 'Delivered' && order.paymentStatus === 'Pending COD') {
      order.paymentStatus = 'Paid';
      if (linkedInv) {
        linkedInv.status = 'Paid';
        linkedInv.amountPaid = linkedInv.total;
        linkedInv.balanceDue = 0;
        linkedInv.paidAt = order.updatedAt;
      }
    }

    // Restock inventory & issue eTIMS credit note on cancellation
    if (nextStatus === 'Cancelled' && prevStatus !== 'Cancelled') {
      order.paymentStatus = 'Refunded';
      for (const l of order.lines) {
        const prod = db.products.find((p) => p.id === l.productId && p.businessId === order.businessId);
        if (prod) {
          prod.stockByStore[order.storeId] = (prod.stockByStore[order.storeId] ?? 0) + l.qty;
        }
      }
      if (linkedInv) {
        linkedInv.status = 'Void';
        linkedInv.balanceDue = 0;
      }
      const origTx = order.linkedTransactionId
        ? db.transactions.find((t) => t.id === order.linkedTransactionId)
        : undefined;
      if (origTx) {
        const cnCuin = `KRA-CN-${String(db.transactions.length + 4913).padStart(6, '0')}`;
        creditNote = {
          ...structuredClone(origTx),
          id: `cn-${crypto.randomUUID().slice(0, 8)}`,
          receiptNo: `CN-${origTx.receiptNo}`,
          subtotal: -Math.abs(origTx.subtotal),
          taxAmount: -Math.abs(origTx.taxAmount),
          total: -Math.abs(origTx.total),
          etimsCuin: cnCuin,
          etimsStatus: 'Credit Note',
          referenceCuin: origTx.etimsCuin,
          customerName: `${origTx.customerName} (Online Order Cancelled)`,
          createdAt: order.updatedAt,
          syncedAt: order.updatedAt,
        };
        db.transactions.unshift(creditNote);
      }
    }

    appendAudit({
      actor: 'Order Fulfillment',
      role: 'Store Manager',
      action: `Updated Online Order ${order.orderNo} status: ${prevStatus} -> ${nextStatus}`,
      module: 'Online Orders',
      storeName: order.storeName,
    });
    saveDatabase();
    res.json({
      onlineOrder: order,
      products: db.products,
      invoices: db.invoices,
      creditNote,
    });
  });

  // --- BACKUPS & RESTORE ---
  app.get('/api/backups', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.query.businessId, 60);
    const list = businessId
      ? db.backups.filter((b) => b.businessId === businessId)
      : db.backups;
    res.json({ backups: list });
  });

  app.post('/api/backups', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const scope = req.body?.scope === 'platform' ? 'platform' : 'business';
    const label = sanitizeText(req.body?.label, 120) || `Snapshot ${new Date().toLocaleString()}`;
    const createdBy = sanitizeText(req.body?.createdBy, 80) || 'Business Admin';

    const biz = businessId ? db.businesses.find((b) => b.id === businessId) : undefined;
    if (scope === 'business' && !biz) {
      res.status(404).json({ error: 'Business not found for backup.' });
      return;
    }

    const payload =
      scope === 'business' && biz
        ? {
            business: structuredClone(biz),
            stores: structuredClone(db.stores.filter((s) => s.businessId === biz.id)),
            employees: structuredClone(db.employees.filter((e) => e.businessId === biz.id)),
            products: structuredClone(db.products.filter((p) => p.businessId === biz.id)),
            transactions: structuredClone(db.transactions.filter((t) => t.businessId === biz.id)),
            invoices: structuredClone(db.invoices.filter((i) => i.businessId === biz.id)),
            onlineOrders: structuredClone(db.onlineOrders.filter((o) => o.businessId === biz.id)),
            crmLeads: structuredClone(db.crmLeads.filter((c) => c.businessId === biz.id)),
            payrollRuns: structuredClone(db.payrollRuns.filter((r) => r.businessId === biz.id)),
            erpRecords: structuredClone(db.erpRecords.filter((r) => r.businessId === biz.id)),
          }
        : {
            businesses: structuredClone(db.businesses),
            stores: structuredClone(db.stores),
            employees: structuredClone(db.employees),
            products: structuredClone(db.products),
            transactions: structuredClone(db.transactions),
            invoices: structuredClone(db.invoices),
            onlineOrders: structuredClone(db.onlineOrders),
            crmLeads: structuredClone(db.crmLeads),
            payrollRuns: structuredClone(db.payrollRuns),
            erpRecords: structuredClone(db.erpRecords),
          };

    const jsonSize = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    const snapshot: BackupSnapshot = {
      id: `bkp-${crypto.randomUUID().slice(0, 8)}`,
      businessId: biz?.id,
      scope,
      label,
      createdBy,
      createdAt: new Date().toISOString(),
      sizeBytes: jsonSize,
      counts: {
        stores: (payload.stores as unknown[]).length,
        employees: (payload.employees as unknown[]).length,
        products: (payload.products as unknown[]).length,
        transactions: (payload.transactions as unknown[]).length,
        invoices: (payload.invoices as unknown[]).length,
        onlineOrders: (payload.onlineOrders as unknown[]).length,
      },
      payload,
    };

    db.backups.unshift(snapshot);
    appendAudit({
      actor: createdBy,
      role: 'Owner',
      action: `Created ${scope} backup snapshot "${label}" (${Math.round(jsonSize / 1024)} KB)`,
      module: 'Backup & Restore',
      storeName: biz?.name || 'Platform Global',
    });
    saveDatabase();
    res.status(201).json({ backup: snapshot });
  });

  function applyBusinessBackupPayload(bizId: string, payload: Record<string, any>) {
    if (payload.business && typeof payload.business === 'object') {
      const idx = db.businesses.findIndex((b) => b.id === bizId);
      if (idx >= 0) db.businesses[idx] = structuredClone(payload.business);
      else db.businesses.push(structuredClone(payload.business));
    }
    const replaceSlice = <T extends { businessId: string }>(arr: T[], incoming: unknown): T[] => {
      if (!Array.isArray(incoming)) return arr;
      return [...arr.filter((x) => x.businessId !== bizId), ...structuredClone(incoming as T[])];
    };
    db.stores = replaceSlice(db.stores, payload.stores);
    db.employees = replaceSlice(db.employees, payload.employees);
    db.products = replaceSlice(db.products, payload.products);
    db.transactions = replaceSlice(db.transactions, payload.transactions);
    db.invoices = replaceSlice(db.invoices, payload.invoices);
    db.onlineOrders = replaceSlice(db.onlineOrders, payload.onlineOrders);
    db.crmLeads = replaceSlice(db.crmLeads, payload.crmLeads);
    db.payrollRuns = replaceSlice(db.payrollRuns, payload.payrollRuns);
    db.erpRecords = replaceSlice(db.erpRecords, payload.erpRecords);
  }

  app.post('/api/backups/:id/restore', (req: Request, res: Response) => {
    const snap = db.backups.find((b) => b.id === req.params.id);
    if (!snap) {
      res.status(404).json({ error: 'Backup snapshot not found.' });
      return;
    }
    if (snap.scope === 'business' && snap.businessId) {
      applyBusinessBackupPayload(snap.businessId, snap.payload as Record<string, any>);
    }
    appendAudit({
      actor: 'System Restore',
      role: 'Owner',
      action: `Restored backup snapshot "${snap.label}" (${snap.createdAt})`,
      module: 'Backup & Restore',
      storeName: snap.businessId || 'Platform Global',
    });
    saveDatabase();
    res.json({
      restored: true,
      businesses: db.businesses,
      stores: db.stores,
      employees: db.employees,
      products: db.products,
      transactions: db.transactions,
      invoices: db.invoices,
      onlineOrders: db.onlineOrders,
      crmLeads: db.crmLeads,
      payrollRuns: db.payrollRuns,
      erpRecords: db.erpRecords,
    });
  });

  app.post('/api/backups/import', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const payload = req.body?.payload;
    if (!businessId || !payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Valid businessId and backup JSON payload required.' });
      return;
    }
    applyBusinessBackupPayload(businessId, payload as Record<string, any>);
    appendAudit({
      actor: 'System Restore',
      role: 'Owner',
      action: `Imported & restored JSON backup archive for business ${businessId}`,
      module: 'Backup & Restore',
      storeName: businessId,
    });
    saveDatabase();
    res.json({
      restored: true,
      businesses: db.businesses,
      stores: db.stores,
      employees: db.employees,
      products: db.products,
      transactions: db.transactions,
      invoices: db.invoices,
      onlineOrders: db.onlineOrders,
      crmLeads: db.crmLeads,
      payrollRuns: db.payrollRuns,
      erpRecords: db.erpRecords,
    });
  });

  // --- POS HARDWARE PERIPHERALS & EMV CARD TERMINAL (PDQ) ---
  app.post('/api/pos/card-terminal/charge', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const provider = sanitizeText(req.body?.provider, 60) || 'Pesapal Sabi PDQ';
    const terminalId = sanitizeText(req.body?.terminalId, 60) || 'PDQ-01';
    const cardLast4 = sanitizeText(req.body?.cardLast4, 4).replace(/[^0-9]/g, '') || '4821';
    const schemeInput = sanitizeText(req.body?.cardScheme, 20);
    const cardScheme: 'VISA' | 'MASTERCARD' | 'AMEX' = ['VISA', 'MASTERCARD', 'AMEX'].includes(schemeInput)
      ? (schemeInput as 'VISA' | 'MASTERCARD' | 'AMEX')
      : 'VISA';
    const cvmInput = sanitizeText(req.body?.cvmMethod, 30);
    const cvmMethod: 'NFC Contactless' | 'EMV Chip + PIN' =
      cvmInput === 'EMV Chip + PIN' ? 'EMV Chip + PIN' : 'NFC Contactless';
    const amount = Number(req.body?.amount) || 0;
    const currency = sanitizeText(req.body?.currency, 8) || 'KES';

    const biz = db.businesses.find((b) => b.id === businessId);
    if (!biz) {
      res.status(404).json({ error: 'Business not found for card PDQ charge.' });
      return;
    }
    if (amount <= 0) {
      res.status(400).json({ error: 'Card charge amount must exceed 0.' });
      return;
    }
    const cardGw = biz.paymentGateways.find(
      (g) => g.enabled && (g.provider === 'pesapal_card' || /card|pdq|visa|pesapal|stripe/i.test(g.mode + g.displayName))
    );
    if (!cardGw) {
      res.status(400).json({ error: 'No Card / PDQ Payment Gateway is enabled for this business.' });
      return;
    }

    const authCode = `AUTH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rrn = `RRN${Date.now().toString().slice(-9)}`;
    const aid = cardScheme === 'MASTERCARD' ? 'A0000000041010' : 'A0000000031010';
    const storeName = db.stores.find((s) => s.id === storeId)?.name || biz.name;

    appendAudit({
      actor: terminalId,
      role: 'Cashier',
      action: `EMV Card Approved via ${provider} (${cardScheme} •••• ${cardLast4}, ${cvmMethod}) · ${currency} ${amount.toFixed(2)} · Auth ${authCode}`,
      module: 'POS Card PDQ',
      storeName,
    });
    saveDatabase();

    res.json({
      approved: true,
      authCode,
      rrn,
      maskedPan: `•••• •••• •••• ${cardLast4}`,
      cardScheme,
      cvmMethod,
      aid,
      terminalId,
      provider,
      amount,
      currency,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/pos/hardware/log', (req: Request, res: Response) => {
    const businessId = sanitizeText(req.body?.businessId, 60);
    const storeId = sanitizeText(req.body?.storeId, 60);
    const actor = sanitizeText(req.body?.actor, 80) || 'Cashier';
    const role: UserRole = isValidRole(req.body?.role) ? req.body.role : 'Cashier';
    const event = sanitizeText(req.body?.event, 80) || 'drawer_kick';
    const detail = sanitizeText(req.body?.detail, 200) || 'Hardware pulse dispatched';

    const store = db.stores.find((s) => s.id === storeId);
    const biz = db.businesses.find((b) => b.id === businessId);

    appendAudit({
      actor,
      role,
      action: `POS Hardware (${event}): ${detail}`,
      module: 'POS Hardware',
      storeName: store?.name || biz?.name || 'POS Register',
    });
    saveDatabase();
    res.json({ logged: true });
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
