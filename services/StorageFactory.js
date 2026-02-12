import LocalStorageProvider from './LocalStorageProvider.js';
import AzureBlobStorageProvider from './AzureBlobStorageProvider.js';

class StorageFactory {
    create() {
        const provider = process.env.STORAGE_PROVIDER || 'local';
        console.log(`Using Storage Provider: ${provider}`);

        if (provider.toLowerCase() === 'azure') {
            return new AzureBlobStorageProvider();
            // return new MulterAzureStorageProvider();
        } else {
            return new LocalStorageProvider();
        }
    }
}

export const storageFactory = new StorageFactory();
