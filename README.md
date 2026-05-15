# Shadows of Melody — Tài liệu Kỹ thuật

> **Phiên bản:** 1.1.0 | **Ngày cập nhật:** 15/05/2026
> Tài liệu này mô tả toàn bộ kiến trúc, API, luồng dữ liệu, logic nghiệp vụ và tiến độ phát triển hiện tại của hệ thống streaming nhạc **Shadows of Melody**.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Tiến độ hiện tại](#2-tiến-độ-hiện-tại)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Cài đặt và Khởi chạy](#5-cài-đặt-và-khởi-chạy)
6. [Cấu hình môi trường](#6-cấu-hình-môi-trường-environment-variables)
7. [Kết nối Database](#7-kết-nối-database)
8. [Schema Database](#8-schema-database)
9. [Tài liệu API](#9-tài-liệu-api)
10. [Luồng dữ liệu và Logic nghiệp vụ](#10-luồng-dữ-liệu-và-logic-nghiệp-vụ)
11. [Cơ chế xác thực và Phân quyền](#11-cơ-chế-xác-thực-và-phân-quyền)
12. [Giải thích code quan trọng](#12-giải-thích-code-quan-trọng)
13. [Middleware và Bảo mật](#13-middleware-và-bảo-mật)
14. [Upload File và Cloudinary](#14-upload-file-và-cloudinary)
15. [Frontend Architecture](#15-frontend-architecture)
16. [Ghi chú kỹ thuật](#16-ghi-chú-kỹ-thuật-và-điểm-cải-thiện)

---

## 1. Tổng quan dự án

**Shadows of Melody** là một nền tảng streaming nhạc trực tuyến bao gồm:

- **Frontend:** Xây dựng bằng [Astro](https://astro.build/) + TailwindCSS, chạy ở cổng `3000`.
- **Backend:** Node.js + Express.js (ESM modules), chạy ở cổng `5000`.
- **Database:** PostgreSQL với connection pool qua thư viện `pg`.
- **File Storage:** Cloudinary CDN dùng để lưu trữ và streaming file audio/ảnh.
- **Auth:** JWT (JSON Web Token) kết hợp In-memory Token Blocklist cho cơ chế logout an toàn.

### Công nghệ sử dụng

| Lớp | Công nghệ |
|---|---|
| Frontend | Astro 6, TailwindCSS 4, TypeScript |
| Backend | Node.js ≥22, Express.js 4, ESM |
| Database | PostgreSQL (raw SQL qua `pg` pool) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| File Storage | Cloudinary (audio + image) |
| Upload | Multer (memoryStorage — không ghi đĩa) |
| Rate Limiting | `express-rate-limit` |
| Dev tooling | nodemon, concurrently |

---

## 2. Tiến độ hiện tại

### Đã hoàn thành gần đây
- Chuyển sang kiến trúc frontend Astro + backend Express/Node.js với PostgreSQL.
- Hoàn thiện luồng xác thực cơ bản: đăng ký, đăng nhập, `/me`, logout và phân quyền theo role.
- Xây dựng hệ thống player toàn cục, sidebar, layout và các trang chính của app.
- Bổ sung luồng khôi phục mật khẩu với token có thời hạn, email reset và trang reset password.
- Tăng cường trải nghiệm UI cho các trang auth với trạng thái loading, lỗi và thông báo thành công.

### Đang ưu tiên
- Hoàn thiện kiểm thử và rà soát linter cho cả frontend/backend.
- Chuẩn hóa tài liệu môi trường `.env` cho local và production.
- Cải thiện khả năng gửi email reset trong môi trường thật bằng SMTP đầy đủ.

### Ghi chú về phạm vi hiện tại
- Backend vẫn dùng stack hiện có, chưa thêm framework mới.
- Chức năng reset mật khẩu đã được thiết kế để không ảnh hưởng đến luồng auth cũ.
- Các thay đổi mới nhất tập trung vào trải nghiệm người dùng và bảo mật tài khoản.

---

## 3. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│                                                             │
│   Browser ← Astro SSG/CSR (port 3000)                       │
│   • Pages: index, search, album, artist, liked, playlist    │
│   • lib/player.js  → Audio singleton (HTML5 Audio API)      │
│   • lib/api.js     → HTTP client + Auth token manager       │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP/REST (JSON)
                         │  Authorization: Bearer <JWT>
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       API GATEWAY LAYER                     │
│                                                             │
│   Express.js App (port 5000)                                │
│   ├── Middleware Pipeline:                                  │
│   │   ├── logger (request logging)                         │
│   │   ├── cors (CORS policy)                               │
│   │   ├── express.json (body parser, limit 10MB)           │
│   │   └── generalLimiter (300 req / 15 min)                │
│   │                                                         │
│   └── Router Mapping:                                       │
│       /api/auth          → authRoutes                       │
│       /api/songs         → songRoutes                       │
│       /api/artists       → artistRoutes                     │
│       /api/albums        → albumRoutes                      │
│       /api/playlists     → playlistRoutes                   │
│       /api/favorites     → favoriteRoutes                   │
│       /api/history       → historyRoutes                    │
│       /api/stream        → streamRoutes                     │
│       /api/subscriptions → subscriptionRoutes               │
│       /api/admin         → adminRoutes                      │
│       /api/roles         → roleRoutes                       │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴───────────────┐
          ▼                              ▼
┌─────────────────┐           ┌──────────────────────┐
│  BUSINESS LOGIC │           │   EXTERNAL SERVICES   │
│   LAYER         │           │                       │
│                 │           │  Cloudinary CDN:      │
│  Controllers    │──upload──▶│  • Audio files        │
│  Models (SQL)   │◀──stream──│  • Cover images       │
│  Utils          │           │  • Avatar images      │
└────────┬────────┘           └──────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                               │
│                                                             │
│   PostgreSQL Database                                       │
│   ├── pg.Pool (max: 10 conn, idle: 30s, timeout: 2s)        │
│   ├── SSL: tuỳ biến qua env DB_SSL=true                    │
│   └── Tables: users, songs, artists, albums, playlists,    │
│               favorites, listening_history, subscriptions,  │
│               payments, genres, song_artists, song_genres,  │
│               playlist_songs, role_requests, manager_tasks  │
└─────────────────────────────────────────────────────────────┘
```

### Luồng giao tiếp Client → Server

1. **Client** gửi HTTP request đến `http://localhost:5000/api/*` kèm header `Authorization: Bearer <JWT>`.
2. **Middleware pipeline** xử lý tuần tự: log → CORS → parse body → rate limit.
3. **Router** định tuyến request đến **Controller** tương ứng.
4. **Middleware Auth** (`requireAuth`, `requireRole`) kiểm tra token trước khi vào controller.
5. **Controller** gọi **Model** để thực thi SQL query qua `pg.Pool`.
6. **Model** trả về dữ liệu → Controller đóng gói JSON response gửi lại Client.
7. Với file audio/ảnh: Controller redirect `302` về **Cloudinary CDN URL** thay vì proxy trực tiếp.

---

## 3. Cấu trúc thư mục

```
Shadows_of_Melody/
├── astro.config.mjs          # Cấu hình Astro + TailwindCSS Vite plugin
├── package.json              # Root workspace: scripts dev:all, build
├── tsconfig.json             # TypeScript config cho frontend
├── prisma/
│   └── schema.prisma         # Prisma schema (tham khảo — backend dùng raw SQL)
│
├── backend/                  # Node.js / Express API Server
│   ├── server.js             # Entry point: khởi động HTTP server, graceful shutdown
│   ├── package.json          # Dependencies backend
│   └── src/
│       ├── app.js            # Express app: middleware, routes, auto-migrations
│       ├── config/
│       │   ├── env.js        # Tổng hợp tất cả biến môi trường thành object config
│       │   ├── database.js   # pg.Pool + query wrapper (? → $N)
│       │   ├── cloudinary.js # Khởi tạo Cloudinary SDK
│       │   └── multer.js     # Upload middleware (memory storage, file validation)
│       ├── controllers/      # Xử lý HTTP request/response, gọi Models
│       │   ├── authController.js
│       │   ├── songController.js
│       │   ├── artistController.js
│       │   ├── albumController.js
│       │   ├── playlistController.js
│       │   ├── favoriteController.js
│       │   ├── historyController.js
│       │   ├── streamController.js
│       │   ├── subscriptionController.js
│       │   ├── adminController.js
│       │   ├── adminSongController.js
│       │   ├── roleController.js
│       │   ├── taskController.js
│       │   └── uploadController.js
│       ├── models/           # Lớp truy vấn DB (Active Record pattern)
│       │   ├── User.js
│       │   ├── Song.js
│       │   ├── Artist.js
│       │   ├── Album.js
│       │   ├── Playlist.js
│       │   ├── Favorite.js
│       │   ├── History.js
│       │   ├── Subscription.js
│       │   └── Payment.js
│       ├── routes/           # Express Router definitions
│       ├── middleware/
│       │   ├── auth.js       # requireAuth, requireRole, adminMiddleware
│       │   ├── errorHandler.js
│       │   ├── logger.js
│       │   └── rateLimiter.js
│       ├── utils/
│       │   ├── jwt.js         # generateToken, verifyToken, revokeToken
│       │   ├── tokenBlocklist.js  # In-memory revocation store
│       │   ├── cloudinaryStorage.js  # Upload/delete helper
│       │   └── validators.js  # Input validation functions
│       ├── db/
│       │   ├── init.js        # Khởi tạo schema lần đầu
│       │   └── schema.postgresql.sql  # DDL đầy đủ
│       └── scripts/
│           └── create-admin.js  # Script tạo tài khoản admin thủ công
│
└── src/                      # Astro Frontend
    ├── components/
    │   ├── PlayerBar.astro   # Global audio player UI
    │   └── Sidebar.astro     # Navigation sidebar
    ├── layouts/
    │   ├── Layout.astro      # Base HTML layout
    │   └── MainLayout.astro  # Layout với Sidebar + PlayerBar
    ├── pages/                # File-based routing Astro
    │   ├── index.astro       # Trang chủ
    │   ├── search.astro      # Tìm kiếm
    │   ├── album.astro       # Chi tiết album
    │   ├── artist.astro      # Trang nghệ sĩ
    │   ├── playlist.astro    # Chi tiết playlist
    │   ├── liked.astro       # Bài hát yêu thích
    │   ├── admin.astro       # Dashboard Admin/Manager
    │   ├── upload.astro      # Upload nhạc (artist+)
    │   ├── profile.astro     # Trang cá nhân
    │   ├── login.astro / signup.astro
    │   └── 403.astro / 404.astro
    ├── lib/
    │   ├── api.js            # HTTP client, token manager, role helpers
    │   └── player.js         # Audio player singleton (HTML5 Web Audio)
    └── styles/
        └── global.css        # Global CSS (TailwindCSS base)
```

---

## 4. Cấu trúc thư mục

### Yêu cầu hệ thống

- **Node.js** ≥ 22.12.0
- **PostgreSQL** ≥ 14
- Tài khoản **Cloudinary** (free tier đủ dùng để dev)

### Cài đặt

```bash
# 1. Clone repository
git clone <repo-url>
cd Shadows_of_Melody

# 2. Cài dependencies frontend (root)
npm install

# 3. Cài dependencies backend
cd backend && npm install && cd ..
```

### Cấu hình môi trường

Tạo file `backend/.env` dựa theo mục [5](#5-cấu-hình-môi-trường-environment-variables).

### Khởi tạo Database

```bash
cd backend

# Chạy schema SQL vào PostgreSQL
node src/db/init.js

# (Tuỳ chọn) Tạo tài khoản admin đầu tiên
node scripts/create-admin.js
```

### Chạy dự án

```bash
# Chạy song song Frontend + Backend (khuyến nghị)
npm run dev:all

# Hoặc chạy riêng lẻ:
npm run dev           # Frontend: http://localhost:3000
npm run dev:backend   # Backend:  http://localhost:5000

# Kiểm tra Backend health:
curl http://localhost:5000/health
# → { "status": "OK", "timestamp": "..." }
```

---

## 5. Cài đặt và Khởi chạy

File: `backend/.env`

```env
# ── PostgreSQL ────────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@localhost:5432/shadows_of_melody
DB_SSL=false

# ── Server ────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── JWT ───────────────────────────────────────────────
JWT_SECRET=your_very_long_and_random_secret_key_here
JWT_EXPIRE=7d

# ── CORS ──────────────────────────────────────────────
CORS_ORIGIN=http://localhost:3000

# ── Cloudinary ────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── Upload ────────────────────────────────────────────
MAX_FILE_SIZE=524288000     # 500 MB (bytes)
CHUNK_SIZE=65536            # 64 KB (reserved, không dùng trực tiếp)
```

> **Bảo mật:** Không commit file `.env` vào git. Tạo file `.env.example` làm template.

---

## 6. Cấu hình môi trường (Environment Variables)

Backend sử dụng thư viện **`pg`** (node-postgres) với cơ chế **connection pool**.

### Cấu hình Pool

```javascript
// backend/src/config/database.js
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                       // Tối đa 10 kết nối đồng thời
    idleTimeoutMillis: 30000,      // Đóng connection nhàn rỗi sau 30 giây
    connectionTimeoutMillis: 2000, // Timeout 2s khi chờ connection từ pool
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,                   // Bật SSL cho production (Heroku, Supabase...)
});
```

### Query Wrapper — Tương thích MySQL syntax

Dự án dùng một **wrapper** đặc biệt để models viết với syntax `?` (MySQL-style) vẫn chạy được trên PostgreSQL (cần `$1, $2, ...`):

```javascript
const _pgQuery = pool.query.bind(pool);

pool.query = async (sql, params = []) => {
    let i = 0;
    // Chuyển: "WHERE id = ?" → "WHERE id = $1"
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await _pgQuery(pgSql, params);
    // Trả về [rows, fields] thay vì result object
    return [result.rows, result.fields ?? []];
};
```

Tất cả models đều destructure kết quả theo cú pháp:

```javascript
const [rows] = await pool.query('SELECT ...', [params]);
```

### Auto-migrations khi khởi động

`app.js` tự động chạy các migration an toàn (idempotent) mỗi khi server start:

```sql
-- Thêm cột user_id vào bảng artists nếu chưa có
ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Tạo unique index cho ON CONFLICT upsert
CREATE UNIQUE INDEX IF NOT EXISTS artists_user_id_unique ON artists (user_id) WHERE user_id IS NOT NULL;

-- Backfill: tạo artist row cho user có role='artist' chưa có entry trong bảng artists
INSERT INTO artists (name, image_url, user_id)
SELECT COALESCE(NULLIF(full_name, ''), username), avatar_url, id
FROM users WHERE role = 'artist' AND deleted_at IS NULL
  AND id NOT IN (SELECT user_id FROM artists WHERE user_id IS NOT NULL);
```

---

## 7. Kết nối Database

### Sơ đồ quan hệ (ERD tóm tắt)

```
users ──────────────┬──── subscriptions
                    ├──── artists (user_id FK, nullable)
                    ├──── playlists
                    ├──── favorites
                    ├──── listening_history
                    ├──── payments
                    └──── role_requests

artists ──── albums ──── songs ──── song_artists ──── artists
                              └──── song_genres  ──── genres
                              └──── playlist_songs ── playlists

users (role=manager) ── manager_tasks (assigned_to)
users (role=admin)   ── manager_tasks (assigned_by)
```

### Bảng chính và mô tả

| Bảng | Mô tả |
|---|---|
| `users` | Người dùng. `role` ENUM: `user/artist/manager/admin`. Soft-delete qua `deleted_at`. Có `is_locked` để khóa tài khoản. |
| `artists` | Nghệ sĩ. Liên kết tới `users.id` qua `user_id` (nullable — tồn tại artist không có user account). |
| `albums` | Album nhạc. Thuộc về một `artist` (FK nullable). |
| `songs` | Bài hát. Lưu `file_url` (Cloudinary HTTPS URL để stream) và `file_path` (Cloudinary public_id để xóa). Full-text search qua `tsvector tsv`. |
| `genres` | Thể loại nhạc. |
| `song_artists` | Junction table: quan hệ N-N giữa `songs` và `artists`. |
| `song_genres` | Junction table: quan hệ N-N giữa `songs` và `genres`. |
| `playlists` | Playlist của người dùng, có ảnh bìa. |
| `playlist_songs` | Junction table: quan hệ N-N giữa `playlists` và `songs`. |
| `favorites` | Bài hát yêu thích (user ↔ song). |
| `listening_history` | Lịch sử nghe nhạc. |
| `subscriptions` | Gói đăng ký: `free`, `premium`, `vip`. |
| `payments` | Lịch sử thanh toán với `status`: `pending/completed/failed/refunded`. |
| `role_requests` | Yêu cầu nâng cấp role lên Artist. `status`: `pending/approved/rejected`. |
| `manager_tasks` | Công việc admin giao cho manager. `status`: `pending/in_progress/completed`. |

### ENUM Types PostgreSQL

```sql
CREATE TYPE user_role            AS ENUM ('user', 'artist', 'manager', 'admin');
CREATE TYPE subscription_type_enum AS ENUM ('free', 'premium', 'vip');
CREATE TYPE payment_status_enum  AS ENUM ('pending', 'completed', 'failed', 'refunded');
```

### Full-text Search Index

```sql
-- GIN Index cho tsvector — tính năng tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_songs_tsv ON songs USING GIN(tsv);

-- Extension unaccent — tìm kiếm không dấu tiếng Việt
CREATE EXTENSION IF NOT EXISTS unaccent;
```

---

## 8. Schema Database

**Base URL:** `http://localhost:5000/api`

**Response format chung:**
```json
{ "success": true/false, "data": <payload>, "message": "..." }
```

**Authentication header:** `Authorization: Bearer <JWT_TOKEN>`

---

### 8.1 Authentication — `/api/auth`

| Method | Endpoint | Chức năng | Auth yêu cầu | Request Body / Params |
|---|---|---|---|---|
| `POST` | `/auth/register` | Đăng ký tài khoản mới | Không | `username`, `email`, `password`, `confirmPassword` |
| `POST` | `/auth/login` | Đăng nhập, nhận JWT | Không | `email`, `password` |
| `GET` | `/auth/me` | Lấy thông tin user hiện tại | JWT | — |
| `PUT` | `/auth/profile` | Cập nhật thông tin cá nhân | JWT | `full_name`, `bio`, ... |
| `POST` | `/auth/upload-avatar` | Upload ảnh đại diện | JWT | `multipart/form-data: avatar` (image ≤5MB) |
| `POST` | `/auth/logout` | Đăng xuất (revoke JWT) | JWT | — |

> **Rate limit** cho `/register` và `/login`: **5 request / 15 phút** (bỏ qua request thành công).

**Ví dụ Response `POST /auth/register` (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 42,
    "username": "johndoe",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation quy tắc:**
- `username`: 3–20 ký tự, chỉ chứa chữ, số và dấu gạch dưới.
- `email`: định dạng email hợp lệ.
- `password`: tối thiểu 8 ký tự, phải có chữ hoa, chữ thường và số.

---

### 8.2 Songs — `/api/songs`

| Method | Endpoint | Chức năng | Auth | Request |
|---|---|---|---|---|
| `GET` | `/songs` | Danh sách bài hát (có pagination) | Không | `?page=1&limit=20` |
| `GET` | `/songs/genres` | Danh sách tất cả thể loại | Không | — |
| `GET` | `/songs/search` | Tìm kiếm bài hát | Không | `?q=keyword&page=1&limit=20` |
| `GET` | `/songs/by-genre/:genreId` | Bài hát theo thể loại | Không | path: `genreId` |
| `GET` | `/songs/:id` | Chi tiết một bài hát | Không | path: `id` |
| `POST` | `/songs/history` | Ghi vào lịch sử nghe | JWT | `song_id` |
| `POST` | `/songs/upload` | Upload audio + tạo bài hát | JWT + artist/manager/admin | `multipart: audio, title, duration, artist_ids, album_id, cover_url` |
| `POST` | `/songs` | Tạo bài hát từ URL đã có | JWT + artist/manager/admin | `title`, `duration`, `file_url`, `album_id`, `artists[]`, `genres[]` |
| `PUT` | `/songs/:id` | Cập nhật metadata bài hát | JWT + artist/manager/admin | Các field cần update |
| `DELETE` | `/songs/:id` | Xóa bài hát | JWT + artist/manager/admin | — |

> **Rate limit search:** 30 request / phút.

**Ví dụ Response `GET /songs` (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Tên bài hát",
      "file_url": "https://res.cloudinary.com/demo/video/upload/songs/abc123.mp3",
      "cover_url": "https://res.cloudinary.com/demo/image/upload/covers/xyz789.jpg",
      "duration": 210,
      "plays_count": 1234,
      "status": "published",
      "artist_ids": "1,2",
      "artist_names": "Nghệ sĩ A,Nghệ sĩ B",
      "album_title": "Tên Album",
      "genre_names": "Pop,R&B"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 }
}
```

---

### 8.3 Artists — `/api/artists`

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/artists` | Danh sách tất cả nghệ sĩ | Không |
| `GET` | `/artists/members` | Danh sách members/ban nhạc | Không |
| `GET` | `/artists/search` | Tìm kiếm nghệ sĩ (`?q=`) | Không |
| `GET` | `/artists/:id` | Chi tiết nghệ sĩ | Không |
| `POST` | `/artists` | Tạo nghệ sĩ mới | JWT + admin |
| `PUT` | `/artists/:id` | Cập nhật nghệ sĩ | JWT + admin |
| `DELETE` | `/artists/:id` | Xóa nghệ sĩ | JWT + admin |

---

### 8.4 Albums — `/api/albums`

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/albums` | Danh sách album | Không |
| `GET` | `/albums/:id` | Chi tiết album | Không |
| `GET` | `/albums/artist/:artistId` | Album của một nghệ sĩ | Không |
| `POST` | `/albums` | Tạo album mới | JWT + admin |
| `PUT` | `/albums/:id` | Cập nhật album | JWT + admin |
| `DELETE` | `/albums/:id` | Xóa album | JWT + admin |

---

### 8.5 Playlists — `/api/playlists`

Tất cả endpoint đều yêu cầu JWT. User chỉ thao tác được playlist của chính mình.

| Method | Endpoint | Chức năng | Request |
|---|---|---|---|
| `GET` | `/playlists/me` | Playlist của tôi | — |
| `GET` | `/playlists` | Tất cả playlist của user hiện tại | — |
| `POST` | `/playlists` | Tạo playlist mới | `multipart: cover (image, optional), name, description` |
| `GET` | `/playlists/:id` | Chi tiết playlist (kèm danh sách bài) | — |
| `PUT` | `/playlists/:id` | Cập nhật playlist | `multipart: cover (optional), name, description` |
| `DELETE` | `/playlists/:id` | Xóa playlist | — |
| `POST` | `/playlists/:playlistId/songs` | Thêm bài hát vào playlist | `song_id` |
| `DELETE` | `/playlists/:playlistId/songs/:songId` | Xóa bài hát khỏi playlist | — |

---

### 8.6 Favorites — `/api/favorites`

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/favorites` | Danh sách bài hát đã thích | JWT |
| `POST` | `/favorites` | Thêm vào yêu thích | JWT — body: `song_id` |
| `GET` | `/favorites/:songId/is-favorite` | Kiểm tra đã thích chưa | JWT |
| `DELETE` | `/favorites/:songId` | Bỏ thích bài hát | JWT |
| `GET` | `/favorites/:songId/count` | Tổng lượt thích của bài | Không |

---

### 8.7 Listening History — `/api/history`

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/history` | Lịch sử nghe của user hiện tại | JWT |
| `DELETE` | `/history` | Xóa toàn bộ lịch sử | JWT |

---

### 8.8 Stream — `/api/stream`

| Method | Endpoint | Chức năng | Auth | Ghi chú |
|---|---|---|---|---|
| `GET` | `/stream/:songId` | Stream audio | Không | `302 redirect` → Cloudinary CDN URL |
| `GET` | `/stream/:songId/download` | Tải về audio | JWT | `302 redirect` → Cloudinary CDN URL |

> **Ghi chú quan trọng:** Backend không proxy audio — chỉ redirect 302 về Cloudinary URL. Cloudinary CDN hỗ trợ HTTP Range Requests nên tính năng seek/scrub trong trình phát hoạt động bình thường.

---

### 8.9 Subscriptions — `/api/subscriptions`

| Method | Endpoint | Chức năng | Auth |
|---|---|---|---|
| `GET` | `/subscriptions` | Gói đăng ký hiện tại của user | JWT |
| `POST` | `/subscriptions/upgrade` | Nâng cấp/đổi gói | JWT — body: `subscriptionType: "free"|"premium"|"vip"` |
| `GET` | `/subscriptions/payments` | Lịch sử thanh toán | JWT |
| `POST` | `/subscriptions/payments` | Tạo thanh toán mới | JWT |
| `GET` | `/subscriptions/admin/stats` | Thống kê subscription | JWT + manager/admin |

---

### 8.10 Roles — `/api/roles`

| Method | Endpoint | Chức năng | Auth | Ghi chú |
|---|---|---|---|---|
| `POST` | `/roles/request-artist` | Gửi yêu cầu trở thành Artist | JWT (role=user) | Rate limit: 3 req/giờ |
| `GET` | `/roles/my-request` | Xem trạng thái yêu cầu của mình | JWT | |
| `GET` | `/roles/requests` | Danh sách yêu cầu đang chờ duyệt | JWT + manager/admin | `?status=pending` |
| `PATCH` | `/roles/requests/:id` | Duyệt/từ chối yêu cầu | JWT + manager/admin | body: `action: "approve"|"reject"` |

---

### 8.11 Admin — `/api/admin`

> **Tất cả routes** trong nhóm này yêu cầu **tối thiểu role `manager`**. Một số thao tác nhạy cảm yêu cầu **role `admin`**.

#### Dashboard & User Management

| Method | Endpoint | Chức năng | Role |
|---|---|---|---|
| `GET` | `/admin/stats` | Tổng quan: users, songs, artists, playlists + 5 user mới nhất | manager+ |
| `GET` | `/admin/users` | Danh sách users (pagination) | manager+ |
| `PATCH` | `/admin/users/:id/role` | Thay đổi role user | manager+ |
| `DELETE` | `/admin/users/:id` | Xóa mềm user | **admin** |
| `PATCH` | `/admin/users/:id/toggle-admin` | Bật/tắt quyền admin | **admin** |
| `PATCH` | `/admin/users/:id/lock` | Khóa/mở khóa tài khoản | **admin** |

#### Artist Management

| Method | Endpoint | Chức năng | Role |
|---|---|---|---|
| `GET` | `/admin/artists` | Danh sách nghệ sĩ | manager+ |
| `GET` | `/admin/artists/:id/content` | Nội dung (bài hát, album) của nghệ sĩ | manager+ |
| `PATCH` | `/admin/artists/:id/revoke-role` | Thu hồi quyền Artist của user | **admin** |

#### Song Management

| Method | Endpoint | Chức năng | Role |
|---|---|---|---|
| `GET` | `/admin/songs` | Tất cả bài hát (kể cả `suppressed`) | manager+ |
| `POST` | `/admin/songs/upload` | Upload bài hát mới (rollback Cloudinary khi DB lỗi) | manager+ |
| `PATCH` | `/admin/songs/:id` | Cập nhật metadata bài hát | manager+ |
| `PATCH` | `/admin/songs/:id/status` | Chuyển trạng thái `published`/`suppressed` | manager+ |
| `POST` | `/admin/upload/cover` | Upload ảnh bìa → trả về Cloudinary URL | manager+ |

#### Album & Genre Management

| Method | Endpoint | Chức năng | Role |
|---|---|---|---|
| `GET` | `/admin/albums` | Danh sách album | manager+ |
| `POST` | `/admin/albums` | Tạo album | **admin** |
| `PATCH` | `/admin/albums/:id` | Cập nhật album | **admin** |
| `DELETE` | `/admin/albums/:id` | Xóa album | **admin** |
| `GET` | `/admin/albums/:id/songs` | Bài hát trong album | manager+ |
| `PATCH` | `/admin/albums/:albumId/songs/:songId` | Cập nhật bài hát trong album | **admin** |
| `GET` | `/admin/genres` | Danh sách thể loại | manager+ |
| `POST` | `/admin/genres` | Tạo thể loại mới | **admin** |
| `PUT` | `/admin/genres/:id` | Cập nhật thể loại | **admin** |
| `DELETE` | `/admin/genres/:id` | Xóa thể loại | **admin** |

#### Manager Task System

| Method | Endpoint | Chức năng | Role | Ghi chú |
|---|---|---|---|---|
| `GET` | `/admin/managers` | Danh sách users có role manager | manager+ | |
| `GET` | `/admin/tasks` | Danh sách task | manager+ | Manager chỉ thấy task của mình |
| `POST` | `/admin/tasks` | Tạo task giao cho manager | **admin** | body: `title, description, assigned_to` |
| `PATCH` | `/admin/tasks/:id/status` | Cập nhật trạng thái task | manager+ | `pending/in_progress/completed` |

---

## 9. Tài liệu API

### 9.1 Luồng Upload bài hát (Artist → Cloudinary → DB)

```
Artist (Browser)
      │
      │ POST /api/songs/upload  (multipart/form-data)
      │ Authorization: Bearer <JWT>
      ▼
[requireAuth] → Verify JWT → Attach req.user
      │
[requireRole('artist','manager','admin')] → Kiểm tra role
      │
[uploadAudio.single('audio')] → Multer:
      │  - Validate extension: .mp3/.wav/.flac/.aac/.ogg/.m4a
      │  - Validate size ≤ 500MB
      │  - Lưu vào RAM (Buffer), KHÔNG ghi đĩa
      ▼
uploadController.uploadSong()
      │
      ├──► uploadToCloudinary(buffer, 'songs', 'video')
      │          │
      │          │ Readable.from(buffer).pipe(upload_stream)
      │          ▼
      │     Cloudinary CDN
      │          │ Returns: { publicId, secureUrl, size }
      │
      ├──► Song.create({ title, duration, file_url: secureUrl, file_path: publicId, ... })
      │          ▼
      │     PostgreSQL: INSERT INTO songs ... RETURNING id
      │
      ├──► Song.addArtist(songId, artistId) × n lần
      │          ▼
      │     PostgreSQL: INSERT INTO song_artists ...
      │
      └──► Song.findById(songId) — đọc lại với JOIN đầy đủ
                 ▼
           Response 201: { success: true, data: { song } }
```

### 9.2 Luồng Stream nhạc (Browser → CDN)

```
Browser Audio Player (player.js)
      │
      │ audio.src = `http://localhost:5000/api/stream/${song.id}`
      │ HTML5 Audio tự gửi GET (có Range header để seek)
      ▼
GET /api/stream/:songId  (Public — không cần auth)
      │
streamController.streamAudio()
      │
      ├──► Song.findById(songId) — kiểm tra tồn tại, lấy file_url
      │
      └──► res.redirect(302, song.file_url)
                 │
                 ▼
           Cloudinary CDN (xử lý Range requests natively)
                 │
                 ▼
           Browser Audio Player (nhận audio stream từ CDN)
```

### 9.3 Luồng Đăng ký

```
POST /api/auth/register
      │
[authLimiter: 5 req/15min]
      │
authController.register()
      │
      ├── Validate: username/email format, password strength, confirmPassword match
      ├── User.findByEmail() → kiểm tra email trùng (409 nếu có)
      ├── User.findByUsername() → kiểm tra username trùng (409 nếu có)
      ├── User.create() → bcryptjs.hash(password, costFactor=10)
      │       └── INSERT INTO users (username, email, password_hash) RETURNING id
      ├── Subscription.create(userId, 'free', now, null)
      │       └── INSERT INTO subscriptions ... (gói free mặc định)
      └── generateToken({ id, username, email, role:'user', is_admin:false })
              └── jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
                  └── Response 201: { data: { token, ... } }
```

### 9.4 Luồng Đăng nhập

```
POST /api/auth/login
      │
[authLimiter]
      │
authController.login()
      │
      ├── User.findByEmail(email) → 401 nếu không tồn tại
      ├── bcryptjs.compare(password, user.password_hash) → 401 nếu sai
      ├── Kiểm tra user.is_locked → 403 ACCOUNT_LOCKED nếu bị khóa
      └── generateToken({ id, username, email, role, is_admin })
              └── Response 200: { data: { user, token } }
```

---

## 10. Luồng dữ liệu và Logic nghiệp vụ

### 10.1 Hệ thống Role (RBAC)

Hệ thống sử dụng **Role-Based Access Control** với 4 cấp độ tăng dần:

```
user (0) → artist (1) → manager (2) → admin (3)
```

| Role | Quyền hạn |
|---|---|
| `user` | Nghe nhạc, tạo/quản lý playlist cá nhân, yêu thích, xem lịch sử, yêu cầu nâng cấp lên artist |
| `artist` | Tất cả quyền `user` + upload/cập nhật/xóa bài hát của mình |
| `manager` | Tất cả + quản lý users (đổi role), duyệt yêu cầu artist, quản lý nội dung, xem stats |
| `admin` | Full control: xóa user, khóa tài khoản, tạo/xóa genres/albums, thu hồi quyền artist, giao task manager |

### 10.2 Luồng xác thực JWT

```
Request đến protected route
      │
[requireAuth] middleware
      │
      ├── Trích xuất token: req.headers.authorization?.split(' ')[1]
      │   → Không có token: 401 "Authentication required"
      │
      ├── isBlocked(token)?
      │   → Có trong blocklist: 401 "Token has been revoked"
      │
      ├── jwt.verify(token, JWT_SECRET)
      │   → Lỗi/hết hạn: 401 "Invalid or expired token"
      │
      ├── Gắn: req.user = { id, username, email, role, is_admin }
      └── next() → đến middleware tiếp theo
                    │
                    ▼
         [requireRole('admin','manager')] (nếu route cần)
                    │
                    ├── req.user.role trong ['admin','manager']?
                    │   → Không: 403 "Access denied. Required role: admin or manager"
                    └── Có: next() → Controller
```

### 10.3 Token Revocation khi Logout

```
POST /api/auth/logout
      │
[requireAuth] → xác thực và gắn req.user, req._token
      │
authController.logout()
      │
      └── revokeToken(req._token, req.user)
              └── blockToken(token, payload.exp)
                      └── _blocklist.set(token, expiry)  ← In-memory Map
                          Response 200: "Logged out successfully"
```

> **Giới hạn đã biết:** Token Blocklist lưu trong RAM của process. Khi deploy multi-instance (PM2 cluster, Docker), token revoked trên instance A vẫn còn hợp lệ trên instance B. Giải pháp: sử dụng Redis làm shared store.

### 10.4 Luồng Yêu cầu nâng cấp Artist

```
User → POST /api/roles/request-artist
       [roleRequestLimiter: max 3/giờ]
       │
       ├── Kiểm tra: req.user.role phải là 'user' (400 nếu không)
       ├── Kiểm tra: không có pending request nào trước đó (409 nếu có)
       └── INSERT INTO role_requests (user_id) VALUES ($1)
               └── Response 201: { id, status: 'pending' }

Manager/Admin → PATCH /api/roles/requests/:id  { action: 'approve'/'reject' }
       │
       ├── action = 'approve':
       │   ├── UPDATE users SET role='artist' WHERE id=user_id
       │   ├── INSERT INTO artists (ON CONFLICT UPDATE) — tạo artist profile
       │   └── UPDATE role_requests SET status='approved', reviewed_by, reviewed_at
       │
       └── action = 'reject':
           └── UPDATE role_requests SET status='rejected', reviewed_by, reviewed_at
```

---

## 11. Cơ chế xác thực và Phân quyền

### 11.1 Database Pool & Query Wrapper (`database.js`)

```javascript
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,                       // [1] Giới hạn 10 connections đồng thời
    idleTimeoutMillis: 30000,      // [2] Đóng connection idle sau 30 giây
    connectionTimeoutMillis: 2000, // [3] Timeout 2s khi pool cạn connection
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }  // [4] SSL cho production
        : false,
});

const _pgQuery = pool.query.bind(pool); // [5] Lưu hàm gốc tránh infinite loop

pool.query = async (sql, params = []) => {
    let i = 0;
    // [6] Chuyển MySQL syntax ? → PostgreSQL $1, $2, $3...
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await _pgQuery(pgSql, params);
    // [7] Chuẩn hóa output: luôn trả về [rows, fields]
    return [result.rows, result.fields ?? []];
};
```

| Dòng | Giải thích |
|---|---|
| `[1]` | Pool tối đa 10 connections — phù hợp cho workload vừa, ngăn DDoS làm cạn connection DB. |
| `[2]` | Tự động đóng connection không dùng sau 30s để giải phóng tài nguyên server DB. |
| `[3]` | Thay vì chờ vô hạn, throw error sau 2s nếu pool cạn — giúp API trả lỗi sớm. |
| `[4]` | Cloud database (Heroku Postgres, Supabase) yêu cầu SSL; `rejectUnauthorized: false` cho self-signed cert. |
| `[5]` | Phải bind và lưu lại hàm gốc TRƯỚC khi override, nếu không sẽ gây stack overflow do self-call. |
| `[6]` | Regex replace `?` → `$N` đơn giản hóa việc viết query, không phải đếm tay số thứ tự. |
| `[7]` | Tất cả models dùng destructuring `const [rows] = await pool.query(...)` nhất quán. |

---

### 11.2 Authentication Middleware (`auth.js`)

```javascript
// [1] Danh sách role theo thứ tự cấp bậc
export const ROLES = Object.freeze(['user', 'artist', 'manager', 'admin']);

// [2] Middleware xác thực — dùng cho mọi protected route
const requireAuth = (req, res, next) => {
    // [3] Tách token từ "Authorization: Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        req.user = verifyToken(token);  // [4] Verify chữ ký + kiểm blocklist
        req._token = token;             // [5] Giữ raw token để revoke khi logout
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// [6] Factory function — tạo middleware kiểm tra role động
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    // [7] Exact match — user phải có chính xác một trong các role được liệt kê
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Access denied. Required role: ${roles.join(' or ')}`,
        });
    }
    next();
};
```

| Dòng | Giải thích |
|---|---|
| `[1]` | `Object.freeze` ngăn code khác vô tình mutate danh sách role. |
| `[2]` | `requireAuth` phải đứng TRƯỚC `requireRole` trong chain middleware. |
| `[3]` | Optional chaining `?.split()` an toàn khi header hoàn toàn không tồn tại. |
| `[4]` | `verifyToken` làm 2 việc: (a) check blocklist, (b) verify JWT signature/expiry. |
| `[5]` | `req._token` giúp controller logout có token để revoke mà không cần parse lại header. |
| `[6]` | `requireRole('admin', 'manager')` trả về middleware function — không phải boolean. |
| `[7]` | `roles.includes(req.user.role)` — match chính xác tên role, không dùng rank comparison. |

**Ví dụ sử dụng trong route:**

```javascript
// Chỉ admin mới xóa được user
router.delete('/users/:id', requireAuth, requireRole('admin'), deleteUser);

// Manager hoặc Admin đều quản lý được song content
router.get('/songs', requireAuth, requireRole('manager', 'admin'), getAdminSongs);

// Tất cả authenticated user đều dùng được
router.get('/me', requireAuth, getMe);
```

---

### 11.3 JWT Utils và Token Blocklist

```javascript
// ── jwt.js ──────────────────────────────────────────────────

const generateToken = (payload) => {
    // [1] Sign payload với secret, đặt expiry 7 ngày
    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
};

const verifyToken = (token) => {
    // [2] Kiểm tra blocklist TRƯỚC — nhanh hơn verify signature
    if (isBlocked(token)) {
        throw new Error('Token has been revoked');
    }
    // [3] Verify signature và expiry; throw nếu invalid
    return jwt.verify(token, config.jwt.secret);
};

const revokeToken = (token, decoded) => {
    // [4] Tái dùng decoded payload nếu đã có sẵn, tránh decode lần 2
    const payload = decoded ?? decodeToken(token);
    // [5] Thêm vào blocklist với TTL = exp của token
    blockToken(token, payload?.exp);
};

// ── tokenBlocklist.js ──────────────────────────────────────

// [6] Map: token string → expiry (unix timestamp)
const _blocklist = new Map();

export function blockToken(token, exp) {
    // [7] Fallback 24h nếu không có exp claim
    const expiry = exp ?? Math.floor(Date.now() / 1000) + 86_400;
    _blocklist.set(token, expiry);
}

export function isBlocked(token) {
    const expiry = _blocklist.get(token);
    if (expiry === undefined) return false;
    // [8] Lazy eviction: nếu token đã expire, xóa khỏi map luôn
    if (Math.floor(Date.now() / 1000) > expiry) {
        _blocklist.delete(token);
        return false;
    }
    return true;
}

// [9] Proactive cleanup mỗi 15 phút — tránh memory leak
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [token, expiry] of _blocklist) {
        if (now > expiry) _blocklist.delete(token);
    }
}, 15 * 60 * 1000);
```

| Dòng | Giải thích |
|---|---|
| `[1]` | Payload embed `{ id, username, email, role, is_admin }` — middleware không cần query DB để kiểm tra role. |
| `[2]` | Check blocklist trước (O(1) Map lookup) rồi mới verify signature (CPU-bound) — tối ưu performance. |
| `[3]` | `jwt.verify` throw `JsonWebTokenError` hoặc `TokenExpiredError` — bắt trong catch của `requireAuth`. |
| `[5]` | Lưu TTL bằng chính `exp` của JWT: khi token tự hết hạn, entry blocklist cũng không còn ý nghĩa. |
| `[8]` | Lazy eviction: mỗi lần check là cơ hội dọn dẹp một entry — không cần scan toàn bộ map. |
| `[9]` | Proactive cleanup đảm bảo map không phình ra vô hạn khi có nhiều logout/giờ. |

---

### 11.4 Upload lên Cloudinary (`cloudinaryStorage.js`)

```javascript
export async function uploadToCloudinary(buffer, folder, resourceType = 'video') {
    return new Promise((resolve, reject) => {
        // [1] Mở upload stream — nhận dữ liệu từ stream và đẩy lên Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,           // [2] 'songs' hoặc 'covers'
                resource_type: resourceType, // [3] 'video' cho audio, 'image' cho ảnh
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    publicId:  result.public_id,  // [4] Dùng để xóa: 'songs/abc123'
                    secureUrl: result.secure_url, // [5] HTTPS CDN URL để stream
                    size:      result.bytes,
                });
            },
        );

        // [6] Chuyển Buffer trong RAM → Readable stream → pipe vào Cloudinary
        Readable.from(buffer).pipe(uploadStream);
    });
}
```

| Dòng | Giải thích |
|---|---|
| `[1]` | `upload_stream` nhận dữ liệu dạng stream thay vì file path — phù hợp với Multer `memoryStorage`. |
| `[2]` | Folder tổ chức files: `songs/xxx` (audio), `covers/xxx` (ảnh bìa). |
| `[3]` | Cloudinary dùng `resource_type: 'video'` cho cả audio và video files (không phải `raw`). |
| `[4]` | `publicId` (`songs/abc123`) được lưu vào `songs.file_path` — dùng khi gọi `cloudinary.uploader.destroy()` để xóa. |
| `[5]` | `secureUrl` là HTTPS URL CDN — lưu vào `songs.file_url` và dùng trực tiếp để redirect stream. |
| `[6]` | `Readable.from(buffer)` — Node.js API chuyển `Buffer` thành `Readable Stream` để `pipe`. Không cần ghi file tạm ra disk. |

---

### 11.5 Song Model với Full-Text Search

```javascript
static async search(query, limit = 20, offset = 0) {
    const [rows] = await pool.query(
        `SELECT s.*,
                STRING_AGG(DISTINCT a.name, ',') as artist_names,
                al.title as album_title
         FROM songs s
         LEFT JOIN song_artists sa ON s.id = sa.song_id
         LEFT JOIN artists a ON sa.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         WHERE
           -- [1] Full-text search qua tsvector index (nhanh, hỗ trợ tiếng Việt không dấu)
           s.tsv @@ plainto_tsquery('simple', unaccent(?))
           -- [2] Tìm theo tên nghệ sĩ (partial match, case-insensitive)
           OR a.name ILIKE ?
           -- [3] Tìm theo tên album (partial match, case-insensitive)
           OR al.title ILIKE ?
         GROUP BY s.id, al.title  -- [4] GROUP BY để STRING_AGG hoạt động
         LIMIT ? OFFSET ?`,
        [query, `%${query}%`, `%${query}%`, limit, offset]
    );
    return rows;
}
```

| Dòng | Giải thích |
|---|---|
| `[1]` | `s.tsv @@ plainto_tsquery(...)`: dùng GIN index — tìm kiếm cực nhanh trong tiêu đề bài hát. `unaccent()` loại bỏ dấu tiếng Việt (e.g. "Nỗi Đau" tìm được bằng "Noi Dau"). |
| `[2,3]` | Fallback ILIKE: partial match cho tên nghệ sĩ và album (không dùng FTS index nhưng đủ khi dataset vừa). |
| `[4]` | `STRING_AGG(DISTINCT a.name, ',')` gom nhiều nghệ sĩ thành một chuỗi, `GROUP BY` cần thiết để aggregate hoạt động đúng sau LEFT JOIN. |

---

### 11.6 Admin Controller — Dashboard Stats

```javascript
// GET /api/admin/stats
export const getStats = async (req, res) => {
    try {
        // [1] Chạy 5 queries song song với Promise.all
        const [usersRes, songsRes, artistsRes, playlistsRes, recentRes] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS users FROM users WHERE deleted_at IS NULL'),
            pool.query('SELECT COUNT(*)::int AS songs FROM songs'),
            pool.query('SELECT COUNT(*)::int AS artists FROM artists'),
            pool.query('SELECT COUNT(*)::int AS playlists FROM playlists'),
            pool.query(
                `SELECT id, username, full_name, email, is_admin, created_at
                 FROM users WHERE deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 5`
            ),
        ]);

        // [2] Unwrap giá trị từ pool.query wrapper (trả về [rows, fields])
        const users     = usersRes[0][0]?.users     ?? 0;
        const songs     = songsRes[0][0]?.songs     ?? 0;
        const artists   = artistsRes[0][0]?.artists  ?? 0;
        const playlists = playlistsRes[0][0]?.playlists ?? 0;
        const recentUsers = recentRes[0]; // [3] Lấy array rows từ kết quả query cuối

        return res.json({
            success: true,
            data: { users_count: users, songs_count: songs, artists_count: artists,
                    playlists_count: playlists, recent_users: recentUsers },
        });
    } catch (err) {
        console.error('Admin getStats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
};
```

| Dòng | Giải thích |
|---|---|
| `[1]` | `Promise.all([...])` chạy tất cả 5 queries đồng thời trên pool — nhanh hơn gọi tuần tự ~4-5x. |
| `[2]` | `usersRes[0][0]?.users` — `[0]` đầu tiên lấy `rows` từ tuple `[rows, fields]`, `[0]` thứ hai lấy row đầu tiên. |
| `[3]` | `recentRes[0]` là toàn bộ array rows của query 5 user gần nhất. |

---

## 12. Giải thích code quan trọng

### Rate Limiters (`rateLimiter.js`)

| Middleware | Giới hạn | Áp dụng cho | Ghi chú |
|---|---|---|---|
| `generalLimiter` | 300 req / 15 phút | Tất cả routes | Áp dụng global trong `app.js` |
| `authLimiter` | 5 req / 15 phút | `/auth/login`, `/auth/register` | `skipSuccessfulRequests: true` — không đếm login thành công |
| `uploadLimiter` | 10 req / giờ | Upload file (reserved, chưa gắn vào route) | — |
| `searchLimiter` | 30 req / phút | `/songs/search`, `/artists/search` | — |
| `roleRequestLimiter` | 3 req / giờ | `/roles/request-artist` | Chống spam yêu cầu artist |

### Error Handler Global (`errorHandler.js`)

```javascript
const errorHandler = (err, req, res, next) => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (err.name === 'ValidationError') → 400
    if (err.name === 'JsonWebTokenError') → 401
    if (err.code?.startsWith('ER_')) → 400 (DB errors)
    default → err.statusCode || 500

    // Stack trace chỉ expose khi NODE_ENV=development
};
```

### Tổng hợp biện pháp bảo mật

| Biện pháp | Chi tiết |
|---|---|
| Password hashing | `bcryptjs` với cost factor 10 (≈100ms/hash) |
| JWT Auth | Signed HS256, expiry 7 ngày |
| Token Revocation | In-memory blocklist khi logout |
| Rate Limiting | Nhiều tầng: global, auth, search, upload, role |
| Input Validation | Validate format username/email/password trước khi xử lý |
| Soft Delete | Users dùng `deleted_at`, không xóa cứng khỏi DB |
| Account Locking | Admin khóa tài khoản qua `is_locked = true` → 403 khi login |
| CORS Policy | Chỉ cho phép origin từ `CORS_ORIGIN` env |
| SSL Database | Hỗ trợ SSL connection qua `DB_SSL=true` |
| No Stack Trace | Stack trace chỉ expose trong `NODE_ENV=development` |
| File Validation | Kiểm tra extension + MIME type trước khi upload |
| Parameter Binding | Tất cả query dùng parameterized queries — không có SQL injection |

---

## 13. Middleware và Bảo mật

### Luồng xử lý file (Zero-Disk Strategy)

```
Client Upload
      │
      ▼
Multer `memoryStorage`
  → File KHÔNG bao giờ ghi ra disk
  → Chỉ tồn tại trong RAM dưới dạng Buffer
  → Validate extension + MIME + size
      │
      ▼
Controller
  → Readable.from(buffer).pipe(cloudinary.upload_stream)
  → Upload trực tiếp từ RAM lên Cloudinary CDN
      │
      ▼
Cloudinary trả về { publicId, secureUrl, size }
      │
      ▼
Lưu vào Database:
  file_url  = secureUrl  ← dùng để stream
  file_path = publicId   ← dùng để xóa
```

### Giới hạn file

| Loại | Định dạng được phép | Kích thước tối đa |
|---|---|---|
| Audio | `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg`, `.m4a` | 500 MB (env: `MAX_FILE_SIZE`) |
| Image | `.jpg`, `.jpeg`, `.png`, `.webp` | 5 MB (hardcoded) |

### Cloudinary folder structure

```
Cloudinary Account/
├── songs/          ← File audio (resource_type: video)
└── covers/         ← Ảnh bìa album, playlist, avatar (resource_type: image)
```

### Xóa file khỏi Cloudinary

```javascript
// Sử dụng publicId lưu trong songs.file_path
await deleteFromCloudinary('songs/abc123', 'video');
// Gọi: cloudinary.uploader.destroy(publicId, { resource_type })
```

---

## 14. Upload File và Cloudinary

### Astro Pages & Routing

Astro dùng **file-based routing**: mỗi file `.astro` trong `src/pages/` = một URL.

| File | URL | Mô tả | Auth yêu cầu |
|---|---|---|---|
| `index.astro` | `/` | Trang chủ: featured songs, trending | Không |
| `search.astro` | `/search` | Tìm kiếm bài hát, nghệ sĩ | Không |
| `album.astro` | `/album?id=` | Chi tiết album + danh sách bài | Không |
| `artist.astro` | `/artist?id=` | Trang nghệ sĩ + discography | Không |
| `artists.astro` | `/artists` | Danh sách tất cả nghệ sĩ | Không |
| `playlist.astro` | `/playlist?id=` | Chi tiết playlist | JWT |
| `liked.astro` | `/liked` | Bài hát đã thích | JWT |
| `admin.astro` | `/admin` | Dashboard admin/manager | JWT + manager+ |
| `upload.astro` | `/upload` | Upload nhạc mới | JWT + artist+ |
| `profile.astro` | `/profile` | Trang cá nhân | JWT |
| `settings.astro` | `/settings` | Cài đặt tài khoản | JWT |
| `login.astro` | `/login` | Đăng nhập | Không |
| `signup.astro` | `/signup` | Đăng ký | Không |
| `403.astro` | `/403` | Trang lỗi Forbidden | Không |
| `404.astro` | `/404` | Trang lỗi Not Found | Không |

### Client-side Auth Guard (`lib/api.js`)

```javascript
// Token và user lưu trong localStorage
export function getToken()  { return localStorage.getItem('auth_token'); }
export function getUser()   { return JSON.parse(localStorage.getItem('auth_user')); }
export function clearAuth() { /* xóa token + user + cache khi logout */ }

// Role hierarchy: user(0) → artist(1) → manager(2) → admin(3)
const ROLE_RANK = { user: 0, artist: 1, manager: 2, admin: 3 };

/**
 * Guard dùng ở đầu script trong mỗi protected page.
 * Redirect về /login hoặc /403 nếu không đủ quyền.
 */
export function requireAuthClient(minRole) {
    if (!getToken()) {
        window.location.href = '/login?reason=auth_required';
        return false;
    }
    if (minRole && !hasMinRole(minRole)) {
        window.location.href = '/403';
        return false;
    }
    return true;
}
```

### Audio Player Singleton (`lib/player.js`)

Player là **module-level singleton** — một instance duy nhất trên toàn tab trình duyệt, giao tiếp với UI qua **Custom Events**:

| Event | Phát khi | Payload |
|---|---|---|
| `player:songchange` | Bài hát mới được load | `{ song }` |
| `player:play` | Bắt đầu phát | `{ song }` |
| `player:pause` | Tạm dừng | `{ song }` |
| `player:timeupdate` | Tiến độ phát thay đổi | `{ song }` |
| `player:ended` | Kết thúc bài | `{ song }` |
| `player:loaded` | Metadata âm thanh sẵn sàng | `{ song }` |

**Tính năng:**
- Shuffle mode (random queue index)
- Repeat modes: `none` / `all` / `one`
- Queue management (danh sách phát)
- State persist/restore qua `sessionStorage` (giữ trạng thái khi navigate giữa các trang)

**Luồng phát nhạc trong player:**

```javascript
// player.js - khi gọi player.playSong(song)
async function _playSong(song) {
    _current = song;
    const a = getAudio(); // lấy hoặc tạo HTML5 Audio instance
    _loading = true;
    a.src = `http://localhost:5000/api/stream/${song.id}`;
    // Backend redirect 302 → Cloudinary CDN URL
    // Browser tự follow redirect và stream audio từ CDN
    _loading = false;
    _dispatch('songchange');
    await a.play();
}
```

---

## 15. Frontend Architecture

| Hạng mục | Trạng thái hiện tại | Đề xuất cải thiện |
|---|---|---|
| **Token Blocklist** | In-memory Map, process-local | Chuyển sang **Redis** cho multi-instance deployment |
| **JWT Role Caching** | Role embed trong token, không realtime khi role thay đổi | Thêm **refresh token** hoặc giảm JWT expiry xuống 1h |
| **Full-text Search** | PostgreSQL tsvector trên `songs.title` | Mở rộng thêm `unaccent` cho `artists.name` |
| **Subscription/Payment** | Stub implementation (không có gateway thật) | Tích hợp **Stripe** hoặc **VNPay** |
| **File Upload** | Single upload, tối đa 500MB | Xem xét **resumable/chunked upload** cho file lớn |
| **Test Coverage** | Chưa có unit/integration tests | Thêm **Jest** + **Supertest** |
| **API Documentation** | README này | Generate **Swagger/OpenAPI** spec tự động |
| **Logging** | Console log cơ bản | Tích hợp **Winston** + structured log format |
| **Monitoring** | Chưa có | Thêm health check endpoint đã có, cân nhắc **Prometheus** metrics |

---

## 16. Ghi chú kỹ thuật và Điểm cải thiện

| Hạng mục | Trạng thái hiện tại | Đề xuất cải thiện |
|---|---|---|
| **Token Blocklist** | In-memory Map, process-local | Chuyển sang **Redis** cho multi-instance deployment |
| **JWT Role Caching** | Role embed trong token, không realtime khi role thay đổi | Thêm **refresh token** hoặc giảm JWT expiry xuống 1h |
| **Password Reset** | Đã có token một lần, hết hạn 15 phút, gửi email reset | Bổ sung SMTP production và trang email template đẹp hơn |
| **Full-text Search** | PostgreSQL tsvector trên `songs.title` | Mở rộng thêm `unaccent` cho `artists.name` |
| **Subscription/Payment** | Stub implementation (không có gateway thật) | Tích hợp **Stripe** hoặc **VNPay** |
| **File Upload** | Single upload, tối đa 500MB | Xem xét **resumable/chunked upload** cho file lớn |
| **Test Coverage** | Chưa có unit/integration tests | Thêm **Jest** + **Supertest** |
| **API Documentation** | README này | Generate **Swagger/OpenAPI** spec tự động |
| **Logging** | Console log cơ bản | Tích hợp **Winston** + structured log format |
| **Monitoring** | Chưa có | Thêm health check endpoint đã có, cân nhắc **Prometheus** metrics |

---

### Trạng thái tính năng auth hiện tại
- Đăng ký, đăng nhập và đăng xuất đã hoạt động ổn định.
- Khôi phục mật khẩu đã được bổ sung với token an toàn và giới hạn thời gian.
- Email reset password sẽ hoạt động khi cấu hình SMTP được cung cấp.
- Token reset sẽ bị vô hiệu hóa ngay sau khi đổi mật khẩu thành công.

---

*Tài liệu được cập nhật theo tiến độ hiện tại của dự án — 15/05/2026.*

