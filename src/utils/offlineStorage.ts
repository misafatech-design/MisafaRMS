import {
  BusinessEntity,
  CartLine,
  EmployeeRecord,
  PaymentMethod,
  ProductItem,
  SaleTransaction,
  StoreBranch,
} from '../types/erp';

const IDB_NAME = 'misafarms_pwa_offline_v1';
const IDB_VERSION = 1;
const STORE_WORKSPACE = 'workspace_cache';
const STORE_POS_DRAFTS = 'pos_drafts';
const STORE_OFFLINE_QUEUE = 'offline_queue';

const LS_WORKSPACE_KEY = 'misafarms_workspace_snapshot_v1';
const LS_DRAFT_PREFIX = 'misafarms_pos_draft_v1:';
const LS_QUEUE_KEY = 'misafarms_encrypted_offline_queue_v1';

export interface OfflineWorkspaceSnapshot {
  businesses: BusinessEntity[];
  stores: StoreBranch[];
  employees: EmployeeRecord[];
  products: ProductItem[];
  transactions: SaleTransaction[];
  savedAt: string;
}

export interface PersistedPosDraft {
  businessId: string;
  storeId: string;
  cart: CartLine[];
  heldCarts: Array<{
    id: string;
    customer: string;
    lines: CartLine[];
    tableLabel?: string;
  }>;
  customerName: string;
  customerPin: string;
  customerPhone: string;
  customerEmail: string;
  selectedOfferId: string;
  tipInput: string;
  selectedTableSlot: {
    zoneId: string;
    slotId: string;
    label: string;
  } | null;
  paymentMethod: PaymentMethod;
  tenderedInput: string;
  activeEmployeeId?: string | null;
  unlockedAt?: string;
  updatedAt: string;
}

export interface OfflineQueueItem {
  id: string;
  receiptNo: string;
  businessId: string;
  storeId: string;
  total: number;
  currency: string;
  paymentMethod: string;
  cashierName: string;
  customerName: string;
  createdAt: string;
  cipher: string;
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WORKSPACE)) {
          db.createObjectStore(STORE_WORKSPACE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_POS_DRAFTS)) {
          db.createObjectStore(STORE_POS_DRAFTS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_QUEUE)) {
          db.createObjectStore(STORE_OFFLINE_QUEUE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function requestPersistentBrowserStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function saveWorkspaceSnapshot(snapshot: OfflineWorkspaceSnapshot): Promise<void> {
  try {
    const compact: OfflineWorkspaceSnapshot = {
      ...snapshot,
      transactions: snapshot.transactions.slice(0, 120),
    };
    try {
      window.localStorage.setItem(LS_WORKSPACE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore quota exceeded on localStorage; IndexedDB handles larger payloads
    }

    const db = await openOfflineDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_WORKSPACE, 'readwrite');
        tx.objectStore(STORE_WORKSPACE).put({ key: 'latest', ...compact });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore storage failures
  }
}

export async function loadWorkspaceSnapshot(): Promise<OfflineWorkspaceSnapshot | null> {
  try {
    const db = await openOfflineDb();
    if (db) {
      const idbResult = await new Promise<OfflineWorkspaceSnapshot | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_WORKSPACE, 'readonly');
          const req = tx.objectStore(STORE_WORKSPACE).get('latest');
          req.onsuccess = () => {
            const val = req.result as (OfflineWorkspaceSnapshot & { key?: string }) | undefined;
            resolve(val && Array.isArray(val.businesses) ? val : null);
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (idbResult) return idbResult;
    }

    const raw = window.localStorage.getItem(LS_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineWorkspaceSnapshot;
    return parsed && Array.isArray(parsed.businesses) ? parsed : null;
  } catch {
    return null;
  }
}

function getDraftKey(businessId: string, storeId: string): string {
  return `${businessId}::${storeId}`;
}

export async function savePosRegisterDraft(draft: PersistedPosDraft): Promise<void> {
  const key = getDraftKey(draft.businessId, draft.storeId);
  try {
    window.localStorage.setItem(`${LS_DRAFT_PREFIX}${key}`, JSON.stringify(draft));
  } catch {
    // Ignore quota failure
  }
  try {
    const db = await openOfflineDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_POS_DRAFTS, 'readwrite');
        tx.objectStore(STORE_POS_DRAFTS).put({ key, ...draft });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore IDB failure
  }
}

export function loadPosRegisterDraftSync(
  businessId: string,
  storeId: string
): PersistedPosDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LS_DRAFT_PREFIX}${getDraftKey(businessId, storeId)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPosDraft;
    return parsed && parsed.businessId === businessId ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadPosRegisterDraft(
  businessId: string,
  storeId: string
): Promise<PersistedPosDraft | null> {
  const key = getDraftKey(businessId, storeId);
  try {
    const db = await openOfflineDb();
    if (db) {
      const fromIdb = await new Promise<PersistedPosDraft | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_POS_DRAFTS, 'readonly');
          const req = tx.objectStore(STORE_POS_DRAFTS).get(key);
          req.onsuccess = () => {
            const val = req.result as (PersistedPosDraft & { key?: string }) | undefined;
            resolve(val && val.businessId === businessId ? val : null);
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (fromIdb) return fromIdb;
    }
  } catch {
    // Fallback to sync localStorage
  }
  return loadPosRegisterDraftSync(businessId, storeId);
}

export async function clearPosRegisterDraft(businessId: string, storeId: string): Promise<void> {
  const key = getDraftKey(businessId, storeId);
  try {
    window.localStorage.removeItem(`${LS_DRAFT_PREFIX}${key}`);
  } catch {
    // Ignore
  }
  try {
    const db = await openOfflineDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_POS_DRAFTS, 'readwrite');
        tx.objectStore(STORE_POS_DRAFTS).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore
  }
}

export async function saveOfflineQueueItems(items: OfflineQueueItem[]): Promise<void> {
  try {
    window.localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Ignore
  }
  try {
    const db = await openOfflineDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_OFFLINE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_OFFLINE_QUEUE);
        store.clear();
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore
  }
}

export async function loadOfflineQueueItems(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openOfflineDb();
    if (db) {
      const fromIdb = await new Promise<OfflineQueueItem[] | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_OFFLINE_QUEUE, 'readonly');
          const req = tx.objectStore(STORE_OFFLINE_QUEUE).getAll();
          req.onsuccess = () => {
            const rows = req.result as OfflineQueueItem[];
            resolve(Array.isArray(rows) ? rows : null);
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      if (fromIdb && fromIdb.length > 0) return fromIdb;
    }

    const raw = window.localStorage.getItem(LS_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Backward-compatible migration if older entries were raw cipher strings
    return parsed
      .map((entry, idx): OfflineQueueItem | null => {
        if (typeof entry === 'string') {
          return {
            id: `legacy-${idx}`,
            receiptNo: `QUEUED-${idx + 1}`,
            businessId: '',
            storeId: '',
            total: 0,
            currency: 'KES',
            paymentMethod: 'Offline',
            cashierName: 'Staff',
            customerName: 'Customer',
            createdAt: new Date().toISOString(),
            cipher: entry,
          };
        }
        if (entry && typeof entry === 'object' && typeof entry.cipher === 'string') {
          return entry as OfflineQueueItem;
        }
        return null;
      })
      .filter((x): x is OfflineQueueItem => x !== null);
  } catch {
    return [];
  }
}
