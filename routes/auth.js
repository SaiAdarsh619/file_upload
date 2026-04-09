import express from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByUsername } from '../services/db.js';

const router = express.Router();

// GET /register
router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('register', { error: null });
});

// POST /register
router.post('/register', async (req, res) => {
    const { username, password, confirm } = req.body;

    if (!username || !password || !confirm) {
        return res.render('register', { error: 'All fields are required.' });
    }
    if (username.length < 3 || username.length > 32) {
        return res.render('register', { error: 'Username must be 3–32 characters.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return res.render('register', { error: 'Username can only contain letters, numbers, _ . -' });
    }
    if (password.length < 6) {
        return res.render('register', { error: 'Password must be at least 6 characters.' });
    }
    if (password !== confirm) {
        return res.render('register', { error: 'Passwords do not match.' });
    }

    const existing = findUserByUsername(username);
    if (existing) {
        return res.render('register', { error: 'Username already taken.' });
    }

    try {
        const hash = await bcrypt.hash(password, 12);
        createUser(username, hash);
        res.redirect('/login?registered=1');
    } catch (err) {
        console.error('Register error:', err);
        res.render('register', { error: 'Registration failed. Please try again.' });
    }
});

// GET /login
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    const registered = req.query.registered === '1';
    res.render('login', { error: null, registered });
});

// POST /login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('login', { error: 'Username and password are required.', registered: false });
    }

    const user = findUserByUsername(username);
    if (!user) {
        return res.render('login', { error: 'Invalid username or password.', registered: false });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.render('login', { error: 'Invalid username or password.', registered: false });
    }

    // Store safe user data in session (never store password_hash)
    req.session.user = { id: user.id, username: user.username };
    req.session.save(() => res.redirect('/'));
});

// POST /logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

export default router;
