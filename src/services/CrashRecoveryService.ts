import { RecordingMetadata } from './AudioService';
import { FileReference } from './FileSystemService';

interface RecoveryState {
  sessionName: string;
  startTime: Date;
  duration: number;
  isPaused: boolean;
  currentFileReference: FileReference | null;
  metadata: RecordingMetadata;
}

export class CrashRecoveryService {
  private static instance: CrashRecoveryService;
  private readonly DB_NAME = 'tavernTapesRecovery';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private recoveryAttempts: number = 0;

  private constructor() {
    this.initializeDB();
  }

  public static getInstance(): CrashRecoveryService {
    if (!CrashRecoveryService.instance) {
      CrashRecoveryService.instance = new CrashRecoveryService();
    }
    return CrashRecoveryService.instance;
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
        if (!db.objectStoreNames.contains('recovery')) {
          const store = db.createObjectStore('recovery', { keyPath: 'id' });
          store.createIndex('startTime', 'startTime', { unique: false });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initializeDB();
    }
    return this.db!;
  }


  async saveState(state: RecoveryState): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recovery', 'readwrite');
      const store = transaction.objectStore('recovery');
      const request = store.put({ id: 'current', ...state });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecoveryState(): Promise<RecoveryState | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recovery', 'readonly');
      const store = transaction.objectStore('recovery');
      const request = store.get('current');

      request.onsuccess = () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        const state = request.result;
        resolve({
          ...state,
          startTime: new Date(state.startTime),
          currentFileReference: state.currentFileReference ? {
            ...state.currentFileReference,
            createdAt: new Date(state.currentFileReference.createdAt)
          } : null
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearRecoveryState(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('recovery', 'readwrite');
      const store = transaction.objectStore('recovery');
      const request = store.delete('current');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  incrementRecoveryAttempts(): boolean {
    this.recoveryAttempts++;
    return this.recoveryAttempts <= this.MAX_RECOVERY_ATTEMPTS;
  }

  resetRecoveryAttempts(): void {
    this.recoveryAttempts = 0;
  }
} 