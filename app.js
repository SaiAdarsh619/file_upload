import express from 'express';
import { storageFactory } from './services/StorageFactory.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(__dirname);

const PORT = 5000;
const app = express();

// Initialize storage provider based on configuration
const storageProvider = storageFactory.create();

// Middleware and view engine setup
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'views', 'static')));

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

app.get('/uploads/delete/:filename', (req, res) => {
    storageProvider.deleteFileOrFolder(req.params.filename, (err) => {
        if (err) {
            console.error('Error deleting:', err);
            return res.status(500).send('Error deleting file or directory');
        }
        res.redirect('/');
    });
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