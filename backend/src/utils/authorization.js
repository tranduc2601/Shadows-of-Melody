const ROLE_PERMISSION_MAP = Object.freeze({
    user: new Set([
        'song:read',
        'album:create',
        'album:edit_own',
        'album:delete_own',
        'artist:request',
        'user:view',
        'user:edit_own',
    ]),
    artist: new Set([
        'song:read',
        'song:upload',
        'song:create',
        'song:edit_own',
        'song:delete_own',
        'album:create',
        'album:edit_own',
        'album:delete_own',
        'artist:request',
        'user:view',
        'user:edit_own',
    ]),
    manager: new Set([
        'song:read',
        'song:approve',
        'song:feature',
        'song:edit_any',
        'song:publish',
        'song:unpublish',
        'album:create',
        'album:edit_any',
        'album:delete_any',
        'artist:approve',
        'artist:reject',
        'artist:revoke',
        'user:view',
        'user:edit_any',
        'user:verify',
        'subscription:view',
        'payment:view',
    ]),
    admin: new Set([
        'song:read',
        'song:upload',
        'song:create',
        'song:edit_any',
        'song:delete_any',
        'song:approve',
        'song:feature',
        'song:publish',
        'song:unpublish',
        'album:create',
        'album:edit_any',
        'album:delete_any',
        'album:publish',
        'album:unpublish',
        'artist:approve',
        'artist:reject',
        'artist:revoke',
        'user:view',
        'user:edit_any',
        'user:ban',
        'user:unban',
        'user:delete',
        'user:verify',
        'role:assign',
        'subscription:view',
        'subscription:manage',
        'payment:view',
        'payment:refund',
        'audit_log:view',
        'audit_log:undo',
        'permission:manage',
        'system:settings',
    ]),
});

export function getPermissionsForRole(role) {
    return new Set(ROLE_PERMISSION_MAP[role] ?? []);
}

export function hasPermission(user, permission) {
    if (!user) return false;
    if (user.is_admin || user.role === 'admin') {
        return true;
    }
    const permissions = Array.isArray(user.permissions)
        ? user.permissions
        : [...getPermissionsForRole(user.role)];
    return permissions.includes(permission);
}

export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        if (!hasPermission(req.user, permission)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        next();
    };
}
