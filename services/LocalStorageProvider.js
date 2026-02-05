import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Move up one level to get to root
const rootDir = path.join(__dirname, '..');
const uploadsDir = path.join(rootDir, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

export default class LocalStorageProvider {
    constructor() {
        console.log('Initialized Local Storage Provider');
    }

    /**
     * Get unique filename like name(1).ext if exists
     * @param {string} originalName 
     */
    async getAvailableFilename(originalName) {
        let name = originalName;
        let ext = path.extname(name);
        let base = path.basename(name, ext);
        let counter = 1;

        while (fs.existsSync(path.join(uploadsDir, name))) {
            name = `${base}(${counter})${ext}`;
            counter++;
        }
        return name;
    }

    /**
     * Upload a file from temporary path to permanent storage
     * @param {Object} file - The file object from multer (needs path, originalname)
     */
    async upload(file) {
        const uniqueName = await this.getAvailableFilename(file.originalname);
        const targetPath = path.join(uploadsDir, uniqueName);

        // Ensure parent directory exists for nested files
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
            await fs.promises.mkdir(parentDir, { recursive: true });
        }

        // Rename (move) the file from temp location to uploads
        await fs.promises.rename(file.path, targetPath);
        return {
            filename: uniqueName,
            path: targetPath,
            size: file.size,
            mimetype: file.mimetype
        };
    }

    /**
     * List all files in storage
     */
    async list() {
        const files = await fs.promises.readdir(uploadsDir);
        return files;
    }

    /**
     * Delete a file by name
     * @param {string} filename 
     */
    async delete(filename) {
        const filePath = path.join(uploadsDir, filename);
        await fs.promises.rm(filePath);
        return { message: 'File deleted successfully' };
    }

    /**
     * Get a readable stream of the file
     * @param {string} filename 
     */
    async getStream(filename) {
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        return fs.createReadStream(filePath);
    }
}
