interface Settings {
  theme: 'light' | 'dark';
  audioFormat: 'wav' | 'mp3';
  audioQuality: number;
  autoSplitEnabled: boolean;
  splitInterval: number;
  splitSize: number;
  defaultSaveLocation: string;
}

class SettingsService {
  private static instance: SettingsService;
  private readonly DB_NAME = 'tavernTapesSettings';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private defaultSettings: Settings = {
    theme: 'dark',
    audioFormat: 'wav',
    audioQuality: 320,
    autoSplitEnabled: true,
    splitInterval: 30, // minutes
    splitSize: 500, // MB
    defaultSaveLocation: 'TavernTapes_Recordings'
  };

  private constructor() {
    this.initializeDB();
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
          const store = db.createObjectStore('settings', { keyPath: 'key' });
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

  public async getSettings(): Promise<Settings> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();

      request.onsuccess = () => {
        const settings = { ...this.defaultSettings };
        request.result.forEach(item => {
          settings[item.key as keyof Settings] = item.value;
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

export default SettingsService.getInstance(); 