import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemService, FileReference } from '../FileSystemService';

describe('FileSystemService', () => {
  let mockDB: any;
  let mockTransaction: any;
  let mockObjectStore: any;
  let mockRequest: any;
  let mockGetRequest: any;
  let mockPutRequest: any;
  let mockDeleteRequest: any;
  let storedFiles: Map<string, FileReference>;

  // Mock electron
  const mockElectron = {
    ipcRenderer: {
      invoke: vi.fn(),
    },
  };

  beforeEach(() => {
    // Reset stored files
    storedFiles = new Map();

    // Reset singleton
    (FileSystemService as any)._instance = null;

    // Mock localStorage
    const mockStorage: { [key: string]: string } = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key]),
      setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }),
      key: vi.fn((index: number) => Object.keys(mockStorage)[index]),
      length: 0,
    };

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

    // Create mock object store
    mockObjectStore = {
      get: vi.fn((id) => {
        setTimeout(() => {
          mockGetRequest.result = storedFiles.get(id);
          mockGetRequest.onsuccess?.({ target: mockGetRequest });
        }, 0);
        return mockGetRequest;
      }),
      put: vi.fn((fileRef) => {
        setTimeout(() => {
          storedFiles.set(fileRef.id, fileRef);
          mockPutRequest.onsuccess?.({ target: mockPutRequest });
        }, 0);
        return mockPutRequest;
      }),
      delete: vi.fn((id) => {
        setTimeout(() => {
          storedFiles.delete(id);
          mockDeleteRequest.onsuccess?.({ target: mockDeleteRequest });
        }, 0);
        return mockDeleteRequest;
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

    // Mock window.electron
    (global as any).window = { electron: mockElectron };
  });

  it('should be a singleton', () => {
    const instance1 = FileSystemService.getInstance();
    const instance2 = FileSystemService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should initialize database with correct store', async () => {
    mockDB.objectStoreNames.contains.mockReturnValueOnce(false);
    FileSystemService.getInstance();
    expect(mockDB.createObjectStore).toHaveBeenCalledWith('files', { keyPath: 'id' });
  });

  it('should set base directory successfully', async () => {
    const service = FileSystemService.getInstance();
    mockElectron.ipcRenderer.invoke.mockResolvedValueOnce({ success: true });
    
    await service.setBaseDirectory('/test/path');
    
    expect(service.getBaseDirectory()).toBe('/test/path');
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith('save-file', {
      path: '/test/path',
      buffer: expect.any(Uint8Array),
    });
  });

  it('should handle base directory creation failure', async () => {
    const service = FileSystemService.getInstance();
    mockElectron.ipcRenderer.invoke.mockResolvedValueOnce({ 
      success: false, 
      error: 'Permission denied' 
    });

    await expect(service.setBaseDirectory('/test/path'))
      .rejects.toThrow('Failed to create base directory: Permission denied');
  });

  it('should save audio file successfully', async () => {
    const service = FileSystemService.getInstance();
    const mockBlob = new Blob(['test audio'], { type: 'audio/wav' });
    const mockMetadata = {
      sessionName: 'Test Session',
      startTime: new Date(),
      duration: 3600,
      fileSize: 1024,
      format: 'wav',
      quality: 320,
    };

    const fileRef = await service.saveAudioFile('test-id', mockBlob, mockMetadata);
    
    expect(fileRef).toEqual({
      id: 'test-id',
      path: expect.stringContaining('recordings/test-id'),
      metadata: mockMetadata,
    });
    expect(localStorage.setItem).toHaveBeenCalled();
    expect(storedFiles.get('test-id')).toEqual(fileRef);
  });

  it('should get audio file successfully', async () => {
    const service = FileSystemService.getInstance();
    const mockFileRef: FileReference = {
      id: 'test-id',
      path: 'recordings/test-id',
      metadata: {
        sessionName: 'Test Session',
        startTime: new Date(),
        duration: 3600,
        fileSize: 1024,
        format: 'wav',
        quality: 320,
      },
    };

    localStorage.setItem(mockFileRef.path, 'test audio data');
    
    const blob = await service.getAudioFile(mockFileRef);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/wav');
  });

  it('should handle missing audio file', async () => {
    const service = FileSystemService.getInstance();
    const mockFileRef: FileReference = {
      id: 'test-id',
      path: 'recordings/test-id',
      metadata: {
        sessionName: 'Test Session',
        startTime: new Date(),
        duration: 3600,
        fileSize: 1024,
        format: 'wav',
        quality: 320,
      },
    };

    await expect(service.getAudioFile(mockFileRef))
      .rejects.toThrow('File not found at path: recordings/test-id');
  });

  it('should delete audio file successfully', async () => {
    const service = FileSystemService.getInstance();
    const mockFileRef: FileReference = {
      id: 'test-id',
      path: 'recordings/test-id',
      metadata: {
        sessionName: 'Test Session',
        startTime: new Date(),
        duration: 3600,
        fileSize: 1024,
        format: 'wav',
        quality: 320,
      },
    };

    storedFiles.set(mockFileRef.id, mockFileRef);
    localStorage.setItem(mockFileRef.path, 'test audio data');

    await service.deleteAudioFile(mockFileRef);
    
    expect(localStorage.removeItem).toHaveBeenCalledWith(mockFileRef.path);
    expect(storedFiles.has(mockFileRef.id)).toBe(false);
  });

  it('should get file reference successfully', async () => {
    const service = FileSystemService.getInstance();
    const mockFileRef: FileReference = {
      id: 'test-id',
      path: 'recordings/test-id',
      metadata: {
        sessionName: 'Test Session',
        startTime: new Date(),
        duration: 3600,
        fileSize: 1024,
        format: 'wav',
        quality: 320,
      },
    };

    storedFiles.set(mockFileRef.id, mockFileRef);

    const fileRef = await service.getFileReference('test-id');
    expect(fileRef).toEqual(mockFileRef);
  });

  it('should handle missing file reference', async () => {
    const service = FileSystemService.getInstance();
    await expect(service.getFileReference('non-existent'))
      .rejects.toThrow('File reference not found for ID: non-existent');
  });

  it('should handle database errors', async () => {
    const service = FileSystemService.getInstance();
    mockObjectStore.get.mockImplementationOnce(() => {
      setTimeout(() => {
        mockGetRequest.onerror?.({ target: mockGetRequest });
      }, 0);
      return mockGetRequest;
    });

    await expect(service.getFileReference('test-id'))
      .rejects.toThrow();
  });
}); 