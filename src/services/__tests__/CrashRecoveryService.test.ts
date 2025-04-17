import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashRecoveryService } from '../CrashRecoveryService';
import { RecordingMetadata } from '../AudioService';
import { FileReference } from '../FileSystemService';

describe('CrashRecoveryService', () => {
  let mockDB: any;
  let mockTransaction: any;
  let mockObjectStore: any;
  let mockIndex: any;
  let mockRequest: any;
  let mockGetRequest: any;
  let mockPutRequest: any;
  let mockDeleteRequest: any;
  let mockGetAllRequest: any;
  let storedState: any = null;

  const mockMetadata: RecordingMetadata = {
    sessionName: 'Test Session',
    startTime: new Date(),
    duration: 3600,
    fileSize: 1024 * 1024,
    format: 'wav',
    quality: 320,
  };

  beforeEach(() => {
    // Reset stored state
    storedState = null;

    // Reset singleton
    (CrashRecoveryService as any)._instance = null;

    // Create mock requests
    mockGetRequest = {
      onsuccess: null,
      onerror: null,
      result: null,
    };

    mockPutRequest = {
      onsuccess: null,
      onerror: null,
    };

    mockDeleteRequest = {
      onsuccess: null,
      onerror: null,
    };

    mockGetAllRequest = {
      onsuccess: null,
      onerror: null,
      result: [],
    };

    // Create mock index
    mockIndex = {
      getAll: vi.fn(() => {
        setTimeout(() => {
          mockGetAllRequest.onsuccess?.({ target: mockGetAllRequest });
        }, 0);
        return mockGetAllRequest;
      }),
    };

    // Create mock object store
    mockObjectStore = {
      get: vi.fn((id) => {
        setTimeout(() => {
          mockGetRequest.result = id === 'current' ? storedState : null;
          mockGetRequest.onsuccess?.({ target: mockGetRequest });
        }, 0);
        return mockGetRequest;
      }),
      put: vi.fn((state) => {
        setTimeout(() => {
          storedState = state;
          mockPutRequest.onsuccess?.({ target: mockPutRequest });
        }, 0);
        return mockPutRequest;
      }),
      delete: vi.fn((id) => {
        setTimeout(() => {
          if (id === 'current') storedState = null;
          mockDeleteRequest.onsuccess?.({ target: mockDeleteRequest });
        }, 0);
        return mockDeleteRequest;
      }),
      index: vi.fn(() => mockIndex),
      createIndex: vi.fn(),
    };

    // Create mock transaction
    mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
    };

    // Create mock database
    mockDB = {
      transaction: vi.fn(() => mockTransaction),
      createObjectStore: vi.fn(() => mockObjectStore),
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

  it('should be a singleton', () => {
    const instance1 = CrashRecoveryService.getInstance();
    const instance2 = CrashRecoveryService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should initialize database with correct store and index', () => {
    mockDB.objectStoreNames.contains.mockReturnValueOnce(false);
    CrashRecoveryService.getInstance();
    expect(mockDB.createObjectStore).toHaveBeenCalledWith('recovery', { keyPath: 'id' });
    expect(mockObjectStore.createIndex).toHaveBeenCalledWith('startTime', 'startTime', { unique: false });
  });

  it('should save recovery state successfully', async () => {
    const service = CrashRecoveryService.getInstance();
    const mockState = {
      sessionName: 'Test Session',
      startTime: new Date(),
      duration: 3600,
      isPaused: false,
      currentFileReference: null,
      metadata: mockMetadata,
    };

    await service.saveState(mockState);
    expect(storedState).toEqual({
      id: 'current',
      ...mockState,
    });
  });

  it('should get recovery state successfully', async () => {
    const service = CrashRecoveryService.getInstance();
    const mockState = {
      id: 'current',
      sessionName: 'Test Session',
      startTime: new Date().toISOString(),
      duration: 3600,
      isPaused: false,
      currentFileReference: {
        id: 'test-file',
        path: '/test/path',
        createdAt: new Date().toISOString(),
        metadata: {
          format: 'wav',
          quality: 320,
        },
      },
      metadata: mockMetadata,
    };

    storedState = mockState;

    const recoveredState = await service.getRecoveryState();
    expect(recoveredState).toEqual({
      ...mockState,
      startTime: expect.any(Date),
      currentFileReference: {
        ...mockState.currentFileReference,
        createdAt: expect.any(Date),
      },
    });
  });

  it('should return null when no recovery state exists', async () => {
    const service = CrashRecoveryService.getInstance();
    const recoveredState = await service.getRecoveryState();
    expect(recoveredState).toBeNull();
  });

  it('should clear recovery state successfully', async () => {
    const service = CrashRecoveryService.getInstance();
    storedState = {
      id: 'current',
      sessionName: 'Test Session',
      startTime: new Date(),
      duration: 3600,
      isPaused: false,
      currentFileReference: null,
      metadata: mockMetadata,
    };

    await service.clearRecoveryState();
    expect(storedState).toBeNull();
  });

  it('should handle database errors when saving state', async () => {
    const service = CrashRecoveryService.getInstance();
    mockObjectStore.put.mockImplementationOnce(() => {
      setTimeout(() => {
        mockPutRequest.onerror?.({ target: mockPutRequest });
      }, 0);
      return mockPutRequest;
    });

    const mockState = {
      sessionName: 'Test Session',
      startTime: new Date(),
      duration: 3600,
      isPaused: false,
      currentFileReference: null,
      metadata: mockMetadata,
    };

    await expect(service.saveState(mockState)).rejects.toThrow();
  });

  it('should handle database errors when getting state', async () => {
    const service = CrashRecoveryService.getInstance();
    mockObjectStore.get.mockImplementationOnce(() => {
      setTimeout(() => {
        mockGetRequest.onerror?.({ target: mockGetRequest });
      }, 0);
      return mockGetRequest;
    });

    await expect(service.getRecoveryState()).rejects.toThrow();
  });

  it('should handle database errors when clearing state', async () => {
    const service = CrashRecoveryService.getInstance();
    mockObjectStore.delete.mockImplementationOnce(() => {
      setTimeout(() => {
        mockDeleteRequest.onerror?.({ target: mockDeleteRequest });
      }, 0);
      return mockDeleteRequest;
    });

    await expect(service.clearRecoveryState()).rejects.toThrow();
  });

  it('should track recovery attempts correctly', () => {
    const service = CrashRecoveryService.getInstance();
    
    expect(service.incrementRecoveryAttempts()).toBe(true); // 1
    expect(service.incrementRecoveryAttempts()).toBe(true); // 2
    expect(service.incrementRecoveryAttempts()).toBe(true); // 3
    expect(service.incrementRecoveryAttempts()).toBe(false); // 4

    service.resetRecoveryAttempts();
    expect(service.incrementRecoveryAttempts()).toBe(true); // Back to 1
  });
}); 