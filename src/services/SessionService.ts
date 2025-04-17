import fileSystemService from './FileSystemService';

export interface Session {
  id: string;
  name: string;
  startTime: Date;
  duration: number;
  fileSize: number;
  format: string;
  quality: number;
  notes?: string;
  tags?: string[];
}

export interface ExportOptions {
  format: 'wav' | 'mp3';
  quality: number;
}

class SessionService {
  private static instance: SessionService;
  private db: IDBDatabase | null = null;

  private constructor() {
    this.initDB();
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('tavernTapesSessions', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('startTime', 'startTime', { unique: false });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

  public async addSession(session: Session): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.add(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getSession(id: string): Promise<Session | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllSessions(): Promise<Session[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async updateSession(session: Session): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.delete(id);

      request.onsuccess = async () => {
        try {
          // Delete associated files
          const fileReference = await fileSystemService.getFileReference(id);
          if (fileReference) {
            await fileSystemService.deleteAudioFile(fileReference);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async searchSessions(query: string): Promise<Session[]> {
    const sessions = await this.getAllSessions();
    const searchTerms = query.toLowerCase().split(' ');
    
    return sessions.filter(session => {
      const sessionText = [
        session.name,
        session.notes || '',
        ...(session.tags || [])
      ].join(' ').toLowerCase();
      
      return searchTerms.every(term => sessionText.includes(term));
    });
  }

  public async exportSession(id: string, options: ExportOptions): Promise<Blob> {
    const session = await this.getSession(id);
    if (!session) {
      throw new Error('Session not found');
    }

    const fileReference = await fileSystemService.getFileReference(id);
    if (!fileReference) {
      throw new Error('Session file not found');
    }

    const audioBlob = await fileSystemService.getAudioFile(fileReference);
    return audioBlob;
  }
}

export default SessionService.getInstance(); 