import { TaxCode, UserRole } from '../types/erp';

const KEY_STORAGE_NAME = 'misafa_local_aes_key_v1';

async function getOrCreateLocalAesKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }
  const existing = window.localStorage.getItem(KEY_STORAGE_NAME);
  if (existing) {
    const raw = Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
    return window.crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  }
  const key = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const exported = await window.crypto.subtle.exportKey('raw', key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  window.localStorage.setItem(KEY_STORAGE_NAME, b64);
  return key;
}

export async function encryptOfflinePayload(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  try {
    const key = await getOrCreateLocalAesKey();
    if (!key) return btoa(unescape(encodeURIComponent(json)));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(json);
    const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const ivB64 = btoa(String.fromCharCode(...iv));
    const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
    return `AES-GCM:${ivB64}:${cipherB64}`;
  } catch {
    return btoa(unescape(encodeURIComponent(json)));
  }
}

export async function decryptOfflinePayload<T>(token: string): Promise<T | null> {
  try {
    if (!token.startsWith('AES-GCM:')) {
      return JSON.parse(decodeURIComponent(escape(atob(token)))) as T;
    }
    const [, ivB64, cipherB64] = token.split(':');
    const key = await getOrCreateLocalAesKey();
    if (!key) return null;
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
    const plainBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plainBuffer)) as T;
  } catch {
    return null;
  }
}

export function formatMoney(amount: number, currency = 'KES'): string {
  const formatted = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}

export function getTaxRate(code: TaxCode, defaultVatRate = 16): number {
  if (code === 'B_16') return defaultVatRate / 100;
  return 0;
}

export function getTaxLabel(code: TaxCode, vatRate = 16): string {
  switch (code) {
    case 'B_16':
      return `VAT ${vatRate}% (Code B)`;
    case 'E_0':
      return 'Zero-Rated 0% (Code E)';
    case 'A_EXEMPT':
      return 'Exempt (Code A)';
  }
}

/**
 * Kenya Statutory Payroll Calculation (2025/2026 rates):
 * - NSSF Tier I & II: 6% up to KES 36,000 cap (max KES 2,160 employee, matched by employer)
 * - SHIF (Social Health Insurance Fund): 2.75% of gross salary
 * - Affordable Housing Levy (AHL): 1.5% of gross salary
 * - PAYE bands on taxable pay (Gross - NSSF) minus Personal Relief KES 2,400
 */
export function calculateKenyaPayroll(grossSalary: number) {
  const nssf = Math.min(grossSalary * 0.06, 2160);
  const shif = Math.round(grossSalary * 0.0275 * 100) / 100;
  const housingLevy = Math.round(grossSalary * 0.015 * 100) / 100;
  const taxablePay = Math.max(0, grossSalary - nssf);

  let payeBeforeRelief = 0;
  let remaining = taxablePay;

  const band1 = Math.min(remaining, 24000);
  payeBeforeRelief += band1 * 0.1;
  remaining -= band1;

  if (remaining > 0) {
    const band2 = Math.min(remaining, 8333);
    payeBeforeRelief += band2 * 0.25;
    remaining -= band2;
  }
  if (remaining > 0) {
    const band3 = Math.min(remaining, 467667);
    payeBeforeRelief += band3 * 0.3;
    remaining -= band3;
  }
  if (remaining > 0) {
    const band4 = Math.min(remaining, 300000);
    payeBeforeRelief += band4 * 0.325;
    remaining -= band4;
  }
  if (remaining > 0) {
    payeBeforeRelief += remaining * 0.35;
  }

  const personalRelief = 2400;
  const insuranceRelief = shif * 0.15;
  const paye = Math.max(0, Math.round((payeBeforeRelief - personalRelief - insuranceRelief) * 100) / 100);
  const totalDeductions = paye + nssf + shif + housingLevy;
  const netPay = Math.max(0, Math.round((grossSalary - totalDeductions) * 100) / 100);

  return {
    grossSalary,
    nssf,
    shif,
    housingLevy,
    taxablePay,
    paye,
    totalDeductions,
    netPay,
  };
}

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    maxDiscountPct: number;
    canVoidSale: boolean;
    canViewEtims: boolean;
    canEditInventory: boolean;
    canManageUsers: boolean;
    canUseStudio: boolean;
    canApprovePo: boolean;
    canViewPayroll: boolean;
  }
> = {
  Owner: {
    maxDiscountPct: 100,
    canVoidSale: true,
    canViewEtims: true,
    canEditInventory: true,
    canManageUsers: true,
    canUseStudio: true,
    canApprovePo: true,
    canViewPayroll: true,
  },
  'Store Manager': {
    maxDiscountPct: 25,
    canVoidSale: true,
    canViewEtims: true,
    canEditInventory: true,
    canManageUsers: false,
    canUseStudio: true,
    canApprovePo: true,
    canViewPayroll: false,
  },
  Cashier: {
    maxDiscountPct: 5,
    canVoidSale: false,
    canViewEtims: false,
    canEditInventory: false,
    canManageUsers: false,
    canUseStudio: false,
    canApprovePo: false,
    canViewPayroll: false,
  },
  'Inventory Clerk': {
    maxDiscountPct: 0,
    canVoidSale: false,
    canViewEtims: false,
    canEditInventory: true,
    canManageUsers: false,
    canUseStudio: false,
    canApprovePo: false,
    canViewPayroll: false,
  },
  Accountant: {
    maxDiscountPct: 0,
    canVoidSale: false,
    canViewEtims: true,
    canEditInventory: false,
    canManageUsers: false,
    canUseStudio: false,
    canApprovePo: true,
    canViewPayroll: true,
  },
  'Field Agent': {
    maxDiscountPct: 10,
    canVoidSale: false,
    canViewEtims: false,
    canEditInventory: false,
    canManageUsers: false,
    canUseStudio: false,
    canApprovePo: false,
    canViewPayroll: false,
  },
};
