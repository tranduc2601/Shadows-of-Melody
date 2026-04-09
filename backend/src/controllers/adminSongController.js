import { pool } from '../config/database.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryStorage.js';

/**
 * POST /api/admin/songs/upload
 * Multipart form-data fields:
 *   audio       - file (required, mp3/wav/flac/aac/ogg/m4a)
 *   title       - string (required)
 *   duration    - integer seconds (required, auto-filled by client)
 *   artist_ids  - JSON array string  e.g. "[1,2]"
 *   genre_ids   - JSON array string  e.g. "[3,4]"
 *   album_id    - integer (optional)
 *   cover_url   - string URL (optional)
 *
 * Flow:
 *   1. Upload buffer → Cloudinary
 *   2. BEGIN PostgreSQL transaction
 *   3. INSERT songs RETURNING id
 *   4. INSERT song_artists (ON CONFLICT DO NOTHING)
 *   5. INSERT song_genres  (ON CONFLICT DO NOTHING)
 *   6. COMMIT
 *   If any DB step fails → ROLLBACK + delete from Cloudinary (prevent orphaned files)
 */
export const adminUploadSong = async (req, res) => {
    // ── 1. Validate input ────────────────────────────────────────────────────
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Audio file required' });
    }

    const { title, duration, album_id, cover_url, artist_ids, genre_ids } = req.body;

    if (!title?.trim()) {
        return res.status(400).json({ success: false, message: 'title is required' });
    }

    const durationSec = parseInt(duration, 10);
    if (isNaN(durationSec) || durationSec <= 0) {
        return res.status(400).json({ success: false, message: 'duration must be a positive integer (seconds)' });
    }

    let artistArr = [];
    let genreArr  = [];
    try { artistArr = JSON.parse(artist_ids || '[]'); } catch {}
    try { genreArr  = JSON.parse(genre_ids  || '[]'); } catch {}

    // ── 2. Upload to Cloudinary ───────────────────────────────────────────────
    let cloudinaryResult;
    try {
        cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'songs', 'video');
    } catch (uploadErr) {
        console.error('[adminUploadSong] Cloudinary upload failed:', uploadErr.message);
        return res.status(502).json({ success: false, message: 'File upload to storage failed' });
    }

    const { publicId, secureUrl, size } = cloudinaryResult;

    // ── 3. PostgreSQL transaction ─────────────────────────────────────────────
    // pool.connect() returns a raw pg client — use native $1/$2 syntax here
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 3a. Insert song
        const songResult = await client.query(
            `INSERT INTO songs
               (title, album_id, duration, file_url, file_path, file_size, cover_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
                title.trim(),
                album_id ? parseInt(album_id, 10) : null,
                durationSec,
                secureUrl,   // Cloudinary CDN URL
                publicId,    // e.g. songs/abc123 — used for deletion
                size,
                cover_url || null,
            ]
        );
        const songId = songResult.rows[0].id;

        // 3b. Link artists (junction table)
        for (const rawId of artistArr) {
            const aid = parseInt(rawId, 10);
            if (!isNaN(aid)) {
                await client.query(
                    'INSERT INTO song_artists (song_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [songId, aid]
                );
            }
        }

        // 3c. Link genres (junction table)
        for (const rawId of genreArr) {
            const gid = parseInt(rawId, 10);
            if (!isNaN(gid)) {
                await client.query(
                    'INSERT INTO song_genres (song_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [songId, gid]
                );
            }
        }

        await client.query('COMMIT');

        // ── 4. Return new song with joined data ───────────────────────────────
        const { rows: [song] } = await client.query(
            `SELECT s.*,
                    STRING_AGG(DISTINCT a.id::text, ',') as artist_ids,
                    STRING_AGG(DISTINCT a.name, ',')     as artist_names,
                    STRING_AGG(DISTINCT g.id::text, ',') as genre_ids,
                    STRING_AGG(DISTINCT g.name, ',')     as genre_names,
                    al.title                             as album_title
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN song_genres sg ON s.id = sg.song_id
             LEFT JOIN genres g ON sg.genre_id = g.id
             LEFT JOIN albums al ON s.album_id = al.id
             WHERE s.id = $1
             GROUP BY s.id, al.title`,
            [songId]
        );

        return res.status(201).json({
            success: true,
            message: 'Song uploaded successfully',
            data: song,
        });

    } catch (dbErr) {
        // ── Rollback DB + delete from Cloudinary to avoid orphaned files ──────
        await client.query('ROLLBACK').catch(() => {});
        await deleteFromCloudinary(publicId, 'video');

        console.error('[adminUploadSong] DB transaction failed (rolled back):', dbErr.message);
        return res.status(500).json({ success: false, message: 'Database error — upload rolled back' });
    } finally {
        client.release();
    }
};

/**
 * PATCH /api/admin/songs/:id
 * JSON body: { title?, cover_url?, album_id?, genre_ids?, artist_ids? }
 */
export const adminUpdateSong = async (req, res) => {
    const { id } = req.params;
    const { title, cover_url, album_id, genre_ids, artist_ids } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Build dynamic SET clause for scalar fields
        const setClauses = [];
        const setValues  = [];
        if (title?.trim())          { setClauses.push(`title = $${setValues.length + 1}`);     setValues.push(title.trim()); }
        if (cover_url !== undefined) { setClauses.push(`cover_url = $${setValues.length + 1}`); setValues.push(cover_url || null); }
        if (album_id  !== undefined) { setClauses.push(`album_id = $${setValues.length + 1}`);  setValues.push(album_id ? parseInt(album_id, 10) : null); }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = NOW()');
            setValues.push(id);
            await client.query(
                `UPDATE songs SET ${setClauses.join(', ')} WHERE id = $${setValues.length}`,
                setValues
            );
        }

        // Replace genres
        if (Array.isArray(genre_ids)) {
            await client.query('DELETE FROM song_genres WHERE song_id = $1', [id]);
            for (const gid of genre_ids) {
                const g = parseInt(gid, 10);
                if (!isNaN(g)) await client.query('INSERT INTO song_genres (song_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, g]);
            }
        }

        // Replace artists
        if (Array.isArray(artist_ids)) {
            await client.query('DELETE FROM song_artists WHERE song_id = $1', [id]);
            for (const aid of artist_ids) {
                const a = parseInt(aid, 10);
                if (!isNaN(a)) await client.query('INSERT INTO song_artists (song_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, a]);
            }
        }

        await client.query('COMMIT');

        const { rows: [song] } = await client.query(
            `SELECT s.*,
                    STRING_AGG(DISTINCT a.id::text, ',') as artist_ids_str,
                    STRING_AGG(DISTINCT a.name, ', ')    as artist_names,
                    STRING_AGG(DISTINCT g.id::text, ',') as genre_ids_str,
                    STRING_AGG(DISTINCT g.name, ', ')    as genre_names,
                    al.title                             as album_title
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN song_genres sg ON s.id = sg.song_id
             LEFT JOIN genres g ON sg.genre_id = g.id
             LEFT JOIN albums al ON s.album_id = al.id
             WHERE s.id = $1
             GROUP BY s.id, al.title`,
            [id]
        );

        return res.status(200).json({ success: true, data: song });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[adminUpdateSong] error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update song' });
    } finally {
        client.release();
    }
};

/**
 * POST /api/admin/upload/cover
 * Multipart field: cover (image/jpeg | image/png | image/webp, max 5 MB)
 * Returns: { success: true, data: { url: string } }
 */
export const adminUploadCover = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Image file required' });
    }
    try {
        const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'covers', 'image');
        return res.status(200).json({ success: true, data: { url: secureUrl } });
    } catch (err) {
        console.error('[adminUploadCover] Cloudinary upload failed:', err.message);
        return res.status(502).json({ success: false, message: 'Image upload to storage failed' });
    }
};
