export const API_BASE = 'http://localhost:5000/api';

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function setAuth(token, user) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('auth_user') || 'null');
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('me_cache');
}

// ── Me cache (stale-while-revalidate) ────────────────────────────────────────
export function getCachedMe() {
  try { return JSON.parse(localStorage.getItem('me_cache') || 'null'); } catch { return null; }
}

export function setCachedMe(data) {
  localStorage.setItem('me_cache', JSON.stringify(data));
}

/**
 * Fetch fresh user profile and update cache.
 * Returns the fresh data (or null on error).
 */
export async function refreshMe() {
  try {
    const { data } = await apiFetch('/auth/me');
    if (data) setCachedMe(data);
    return data ?? null;
  } catch { return null; }
}

// ── Role helpers ─────────────────────────────────────────────────────────────
const ROLE_RANK = { user: 0, artist: 1, manager: 2, admin: 3 };

/** Returns the current user's role string, or null if not logged in. */
export function getUserRole() {
  return getUser()?.role ?? null;
}

/** True when the logged-in user has at least the given role level. */
export function hasRole(...roles) {
  const role = getUserRole();
  return role !== null && roles.includes(role);
}

/** True when the user's role rank is >= the required rank. */
export function hasMinRole(minRole) {
  const rank = ROLE_RANK[getUserRole()] ?? -1;
  return rank >= (ROLE_RANK[minRole] ?? 0);
}

/**
 * Guard helper for Astro/vanilla pages.
 * Call at the top of your <script> block.
 * @param {string} [minRole]  Minimum role required. Omit to require only auth.
 */
export function requireAuthClient(minRole) {
  const token = getToken();
  if (!token) {
    window.location.href = '/login?reason=auth_required';
    return false;
  }
  if (minRole && !hasMinRole(minRole)) {
    window.location.href = '/403';
    return false;
  }
  return true;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();

  // Token expired / invalid → clear local state and redirect to login
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login?reason=session_expired';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) throw new Error(data.message || `Lỗi ${res.status}`);
  return data;
}

export function formatDuration(sec) {
  const s = parseInt(sec) || 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatCount(n) {
  const num = parseInt(n) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return Math.floor(num / 1e3) + 'K';
  return String(num);
}

const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#f43f5e,#f97316)',
  'linear-gradient(135deg,#ec4899,#7c3aed)',
  'linear-gradient(135deg,#ef4444,#d946ef)',
  'linear-gradient(135deg,#3b82f6,#06b6d4)',
  'linear-gradient(135deg,#06b6d4,#10b981)',
  'linear-gradient(135deg,#d946ef,#7c3aed)',
  'linear-gradient(135deg,#fb923c,#fb7185)',
  'linear-gradient(135deg,#34d399,#22d3ee)',
  'linear-gradient(135deg,#f59e0b,#f97316)',
];

export function colorFor(id) {
  return GRADIENTS[((parseInt(id) || 1) - 1) % GRADIENTS.length];
}

export function coverImg(id, url, cls) {
  if (url) return `<img src="${url}" class="${cls} object-cover" alt=""/>`;
  return `<div class="${cls}" style="background:${colorFor(id)}"></div>`;
}
