export type AccountTier = 'admin' | 'employee' | 'user';

export type UserRole =
  | 'Owner'
  | 'Store Manager'
  | 'Cashier'
  | 'Inventory Clerk'
  | 'Accountant'
  | 'Field Agent';

export type TaxCode = 'B_16' | 'E_0' | 'A_EXEMPT';

export type PaymentMethod = string;

export interface PosCustomizationConfig {
  receiptHeader: string;
  receiptFooter: string;
  paperWidth: '80mm' | 'A4';
  gridDensity: 'comfortable' | 'compact';
  barcodeAutoFocus: boolean;
  soundBeep: boolean;
  requirePinPerShift: boolean;
  quickCashNotes: number[];
}

export interface PaymentGatewayConfig {
  id: string;
  provider: 'mpesa_daraja' | 'airtel_money' | 'pesapal_card' | 'tkash' | 'bank_rtgs' | 'cash' | 'custom';
  displayName: string;
  enabled: boolean;
  mode: 'Paybill' | 'Buy Goods Till' | 'Card Terminal' | 'Cash Drawer' | 'Bank Transfer' | 'Custom';
  shortcodeOrTill: string;
  accountPrefix: string;
  environment: 'Production' | 'Sandbox';
  stkPushSupported: boolean;
}

export interface EmployeePermissionSet {
  maxDiscountPct: number;
  canVoidSale: boolean;
  canOpenDrawer: boolean;
  canViewCostPrice: boolean;
  canEditInventory: boolean;
  canViewEtims: boolean;
  canExportReports: boolean;
  canManagePayments: boolean;
}

export interface EmployeeRecord {
  id: string;
  businessId: string;
  ownerId?: string;
  name: string;
  email: string;
  role: UserRole;
  pinCode: string;
  branchId: string;
  grossSalary: number;
  active: boolean;
  permissions: EmployeePermissionSet;
  avatarUrl?: string;
  createdAt: string;
}

export interface StoreBranch {
  id: string;
  businessId: string;
  name: string;
  code: string;
  location: string;
  etimsBhfId: string;
  vscuSerial: string;
  tillNumber: string;
  registerId: string;
  isActive: boolean;
}

export interface BusinessEntity {
  id: string;
  ownerId?: string;
  slug: string;
  name: string;
  country: 'KE' | 'UG' | 'TZ' | 'GB' | 'US';
  currency: 'KES' | 'UGX' | 'TZS' | 'GBP' | 'USD';
  taxAuthority: string;
  taxPin: string;
  vatRate: number;
  etimsEnabled: boolean;
  etimsMode: 'OSCU' | 'VSCU' | 'Standard';
  paybillOrTill: string;
  installedModuleIds: string[];
  posConfig: PosCustomizationConfig;
  paymentGateways: PaymentGatewayConfig[];
  createdAt: string;
}

export interface ProductItem {
  id: string;
  businessId: string;
  ownerId?: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  taxCode: TaxCode;
  unit: string;
  reorderPoint: number;
  imageUrl?: string;
  variants?: string[];
  stockByStore: Record<string, number>;
}

export interface CartLine {
  product: ProductItem;
  qty: number;
  discountPct: number;
}

export interface SaleTransaction {
  id: string;
  ownerId?: string;
  receiptNo: string;
  businessId: string;
  storeId: string;
  storeName: string;
  cashierRole: UserRole;
  cashierName: string;
  customerName: string;
  customerPin?: string;
  customerPhone?: string;
  customerEmail?: string;
  emailedTo?: string;
  channel: 'POS' | 'Field Agent' | 'eCommerce' | 'Restaurant';
  paymentMethod: PaymentMethod;
  paymentRef: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountTotal: number;
  total: number;
  amountTendered: number;
  changeDue: number;
  etimsCuin: string;
  etimsStatus: 'Transmitted' | 'Queued Offline' | 'Pending Retry' | 'Credit Note';
  referenceCuin?: string;
  etimsQrData: string;
  lines: Array<{
    productId: string;
    sku: string;
    name: string;
    qty: number;
    unitPrice: number;
    discountPct: number;
    taxCode: TaxCode;
    lineTotal: number;
  }>;
  createdAt: string;
  syncedAt?: string;
  encryptedOffline?: boolean;
}

export interface StudioField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'relation';
  required: boolean;
}

export interface StudioModel {
  id: string;
  name: string;
  technicalName: string;
  category: string;
  description: string;
  fields: StudioField[];
  recordsCount: number;
}

export interface WorkflowAutomation {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  active: boolean;
  executions: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  action: string;
  module: string;
  storeName: string;
  ipOrDevice: string;
  hashPrefix: string;
  emailNotified: boolean;
  recipientEmail?: string;
}

export interface ErpRecord {
  id: string;
  ownerId?: string;
  moduleId: string;
  businessId: string;
  title: string;
  subtitle: string;
  status: string;
  amount?: number;
  currency?: string;
  date: string;
  meta: Record<string, string | number>;
}

export interface AppModuleMeta {
  id: string;
  name: string;
  category:
    | 'Website'
    | 'Sales'
    | 'Finance'
    | 'Services'
    | 'Productivity'
    | 'Supply Chain'
    | 'Marketing'
    | 'Human Resources'
    | 'Customizations'
    | 'Kenya & Enterprise';
  description: string;
  iconName: string;
  accentColor: string;
  adminOnly?: boolean;
  portalVisible?: boolean;
  specialView?:
    | 'pos'
    | 'pos_admin'
    | 'etims'
    | 'analytics'
    | 'studio'
    | 'field'
    | 'governance'
    | 'api'
    | 'timeline'
    | 'payments'
    | 'portal';
  kenyaHighlight?: string;
}
