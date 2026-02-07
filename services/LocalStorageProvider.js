import fs from 'fs';
import path from 'path';
import multer from 'multer';
import archiver from 'archiver';
import dotenv from 'dotenv';
dotenv.config();

const uploadsDir = path.resolve(
    process.env.UPLOAD_DIR || 'uploads'
);

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
                        mappedFolder = this.getAvailableFoldernameSync(fileDir);
                        // Store the mapping for other files from this folder in same request
                        req.uploadedFolders[fileDir] = mappedFolder;
                        console.log(`Mapped folder "${fileDir}" to "${mappedFolder}"`);
                    }
                }

                const finalDir = path.join(baseUploadDir, mappedFolder);
                console.log('Final directory:', finalDir);
                
                // Verify the resolved path is still within baseUploadDir (security check)
                const realPath = path.resolve(finalDir);
                if (!realPath.startsWith(path.resolve(baseUploadDir))) {
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
     * Get unique folder name like name(1) if exists (synchronous version)
     * @param {string} originalName
     */
    getAvailableFoldernameSync(originalName) {
        let name = originalName;
        let base = name;
        let counter = 1;

        while (fs.existsSync(path.join(uploadsDir, name))) {
            name = `${base}(${counter})`;
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
     * List all files and folders in storage
     */
    async list() {
        try {
            const files = await fs.promises.readdir(uploadsDir);
            //console.log(files);
            return files;
        } catch (error) {
            console.error('Error reading directory:', error.message);
            return [];
        }
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