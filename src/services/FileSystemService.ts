
export interface FileReference {
  id: string;
  path: string;
  metadata: {
    sessionName: string;
    startTime: Date;
    duration: number;
    fileSize: number;
    format: string;
    quality: number;
  };
}

export class FileSystemService {
  private static instance: FileSystemService;
  private readonly DB_NAME = 'tavernTapesFiles';
  private readonly DB_VERSION = 2; // Incremented for new audio store
  private db: IDBDatabase | null = null;
  private initializationPromise: Promise<void> | null = null;
  private baseDirectory: string = '';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // ms

  private constructor() {
    this.initializationPromise = this.initializeDB();
  }

  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  public async setBaseDirectory(directory: string): Promise<void> {
    this.baseDirectory = directory;
    // Ensure the directory exists
    if (window.electron) {
      const result = await window.electron.ipcRenderer.invoke('save-file', {
        path: this.baseDirectory,
        buffer: new Uint8Array()
      });
      if (!result.success) {
        throw new Error(`Failed to create base directory: ${result.error}`);
      }
    }
  }

  public getBaseDirectory(): string {
    return this.baseDirectory;
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create files store if it doesn't exist
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        
        // Create audio blobs store if it doesn't exist
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'id' });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      if (!this.initializationPromise) {
        this.initializationPromise = this.initializeDB();
      }
      await this.initializationPromise;
    }
    return this.db!;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retrying, with exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
        console.warn(`Operation failed (attempt ${attempt}/${retries}), retrying...`, error);
      }
    }
    throw new Error('Retry operation failed - should not reach here');
  }

  public async getFileReference(id: string): Promise<FileReference> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          reject(new Error(`File reference not found for ID: ${id}`));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async saveAudioFile(id: string, blob: Blob, metadata: FileReference['metadata']): Promise<FileReference> {
    return this.retryOperation(async () => {
      const path = await this.saveBlobToFileSystem(id, blob);
      const fileReference: FileReference = { id, path, metadata };
      await this.saveFileReference(fileReference);
      return fileReference;
    });
  }

  public async getAudioFile(fileReference: FileReference): Promise<Blob> {
    return this.retryOperation(() => this.loadBlobFromFileSystem(fileReference.path));
  }

  public async deleteAudioFile(fileReference: FileReference): Promise<void> {
    return this.retryOperation(async () => {
      await this.deleteBlobFromFileSystem(fileReference.path);
      await this.deleteFileReference(fileReference.id);
    });
  }

  private async saveFileReference(fileReference: FileReference): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(fileReference);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFileReference(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveBlobToFileSystem(id: string, blob: Blob): Promise<string> {
    const db = await this.getDB();
    const path = `recordings/${id}`;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('audioBlobs', 'readwrite');
      const store = transaction.objectStore('audioBlobs');
      
      // Store the blob with its ID
      const request = store.put({ id, blob, path });
      
      request.onsuccess = () => resolve(path);
      request.onerror = () => reject(new Error(`Failed to save audio blob: ${request.error}`));
    });
  }

  private async loadBlobFromFileSystem(path: string): Promise<Blob> {
    const db = await this.getDB();
    // Extract ID from path (format: "recordings/{id}")
    const id = path.split('/').pop();
    
    if (!id) {
      throw new Error(`Invalid path format: ${path}`);
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('audioBlobs', 'readonly');
      const store = transaction.objectStore('audioBlobs');
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else {
          reject(new Error(`Audio file not found for path: ${path}`));
        }
      };
      request.onerror = () => reject(new Error(`Failed to load audio blob: ${request.error}`));
    });
  }

  private async deleteBlobFromFileSystem(path: string): Promise<void> {
    const db = await this.getDB();
    // Extract ID from path (format: "recordings/{id}")
    const id = path.split('/').pop();
    
    if (!id) {
      throw new Error(`Invalid path format: ${path}`);
    }
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('audioBlobs', 'readwrite');
      const store = transaction.objectStore('audioBlobs');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete audio blob: ${request.error}`));
    });
  }
}

export const fileSystemService = FileSystemService.getInstance();
export default fileSystemService; 