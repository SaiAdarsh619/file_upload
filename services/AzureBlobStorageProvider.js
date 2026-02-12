import { BlobServiceClient } from '@azure/storage-blob';
import multer from 'multer';
import path from 'path';
import archiver from 'archiver';
import dotenv from 'dotenv';

dotenv.config();

export default class AzureBlobStorageProvider {
    constructor() {
        console.log('Initialized Azure Blob Storage Provider');
        
        // Initialize Azure client
        const connectionString = process.env.CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.CONTAINER_NAME || 'uploads';

        if (!connectionString) {
            throw new Error('Azure Storage Connection String is missing (CONNECTION_STRING)');
        }

        this.containerName = containerName;
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(containerName);

        // Ensure container exists
        this.containerClient.createIfNotExists()
            .then(() => console.log(`Azure Container '${containerName}' ready`))
            .catch(err => console.error('Error creating container:', err.message));

        // Create multer instance with PROPER async fileFilter handling
        const multerInstance = multer({
            preservePath: true,
            storage: multer.memoryStorage(),
            fileFilter: (req, file, cb) => {
                console.log('=== FILEFILTER CALLED ===');
                console.log('File object:', {
                    fieldname: file.fieldname,
                    originalname: file.originalname,
                    encoding: file.encoding,
                    mimetype: file.mimetype
                });
                
                // Call the async filter and handle the promise
                this._fileFilter(req, file, cb).catch(err => {
                    console.error('Error in fileFilter:', err);
                    cb(err);
                });
            }
        });

        // Wrap multer to handle Azure upload internally
        this.upload = {
            single: (fieldName) => (req, res, next) => {
                multerInstance.single(fieldName)(req, res, async (err) => {
                    if (err) return next(err);
                    if (req.file) {
                        await this._uploadFilesToAzure(req);
                    }
                    next();
                });
            },
            array: (fieldName, maxCount) => (req, res, next) => {
                multerInstance.array(fieldName, maxCount)(req, res, async (err) => {
                    if (err) return next(err);
                    if (req.files && req.files.length > 0) {
                        await this._uploadFilesToAzure(req);
                    }
                    next();
                });
            }
        };
    }

    /**
     * File filter for multer to track folder mappings
     * @private
     */
    async _fileFilter(req, file, cb) {
        try {
            console.log('>>> INSIDE _fileFilter <<<');
            console.log('File originalname (with preservePath):', file.originalname);

            // Initialize folder tracking for this request if not exists
            if (!req.uploadedFolders) {
                req.uploadedFolders = {};
            }
            if (!req.fileDestinations) {
                req.fileDestinations = {};
            }

            // Get the upload path from request (e.g., 'folder1/folder2')
            const uploadPath = req.uploadPath || '';

            // preservePath: true preserves the full path from FormData
            let filePath = file.originalname;
            
            console.log('Using filePath:', filePath);
            
            // Sanitize the filepath to prevent directory traversal
            filePath = path.normalize(filePath).replace(/(\.\.(\/|\\|))/g, '');
            
            let fileDir = path.dirname(filePath);
            // Convert Windows paths to forward slashes
            fileDir = fileDir.replace(/\\/g, '/');
            
            console.log('Processing file - filepath:', filePath, 'folder:', fileDir, 'uploadPath:', uploadPath);

            let mappedFolder = fileDir; // Default to original folder

            // Only apply folder duplication logic for nested folders (not root level)
            if (fileDir !== '.') {
                // Check if we've already mapped this folder in this request
                if (!req.uploadedFolders[fileDir]) {
                    // First file from this folder - check if folder exists in Azure
                    const availableFolder = await this.getAvailableFoldernameSync(fileDir, uploadPath);
                    req.uploadedFolders[fileDir] = availableFolder;
                    mappedFolder = availableFolder;
                    console.log(`Mapped folder "${fileDir}" to "${availableFolder}"`);
                } else {
                    // Use previously mapped folder name
                    mappedFolder = req.uploadedFolders[fileDir];
                    console.log(`Using existing mapping for "${fileDir}": "${mappedFolder}"`);
                }
            } else {
                // Root level file (no folder) - use uploadPath if provided
                mappedFolder = uploadPath || '.';
                console.log('Root level file - uploadPath:', uploadPath);
            }

            // Store the destination for this file
            const fileKey = `${file.fieldname}_${filePath}`;
            req.fileDestinations[fileKey] = { folder: mappedFolder, filename: path.basename(filePath) };
            console.log(`File destination mapping: ${fileKey} -> folder: ${mappedFolder}, filename: ${path.basename(filePath)}`);

            cb(null, true);
        } catch (error) {
            console.error('Error in fileFilter:', error);
            cb(error);
        }
    }

    /**
     * File filter for multer to track folder mappings
     * @private
     */
    async _fileFilter(req, file, cb) {
        try {
            // Initialize folder tracking for this request if not exists
            if (!req.uploadedFolders) {
                req.uploadedFolders = {};
            }
            if (!req.fileDestinations) {
                req.fileDestinations = {};
            }

            // Try to get full filepath from captured paths, otherwise use originalname
            let filepath = file.originalname;
            
            if (req.filePaths && req.filePaths[file.fieldname]) {
                const capturedPaths = req.filePaths[file.fieldname];
                // Get the path that matches this file (by position in array)
                const fileIndex = (req.fileDestinations[`_count_${file.fieldname}`] || 0);
                if (capturedPaths[fileIndex]) {
                    filepath = capturedPaths[fileIndex];
                    console.log(`Using captured filepath: ${filepath}`);
                }
                req.fileDestinations[`_count_${file.fieldname}`] = fileIndex + 1;
            }
            
            // Sanitize the filepath to prevent directory traversal
            filepath = path.normalize(filepath).replace(/(\.\.(\/|\\|))/g, '');
            
            let fileDir = path.dirname(filepath);
            // Convert Windows paths to forward slashes
            fileDir = fileDir.replace(/\\/g, '/');
            
            console.log('Processing file - filepath:', filepath, 'folder:', fileDir);

            let mappedFolder = fileDir; // Default to original folder

            // Only apply folder duplication logic for nested folders (not root level)
            if (fileDir !== '.') {
                // Check if we've already mapped this folder in this request
                if (!req.uploadedFolders[fileDir]) {
                    // First file from this folder - check if folder exists in Azure
                    const availableFolder = await this.getAvailableFoldernameSync(fileDir);
                    req.uploadedFolders[fileDir] = availableFolder;
                    mappedFolder = availableFolder;
                    console.log(`Mapped folder "${fileDir}" to "${availableFolder}"`);
                } else {
                    // Use previously mapped folder name
                    mappedFolder = req.uploadedFolders[fileDir];
                    console.log(`Using existing mapping for "${fileDir}": "${mappedFolder}"`);
                }
            } else {
                // Root level file - keep as is
                mappedFolder = '.';
            }

            // Store the destination for this file using original filepath as key
            const fileKey = `${file.fieldname}_${filepath}`;
            req.fileDestinations[fileKey] = { folder: mappedFolder, filename: path.basename(filepath) };
            console.log(`File destination mapping: ${fileKey} -> folder: ${mappedFolder}, filename: ${path.basename(filepath)}`);

            cb(null, true);
        } catch (error) {
            console.error('Error in fileFilter:', error);
            cb(error);
        }
    }

    /**
     * Upload files to Azure after multer processes them
     * @private
     */
    async _uploadFilesToAzure(req) {
        const files = req.files || (req.file ? [req.file] : []);

        for (const file of files) {
            try {
                // File path is already in file.originalname (sent by your frontend)
                const filePath = file.originalname;
                const fileKey = `${file.fieldname}_${filePath}`;
                let mappedFolder = '';
                let filename = file.originalname;
                
                if (req.fileDestinations && req.fileDestinations[fileKey]) {
                    const destInfo = req.fileDestinations[fileKey];
                    mappedFolder = destInfo.folder;
                    filename = destInfo.filename;
                    console.log(`Found destination for ${filePath}: folder=${mappedFolder}, filename=${filename}`);
                } else {
                    console.warn(`No folder mapping found for ${fileKey}`);
                    filename = path.basename(file.originalname);
                }
                
                await this.uploadFile(file, mappedFolder, filename);
                console.log(`Uploaded to Azure: ${filePath}`);
            } catch (error) {
                console.error(`Failed to upload file to Azure:`, error);
            }
        }
    }

    /**
     * Get unique filename like name(1).ext if exists in the specified folder
     * Checks Azure blob storage for existing files
     * @param {string} filename - The filename to check
     * @param {string} folder - The folder/prefix to check in
     */
    async getAvailableFilenameSyncAzure(filename, folder = '') {
        let name = filename;
        let ext = path.extname(name);
        let base = path.basename(name, ext);
        let counter = 1;

        const prefix = folder && folder !== '.' ? `${folder}/` : '';
        const fullPath = (fname) => prefix ? `${prefix}${fname}` : fname;

        while (await this.containerClient.getBlockBlobClient(fullPath(name)).exists()) {
            name = `${base}(${counter})${ext}`;
            counter++;
        }
        return name;
    }

    /**
     * Get unique folder name like folder(1) if exists
     * Checks if a folder (prefix) exists in Azure by listing blobs
     * @param {string} folderName - The folder name to check
     */
    async getAvailableFoldernameSync(folderName, uploadPath = '') {
        let name = folderName;
        let counter = 1;

        // Build the full folder path
        const fullPath = uploadPath ? `${uploadPath}/${folderName}` : folderName;

        // Check if any blob exists with this prefix
        while (await this.folderExistsInAzure(uploadPath ? `${uploadPath}/${name}` : name)) {
            name = `${folderName}(${counter})`;
            counter++;
        }
        return name;
    }

    /**
     * Check if a folder (prefix) exists in Azure
     * @param {string} folderName - The folder name to check
     */
    async folderExistsInAzure(folderName) {
        const prefix = `${folderName}/`;
        
        for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
            if (blob.name.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a path is a file or directory/folder in Azure
     * @param {string} blobName - The blob name or prefix
     * @returns {number} 1 for file, -1 for directory, null if not found
     */
    async fileOrDir(blobName) {
        try {
            // Check if it's a file (blob exists)
            const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
            if (await blockBlobClient.exists()) {
                return 1; // It's a file
            }

            // Check if it's a folder (prefix exists)
            if (await this.folderExistsInAzure(blobName)) {
                return -1; // It's a folder
            }

            return null; // Not found
        } catch (error) {
            console.error(`Error checking path: ${error.message}`);
            return null;
        }
    }

    /**
     * Upload a file to Azure Blob Storage
     * @param {Object} file - The file object from multer (with buffer and fieldname)
     * @param {string} mappedFolder - The destination folder
     * @param {string} filename - Optional filename (uses originalname if not provided)
     */
    async uploadFile(file, mappedFolder = '', filename = null) {
        try {
            // Use provided filename or get from originalname
            const baseFilename = filename || path.basename(file.originalname);
            const uniqueName = await this.getAvailableFilenameSyncAzure(baseFilename, mappedFolder);
            
            // Construct full blob path
            const blobPath = mappedFolder && mappedFolder !== '.' 
                ? `${mappedFolder}/${uniqueName}` 
                : uniqueName;

            console.log(`Uploading: originalname=${file.originalname}, mappedFolder=${mappedFolder}, filename=${baseFilename}, uniqueName=${uniqueName}, blobPath=${blobPath}`);

            const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);

            // Upload from buffer
            await blockBlobClient.uploadData(file.buffer, {
                blobHTTPHeaders: {
                    blobContentType: file.mimetype
                }
            });

            console.log(`Successfully uploaded to Azure: ${blobPath}`);

            return {
                filename: uniqueName,
                path: blobPath,
                url: blockBlobClient.url,
                size: file.size,
                mimetype: file.mimetype
            };
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    /**
     * List all files and folders in Azure (virtual folder structure)
     * @param {string} currentPath - Current folder path (empty string for root)
     */
    async list(currentPath = '') {
        try {
            const items = new Map();
            const folders = new Map();
            
            // Build the prefix for the current path
            const prefix = currentPath ? `${currentPath}/` : '';

            for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
                const fullName = blob.name;
                
                // Get the name relative to current path
                const relativeName = fullName.substring(prefix.length);
                
                // Skip if it's empty or the blob itself
                if (!relativeName) continue;
                
                // Find the first slash to determine if it's a file or folder at this level
                const slashIndex = relativeName.indexOf('/');

                if (slashIndex !== -1) {
                    // It's a nested item - extract folder name
                    const folderName = relativeName.substring(0, slashIndex);
                    if (!folders.has(folderName)) {
                        const folderPath = prefix ? `${prefix}${folderName}` : folderName;
                        folders.set(folderName, {
                            name: folderName,
                            path: folderPath,
                            isFolder: true,
                            size: 0,
                            sizeFormatted: '0 B',
                            type: 'folder',
                            modified: new Date(),
                            modifiedFormatted: new Date().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        });
                    }
                } else {
                    // It's a root-level file in current directory
                    const filePath = prefix ? `${prefix}${relativeName}` : relativeName;
                    items.set(relativeName, {
                        name: relativeName,
                        path: filePath,
                        isFolder: false,
                        size: blob.properties.contentLength || 0,
                        sizeFormatted: this.formatFileSize(blob.properties.contentLength || 0),
                        type: this.getFileType(relativeName),
                        modified: blob.properties.createdOn || new Date(),
                        modifiedFormatted: new Date(blob.properties.createdOn || new Date()).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                    });
                }
            }

            // Add folders to items (folders come first for better UX)
            folders.forEach((value, key) => items.set(key, value));

            const result = Array.from(items.values());
            console.log('Listed items in', currentPath || 'root:', result);
            return result;
        } catch (error) {
            console.error('Error reading blobs:', error.message);
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
     * Download a file or folder to a writable stream (for batch operations)
     * @param {string} blobName - The blob name or folder name
     * @param {stream} stream - Writable stream to write to
     */
    async downloadToStream(blobName, stream) {
        try {
            const type = await this.fileOrDir(blobName);

            if (type === 1) {
                // It's a file - stream directly
                console.log('Streaming file:', blobName);
                const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
                const downloadBlockBlobResponse = await blockBlobClient.download(0);
                
                downloadBlockBlobResponse.readableStreamBody.pipe(stream);
                
                return new Promise((resolve, reject) => {
                    downloadBlockBlobResponse.readableStreamBody.on('end', resolve);
                    downloadBlockBlobResponse.readableStreamBody.on('error', reject);
                    stream.on('error', reject);
                });
            } else if (type === -1) {
                // It's a folder - create zip with all files in this folder
                console.log('Zipping folder for stream:', blobName);
                
                const prefix = `${blobName}/`;
                const archive = archiver('zip', {
                    zlib: { level: 9 }
                });

                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    stream.destroy();
                });

                archive.pipe(stream);

                // Add all files with this prefix to the archive
                for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
                    if (blob.name.startsWith(prefix)) {
                        // Get the relative path within the folder (remove the prefix)
                        const relativePath = blob.name.substring(prefix.length);
                        const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
                        
                        // Download blob and add to archive
                        const downloadResponse = await blockBlobClient.download(0);
                        archive.append(downloadResponse.readableStreamBody, { name: relativePath });
                    }
                }

                await archive.finalize();
            } else {
                throw new Error('File or folder not found');
            }
        } catch (error) {
            console.error('Error downloading to stream:', error.message);
            throw error;
        }
    }

    /**
     * Delete a file or folder
     * @param {string} blobName - The blob name or folder name
     * @param {function} callback - Callback function(err)
     */
    async deleteFileOrFolder(blobName, callback) {
        try {
            const type = await this.fileOrDir(blobName);

            if (type === 1) {
                // It's a file
                console.log('Deleting file:', blobName);
                const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
                await blockBlobClient.delete();
                console.log('File deleted successfully');
                callback(null);
            } else if (type === -1) {
                // It's a folder - delete all blobs with this prefix
                console.log('Deleting folder:', blobName);
                const prefix = `${blobName}/`;
                
                for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
                    if (blob.name.startsWith(prefix)) {
                        const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
                        await blockBlobClient.delete();
                        console.log(`Deleted: ${blob.name}`);
                    }
                }
                console.log('Folder deleted successfully');
                callback(null);
            } else {
                callback(new Error('File or folder not found'));
            }
        } catch (error) {
            console.error('Error in deleteFileOrFolder:', error.message);
            callback(error);
        }
    }

    /**
     * Delete a file or folder (promise-based)
     * @param {string} blobName - The blob name or folder name
     */
    async delete(blobName) {
        return new Promise((resolve, reject) => {
            this.deleteFileOrFolder(blobName, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ message: 'File or folder deleted successfully' });
                }
            });
        });
    }

    /**
     * Download a file or folder as zip
     * For files: direct download
     * For folders: creates a zip of all files in that folder
     * @param {string} blobName - The blob name or folder name
     * @param {object} res - Express response object
     */
    async downloadFile(blobName, res) {
        try {
            const type = await this.fileOrDir(blobName);

            if (type === 1) {
                // It's a file - download directly
                console.log('Downloading file:', blobName);
                const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
                const downloadBlockBlobResponse = await blockBlobClient.download(0);
                
                // Extract content type from different possible locations
                const contentType = downloadBlockBlobResponse.contentSettings?.contentType 
                    || downloadBlockBlobResponse.blobProperties?.contentType 
                    || 'application/octet-stream';
                
                res.setHeader('Content-Disposition', `attachment; filename="${path.basename(blobName)}"`);
                res.setHeader('Content-Type', contentType);
                
                downloadBlockBlobResponse.readableStreamBody.pipe(res);
            } else if (type === -1) {
                // It's a folder - create zip with all files in this folder
                console.log('Creating zip for folder:', blobName);
                
                const prefix = `${blobName}/`;
                res.setHeader('Content-Disposition', `attachment; filename="${blobName}.zip"`);
                res.setHeader('Content-Type', 'application/zip');
                
                const archive = archiver('zip', {
                    zlib: { level: 9 }
                });

                archive.on('error', (err) => {
                    console.error('Archive error:', err);
                    res.status(500).send('Error creating archive');
                });

                archive.pipe(res);

                // Add all files with this prefix to the archive
                for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
                    if (blob.name.startsWith(prefix)) {
                        // Get the relative path within the folder (remove the prefix)
                        const relativePath = blob.name.substring(prefix.length);
                        const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
                        
                        // Download blob and add to archive
                        const downloadResponse = await blockBlobClient.download(0);
                        archive.append(downloadResponse.readableStreamBody, { name: relativePath });
                    }
                }

                await archive.finalize();
            } else {
                res.status(404).send('File or folder not found');
            }
        } catch (error) {
            console.error('Error downloading file:', error.message);
            res.status(500).send('Error downloading file');
        }
    }

    /**
     * Get file or folder as a buffer (for batch operations)
     * Directly downloads from Azure without using downloadFile
     * @param {string} blobName - The blob name or folder name
     * @returns {Promise<Buffer>} - Promise resolving to the file/folder data as buffer
     */
    async getFileAsBuffer(blobName) {
        try {
            const type = await this.fileOrDir(blobName);

            if (type === 1) {
                // It's a file - download directly
                console.log('Downloading blob for batch:', blobName);
                const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
                const downloadResponse = await blockBlobClient.download(0);
                
                // Convert stream to buffer
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    downloadResponse.readableStreamBody.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                    downloadResponse.readableStreamBody.on('end', () => {
                        resolve(Buffer.concat(chunks));
                    });
                    downloadResponse.readableStreamBody.on('error', reject);
                });
            } else if (type === -1) {
                // It's a folder - create zip and return as buffer
                console.log('Creating zip for batch:', blobName);
                
                return new Promise((resolve, reject) => {
                    const chunks = [];
                    const prefix = `${blobName}/`;
                    const archive = archiver('zip', {
                        zlib: { level: 9 }
                    });

                    archive.on('data', (chunk) => chunks.push(chunk));
                    archive.on('end', () => resolve(Buffer.concat(chunks)));
                    archive.on('error', reject);

                    // Add all blobs with this prefix to the archive
                    (async () => {
                        try {
                            for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
                                if (blob.name.startsWith(prefix)) {
                                    const relativePath = blob.name.substring(prefix.length);
                                    const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
                                    const downloadResponse = await blockBlobClient.download(0);
                                    archive.append(downloadResponse.readableStreamBody, { name: relativePath });
                                }
                            }
                            await archive.finalize();
                        } catch (error) {
                            archive.destroy();
                            reject(error);
                        }
                    })();
                });
            } else {
                throw new Error('File or folder not found');
            }
        } catch (error) {
            console.error(`Error getting file as buffer: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get a readable stream of the file from Azure
     * @param {string} blobName - The blob name
     */
    async getStream(blobName) {
        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
            if (!await blockBlobClient.exists()) {
                throw new Error('Blob not found');
            }
            const downloadBlockBlobResponse = await blockBlobClient.download(0);
            return downloadBlockBlobResponse.readableStreamBody;
        } catch (error) {
            console.error('Error getting stream:', error.message);
            throw error;
        }
    }
}