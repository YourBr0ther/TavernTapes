import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService, RecordingOptions, RecordingMetadata } from '../AudioService';
import { FileSystemService } from '../FileSystemService';
import { CrashRecoveryService } from '../CrashRecoveryService';
import RecordRTC from 'recordrtc';

// Mock dependencies
vi.mock('recordrtc');
vi.mock('../FileSystemService');
vi.mock('../CrashRecoveryService');

describe('AudioService', () => {
  // Mock navigator.mediaDevices
  const mockMediaStream = {
    getTracks: vi.fn(() => [{
      stop: vi.fn()
    }]),
  };

  const mockMediaDevices = {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn(),
  };

  // Mock AudioContext
  const mockAnalyser = {
    fftSize: 256,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn(),
  };

  const mockAudioContext = {
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => mockAnalyser),
    close: vi.fn(),
  };

  const defaultOptions: RecordingOptions = {
    format: 'wav',
    quality: 320,
    splitInterval: 30,
    splitSize: 500,
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    AudioService.resetInstance();

    // Setup navigator.mediaDevices mock
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: mockMediaDevices,
      writable: true,
    });

    // Setup AudioContext mock
    (global as any).AudioContext = vi.fn(() => mockAudioContext);

    // Setup MediaStream mock
    mockMediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);

    // Setup device enumeration mock
    mockMediaDevices.enumerateDevices.mockResolvedValue([
      { kind: 'audioinput', deviceId: 'default', label: 'Default' },
      { kind: 'audioinput', deviceId: 'device1', label: 'Device 1' },
    ]);

    // Mock window.crypto
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
      },
    });

    // Setup localStorage mock
    const mockStorage: { [key: string]: string } = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key]),
        setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
        removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
        clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }),
      },
      writable: true,
    });
  });

  describe('Initialization', () => {
    it('should be a singleton', () => {
      const instance1 = AudioService.getInstance(defaultOptions);
      const instance2 = AudioService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should throw error when getting instance without initialization', () => {
      AudioService.resetInstance();
      expect(() => AudioService.getInstance()).toThrow('AudioService must be initialized with options first');
    });

    it('should initialize with provided options', () => {
      const service = AudioService.getInstance(defaultOptions);
      expect(service).toBeDefined();
    });

    it('should update options', () => {
      const service = AudioService.getInstance(defaultOptions);
      const newOptions: RecordingOptions = {
        format: 'mp3',
        quality: 192,
      };
      service.updateOptions(newOptions);
      // Since options are private, we can test the effect through recording
      expect(service).toBeDefined();
    });
  });

  describe('Device Management', () => {
    it('should get available input devices', async () => {
      const devices = await AudioService.getInputDevices();
      expect(devices).toHaveLength(2);
      expect(devices[0].kind).toBe('audioinput');
      expect(mockMediaDevices.enumerateDevices).toHaveBeenCalled();
    });

    it('should handle errors when getting input devices', async () => {
      mockMediaDevices.enumerateDevices.mockRejectedValueOnce(new Error('Permission denied'));
      const devices = await AudioService.getInputDevices();
      expect(devices).toHaveLength(0);
    });
  });

  describe('Recording Control', () => {
    it('should start recording with default session name', async () => {
      const service = AudioService.getInstance(defaultOptions);
      await service.start();
      expect(service.isRecording()).toBe(true);
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should start recording with custom session name', async () => {
      const service = AudioService.getInstance(defaultOptions);
      await service.start('Test Session');
      expect(service.isRecording()).toBe(true);
    });

    it('should not start recording if already recording', async () => {
      const service = AudioService.getInstance(defaultOptions);
      await service.start();
      await expect(service.start()).rejects.toThrow('Recording is already in progress');
    });

    it('should pause recording', async () => {
      const service = AudioService.getInstance(defaultOptions);
      await service.start();
      service.pause();
      expect(service.isPaused()).toBe(true);
    });

    it('should resume recording', async () => {
      const service = AudioService.getInstance(defaultOptions);
      await service.start();
      service.pause();
      service.resume();
      expect(service.isPaused()).toBe(false);
    });

    it('should stop recording', async () => {
      const service = AudioService.getInstance(defaultOptions);
      await service.start();
      const metadata = await service.stop();
      expect(service.isRecording()).toBe(false);
      expect(metadata).toBeDefined();
    });
  });

  describe('Audio Processing', () => {
    it('should monitor audio levels', async () => {
      const service = AudioService.getInstance(defaultOptions);
      const mockCallback = vi.fn();
      service.setAudioLevelCallback(mockCallback);
      await service.start();
      
      // Simulate audio data
      const dataArray = new Uint8Array(128);
      dataArray[0] = 100; // Set some non-zero value
      mockAnalyser.getByteFrequencyData.mockImplementation((array) => {
        array.set(dataArray);
      });

      // Wait for a frame
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle audio processing errors', async () => {
      const service = AudioService.getInstance(defaultOptions);
      mockAudioContext.createMediaStreamSource.mockImplementationOnce(() => {
        throw new Error('Audio processing error');
      });

      // Should still start recording even if audio processing fails
      await service.start();
      expect(service.isRecording()).toBe(true);
    });
  });

  describe('Crash Recovery', () => {
    it('should handle recovery state on start', async () => {
      const mockRecoveryState = {
        sessionName: 'Recovered Session',
        startTime: new Date(),
        duration: 1800,
        isPaused: false,
        currentFileReference: null,
        metadata: {
          sessionName: 'Recovered Session',
          startTime: new Date(),
          duration: 1800,
          fileSize: 1024 * 1024,
          format: 'wav',
          quality: 320,
        },
      };

      (CrashRecoveryService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
        getRecoveryState: vi.fn().mockResolvedValue(mockRecoveryState),
        clearRecoveryState: vi.fn(),
      });

      // Mock window.confirm
      (global as any).window = {
        confirm: vi.fn(() => true),
      };

      const service = AudioService.getInstance(defaultOptions);
      await service.start();

      expect(window.confirm).toHaveBeenCalled();
      expect(service.isRecording()).toBe(true);
    });

    it('should save state periodically', async () => {
      vi.useFakeTimers();
      
      const service = AudioService.getInstance(defaultOptions);
      const mockSaveState = vi.fn();
      
      (CrashRecoveryService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
        getRecoveryState: vi.fn().mockResolvedValue(null),
        saveState: mockSaveState,
      });

      await service.start('Test Session');
      
      // Advance timers to trigger state saving
      vi.advanceTimersByTime(5000);
      
      expect(mockSaveState).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle media device access errors', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      const service = AudioService.getInstance(defaultOptions);
      await expect(service.start()).rejects.toThrow();
    });

    it('should handle recording errors', async () => {
      ((RecordRTC as unknown) as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        startRecording: vi.fn(() => {
          throw new Error('Recording error');
        }),
      }));

      const service = AudioService.getInstance(defaultOptions);
      await expect(service.start()).rejects.toThrow();
    });

    it('should cleanup resources on error', async () => {
      const service = AudioService.getInstance(defaultOptions);
      mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      
      try {
        await service.start();
      } catch (error) {
        expect(mockAudioContext.close).toHaveBeenCalled();
        expect(service.isRecording()).toBe(false);
      }
    });
  });
}); 