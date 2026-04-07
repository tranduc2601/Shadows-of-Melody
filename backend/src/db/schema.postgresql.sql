-- ============================================================
-- PostgreSQL Schema cho Shadows of Melody (Fixed)
-- ============================================================

-- Bật Extension hỗ trợ bỏ dấu tiếng Việt
CREATE EXTENSION IF NOT EXISTS unaccent;

-- TẠO HÀM ÉP UNACCENT THÀNH BẤT BIẾN (IMMUTABLE) ĐỂ FIX LỖI 42P17
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
    SELECT unaccent('unaccent', $1);
$$ LANGUAGE sql IMMUTABLE STRICT;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100),
    avatar_url    VARCHAR(500),
    bio           TEXT,
    is_admin      BOOLEAN DEFAULT FALSE,
    is_verified   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- ── Artists ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    bio             TEXT,
    image_url       VARCHAR(500),
    followers_count INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Albums ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS albums (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(150) NOT NULL,
    artist_id    INT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    cover_url    VARCHAR(500),
    release_date DATE,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Genres ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS genres (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- ── Songs (ĐÃ FIX CÚ PHÁP VÀ HÀM IMMUTABLE) ──────────────────
CREATE TABLE IF NOT EXISTS songs (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    album_id    INT REFERENCES albums(id) ON DELETE SET NULL,
    duration    INT NOT NULL,               
    file_url    VARCHAR(1000) NOT NULL UNIQUE, 
    file_path   VARCHAR(500),               
    file_size   BIGINT,                     
    cover_url   VARCHAR(500),
    plays_count INT DEFAULT 0,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    
    -- Đã sửa cú pháp thành GENERATED ALWAYS AS và dùng hàm immutable_unaccent
    tsv         TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', immutable_unaccent(title))) STORED
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_tsv   ON songs USING GIN(tsv);

-- ── Song ↔ Artists (n:m) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_artists (
    song_id   INT NOT NULL REFERENCES songs(id)   ON DELETE CASCADE,
    artist_id INT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (song_id, artist_id)
);

-- ── Song ↔ Genres (n:m) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_genres (
    song_id  INT NOT NULL REFERENCES songs(id)  ON DELETE CASCADE,
    genre_id INT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (song_id, genre_id)
);

-- ── Playlists ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    cover_url   VARCHAR(500),
    is_public   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Playlist ↔ Songs (n:m) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id INT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id     INT NOT NULL REFERENCES songs(id)     ON DELETE CASCADE,
    added_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (playlist_id, song_id)
);

-- ── Favorites ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id    INT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, song_id)
);

-- ── Listening History ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listening_history (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id         INT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    played_at       TIMESTAMPTZ DEFAULT NOW(),
    duration_played INT
);

CREATE INDEX IF NOT EXISTS idx_history_user_date ON listening_history(user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_history_song_date ON listening_history(song_id, played_at);

-- ── Subscriptions ────────────────────────────────────────────
CREATE TYPE subscription_type_enum AS ENUM ('free', 'premium', 'vip');

CREATE TABLE IF NOT EXISTS subscriptions (
    id                SERIAL PRIMARY KEY,
    user_id           INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    subscription_type subscription_type_enum DEFAULT 'free',
    start_date        DATE NOT NULL,
    end_date          DATE,
    is_active         BOOLEAN DEFAULT TRUE,
    auto_renew        BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payments ─────────────────────────────────────────────────
CREATE TYPE payment_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount          NUMERIC(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'USD',
    payment_method  VARCHAR(50),
    transaction_id  VARCHAR(100) UNIQUE,
    status          payment_status_enum DEFAULT 'pending',
    description     TEXT,
    payment_date    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_date ON payments(user_id, payment_date);

-- ── Trigger: tự động cập nhật updated_at ─────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','artists','albums','songs','playlists','subscriptions'] LOOP
        EXECUTE format(
            'CREATE OR REPLACE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;