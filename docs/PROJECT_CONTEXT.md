# Shadows of Melody - Project Context

## Tong quan

Shadows_of_Melody la app nghe nhac gom:

* Frontend: Astro tai `src/`
* Backend: Node.js/Express tai `backend/src/`
* Database: PostgreSQL schema tai `backend/src/db/schema.postgresql.sql`
* Prisma hien chi co datasource/generator, chua khai bao model tai `prisma/schema.prisma`

## Cau truc thu muc chinh

```txt
D:\Shadows_of_Melody
|-- backend
|   |-- src
|   |   |-- config
|   |   |-- controllers
|   |   |-- db
|   |   |-- middleware
|   |   |-- models
|   |   |-- routes
|   |   `-- utils
|   |-- scripts
|   `-- server.js
|-- prisma
|   `-- schema.prisma
|-- public
|   `-- images
|-- src
|   |-- assets
|   |-- components
|   |-- layouts
|   |-- lib
|   |-- pages
|   `-- styles
|-- outputs
|-- package.json
`-- astro.config.mjs
```

## Database chinh

### users

Cot chinh:

* id
* username
* email
* password_hash
* full_name
* avatar_url
* bio
* auth_provider
* google_id
* role
* is_admin
* is_verified
* is_locked
* timestamps

Vai tro:

* Goc cho artist, playlist, favorite, history, subscription, payment

### artists

Cot chinh:

* id
* name
* bio
* image_url
* followers_count
* user_id
* timestamps

Quan he:

* user_id -> users.id

### albums

Cot chinh:

* id
* title
* artist_id
* cover_url
* release_date
* description
* timestamps

Quan he:

* artist_id -> artists.id

### genres

Cot chinh:

* id
* name
* description

Quan he:

* nhieu-nhieu voi songs

### songs

Cot chinh:

* id
* title
* album_id
* duration
* file_url
* file_path
* file_size
* cover_url
* plays_count
* status
* is_featured
* featured_at
* tsv
* timestamps

Quan he:

* album_id -> albums.id

### song_artists

Cot chinh:

* song_id
* artist_id

Quan he:

* nhieu-nhieu songs/artists

### song_genres

Cot chinh:

* song_id
* genre_id

Quan he:

* nhieu-nhieu songs/genres

### playlists

Cot chinh:

* id
* user_id
* name
* description
* cover_url
* is_public
* timestamps

Quan he:

* user_id -> users.id

### playlist_songs

Cot chinh:

* playlist_id
* song_id
* added_at

Quan he:

* nhieu-nhieu playlists/songs

### favorites

Cot chinh:

* id
* user_id
* song_id
* created_at

Rang buoc:

* unique user_id + song_id

### listening_history

Cot chinh:

* id
* user_id
* song_id
* played_at
* duration_played

### subscriptions

Cot chinh:

* id
* user_id
* subscription_type
* start_date
* end_date
* is_active
* auto_renew
* timestamps

### password_reset_tokens

Cot chinh:

* id
* user_id
* token_hash
* expires_at
* used_at
* created_at

### payments

Cot chinh:

* id
* user_id
* subscription_id
* amount
* currency
* payment_method
* payment_provider
* transaction_id
* order_id
* status
* paid_at
* timestamps

### role_requests

Cot chinh:

* id
* user_id
* status
* reviewed_by
* reviewed_at
* created_at

## Enum

### user_role

* user
* artist
* manager
* admin

### subscription_type_enum

* free
* premium
* vip

### payment_status_enum

* pending
* completed
* failed
* refunded

## API chinh

Backend mount routes trong `backend/src/app.js`:

```txt
/api/auth
/api/songs
/api/artists
/api/albums
/api/playlists
/api/favorites
/api/history
/api/stream
/api/subscriptions
/api/admin
/api/roles
/api/studio
/health
```

## Frontend pages

```txt
/
/login
/signup
/songs
/artists
/artist
/album
/playlist
/liked
/player
/search
/profile
/settings
/upload
/studio
/subscription
/admin
/forgot-password
/reset-password
/privacy
/terms
/403
/404
/payment/vnpay-mock
```
