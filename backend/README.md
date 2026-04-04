# 🎵 Shadows of Melody - Backend Server

Backend Node.js + Express + MySQL cho hệ thống streaming nhạc.

## 📋 Requirements

- Node.js >= 22.12.0
- MySQL >= 8.0
- npm hoặc yarn

## 🚀 Cấu trúc dự án

```
backend/
├── src/
│   ├── config/            # Database & environment configuration
│   ├── middleware/        # Auth, CORS, Rate Limit, Logger, Error Handler
│   ├── models/           # Database models (User, Song, Artist, Album, etc.)
│   ├── controllers/      # Business logic
│   ├── routes/          # API routes
│   ├── utils/           # JWT, Validators
│   ├── db/              # Database schema & initialization
│   └── app.js           # Express app setup
├── uploads/             # Audio files storage
├── server.js            # Server entry point
├── package.json
├── .env.example         # Environment variables template
└── README.md
```

## 🔧 Cài đặt

### 1. Copy environment file

```bash
cd backend
cp .env.example .env
```

### 2. Cấu hình `.env`

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=shadows_of_melody

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. Cài đặt dependencies

```bash
npm install
```

### 4. Tạo database trong MySQL

```sql
CREATE DATABASE IF NOT EXISTS shadows_of_melody;
```

### 5. Initialize database schema

```bash
npm run db:init
```

## 📱 API Endpoints

### 🔐 Authentication

```
POST   /api/auth/register          # Đăng ký
POST   /api/auth/login             # Đăng nhập
GET    /api/auth/me                # Lấy thông tin user (require token)
PUT    /api/auth/profile           # Cập nhật profile (require token)
```

### 🎵 Songs

```
GET    /api/songs                  # Lấy danh sách bài hát
GET    /api/songs/:id              # Lấy chi tiết bài hát
GET    /api/songs/search?q=keyword # Tìm kiếm bài hát
POST   /api/songs/history          # Thêm vào lịch sử nghe (require token)
POST   /api/songs                  # Tạo bài hát (admin)
PUT    /api/songs/:id              # Cập nhật bài hát (admin)
DELETE /api/songs/:id              # Xóa bài hát (admin)
```

### 🎤 Artists

```
GET    /api/artists                # Lấy danh sách nghệ sĩ
GET    /api/artists/:id            # Lấy chi tiết nghệ sĩ
GET    /api/artists/search?q=keyword # Tìm kiếm nghệ sĩ
POST   /api/artists                # Tạo nghệ sĩ (admin)
PUT    /api/artists/:id            # Cập nhật nghệ sĩ (admin)
DELETE /api/artists/:id            # Xóa nghệ sĩ (admin)
```

### 📀 Albums

```
GET    /api/albums                 # Lấy danh sách album
GET    /api/albums/:id             # Lấy chi tiết album
GET    /api/albums/artist/:artistId # Lấy album của nghệ sĩ
POST   /api/albums                 # Tạo album (admin)
PUT    /api/albums/:id             # Cập nhật album (admin)
DELETE /api/albums/:id             # Xóa album (admin)
```

### 📂 Playlists (require token)

```
GET    /api/playlists              # Lấy danh sách playlist của user
POST   /api/playlists              # Tạo playlist mới
GET    /api/playlists/:id          # Lấy chi tiết playlist
PUT    /api/playlists/:id          # Cập nhật playlist
DELETE /api/playlists/:id          # Xóa playlist
POST   /api/playlists/:playlistId/songs       # Thêm bài hát vào playlist
DELETE /api/playlists/:playlistId/songs/:songId # Xóa bài hát khỏi playlist
```

### ❤️ Favorites (require token)

```
GET    /api/favorites              # Lấy danh sách yêu thích
POST   /api/favorites              # Thêm vào yêu thích
GET    /api/favorites/:songId/is-favorite     # Kiểm tra xem có yêu thích không
DELETE /api/favorites/:songId      # Xóa khỏi yêu thích
GET    /api/favorites/:songId/count # Lấy số lượng yêu thích của bài hát
```

### ▶️ Listening History (require token)

```
GET    /api/history                # Lấy lịch sử nghe
GET    /api/history/recent         # Lấy bài hát nghe gần đây
DELETE /api/history                # Xóa lịch sử nghe
```

### 🎧 Streaming

```
GET    /api/stream/:songId         # Stream audio (range request support)
GET    /api/stream/:songId/download # Download audio (require token)
```

### 💳 Subscriptions (require token)

```
GET    /api/subscriptions          # Lấy thông tin subscription
POST   /api/subscriptions/upgrade  # Nâng cấp subscription
GET    /api/subscriptions/payments # Lấy lịch sử thanh toán
POST   /api/subscriptions/payments # Tạo thanh toán
GET    /api/subscriptions/admin/stats # Thống kê subscription (admin)
```

## 🔄 Request/Response Format

### Request Headers

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

### Response Format (Success)

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Response Format (Error)

```json
{
  "success": false,
  "message": "Error message here"
}
```

## 🔐 JWT Token

Nhận token từ login endpoint:

```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Sử dụng token trong headers cho request:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🚀 Chạy Server

### Development Mode

```bash
npm run dev
```

Sẽ chạy với nodemon (auto reload khi thay đổi code)

### Production Mode

```bash
npm start
```

## 📊 Database Schema

### Users

```sql
Users (id, username, email, password_hash, full_name, avatar_url, bio, is_admin, is_verified, created_at)
```

### Music Data

```sql
Artists (id, name, bio, image_url, followers_count, created_at)
Albums (id, title, artist_id, cover_url, release_date, description, created_at)
Songs (id, title, album_id, duration, file_url, file_size, cover_url, plays_count, created_at)
Song_Artists (song_id, artist_id) - junction table
Song_Genres (song_id, genre_id) - junction table
Genres (id, name, description)
```

### User Features

```sql
Playlists (id, user_id, name, description, cover_url, is_public, created_at)
Playlist_Songs (playlist_id, song_id, added_at) - junction table
Favorites (id, user_id, song_id, created_at)
Listening_History (id, user_id, song_id, played_at, duration_played)
```

### Monetization

```sql
Subscriptions (id, user_id, subscription_type, start_date, end_date, is_active, created_at)
Payments (id, user_id, subscription_id, amount, currency, payment_method, transaction_id, status, created_at)
```

## 🔌 Rate Limiting

- **General**: 100 requests / 15 minutes
- **Auth**: 5 attempts / 15 minutes
- **Upload**: 10 uploads / 60 minutes
- **Search**: 30 searches / 1 minute

## 📝 Middleware

- **Auth Middleware**: Bảo vệ các route yêu cầu authentication
- **Admin Middleware**: Bảo vệ các route chỉ admin có thể truy cập
- **Logger Middleware**: Log tất cả requests với response time
- **CORS Middleware**: Cho phép frontend (port 3000) gọi API
- **Rate Limiter**: Chống spam và DDoS
- **Error Handler**: Xử lý tập trung các lỗi

## 🔍 Database Indexes

Các index được tạo để tối ưu hiệu suất:

- username (UNIQUE)
- email (UNIQUE)
- user_id (playlists, favorites, history)
- song_id (playlists, history)
- fulltext index cho song title (search)

## 🌐 CORS Setup

Backend chạy trên `port 5000`, frontend (Astro) chạy trên `port 3000`.
CORS đã được cấu hình cho phép `localhost:3000` gọi API.

## 📦 Dependencies

```json
{
  "express": "^4.18.2",           // Web framework
  "mysql2": "^3.6.5",             // MySQL driver
  "dotenv": "^16.3.1",            // Environment variables
  "jsonwebtoken": "^9.1.2",       // JWT tokens
  "bcryptjs": "^2.4.3",           // Password hashing
  "cors": "^2.8.5",               // CORS support
  "express-rate-limit": "^7.1.5", // Rate limiting
  "multer": "^1.4.5-lts.1",       // File upload
  "axios": "^1.6.4"               // HTTP client
}
```

## 🐛 Troubleshooting

### Connection refused at 127.0.0.1:3306

- Check if MySQL is running
- Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env

### JWT errors

- Make sure JWT_SECRET in .env is not empty
- Check if token is being sent in Authorization header

### CORS errors

- Check CORS_ORIGIN in .env matches frontend URL
- Verify Content-Type is application/json

## 📚 Thêm thông tin

Để tìm hiểu thêm về API, hãy xem các file routes trong `src/routes/`.

## 👨‍💻 Author

Shadows of Melody Backend - 2024

---

🎵 Chúc bạn phát triển hệ thống streaming nhạc thành công!
