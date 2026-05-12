













const _blocklist = new Map();







export function blockToken(token, exp) {
    const expiry = exp ?? Math.floor(Date.now() / 1000) + 86_400;
    _blocklist.set(token, expiry);
}





export function isBlocked(token) {
    const expiry = _blocklist.get(token);
    if (expiry === undefined) return false;
    if (Math.floor(Date.now() / 1000) > expiry) {
        _blocklist.delete(token);
        return false;
    }
    return true;
}


setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [token, expiry] of _blocklist) {
        if (now > expiry) _blocklist.delete(token);
    }
}, 15 * 60 * 1000);
