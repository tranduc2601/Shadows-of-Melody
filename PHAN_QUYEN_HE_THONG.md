Shadows of Melody Authorization System Specification

Version: 1.0
Status: Approved
Architecture: RBAC + Permission Layer + Scope Layer + Audit Layer

1. Purpose

Hệ thống phân quyền của Shadows of Melody được xây dựng nhằm:

Kiểm soát truy cập theo Role
Kiểm soát hành động theo Permission
Giới hạn dữ liệu theo Scope
Theo dõi lịch sử thao tác bằng Audit Log
Hỗ trợ Temporary Permission
Hỗ trợ Permission Delegation
Hỗ trợ Two-Man Rule cho các hành động nguy hiểm
2. Authorization Model

Mọi request đều được đánh giá theo công thức:

ALLOW(user, action, resource, scope)

Một request chỉ được phép thực hiện khi:

1. User có permission cần thiết

AND

2. Scope hợp lệ

AND

3. Security Policies hợp lệ

Nếu bất kỳ điều kiện nào thất bại:

DENY
3. Role Definitions
ADMIN

Description:

Toàn quyền hệ thống
Không bị giới hạn scope

Capabilities:

Quản lý toàn bộ dữ liệu
Quản lý role
Quản lý permission
Xem và undo audit log
Xác nhận Two-Man Rule
CONTENT_MANAGER

Description:

Quản lý nội dung âm nhạc.

Capabilities:

Duyệt bài hát
Quản lý bài hát
Quản lý album
Đánh dấu featured song
USER_MANAGER

Description:

Quản lý người dùng.

Capabilities:

Xem user
Ban user
Verify user
Chỉnh sửa user
ARTIST_MANAGER

Description:

Quản lý nghệ sĩ.

Capabilities:

Duyệt artist request
Từ chối artist request
Thu hồi artist
FINANCE_MANAGER

Description:

Quản lý tài chính.

Capabilities:

Subscription
Payment
Refund
VERIFIED_ARTIST

Description:

Artist đã được duyệt.

Capabilities:

Upload bài hát
Quản lý bài hát của chính mình
Quản lý album của chính mình
PENDING_ARTIST

Description:

Đang chờ duyệt.

Capabilities:

Không được upload nội dung
PREMIUM_USER

Description:

Người dùng trả phí.

Capabilities:

Truy cập tính năng premium
FREE_USER

Description:

Người dùng thông thường.

Capabilities:

Sử dụng chức năng cơ bản
4. Permission Catalog
Song Permissions
song:read
song:upload

song:edit_own
song:edit_any

song:delete_own
song:delete_any

song:approve

song:feature
Album Permissions
album:create

album:edit_own
album:edit_any

album:delete_own
album:delete_any
User Permissions
user:view

user:edit_own
user:edit_any

user:ban

user:delete

user:verify

role:assign
Artist Permissions
artist:request

artist:approve

artist:reject

artist:revoke
Finance Permissions
subscription:view

subscription:manage

payment:view

payment:refund
System Permissions
audit_log:view

audit_log:undo

permission:manage

system:settings
5. Role Permission Mapping
FREE_USER
permissions:
  - song:read
  - artist:request
PREMIUM_USER
permissions:
  - song:read
  - artist:request
PENDING_ARTIST
permissions:
  - song:read
VERIFIED_ARTIST
permissions:
  - song:read

  - song:upload

  - song:edit_own

  - song:delete_own

  - album:create

  - album:edit_own

  - album:delete_own
CONTENT_MANAGER
permissions:
  - song:read

  - song:upload

  - song:edit_any

  - song:delete_any

  - song:approve

  - song:feature

  - album:create

  - album:edit_any

  - album:delete_any

  - audit_log:view
USER_MANAGER
permissions:
  - user:view

  - user:edit_any

  - user:ban

  - user:verify

  - audit_log:view
ARTIST_MANAGER
permissions:
  - artist:approve

  - artist:reject

  - artist:revoke

  - user:view

  - audit_log:view
FINANCE_MANAGER
permissions:
  - subscription:view

  - subscription:manage

  - payment:view

  - payment:refund

  - audit_log:view
ADMIN
permissions:
  - "*"
6. Scope System

Manager chỉ được thao tác trên dữ liệu thuộc phạm vi được giao.

CONTENT_MANAGER

Allowed Scopes

genres:
regions:

Example:

{
  "genres": ["V-Pop", "Indie"],
  "regions": ["VN"]
}
USER_MANAGER

Allowed Scopes

regions:
user_tiers:

Example:

{
  "regions": ["VN"],
  "user_tiers": ["FREE"]
}
ARTIST_MANAGER

Allowed Scopes

genres:
regions:
FINANCE_MANAGER

Allowed Scopes

subscription_plans:
regions:
ADMIN
scope: "*"
7. Temporary Permissions

Cho phép cấp quyền tạm thời.

Ví dụ:

song:approve

30 days

Sau khi hết hạn:

permission revoked automatically
Required Fields
granted_by:
granted_at:
expires_at:
reason:
8. Permission Delegation

Admin có thể ủy quyền permission của mình.

Ví dụ:

audit_log:undo

delegated to manager

24 hours

Sau khi hết hạn:

permission revoked automatically
9. Two-Man Rule

Một số hành động yêu cầu 2 admin xác nhận.

Protected Actions
user:delete

audit_log:undo

artist:revoke_bulk

payment:refund_large

role:assign_admin
Workflow
1. Admin A submits action

2. Status = PENDING_APPROVAL

3. Admin B reviews

4. Admin B approves

5. Execute action

6. Create audit log
10. Audit Log
Logged Actions
DELETE_USER

DELETE_SONG

DELETE_ALBUM

BAN_USER

UNBAN_USER

CHANGE_ROLE

UPDATE_USER

UPDATE_SONG
Audit Log Schema
{
  "id": "",
  "action": "",

  "entity": "",
  "entity_id": "",

  "performed_by": "",
  "performed_at": "",

  "snapshot_before": {},
  "snapshot_after": {},

  "is_undone": false,

  "undone_by": null,
  "undone_at": null,

  "two_man_confirmed_by": null
}
Audit Access Rules
Role	View	Undo
ADMIN	All	Yes
CONTENT_MANAGER	Content only	No
USER_MANAGER	User only	No
ARTIST_MANAGER	Artist only	No
FINANCE_MANAGER	Finance only	No
11. Database Schema
permissions
CREATE TABLE permissions (
  id VARCHAR PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR
);
role_permissions
CREATE TABLE role_permissions (
  role VARCHAR NOT NULL,
  permission VARCHAR NOT NULL,
  PRIMARY KEY(role, permission)
);
temporary_permissions
CREATE TABLE temporary_permissions (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  permission VARCHAR NOT NULL,

  granted_by VARCHAR NOT NULL,

  granted_at TIMESTAMP NOT NULL,

  expires_at TIMESTAMP NOT NULL,

  reason TEXT
);
manager_scopes
CREATE TABLE manager_scopes (
  id VARCHAR PRIMARY KEY,

  user_id VARCHAR NOT NULL,

  scope JSONB NOT NULL
);
audit_logs
CREATE TABLE audit_logs (
  id VARCHAR PRIMARY KEY,

  action VARCHAR NOT NULL,

  entity VARCHAR NOT NULL,

  entity_id VARCHAR NOT NULL,

  performed_by VARCHAR NOT NULL,

  performed_at TIMESTAMP NOT NULL,

  snapshot_before JSONB,

  snapshot_after JSONB,

  is_undone BOOLEAN DEFAULT FALSE,

  undone_by VARCHAR,

  undone_at TIMESTAMP,

  two_man_confirmed_by VARCHAR,

  metadata JSONB
);
pending_approvals
CREATE TABLE pending_approvals (
  id VARCHAR PRIMARY KEY,

  action VARCHAR NOT NULL,

  payload JSONB NOT NULL,

  requested_by VARCHAR NOT NULL,

  requested_at TIMESTAMP NOT NULL,

  confirmed_by VARCHAR,

  confirmed_at TIMESTAMP,

  status VARCHAR NOT NULL
);

Allowed status:

pending
approved
rejected
expired
12. Backend Authorization Contract
hasPermission(
  user,
  permission
)
hasPermission(
  user,
  permission,
  scope
)
requireTwoMan(
  action
)
createAuditLog(
  action,
  entity,
  actor
)
13. Authorization Algorithm
AUTHORIZE(user, action)

1. Resolve user roles

2. Load role permissions

3. Load temporary permissions

4. Load delegated permissions

5. Merge permissions

6. Check permission

IF FAILED
  DENY

7. Check scope

IF FAILED
  DENY

8. Check security policies

- Two-Man Rule
- Temporary Permission
- Delegation

IF FAILED
  DENY

ALLOW
14. Implementation Roadmap
Phase	Description	Priority
1	Roles + Permissions + Middleware	High
2	Audit Log	High
3	Scope System	Medium
4	Temporary Permission	Medium
5	Two-Man Rule	Medium
6	Permission Delegation	Low
15. Golden Rules
Never check role directly in business logic.

BAD:

if (user.role === "ADMIN")

GOOD:

if (hasPermission(user, "song:delete_any"))

Always use permissions.

Always enforce scopes.

Always write audit logs for critical actions.

Never bypass Two-Man Rule.