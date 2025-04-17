import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../SettingsService';

describe('SettingsService', () => {
  let mockDB: any;
  let mockTransaction: any;
  let mockObjectStore: any;
  let mockRequest: any;
  let mockGetAllRequest: any;
  let mockPutRequest: any;
  let mockClearRequest: any;
  let storedSettings: any = null;

  beforeEach(() => {
    // Reset stored settings
    storedSettings = null;

    // Reset singleton
    (SettingsService as any)._instance = null;

    // Create mock requests
    mockGetAllRequest = {
      onsuccess: null,
      onerror: null,
      result: null,
    };

    mockPutRequest = {
      onsuccess: null,
      onerror: null,
    };

    mockClearRequest = {
      onsuccess: null,
      onerror: null,
    };

    // Create mock object store
    mockObjectStore = {
      getAll: vi.fn(() => {
        setTimeout(() => {
          mockGetAllRequest.result = storedSettings;
          mockGetAllRequest.onsuccess?.({ target: mockGetAllRequest });
        }, 0);
        return mockGetAllRequest;
      }),
      put: vi.fn((settings) => {
        setTimeout(() => {
          storedSettings = settings;
          mockPutRequest.onsuccess?.({ target: mockPutRequest });
        }, 0);
        return mockPutRequest;
      }),
      clear: vi.fn(() => {
        setTimeout(() => {
          storedSettings = null;
          mockClearRequest.onsuccess?.({ target: mockClearRequest });
        }, 0);
        return mockClearRequest;
      }),
    };

    // Create mock transaction
    mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
    };

    // Create mock database
    mockDB = {
      transaction: vi.fn(() => mockTransaction),
      createObjectStore: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(),
      },
    };

    // Mock indexedDB.open
    mockRequest = {
      result: mockDB,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
    };

    global.indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({ target: mockRequest });
          }
          mockRequest.onsuccess?.({ target: mockRequest });
        }, 0);
        return mockRequest;
      }),
    } as any;
  });

  it('should be a singleton', async () => {
    const instance1 = await SettingsService.getInstance();
    const instance2 = await SettingsService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should get default settings when no settings exist', async () => {
    const service = await SettingsService.getInstance();
    const settings = await service.getSettings();
    expect(settings).toEqual({
      id: 'settings',
      autoSplitEnabled: false,
      autoSplitDuration: 300,
      maxRecordingDuration: 3600,
      autoStopEnabled: false,
      autoStopDuration: 1800,
    });
  });

  it('should update settings', async () => {
    const service = await SettingsService.getInstance();
    const newSettings = {
      id: 'settings',
      autoSplitEnabled: true,
      autoSplitDuration: 600,
      maxRecordingDuration: 7200,
      autoStopEnabled: true,
      autoStopDuration: 3600,
    };
    
    await service.updateSettings(newSettings);
    const updatedSettings = await service.getSettings();
    expect(updatedSettings).toEqual(newSettings);
  });

  it('should handle database errors', async () => {
    mockObjectStore.getAll.mockImplementationOnce(() => {
      setTimeout(() => {
        mockGetAllRequest.onerror?.({ target: mockGetAllRequest });
      }, 0);
      return mockGetAllRequest;
    });

    const service = await SettingsService.getInstance();
    await expect(service.getSettings()).rejects.toThrow('Failed to get settings');
  });

  it('should handle database initialization errors', async () => {
    global.indexedDB.open = vi.fn(() => {
      setTimeout(() => {
        mockRequest.onerror?.({ target: mockRequest });
      }, 0);
      return mockRequest;
    });

    await expect(SettingsService.getInstance()).rejects.toThrow('Failed to open database');
  });

  it('should handle database upgrade', async () => {
    mockDB.objectStoreNames.contains.mockReturnValueOnce(false);
    await SettingsService.getInstance();
    expect(mockDB.createObjectStore).toHaveBeenCalledWith('settings', { keyPath: 'id' });
  });
}); 