/**
 * Middleware that requires the user to be logged in.
 * Since this is now a pure JSON API, it simply returns a 401 status.
 */
export function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
}
