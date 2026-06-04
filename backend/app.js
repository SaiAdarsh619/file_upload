import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { storageFactory } from './services/StorageFactory.js';
import archiver from 'archiver';
import dotenv from 'dotenv';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/authMiddleware.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 5000;
const app = express();

// ─── Session Setup ───────────────────────────────────────────────────────────
const SQLiteStore = connectSqlite3(session);

app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: path.join(__dirname, 'data')
    }),
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true
    }
}));

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Auth Routes (public) ─────────────────────────────────────────────────────
app.use('/', authRouter);

// ─── Helper: get per-request storage provider ────────────────────────────────
function getStorage(req) {
    return storageFactory.create(req.session.user.id);
}

// ─── Protected Routes ─────────────────────────────────────────────────────────

// JSON API — check current user auth state
app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

// JSON API — list files
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        const currentPath = req.query.path || '';
        const file_list = await getStorage(req).list(currentPath);
        res.json(file_list);
    } catch (error) {
        console.error('List error:', error);
        res.status(500).json({ error: 'Failed to retrieve file list' });
    }
});

app.get('/uploads/:filename', requireAuth, (req, res) => {
    getStorage(req).downloadFile(req.params.filename, res);
});

app.get('/uploads/delete/:filename', requireAuth, async (req, res) => {
    try {
        const filename = req.params.filename;

        if (filename.includes('..') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        await new Promise((resolve) => {
            getStorage(req).deleteFileOrFolder(filename, (err) => {
                if (err) {
                    console.error(`Error deleting ${filename}:`, err);
                    res.status(500).json({ error: 'Error deleting file or directory', message: err.message });
                } else {
                    console.log(`Successfully deleted: ${filename}`);
                    res.json({ success: true, message: `${filename} deleted successfully` });
                }
                resolve();
            });
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Batch delete endpoint
app.post('/delete-batch', requireAuth, async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items specified' });
        }

        const storage = getStorage(req);
        const results = [];

        for (const item of items) {
            if (item.includes('..') || item.includes('\\')) {
                results.push({ item, status: 'error', message: 'Invalid item name' });
                continue;
            }

            await new Promise((resolve) => {
                storage.deleteFileOrFolder(item, (err) => {
                    if (err) {
                        console.error(`Error deleting ${item}:`, err);
                        results.push({ item, status: 'error', message: err.message });
                    } else {
                        console.log(`Successfully deleted: ${item}`);
                        results.push({ item, status: 'success' });
                    }
                    resolve();
                });
            });
        }

        res.json({ results });
    } catch (error) {
        console.error('Batch delete error:', error);
        res.status(500).json({ error: 'Batch delete failed' });
    }
});

// Batch download endpoint
app.post('/download-batch', requireAuth, async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items specified' });
        }

        res.setHeader('Content-Disposition', 'attachment; filename="downloads.zip"');
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error creating archive' });
            }
        });

        archive.pipe(res);

        const storage = getStorage(req);

        for (const item of items) {
            if (item.includes('..') || item.includes('\\')) {
                console.warn(`Skipping invalid item: ${item}`);
                continue;
            }

            try {
                const buffer = await storage.getFileAsBuffer(item);
                const filename = path.basename(item);
                archive.append(buffer, { name: filename });
            } catch (error) {
                console.error(`Error adding ${item} to archive:`, error);
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Batch download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Batch download failed' });
        }
    }
});

app.post('/upload', requireAuth, (req, res, next) => {
    req.uploadPath = req.query.uploadPath || '';
    console.log('Upload path from query:', req.uploadPath);

    const storage = getStorage(req);
    storage.upload.array('files')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(500).json({ error: 'Upload failed' });
        }
        res.json({ success: true });
    });
});

app.listen(PORT, (err) => {
    if (err) {
        console.log(err);
    }
    console.log('Server is listening at port', PORT);
});