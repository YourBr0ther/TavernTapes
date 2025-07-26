export interface Settings {
  theme: 'light' | 'dark';
  audioFormat: 'wav' | 'mp3';
  format: 'wav' | 'mp3';  // Alias for audioFormat for backward compatibility
  audioQuality: number;
  quality: number;  // Alias for audioQuality for backward compatibility
  autoSplitEnabled: boolean;
  splitInterval: number;
  splitSize: number;
  storageLocation: string;
  inputDeviceId: string;
}

export const defaultSettings: Settings = {
  theme: 'dark',
  audioFormat: 'wav',
  format: 'wav',
  audioQuality: 320,
  quality: 320,
  autoSplitEnabled: true,
  splitInterval: 30, // minutes
  splitSize: 500, // MB
  storageLocation: 'TavernTapes_Recordings',
  inputDeviceId: 'default'
};

class SettingsService {
  private static instance: SettingsService;
  private readonly DB_NAME = 'tavernTapesSettings';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    this.initializationPromise = this.initializeDB();
  }

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
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
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
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

  public async getSettings(): Promise<Settings> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();

      request.onsuccess = () => {
        const settings: Settings = { ...defaultSettings };
        request.result.forEach((item: { key: keyof Settings; value: unknown }) => {
          switch (item.key) {
            case 'theme':
              if (item.value === 'light' || item.value === 'dark') {
                settings.theme = item.value;
              }
              break;
            case 'audioFormat':
            case 'format':
              if (item.value === 'wav' || item.value === 'mp3') {
                settings.audioFormat = item.value;
                settings.format = item.value;
              }
              break;
            case 'audioQuality':
            case 'quality':
              if (typeof item.value === 'number') {
                settings.audioQuality = item.value;
                settings.quality = item.value;
              }
              break;
            case 'splitInterval':
            case 'splitSize':
              if (typeof item.value === 'number') {
                settings[item.key] = item.value;
              }
              break;
            case 'autoSplitEnabled':
              if (typeof item.value === 'boolean') {
                settings.autoSplitEnabled = item.value;
              }
              break;
            case 'storageLocation':
            case 'inputDeviceId':
              if (typeof item.value === 'string') {
                settings[item.key] = item.value;
              }
              break;
          }
        });
        resolve(settings);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async updateSettings(updates: Partial<Settings>): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');

      const requests = Object.entries(updates).map(([key, value]) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.put({ key, value });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      Promise.all(requests)
        .then(() => resolve())
        .catch(error => reject(error));
    });
  }

  public async resetSettings(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export { SettingsService };
export default SettingsService.getInstance(); 