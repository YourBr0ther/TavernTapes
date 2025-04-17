import { RecordingMetadata } from './AudioService';

export interface FileReference {
  id: string;
  path: string;
  size: number;
  createdAt: Date;
  sessionId: string;
}

export class FileSystemService {
  private static instance: FileSystemService;
  private baseDirectory: string | null = null;
  private readonly DB_NAME = 'tavernTapesDB';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;

  private constructor() {
    this.initializeDB();
  }

  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
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
        
        // Create object store for file references
        if (!db.objectStoreNames.contains('fileReferences')) {
          const store = db.createObjectStore('fileReferences', { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
        }

        // Create object store for settings
        if (!db.objectStoreNames.contains('settings')) {
          const store = db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  public async setBaseDirectory(path: string): Promise<void> {
    this.baseDirectory = path;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key: 'baseDirectory', value: path });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getBaseDirectory(): Promise<string | null> {
    if (this.baseDirectory) {
      return this.baseDirectory;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('baseDirectory');

      request.onsuccess = () => {
        this.baseDirectory = request.result?.value || null;
        resolve(this.baseDirectory);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async saveAudioFile(
    sessionId: string,
    blob: Blob,
    metadata: RecordingMetadata
  ): Promise<FileReference> {
    if (!this.baseDirectory) {
      throw new Error('Base directory not set');
    }

    const fileId = crypto.randomUUID();
    const fileName = `${metadata.sessionName}_${fileId}.${metadata.format}`;
    const filePath = `${this.baseDirectory}/${fileName}`;

    // Save file using Electron's file system API
    const buffer = await blob.arrayBuffer();
    await window.electron.ipcRenderer.invoke('save-file', {
      path: filePath,
      buffer: buffer
    });

    const fileReference: FileReference = {
      id: fileId,
      path: filePath,
      size: blob.size,
      createdAt: new Date(),
      sessionId
    };

    // Store reference in IndexedDB
    await this.storeFileReference(fileReference);

    return fileReference;
  }

  public async getAudioFile(fileId: string): Promise<Blob> {
    const fileReference = await this.getFileReference(fileId);
    if (!fileReference) {
      throw new Error('File reference not found');
    }

    // Get file using Electron's file system API
    const buffer = await window.electron.ipcRenderer.invoke('read-file', fileReference.path);
    return new Blob([buffer], { type: `audio/${fileReference.path.split('.').pop()}` });
  }

  public async deleteAudioFile(fileId: string): Promise<void> {
    const fileReference = await this.getFileReference(fileId);
    if (!fileReference) {
      throw new Error('File reference not found');
    }

    // Delete file using Electron's file system API
    await window.electron.ipcRenderer.invoke('delete-file', fileReference.path);

    // Remove reference from IndexedDB
    await this.deleteFileReference(fileId);
  }

  public async getSessionFiles(sessionId: string): Promise<FileReference[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction('fileReferences', 'readonly');
      const store = transaction.objectStore('fileReferences');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeFileReference(reference: FileReference): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction('fileReferences', 'readwrite');
      const store = transaction.objectStore('fileReferences');
      const request = store.add(reference);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getFileReference(fileId: string): Promise<FileReference | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction('fileReferences', 'readonly');
      const store = transaction.objectStore('fileReferences');
      const request = store.get(fileId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFileReference(fileId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction('fileReferences', 'readwrite');
      const store = transaction.objectStore('fileReferences');
      const request = store.delete(fileId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}

export const fileSystemService = FileSystemService.getInstance();
export default fileSystemService; 