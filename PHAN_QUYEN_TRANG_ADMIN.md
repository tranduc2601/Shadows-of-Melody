# Phân Quyền Theo Trang — Admin Panel

> Ai được truy cập trang nào, làm được gì trên trang đó.

---

## Tổng Quan Truy Cập Trang

| Trang | Content Mgr | User Mgr | Artist Mgr | Finance Mgr | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Songs | ✅ | ❌ | ❌ | ❌ | ✅ |
| Albums | ✅ | ❌ | ❌ | ❌ | ✅ |
| Artists | ❌ | ❌ | ✅ | ❌ | ✅ |
| Users | ❌ | ✅ | ❌ | ❌ | ✅ |
| Subscriptions | ❌ | ❌ | ❌ | ✅ | ✅ |
| Payments | ❌ | ❌ | ❌ | ✅ | ✅ |
| Audit Log | ✅ | ✅ | ✅ | ✅ | ✅ |
| Permissions | ❌ | ❌ | ❌ | ❌ | ✅ |
| Settings | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Chi Tiết Từng Trang

---

### 🏠 Dashboard

**Tất cả role đều truy cập được**, nhưng nội dung hiển thị khác nhau theo role.

| Thành phần | Content Mgr | User Mgr | Artist Mgr | Finance Mgr | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Tổng số bài hát / album | ✅ | ❌ | ❌ | ❌ | ✅ |
| Tổng số user | ❌ | ✅ | ❌ | ❌ | ✅ |
| Yêu cầu artist chờ duyệt | ❌ | ❌ | ✅ | ❌ | ✅ |
| Doanh thu / subscription | ❌ | ❌ | ❌ | ✅ | ✅ |
| Thống kê toàn hệ thống | ❌ | ❌ | ❌ | ❌ | ✅ |
| Hoạt động gần đây (audit) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🎵 Songs

**Chỉ Content Manager và Admin.**

| Hành động | Content Mgr | Admin |
|---|:---:|:---:|
| Xem danh sách bài hát | ✅ | ✅ |
| Tìm kiếm / lọc | ✅ | ✅ |
| Xem chi tiết bài hát | ✅ | ✅ |
| Sửa thông tin bài hát | ✅ | ✅ |
| Duyệt bài hát chờ xuất bản | ✅ | ✅ |
| Đánh dấu nổi bật / trending | ✅ | ✅ |
| Xóa bài hát | ✅ | ✅ |
| Upload bài hát mới | ❌ | ✅ |

> Content Manager **không thể upload** — chỉ quản lý nội dung đã có.

---

### 💿 Albums

**Chỉ Content Manager và Admin.**

| Hành động | Content Mgr | Admin |
|---|:---:|:---:|
| Xem danh sách album | ✅ | ✅ |
| Tìm kiếm / lọc | ✅ | ✅ |
| Xem chi tiết album | ✅ | ✅ |
| Sửa thông tin album | ✅ | ✅ |
| Xóa album | ✅ | ✅ |
| Tạo album mới | ❌ | ✅ |

---

### 🎤 Artists

**Chỉ Artist Manager và Admin.**

| Hành động | Artist Mgr | Admin |
|---|:---:|:---:|
| Xem danh sách artist | ✅ | ✅ |
| Xem chi tiết artist (songs, albums) | ✅ | ✅ |
| Xem danh sách yêu cầu chờ duyệt | ✅ | ✅ |
| Duyệt yêu cầu trở thành artist | ✅ | ✅ |
| Từ chối yêu cầu trở thành artist | ✅ | ✅ |
| Thu hồi quyền artist | ✅ | ✅ |
| Xóa artist khỏi hệ thống | ❌ | ✅ |

---

### 👥 Users

**Chỉ User Manager và Admin.**

| Hành động | User Mgr | Admin |
|---|:---:|:---:|
| Xem danh sách user | ✅ | ✅ |
| Tìm kiếm / lọc user | ✅ | ✅ |
| Xem chi tiết user | ✅ | ✅ |
| Sửa thông tin user | ✅ | ✅ |
| Verify email thủ công | ✅ | ✅ |
| Ban / Unban tài khoản | ✅ | ✅ |
| Đổi role user | ❌ | ✅ |
| Xóa tài khoản | ❌ | ✅ |

> User Manager **không thể đổi role hoặc xóa tài khoản** — chỉ Admin mới có.

---

### 💳 Subscriptions

**Chỉ Finance Manager và Admin.**

| Hành động | Finance Mgr | Admin |
|---|:---:|:---:|
| Xem danh sách subscription | ✅ | ✅ |
| Lọc theo gói / trạng thái | ✅ | ✅ |
| Xem chi tiết subscription của user | ✅ | ✅ |
| Thay đổi gói subscription của user | ✅ | ✅ |
| Hủy subscription | ✅ | ✅ |
| Tạo / chỉnh sửa gói subscription | ❌ | ✅ |
| Xóa gói subscription | ❌ | ✅ |

---

### 💰 Payments

**Chỉ Finance Manager và Admin.**

| Hành động | Finance Mgr | Admin |
|---|:---:|:---:|
| Xem lịch sử giao dịch | ✅ | ✅ |
| Tìm kiếm / lọc giao dịch | ✅ | ✅ |
| Xem chi tiết giao dịch | ✅ | ✅ |
| Hoàn tiền (refund) | ✅ | ✅ |
| Export báo cáo doanh thu | ✅ | ✅ |

---

### 📋 Audit Log

**Tất cả Manager và Admin đều truy cập được**, nhưng mỗi role chỉ thấy log trong phạm vi của mình.

| Hành động | Content Mgr | User Mgr | Artist Mgr | Finance Mgr | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Xem log liên quan content | ✅ | ❌ | ❌ | ❌ | ✅ |
| Xem log liên quan user | ❌ | ✅ | ❌ | ❌ | ✅ |
| Xem log liên quan artist | ❌ | ❌ | ✅ | ❌ | ✅ |
| Xem log liên quan payment | ❌ | ❌ | ❌ | ✅ | ✅ |
| Xem tất cả log | ❌ | ❌ | ❌ | ❌ | ✅ |
| Hoàn tác (Undo) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Export log CSV | ❌ | ❌ | ❌ | ❌ | ✅ |

---

### 🔐 Permissions

**Chỉ Admin.**

| Hành động | Admin |
|---|:---:|
| Xem permission của từng role | ✅ |
| Thêm / bỏ permission khỏi role | ✅ |
| Cấp temporary permission cho user | ✅ |
| Xem danh sách temporary permission đang hoạt động | ✅ |
| Thu hồi temporary permission | ✅ |
| Xem / chỉnh sửa scope của từng Manager | ✅ |

---

### ⚙️ Settings

**Chỉ Admin.**

| Hành động | Admin |
|---|:---:|
| Cấu hình thông tin hệ thống | ✅ |
| Quản lý SMTP / email | ✅ |
| Tạo tài khoản Manager mới | ✅ |
| Xóa tài khoản Manager | ✅ |
| Cấu hình Two-Man Rule | ✅ |
| Xem thông tin server / uptime | ✅ |
