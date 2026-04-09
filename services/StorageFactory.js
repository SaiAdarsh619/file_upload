import LocalStorageProvider from './LocalStorageProvider.js';
import AzureBlobStorageProvider from './AzureBlobStorageProvider.js';

class StorageFactory {
    /**
     * Create a storage provider scoped to a specific user.
     * @param {string|number} userId - The authenticated user's ID
     */
    create(userId) {
        if (!userId) throw new Error('StorageFactory.create() requires a userId');
        const provider = process.env.STORAGE_PROVIDER || 'local';
        console.log(`Using Storage Provider: ${provider} for user ${userId}`);

        if (provider.toLowerCase() === 'azure') {
            return new AzureBlobStorageProvider(userId);
        } else {
            return new LocalStorageProvider(userId);
        }
    }
}

export const storageFactory = new StorageFactory();
