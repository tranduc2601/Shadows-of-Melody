/**
 * In-memory JWT token blocklist.
 *
 * ⚠ Limitation: This store is process-local. If you run multiple server
 * instances (e.g. PM2 cluster / Docker replicas) each process has its own
 * blocklist, so a token revoked on instance A is still accepted by instance B.
 * Replace with a shared store (Redis, DB table) for production multi-instance
 * deployments.
 *
 * Entries are automatically pruned once the token's own `exp` has passed,
 * so memory usage stays bounded.
 */

/** @type {Map<string, number>} jti (or raw token) → expiry unix timestamp */
const _blocklist = new Map();

/**
 * Add a token to the blocklist.
 * @param {string} token  The raw JWT string.
 * @param {number} exp    The token's `exp` claim (unix seconds). If omitted,
 *                        the entry lives for 24 h as a safe fallback.
 */
export function blockToken(token, exp) {
    const expiry = exp ?? Math.floor(Date.now() / 1000) + 86_400;
    _blocklist.set(token, expiry);
}

/**
 * Returns true when the token is on the blocklist AND has not yet expired.
 * @param {string} token
 */
export function isBlocked(token) {
    const expiry = _blocklist.get(token);
    if (expiry === undefined) return false;
    if (Math.floor(Date.now() / 1000) > expiry) {
        _blocklist.delete(token); // lazy eviction
        return false;
    }
    return true;
}

/** Periodically purge expired entries (runs every 15 minutes). */
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [token, expiry] of _blocklist) {
        if (now > expiry) _blocklist.delete(token);
    }
}, 15 * 60 * 1000);
