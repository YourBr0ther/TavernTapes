import { FileSystemService } from './FileSystemService';
import { Session, ExportOptions } from '../types/Session';
import { createServiceLogger } from '../utils/logger';

class SessionService {
  private static instance: SessionService;
  private fileSystemService: FileSystemService;
  private readonly DB_NAME = 'tavernTapesSessions';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private initializationPromise: Promise<void> | null = null;
  private logger = createServiceLogger('SessionService');

  private constructor() {
    this.fileSystemService = FileSystemService.getInstance();
    this.initializationPromise = this.initializeDB();
    this.logger.info('SessionService initialized', {
      dbName: this.DB_NAME,
      dbVersion: this.DB_VERSION
    });
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  private async initializeDB(): Promise<void> {
    this.logger.debug('Initializing IndexedDB database', { method: 'initializeDB' });
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        const error = request.error;
        this.logger.error('Failed to open IndexedDB database', error, { 
          method: 'initializeDB',
          dbName: this.DB_NAME,
          dbVersion: this.DB_VERSION
        });
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.logger.info('IndexedDB database opened successfully', {
          method: 'initializeDB',
          dbName: this.DB_NAME,
          dbVersion: this.DB_VERSION
        });
        resolve();
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          this.logger.info('Database upgrade needed', {
            method: 'initializeDB',
            oldVersion: event.oldVersion,
            newVersion: event.newVersion
          });

          if (!db.objectStoreNames.contains('sessions')) {
            const store = db.createObjectStore('sessions', { keyPath: 'id' });
            this.logger.debug('Created sessions object store');
          }
        } catch (error) {
          this.logger.error('Error during database upgrade', error, { method: 'initializeDB' });
          reject(error);
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

  public async getAllSessions(): Promise<Session[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('sessions', 'readonly');
        const store = transaction.objectStore('sessions');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error getting all sessions:', error);
      throw new Error('Failed to get all sessions');
    }
  }

  public async searchSessions(query: string): Promise<Session[]> {
    try {
      const allSessions = await this.getAllSessions();
      const lowerQuery = query.toLowerCase();
      
      return allSessions.filter(session => {
        const nameMatch = session.metadata.sessionName.toLowerCase().includes(lowerQuery);
        const tagsMatch = session.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) || false;
        const notesMatch = session.notes?.some(note => note.toLowerCase().includes(lowerQuery)) || false;
        
        return nameMatch || tagsMatch || notesMatch;
      });
    } catch (error) {
      console.error('Error searching sessions:', error);
      throw new Error('Failed to search sessions');
    }
  }

  public async addNoteToSession(sessionId: string, note: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const session = await new Promise<Session>((resolve, reject) => {
        const request = store.get(sessionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!session) {
        throw new Error('Session not found');
      }

      session.notes = session.notes || [];
      session.notes.push(note);

      return new Promise((resolve, reject) => {
        const request = store.put(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error adding note to session:', error);
      throw new Error('Failed to add note to session');
    }
  }

  public async addTagsToSession(sessionId: string, tags: string[]): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const session = await new Promise<Session>((resolve, reject) => {
        const request = store.get(sessionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.tags) {
        session.tags = [];
      }
      
      tags.forEach(tag => {
        if (session.tags && !session.tags.includes(tag)) {
          session.tags.push(tag);
        }
      });

      return new Promise((resolve, reject) => {
        const request = store.put(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error adding tags to session:', error);
      throw new Error('Failed to add tags to session');
    }
  }

  public async removeTagFromSession(sessionId: string, tag: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const session = await new Promise<Session>((resolve, reject) => {
        const request = store.get(sessionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!session) {
        throw new Error('Session not found');
      }

      if (session.tags) {
        session.tags = session.tags.filter(t => t !== tag);
      }

      return new Promise((resolve, reject) => {
        const request = store.put(session);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error removing tag from session:', error);
      throw new Error('Failed to remove tag from session');
    }
  }

  public async exportSessionToFile(sessionId: string, outputPath: string): Promise<void> {
    try {
      const session = await this.exportSession(sessionId);
      // Convert blob to file and save
      const buffer = await session.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      if (window.electron) {
        await window.electron.ipcRenderer.invoke('save-file', {
          path: outputPath,
          data: Array.from(uint8Array)
        });
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Error exporting session to file:', error);
      throw new Error('Failed to export session to file');
    }
  }
}

export { SessionService };
export default SessionService.getInstance(); 