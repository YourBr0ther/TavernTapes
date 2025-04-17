import { RecordingMetadata } from './AudioService';

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
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private initializationPromise: Promise<void> | null = null;
  private baseDirectory: string = '';

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
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
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
    const path = await this.saveBlobToFileSystem(id, blob);
    const fileReference: FileReference = { id, path, metadata };
    await this.saveFileReference(fileReference);
    return fileReference;
  }

  public async getAudioFile(fileReference: FileReference): Promise<Blob> {
    return this.loadBlobFromFileSystem(fileReference.path);
  }

  public async deleteAudioFile(fileReference: FileReference): Promise<void> {
    await this.deleteBlobFromFileSystem(fileReference.path);
    await this.deleteFileReference(fileReference.id);
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
    // Implementation depends on your file system access method
    // For now, we'll just store it in memory
    const path = `recordings/${id}`;
    localStorage.setItem(path, await blob.text());
    return path;
  }

  private async loadBlobFromFileSystem(path: string): Promise<Blob> {
    // Implementation depends on your file system access method
    // For now, we'll just retrieve from memory
    const data = localStorage.getItem(path);
    if (!data) {
      throw new Error(`File not found at path: ${path}`);
    }
    return new Blob([data], { type: 'audio/wav' });
  }

  private async deleteBlobFromFileSystem(path: string): Promise<void> {
    // Implementation depends on your file system access method
    // For now, we'll just remove from memory
    localStorage.removeItem(path);
  }
}

export const fileSystemService = FileSystemService.getInstance();
export default fileSystemService; 