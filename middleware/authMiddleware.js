/**
 * Middleware that requires the user to be logged in.
 * - For XHR/API requests (Accept: application/json), responds with 401 JSON.
 * - For regular browser requests, redirects to /login.
 */
export function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }

    const isXhr = req.headers.accept && req.headers.accept.includes('application/json');
    if (isXhr) {
        return res.status(401).json({ error: 'Unauthorized', redirect: '/login' });
    }

    return res.redirect('/login');
}
