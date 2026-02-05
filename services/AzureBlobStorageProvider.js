import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import multer from 'multer';
import { MulterAzureStorage } from 'multer-azure-blob-storage';

export default class AzureBlobStorageProvider {
    constructor() {
        // Initialize client
        const connectionString = process.env.CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.CONTAINER_NAME || 'uploads';

        if (!connectionString) {
            throw new Error('Azure Storage Connection String is missing (CONNECTION_STRING)');
        }

        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(containerName);

        // Ensure container exists
        this.containerClient.createIfNotExists()
            .then(() => console.log(`Container ${containerName} ready`))
            .catch(err => console.error('Error creating container:', err.message));

        console.log('Initialized Azure Blob Storage Provider');
    }

    /**
     * Get unique blob name like name(1).ext if exists
     * @param {string} originalName 
     */
    async getAvailableBlobName(originalName) {
        let name = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

        let extIndex = name.lastIndexOf('.');
        let ext = extIndex !== -1 ? name.substring(extIndex) : '';
        let base = extIndex !== -1 ? name.substring(0, extIndex) : name;

        let counter = 1;
        let candidate = name;

        while (await this.containerClient.getBlockBlobClient(candidate).exists()) {
            candidate = `${base}(${counter})${ext}`;
            counter++;
        }
        return candidate;
    }

    /**
     * Upload a file
     */
    async upload(file) {
        console.log(file);
        const uniqueName = await this.getAvailableBlobName(file.originalname);
        const blockBlobClient = this.containerClient.getBlockBlobClient(uniqueName);

        // Upload
        await blockBlobClient.uploadFile(file.path, {
            blobHTTPHeaders: {
                blobContentType: file.mimetype
            }
        });

        // Clean up local temp file
        try {
            await fs.promises.unlink(file.path);
        } catch (e) {
            console.warn('Failed to cleanup temp file:', file.path);
        }

        return {
            filename: uniqueName,
            path: blockBlobClient.url,
            size: file.size,
            mimetype: file.mimetype
        };
    }

    uploadMiddleware = multer({ storage: this.azureStorage });

    /**
     * List files
     */
    async list() {
        const files = [];
        for await (const blob of this.containerClient.listBlobsFlat()) {
            files.push(blob.name);
        }
        return files;
    }

    /**
     * Delete file
     */
    async delete(filename) {
        const blockBlobClient = this.containerClient.getBlockBlobClient(filename);
        await blockBlobClient.delete();
        return { message: 'File deleted successfully' };
    }

    /**
     * Get stream
     */
    async getStream(filename) {
        const blockBlobClient = this.containerClient.getBlockBlobClient(filename);
        const downloadBlockBlobResponse = await blockBlobClient.download(0);
        return downloadBlockBlobResponse.readableStreamBody;
    }
}
