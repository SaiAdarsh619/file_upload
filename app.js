import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { storageFactory } from './services/StorageFactory.js';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(__dirname);

const PORT = 5000;
const app = express();

// Initialize the storage provider using factory
const storageProvider = storageFactory.create();

// Middleware and view engine setup
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views', 'static')));

// Add body parsing middleware to capture form fields sent by client
// This allows us to read webkitRelativePath values from req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/files', async (req, res) => {
    try {
        const file_list = await storageProvider.list();
        res.json(file_list);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve file list' });
    }
});

app.get('/uploads/:filename', (req, res) => {
    storageProvider.downloadFile(req.params.filename, res);
});

app.get('/uploads/delete/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;

        // Sanitize filename to prevent directory traversal
        if (filename.includes('..') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        await new Promise((resolve) => {
            storageProvider.deleteFileOrFolder(filename, (err) => {
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
app.post('/delete-batch', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items specified' });
        }

        const results = [];
        
        for (const item of items) {
            // Sanitize item name to prevent directory traversal
            if (item.includes('..') || item.includes('\\')) {
                results.push({ item, status: 'error', message: 'Invalid item name' });
                continue;
            }

            await new Promise((resolve) => {
                storageProvider.deleteFileOrFolder(item, (err) => {
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
app.post('/download-batch', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items specified' });
        }

        // Set up zip response
        res.setHeader('Content-Disposition', 'attachment; filename="downloads.zip"');
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error creating archive' });
            }
        });

        archive.pipe(res);

        // Download each item and add to archive
        for (const item of items) {
            // Sanitize item name to prevent directory traversal
            if (item.includes('..') || item.includes('\\')) {
                console.warn(`Skipping invalid item: ${item}`);
                continue;
            }

            try {
                console.log(`Adding to batch download: ${item}`);
                
                // Get file/folder as buffer using the provider's helper method
                const buffer = await storageProvider.getFileAsBuffer(item);
                
                // Add to archive
                archive.append(buffer, { name: item });
                console.log(`Added to archive: ${item}`);
            } catch (error) {
                console.error(`Error adding ${item} to archive:`, error);
                // Continue with next item
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

app.post('/upload', storageProvider.upload.array('files'), (req, res) => {
    res.redirect('/');
});

app.listen(PORT, (err) => {
    if (err) {
        console.log(err);
    }
    console.log('server is listening at port', PORT);
});