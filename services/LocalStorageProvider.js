import fs from 'fs';
import path from 'path';
import multer from 'multer';
import archiver from 'archiver';
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
        
        // LOCAL STORAGE MULTER CONFIG
        this.storage = multer.diskStorage({
            destination: (req, file, cb) => {
                // Initialize folder tracking for this request if not exists
                if (!req.uploadedFolders) {
                    req.uploadedFolders = {};
                }
                if (!req.fileDestinations) {
                    req.fileDestinations = {};
                }

                let baseUploadDir = uploadsDir;
                
                // Get the upload path from request (e.g., 'folder1/folder2')
                const uploadPath = req.uploadPath || '';
                
                // If uploadPath is provided, prepend it to baseUploadDir
                if (uploadPath) {
                    baseUploadDir = path.join(uploadsDir, uploadPath);
                    // Create the base upload directory if it doesn't exist
                    fs.mkdirSync(baseUploadDir, { recursive: true });
                }
                
                let filepath = file.originalname;
                
                //console.log(filepath);
                filepath = path.normalize(filepath).replace(/(\.\.(\/|\\|))/g, '');
                //console.log(filepath);
                
                let fileDir = path.dirname(filepath);
                console.log('Original folder:', fileDir);

                let mappedFolder = fileDir;

                // Only apply folder duplication logic for nested folders (not root level)
                if (fileDir !== '.') {
                    // Check if we've already mapped this folder in this request
                    mappedFolder = req.uploadedFolders[fileDir];
                    
                    if (!mappedFolder) {
                        // First file from this folder - check if folder exists
                        mappedFolder = this.getAvailableFoldernameSync(fileDir, baseUploadDir);
                        // Store the mapping for other files from this folder in same request
                        req.uploadedFolders[fileDir] = mappedFolder;
                        console.log(`Mapped folder "${fileDir}" to "${mappedFolder}"`);
                    }
                }

                const finalDir = mappedFolder === '.' ? baseUploadDir : path.join(baseUploadDir, mappedFolder);
                console.log('Final directory:', finalDir);
                
                // Verify the resolved path is still within uploadsDir (security check)
                const realPath = path.resolve(finalDir);
                if (!realPath.startsWith(path.resolve(uploadsDir))) {
                    return cb(new Error('Invalid file path'));
                }
                
                fs.mkdirSync(finalDir, { recursive: true });
                
                // Store the destination directory for this file using a unique key
                const fileKey = `${file.fieldname}_${file.originalname}`;
                req.fileDestinations[fileKey] = finalDir;
                
                cb(null, finalDir);
            },
            filename: (req, file, cb) => {
                //console.log(req.files);
                const filename = path.basename(file.originalname);
                // Get the destination directory that was set for this file
                const fileKey = `${file.fieldname}_${file.originalname}`;
                const currentDir = req.fileDestinations[fileKey] || uploadsDir;
                const uniqueName = this.getAvailableFilenameSync(filename, currentDir);
                cb(null, uniqueName);
            }
        });
        
        this.upload = multer({ preservePath: true, storage: this.storage });
    }

    /**
     * Get unique filename like name(1).ext if exists (synchronous version for multer)
     * Checks for duplicates in the specified directory
     * @param {string} originalName 
     * @param {string} directory - Directory to check for duplicates
     */
    getAvailableFilenameSync(originalName, directory = uploadsDir) {
        let name = originalName;
        let ext = path.extname(name);
        let base = path.basename(name, ext);
        let counter = 1;

        while (fs.existsSync(path.join(directory, name))) {
            name = `${base}(${counter})${ext}`;
            counter++;
        }
        return name;
    }

    /**
     * Get unique folder name like folder(1) if exists (synchronous version for multer)
     * Only checks at uploads root level
     * @param {string} folderName 
     */
    getAvailableFoldernameSync(folderName, baseUploadDir = uploadsDir) {
        let name = folderName;
        let counter = 1;

        while (fs.existsSync(path.join(baseUploadDir, name))) {
            name = `${folderName}(${counter})`;
            counter++;
        }
        return name;
    }

    /**
     * Get unique filename like name(1).ext if exists (async version)
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
     * Check if a path is a file or directory
     * @param {string} filename - The filename or relative path
     * @returns {number} 1 for file, -1 for directory, null if not found
     */
    fileOrDir(filename) {
        const targetPath = path.join(uploadsDir, filename);

        try {
            const stats = fs.statSync(targetPath);
            if (stats.isFile()) {
                return 1;
            } else if (stats.isDirectory()) {
                return -1;
            } else {
                console.log(`${targetPath} is neither a file nor a directory`);
                return null;
            }
        } catch (error) {
            console.error(`Error checking path: ${error.message}`);
            return null;
        }
    }

    /**
     * List all files and folders in storage with metadata
     * @param {string} currentPath - Current folder path (empty string for root)
     */
    async list(currentPath = '') {
        try {
            // Resolve the full directory path
            const targetDir = currentPath ? path.join(uploadsDir, currentPath) : uploadsDir;
            
            // Security check: prevent directory traversal
            const realPath = path.resolve(targetDir);
            if (!realPath.startsWith(path.resolve(uploadsDir))) {
                throw new Error('Invalid path');
            }

            const files = await fs.promises.readdir(targetDir, { withFileTypes: true });
            const items = [];

            for (const file of files) {
                const filePath = path.join(targetDir, file.name);
                const stats = await fs.promises.stat(filePath);
                
                // Build the relative path from uploads directory
                const relativePath = path.relative(uploadsDir, filePath).replace(/\\/g, '/');

                items.push({
                    name: file.name,
                    path: relativePath,
                    isFolder: file.isDirectory(),
                    size: stats.size,
                    sizeFormatted: this.formatFileSize(stats.size),
                    type: file.isDirectory() ? 'folder' : this.getFileType(file.name),
                    modified: stats.mtime,
                    modifiedFormatted: this.formatDate(stats.mtime)
                });
            }

            console.log('Listed items in', currentPath || 'root:', items);
            return items;
        } catch (error) {
            console.error('Error reading directory:', error.message);
            return [];
        }
    }

    /**
     * Format file size in human-readable format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get file type from extension
     */
    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase().slice(1);
        if (!ext) return 'unknown';
        
        const typeMap = {
            'pdf': 'PDF',
            'doc': 'Word', 'docx': 'Word',
            'xls': 'Excel', 'xlsx': 'Excel',
            'ppt': 'PowerPoint', 'pptx': 'PowerPoint',
            'txt': 'Text',
            'zip': 'Archive', 'rar': 'Archive', '7z': 'Archive',
            'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'webp': 'Image',
            'mp4': 'Video', 'avi': 'Video', 'mov': 'Video', 'mkv': 'Video',
            'mp3': 'Audio', 'wav': 'Audio', 'flac': 'Audio'
        };
        
        return typeMap[ext] || ext.toUpperCase();
    }

    /**
     * Format date in readable format
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Download a file or folder as stream (for batch operations)
     * @param {string} filename - The filename or folder name
     * @param {stream} stream - Writable stream to write to
     */
    async downloadToStream(filename, stream) {
        const filePath = path.join(uploadsDir, filename);

        try {
            if (this.fileOrDir(filename) === 1) {
                // It's a file - stream directly
                console.log('Streaming file:', filePath);
                const readStream = fs.createReadStream(filePath);
                readStream.pipe(stream);
                
                return new Promise((resolve, reject) => {
                    readStream.on('end', resolve);
                    readStream.on('error', reject);
                    stream.on('error', reject);
                });
            } else if (this.fileOrDir(filename) === -1) {
                // It's a directory - zip and stream
                console.log('Zipping directory for stream:', filePath);
                const archive = archiver('zip', {
                    zlib: { level: 9 }
                });

                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    stream.destroy();
                });

                archive.pipe(stream);
                archive.directory(filePath, false);
                await archive.finalize();
            } else {
                throw new Error('File or directory not found');
            }
        } catch (error) {
            console.error('Error downloading file to stream:', error.message);
            throw error;
        }
    }

    /**
     * Delete a file or folder
     * @param {string} filename - The filename or folder name
     * @param {function} callback - Callback function(err)
     */
    deleteFileOrFolder(filename, callback) {
        const filePath = path.join(uploadsDir, filename);

        try {
            const type = this.fileOrDir(filename);

            if (type === 1) {
                // It's a file
                console.log('Deleting file:', filePath);
                fs.rm(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting file:', err);
                        return callback(err);
                    }
                    console.log('File deleted successfully');
                    callback(null);
                });
            } else if (type === -1) {
                // It's a directory
                console.log('Deleting directory:', filePath);
                fs.rm(filePath, { recursive: true, force: true }, (err) => {
                    if (err) {
                        console.error('Error deleting directory:', err);
                        return callback(err);
                    }
                    console.log('Directory deleted successfully');
                    callback(null);
                });
            } else {
                callback(new Error('File or directory not found'));
            }
        } catch (error) {
            console.error('Error in deleteFileOrFolder:', error.message);
            callback(error);
        }
    }

    /**
     * Delete a file or folder (promise-based)
     * @param {string} filename - The filename or folder name
     */
    async delete(filename) {
        return new Promise((resolve, reject) => {
            this.deleteFileOrFolder(filename, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'File or directory deleted successfully' });
                }
            });
        });
    }

    /**
     * Download a file or folder as zip
     * @param {string} filename - The filename or folder name
     * @param {object} res - Express response object
     */
    downloadFile(filename, res) {
        const filePath = path.join(uploadsDir, filename);

        try {
            if (this.fileOrDir(filename) === 1) {
                // It's a file - send directly
                console.log('Downloading file:', filePath);
                res.sendFile(filePath);
            } else if (this.fileOrDir(filename) === -1) {
                // It's a directory - zip and send
                console.log('Zipping directory:', filePath);
                res.attachment(`${filename}.zip`);
                const archive = archiver('zip', {
                    zlib: { level: 9 }
                });

                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    res.status(500).send('Error creating archive');
                });

                archive.pipe(res);
                archive.directory(filePath, false);
                archive.finalize();
            } else {
                res.status(404).send('File or directory not found');
            }
        } catch (error) {
            console.error('Error downloading file:', error.message);
            res.status(500).send('Error downloading file');
        }
    }

    /**
     * Get file or folder as a buffer (for batch operations)
     * Directly reads files without using downloadFile
     * @param {string} filename - The filename or folder name
     * @returns {Promise<Buffer>} - Promise resolving to the file/folder data as buffer
     */
    async getFileAsBuffer(filename) {
        try {
            const filePath = path.join(uploadsDir, filename);
            const type = this.fileOrDir(filename);

            if (type === 1) {
                // It's a file - read directly
                console.log('Reading file for batch:', filePath);
                const buffer = await fs.promises.readFile(filePath);
                return buffer;
            } else if (type === -1) {
                // It's a folder - create zip and return as buffer
                console.log('Creating zip for batch:', filePath);
                
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    const archive = archiver('zip', {
                        zlib: { level: 9 }
                    });

                    archive.on('data', (chunk) => chunks.push(chunk));
                    archive.on('end', () => resolve(Buffer.concat(chunks)));
                    archive.on('error', reject);

                    archive.directory(filePath, false);
                    archive.finalize();
                });
            } else {
                throw new Error('File or folder not found');
            }
        } catch (error) {
            console.error(`Error getting file as buffer: ${error.message}`);
            throw error;
        }
    }
}