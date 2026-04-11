-- ============================================================
-- PostgreSQL Schema — Shadows of Melody
-- Reverse-engineered from live database: 2026-04-10
-- Tables: albums, artists, favorites, genres, listening_history,
--         payments, playlist_songs, playlists, role_requests,
--         song_artists, song_genres, songs, subscriptions, users
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrapper required for use in indexes / triggers
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
    SELECT unaccent('unaccent', $1);
$$ LANGUAGE sql IMMUTABLE STRICT;

-- ── Custom ENUM Types ─────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'artist', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_type_enum AS ENUM ('free', 'premium', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100),
    avatar_url    VARCHAR(500),
    bio           TEXT,
    is_admin      BOOLEAN   NOT NULL DEFAULT FALSE,
    is_verified   BOOLEAN   NOT NULL DEFAULT FALSE,
    role          user_role NOT NULL DEFAULT 'user',
    is_locked     BOOLEAN   NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

-- ── Artists ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    bio             TEXT,
    image_url       VARCHAR(500),
    followers_count INT         DEFAULT 0,
    user_id         INT         UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Albums ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS albums (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(150) NOT NULL,
    artist_id    INT          REFERENCES artists(id) ON DELETE CASCADE,
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

-- ── Songs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS songs (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(150)  NOT NULL,
    album_id    INT           REFERENCES albums(id) ON DELETE SET NULL,
    duration    INT           NOT NULL,
    file_url    VARCHAR(1000) NOT NULL UNIQUE,
    file_path   VARCHAR(500),
    file_size   BIGINT,
    cover_url   VARCHAR(500),
    plays_count INT           DEFAULT 0,
    status      VARCHAR(20)   NOT NULL DEFAULT 'published',
    tsv         TSVECTOR,
    upload_date TIMESTAMPTZ   DEFAULT NOW(),
    created_at  TIMESTAMPTZ   DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_tsv   ON songs USING GIN(tsv);

-- Trigger to keep tsv in sync with title
CREATE OR REPLACE FUNCTION songs_tsv_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.tsv = to_tsvector('simple', immutable_unaccent(NEW.title));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_songs_tsv ON songs;
CREATE TRIGGER trg_songs_tsv
    BEFORE INSERT OR UPDATE OF title ON songs
    FOR EACH ROW EXECUTE FUNCTION songs_tsv_update();

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

-- ── Subscriptions ─────────────────────────────────────────────
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

-- ── Payments ──────────────────────────────────────────────────
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

-- ── Role Requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_requests (
    id          SERIAL PRIMARY KEY,
    user_id     INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by INT                  REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_requests_user_id ON role_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_status  ON role_requests(status);

-- ── updated_at Auto-Trigger ───────────────────────────────────
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
            'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
             CREATE TRIGGER trg_%1$s_updated_at
             BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t
        );
    END LOOP;
END;
$$;