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

export type LayoutMode = 'retail_shelves' | 'restaurant_tables' | 'hybrid';

export type SlotStatus = 'available' | 'occupied' | 'needs_clearing' | 'needs_restock';

export interface ZoneSlot {
  id: string;
  code: string;
  label: string;
  capacity: number;
  status: SlotStatus;
  assignedEmployeeName?: string;
  activeOrderTotal?: number;
  lastUpdatedAt?: string;
}

export interface BusinessZone {
  id: string;
  storeId: string;
  name: string;
  kind: 'floor' | 'section';
  slots: ZoneSlot[];
}

export interface BusinessLayoutConfig {
  layoutMode: LayoutMode;
  zoneLabel: string;
  slotLabel: string;
  autoMarkTableNeedsClearing: boolean;
  showShelfOnPosTile: boolean;
  zones: BusinessZone[];
}

export interface CategoryGroup {
  id: string;
  name: string;
  subCategories: string[];
}

export interface PromoOffer {
  id: string;
  name: string;
  code?: string;
  type: 'percent_off' | 'fixed_off' | 'min_qty_percent';
  value: number;
  minQty?: number;
  minSpend?: number;
  targetCategory: string;
  active: boolean;
  badgeText: string;
}

export interface ShiftAttendanceLog {
  id: string;
  businessId: string;
  employeeId: string;
  employeeName: string;
  role: UserRole;
  branchId: string;
  action: 'clock_in' | 'clock_out';
  timestamp: string;
  note?: string;
}

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
  clockedIn?: boolean;
  lastClockInAt?: string;
  lastClockOutAt?: string;
  tipsEarned?: number;
  ratingAvg?: number;
  ratingCount?: number;
  ordersHandled?: number;
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

export type SubscriptionPlanId = 'Trial' | 'Starter' | 'Multi-Store Pro' | 'Enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'suspended';

export interface SubscriptionPlanTier {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  monthlyPriceKes: number;
  monthlyPriceUsd: number;
  branchLimit: number;
  userLimit: number;
  etimsIncluded: boolean;
  highlighted?: boolean;
}

export interface PlatformBillingGateway {
  id: string;
  provider:
    | 'mpesa_daraja_saas'
    | 'airtel_money_saas'
    | 'pesapal_saas'
    | 'stripe_global'
    | 'bank_eft'
    | 'custom';
  displayName: string;
  enabled: boolean;
  mode:
    | 'Paybill'
    | 'Merchant Till'
    | 'Card & Mobile'
    | 'International Card'
    | 'Bank EFT / RTGS'
    | 'Custom';
  shortcodeOrAccount: string;
  accountPrefix: string;
  currencies: string[];
  environment: 'Production' | 'Sandbox';
  webhookUrl: string;
  hasSecretConfigured: boolean;
  settlementSchedule: string;
  instructions?: string;
}

export interface PlatformUserRecord {
  id: string;
  name: string;
  email: string;
  tier: 'super_admin' | 'admin' | 'employee' | 'user';
  role: UserRole | 'Super Admin' | 'Customer';
  businessId?: string;
  businessName?: string;
  businessSlug?: string;
  status: 'active' | 'suspended';
  emailVerified: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface SubscriptionInvoice {
  id: string;
  invoiceNo: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  planId: SubscriptionPlanId;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod: string;
  paymentRef: string;
  periodLabel: string;
  dueDate: string;
  paidAt?: string;
}

export interface BusinessEntity {
  id: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
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
  subscriptionPlan?: SubscriptionPlanId;
  subscriptionStatus?: SubscriptionStatus;
  monthlyFee?: number;
  branchLimit?: number;
  subscriptionRenewsAt?: string;
  // eCommerce & Domain Configuration
  ecommerceEnabled?: boolean;
  customDomain?: string;
  domainVerified?: boolean;
  dnsToken?: string;
  storefrontTagline?: string;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
  storefrontPickupEnabled?: boolean;
  installedModuleIds: string[];
  posConfig: PosCustomizationConfig;
  paymentGateways: PaymentGatewayConfig[];
  layoutConfig?: BusinessLayoutConfig;
  catalogTaxonomy?: CategoryGroup[];
  offers?: PromoOffer[];
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
  subCategory?: string;
  zoneId?: string;
  slotId?: string;
  shelfCode?: string;
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
  offerName?: string;
  offerDiscount?: number;
  tipAmount?: number;
  tableOrSlotLabel?: string;
  staffRating?: number;
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

export type OnlineOrderFulfillmentStatus =
  | 'Pending'
  | 'Confirmed & Packed'
  | 'Dispatched'
  | 'Delivered'
  | 'Cancelled';

export interface OnlineOrderLine {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  taxCode: TaxCode;
  lineTotal: number;
}

export interface OnlineOrder {
  id: string;
  orderNo: string;
  businessId: string;
  storeId: string;
  storeName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerPin?: string;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddress: string;
  fulfillmentStatus: OnlineOrderFulfillmentStatus;
  paymentMethod: string;
  paymentRef: string;
  paymentStatus: 'Paid' | 'Pending COD' | 'Refunded';
  currency: string;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
  lines: OnlineOrderLine[];
  linkedTransactionId?: string;
  linkedInvoiceId?: string;
  etimsCuin?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxInvoiceRecord {
  id: string;
  invoiceNo: string;
  businessId: string;
  storeId: string;
  storeName: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerPin?: string;
  docType: 'Tax Invoice' | 'Proforma Quote';
  status: 'Draft' | 'Unpaid' | 'Partial' | 'Paid' | 'Void';
  currency: string;
  lines: Array<{
    productId?: string;
    sku: string;
    name: string;
    qty: number;
    unitPrice: number;
    taxCode: TaxCode;
    lineTotal: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  etimsCuin?: string;
  linkedTransactionId?: string;
  createdAt: string;
  paidAt?: string;
}

export interface CrmCustomerLead {
  id: string;
  businessId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  kraPin?: string;
  stage: 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Customer';
  expectedValue: number;
  notes?: string;
  source: 'POS' | 'Online Store' | 'Manual' | 'B2B Referral';
  createdAt: string;
}

export interface PayrollRunPayslip {
  employeeId: string;
  employeeName: string;
  role: UserRole;
  grossSalary: number;
  nssf: number;
  shif: number;
  housingLevy: number;
  taxablePay: number;
  paye: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollRunRecord {
  id: string;
  businessId: string;
  periodLabel: string;
  employeeCount: number;
  currency: string;
  totalGross: number;
  totalPaye: number;
  totalShif: number;
  totalNssf: number;
  totalHousingLevy: number;
  totalNet: number;
  totalEmployerCost: number;
  status: 'Posted' | 'Paid';
  payslips: PayrollRunPayslip[];
  createdAt: string;
}

export interface BackupSnapshot {
  id: string;
  businessId?: string;
  scope: 'business' | 'platform';
  label: string;
  createdBy: string;
  createdAt: string;
  sizeBytes: number;
  counts: {
    stores: number;
    employees: number;
    products: number;
    transactions: number;
    invoices: number;
    onlineOrders: number;
  };
  payload: Record<string, unknown>;
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
    | 'invoicing'
    | 'crm'
    | 'accounting'
    | 'ecommerce'
    | 'online_orders'
    | 'backups'
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
