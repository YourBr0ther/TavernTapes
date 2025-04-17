import { FileSystemService, FileReference } from './FileSystemService';

export interface Session {
  id: string;
  createdAt: Date;
  metadata: {
    sessionName: string;
    duration: number;
    format: 'wav' | 'mp3';
    quality: number;
    fileSize: number;
  };
  filePath: string;
}

export interface ExportOptions {
  format?: 'wav' | 'mp3';
  quality?: number;
}

class SessionService {
  private static instance: SessionService;
  private fileSystemService: FileSystemService;
  private readonly DB_NAME = 'tavernTapesSessions';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    this.fileSystemService = FileSystemService.getInstance();
    this.initializationPromise = this.initializeDB();
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
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
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
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

  public async deleteSession(id: string): Promise<void> {
    try {
      const fileReference = await this.fileSystemService.getFileReference(id);
      await this.fileSystemService.deleteAudioFile(fileReference);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw new Error('Failed to delete session');
    }
  }

  public async exportSession(id: string, options: ExportOptions = {}): Promise<Blob> {
    try {
      const fileReference = await this.fileSystemService.getFileReference(id);
      const audioBlob = await this.fileSystemService.getAudioFile(fileReference);
      
      // If no conversion needed, return the original blob
      if (!options.format || options.format === fileReference.metadata.format) {
        return audioBlob;
      }

      // TODO: Implement format conversion
      throw new Error('Format conversion not implemented yet');
    } catch (error) {
      console.error('Error exporting session:', error);
      throw new Error('Failed to export session');
    }
  }

  public async addSession(session: Session): Promise<void> {
    try {
      // Store session metadata in IndexedDB
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('sessions', 'readwrite');
        const store = transaction.objectStore('sessions');
        const request = store.add(session);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error adding session:', error);
      throw new Error('Failed to add session');
    }
  }
}

export { SessionService };
export default SessionService.getInstance(); 