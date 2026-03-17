import logger from '../../core/logger/logger.js';

/**
 * requireRole middleware
 * Usage: requireRole(['admin', 'system'])
 *
 * req.user must be set by authenticate middleware before this runs
 * req.user = { id, role, ... }
 */
export const requireRole = (allowedRoles = []) => (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please login to continue.'
            });
        }

        if (!user.role) {
            logger.warn(`[RoleMiddleware] User ${user.id} has no role assigned`);
            return res.status(403).json({
                success: false,
                message: 'Access denied. No role assigned to your account.'
            });
        }

        if (!allowedRoles.includes(user.role)) {
            logger.warn(
                `[RoleMiddleware] Access denied | User: ${user.id} | Role: ${user.role} | Required: ${allowedRoles.join(', ')}`
            );
            return res.status(403).json({
                success: false,
                message: `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}.`
            });
        }

        next();
    } catch (error) {
        logger.error('[RoleMiddleware] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error in role verification.'
        });
    }
};
