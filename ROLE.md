# Shadows of Melody Authorization System

Version: 2.0

---

# Core Principle

The system must never authorize actions based solely on role.

Authorization is determined by:

```text
User
→ Assignments
→ Permissions
→ Scopes
→ Policies
→ Authorization Decision
```

Every request must be evaluated through permissions and scopes.

Never check role directly inside business logic.

Bad:

```typescript
if (user.role === "ADMIN")
```

Good:

```typescript
if (hasPermission(user, "song:delete_any"))
```

---

# Authorization Model

A request is authorized only if:

```text
1. User has required permission

AND

2. Resource matches assignment scope

AND

3. Security policies pass
```

Otherwise:

```text
DENY
```

---

# Definitions

## Role

Role is only a job title.

Role does not automatically grant unrestricted access.

Examples:

```text
ADMIN

CONTENT_MANAGER

USER_MANAGER

ARTIST_MANAGER

FINANCE_MANAGER

VERIFIED_ARTIST

PENDING_ARTIST

PREMIUM_USER

FREE_USER
```

---

## Permission

Permission defines what a user can do.

Examples:

```text
song:approve

song:feature

song:edit_any

user:ban

payment:refund
```

---

## Scope

Scope defines where a permission can be applied.

Examples:

```json
{
  "genres": ["V-Pop"],
  "regions": ["VN"]
}
```

```json
{
  "genres": ["K-Pop"],
  "regions": ["KR"]
}
```

Two users may have the same permission but different scopes.

---

## Assignment

Assignment is the actual authorization unit.

An assignment connects:

```text
User
Role
Permissions
Scopes
```

Authorization must be resolved through assignments.

---

# Permission Catalog

## Song

```text
song:read

song:upload

song:create

song:edit_own

song:edit_any

song:delete_own

song:delete_any

song:approve

song:feature

song:publish

song:unpublish
```

---

## Album

```text
album:create

album:edit_own

album:edit_any

album:delete_own

album:delete_any

album:publish

album:unpublish
```

---

## Artist

```text
artist:request

artist:approve

artist:reject

artist:revoke
```

---

## User

```text
user:view

user:edit_own

user:edit_any

user:ban

user:unban

user:delete

user:verify

role:assign
```

---

## Finance

```text
subscription:view

subscription:manage

payment:view

payment:refund
```

---

## System

```text
audit_log:view

audit_log:undo

permission:manage

system:settings
```

---

# Default Roles

## FREE_USER

Purpose:

Basic platform usage.

---

## PREMIUM_USER

Purpose:

Premium platform usage.

---

## VERIFIED_ARTIST

Purpose:

Upload and manage own content.

---

## PENDING_ARTIST

Purpose:

Waiting for approval.

---

## CONTENT_MANAGER

Purpose:

Manage songs and albums.

---

## USER_MANAGER

Purpose:

Manage users.

---

## ARTIST_MANAGER

Purpose:

Manage artist approvals.

---

## FINANCE_MANAGER

Purpose:

Manage subscriptions and payments.

---

## ADMIN

Purpose:

Full system administration.

---

# Assignment Examples

## Content Manager A

```yaml
user_id: mgr_001

role: CONTENT_MANAGER

permissions:
  - song:approve
  - song:feature

scope:
  genres:
    - V-Pop
    - Indie

  regions:
    - VN
```

Capabilities:

```text
Can approve songs.

Can feature songs.

Only for V-Pop and Indie.

Only in Vietnam.
```

---

## Content Manager B

```yaml
user_id: mgr_002

role: CONTENT_MANAGER

permissions:
  - song:approve

scope:
  genres:
    - K-Pop

  regions:
    - KR
```

Capabilities:

```text
Can approve songs.

Cannot feature songs.

Cannot edit songs.

Only for K-Pop.

Only in Korea.
```

---

## Content Manager C

```yaml
user_id: mgr_003

role: CONTENT_MANAGER

permissions:
  - song:edit_any

scope:
  genres:
    - EDM
```

Capabilities:

```text
Can edit songs.

Cannot approve songs.

Cannot feature songs.

Only for EDM.
```

---

# Scope Model

## Content Scope

```json
{
  "genres": [],
  "regions": []
}
```

---

## User Scope

```json
{
  "regions": [],
  "user_tiers": []
}
```

---

## Finance Scope

```json
{
  "regions": [],
  "subscription_plans": []
}
```

---

# Security Policies

## Temporary Permission

Permissions may expire.

Example:

```yaml
permission: song:approve

expires_at: 2026-12-31
```

Expired permissions must be ignored.

---

## Permission Delegation

Admin may temporarily delegate permissions.

Example:

```yaml
permission: audit_log:undo

delegated_to: manager_001

expires_at: 2026-07-01
```

Delegated permissions behave exactly like normal permissions until expiration.

---

## Two-Man Rule

Some actions require two independent admins.

Protected actions:

```text
user:delete

audit_log:undo

role:assign_admin

payment:refund_large

artist:revoke_bulk
```

Workflow:

```text
Admin A requests action

↓

Pending Approval

↓

Admin B approves

↓

Action executes

↓

Audit Log created
```

---

# Audit Log Requirements

The following actions must always be logged:

```text
DELETE_USER

DELETE_SONG

DELETE_ALBUM

BAN_USER

UNBAN_USER

CHANGE_ROLE

UPDATE_USER

UPDATE_SONG

REFUND_PAYMENT
```

Minimum log schema:

```json
{
  "id": "",
  "action": "",
  "entity": "",
  "entity_id": "",
  "performed_by": "",
  "performed_at": "",
  "snapshot_before": {},
  "snapshot_after": {}
}
```

---

# Authorization Algorithm

```text
AUTHORIZE(user, permission, resource)

1. Load active assignments

2. Load temporary permissions

3. Load delegated permissions

4. Merge permissions

5. Check permission

IF FAIL

DENY

6. Check scope

IF FAIL

DENY

7. Check policy requirements

IF FAIL

DENY

ALLOW
```

---

# Important Rules

Rule 1

Never authorize based only on role.

---

Rule 2

Permissions decide what a user can do.

---

Rule 3

Scopes decide where permissions apply.

---

Rule 4

Assignments are the real source of authorization.

---

Rule 5

Multiple managers with the same role may have completely different permissions.

---

Rule 6

Admin may create custom manager assignments without creating new roles.

---

Rule 7

All critical actions must create audit logs.

---

Rule 8

Business logic must use permission checks.

Never use role checks.

```
```
