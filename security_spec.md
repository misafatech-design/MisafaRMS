# MisafaRMS Security Specification (Firestore Rules TDD)

## 1. Data Invariants
1. **Owner & Admin Isolation**: Every `/businesses/{businessId}` and its subcollections (`/employees`, `/stores`, `/products`, `/transactions`, `/erpRecords`, `/auditLogs`) belong to an authenticated `ownerId == request.auth.uid` or verified platform admin (`misafatech@gmail.com` with `email_verified == true` or `/admins/$(request.auth.uid)`).
2. **Account Tier Separation**: Users cannot self-escalate `accountType` to `'admin'` during `/users/{userId}` creation or updates; only `'user'` or `'employee'` may be claimed by standard sign-ins unless verified as the bootstrapped admin.
3. **PII Isolation**: User email and phone reside strictly in `/users/{userId}/private/{docId}` readable/writable only by the owning UID or verified Admin.
4. **Immutable Ownership & Timestamps**: `ownerId` and `createdAt` cannot be modified after creation.
5. **Strict Key & Size Bounds**: Every write validates required fields, rejects unknown shadow keys via `hasOnly()`, enforces `.size()` limits on all strings and bounded arrays (`installedModuleIds.size() <= 80`), and validates path IDs with `isValidId()`.

## 2. Dirty Dozen Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read `/businesses/biz-savannah` with `request.auth == null`.
2. **Self-Admin Escalation**: Create `/users/attacker1` with `{ uid: "attacker1", accountType: "admin" }` from non-admin email.
3. **Ghost Shadow Field**: Create `/businesses/biz-1` adding `{ isPlatformMaster: true }`.
4. **Email Spoofing (Unverified)**: Access admin route with `email: "misafatech@gmail.com"` and `email_verified: false`.
5. **Cross-Tenant Theft**: Non-owner UID reads or lists `/businesses/biz-other/transactions`.
6. **PII Scraping**: Non-owner UID reads `/users/victim1/private/profile`.
7. **ID Poisoning**: Write `/businesses/bad$id..9999` violating `^[a-zA-Z0-9_-]+$` and `size() <= 128`.
8. **Ownership Hijack on Update**: Update `/businesses/biz-1` changing `ownerId` to attacker UID.
9. **Terminal Transaction Tampering**: Non-admin updates a `'Transmitted'` transaction's `total` or `etimsCuin`.
10. **Array Flood**: Create `/businesses/biz-1` with `installedModuleIds` list exceeding 80 entries.
11. **Timestamp Forgery**: Create `/users/u1` with client-forged `createdAt` instead of `request.time` (or non-matching server timestamp).
12. **Employee PIN Brute/Hijack**: Portal `'user'` attempts to list `/businesses/biz-1/employees`.
