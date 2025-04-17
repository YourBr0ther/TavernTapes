import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../SessionService';
import { FileSystemService } from '../FileSystemService';

vi.mock('../FileSystemService', () => ({
  FileSystemService: {
    getInstance: vi.fn(() => ({
      getFileReference: vi.fn(),
      deleteAudioFile: vi.fn(),
      getAudioFile: vi.fn(),
    })),
  },
}));

describe('SessionService', () => {
  let mockDB: any;
  let mockTransaction: any;
  let mockObjectStore: any;
  let mockRequest: any;
  let mockAddRequest: any;
  let storedSessions: any[] = [];

  beforeEach(() => {
    // Reset stored sessions
    storedSessions = [];

    // Reset singleton
    (SessionService as any)._instance = null;

    // Create mock requests
    mockAddRequest = {
      onsuccess: null,
      onerror: null,
    };

    // Create mock object store
    mockObjectStore = {
      add: vi.fn((session) => {
        setTimeout(() => {
          storedSessions.push(session);
          mockAddRequest.onsuccess?.({ target: mockAddRequest });
        }, 0);
        return mockAddRequest;
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
    const instance1 = SessionService.getInstance();
    const instance2 = SessionService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should initialize database with correct store', async () => {
    mockDB.objectStoreNames.contains.mockReturnValueOnce(false);
    SessionService.getInstance();
    expect(mockDB.createObjectStore).toHaveBeenCalledWith('sessions', { keyPath: 'id' });
  });

  it('should add a session successfully', async () => {
    const service = SessionService.getInstance();
    const mockSession = {
      id: '123',
      createdAt: new Date(),
      metadata: {
        sessionName: 'Test Session',
        duration: 3600,
        format: 'wav' as const,
        quality: 320,
        fileSize: 1024,
      },
      filePath: '/path/to/file',
    };

    await service.addSession(mockSession);
    expect(storedSessions).toContainEqual(mockSession);
  });

  it('should handle database errors when adding session', async () => {
    const service = SessionService.getInstance();
    mockObjectStore.add.mockImplementationOnce(() => {
      setTimeout(() => {
        mockAddRequest.onerror?.({ target: mockAddRequest });
      }, 0);
      return mockAddRequest;
    });

    const mockSession = {
      id: '123',
      createdAt: new Date(),
      metadata: {
        sessionName: 'Test Session',
        duration: 3600,
        format: 'wav' as const,
        quality: 320,
        fileSize: 1024,
      },
      filePath: '/path/to/file',
    };

    await expect(service.addSession(mockSession)).rejects.toThrow('Failed to add session');
  });

  it('should delete a session successfully', async () => {
    const service = SessionService.getInstance();
    const mockFileReference = { id: '123', path: '/path/to/file' };
    const fileSystemService = FileSystemService.getInstance();

    (fileSystemService.getFileReference as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFileReference);
    
    await service.deleteSession('123');
    
    expect(fileSystemService.getFileReference).toHaveBeenCalledWith('123');
    expect(fileSystemService.deleteAudioFile).toHaveBeenCalledWith(mockFileReference);
  });

  it('should handle errors when deleting session', async () => {
    const service = SessionService.getInstance();
    const fileSystemService = FileSystemService.getInstance();

    (fileSystemService.getFileReference as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('File not found'));

    await expect(service.deleteSession('123')).rejects.toThrow('Failed to delete session');
  });

  it('should export session without conversion', async () => {
    const service = SessionService.getInstance();
    const mockFileReference = { 
      id: '123', 
      path: '/path/to/file',
      metadata: { format: 'wav' }
    };
    const mockBlob = new Blob(['test'], { type: 'audio/wav' });
    const fileSystemService = FileSystemService.getInstance();

    (fileSystemService.getFileReference as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFileReference);
    (fileSystemService.getAudioFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockBlob);

    const result = await service.exportSession('123');
    expect(result).toBe(mockBlob);
  });

  it('should throw error when trying to convert format', async () => {
    const service = SessionService.getInstance();
    const mockFileReference = { 
      id: '123', 
      path: '/path/to/file',
      metadata: { format: 'wav' }
    };
    const mockBlob = new Blob(['test'], { type: 'audio/wav' });
    const fileSystemService = FileSystemService.getInstance();

    (fileSystemService.getFileReference as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFileReference);
    (fileSystemService.getAudioFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockBlob);

    await expect(service.exportSession('123', { format: 'mp3' }))
      .rejects.toThrow('Format conversion not implemented yet');
  });
}); 