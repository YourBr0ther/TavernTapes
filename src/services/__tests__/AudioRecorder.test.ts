// Mock RecordRTC
const mockRecorder = {
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn().mockImplementation(function(this: any, callback?: () => void) {
    if (callback) {
      Promise.resolve().then(() => {
        const blob = new Blob(['test'], { type: 'audio/wav' });
        if (this.ondataavailable) {
          this.ondataavailable(blob);
        }
        callback();
        if (this.onstop) {
          this.onstop();
        }
      });
    }
  }),
  pauseRecording: vi.fn(),
  resumeRecording: vi.fn(),
  destroy: vi.fn(),
  getState: vi.fn().mockReturnValue('recording'),
  getBlob: vi.fn().mockImplementation(() => new Blob(['test'], { type: 'audio/wav' })),
  blob: new Blob(['test'], { type: 'audio/wav' })
};

const mockRecordRTC = vi.fn().mockImplementation(() => mockRecorder);
vi.mock('recordrtc', () => ({
  default: mockRecordRTC,
  StereoAudioRecorder: vi.fn()
}));

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioService } from '../AudioService';

// Mock browser APIs
const mockMediaStream = {
  getTracks: () => [{
    stop: vi.fn()
  }]
};

const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
  enumerateDevices: vi.fn().mockResolvedValue([
    { kind: 'audioinput', deviceId: 'default' }
  ])
};

const mockAudioContext = vi.fn().mockImplementation(() => ({
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn()
  }),
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 0,
    getByteFrequencyData: vi.fn()
  }),
  close: vi.fn()
}));

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: mockMediaDevices,
    userAgent: 'test'
  },
  writable: true
});

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    AudioContext: mockAudioContext
  },
  writable: true
});

// Mock dependencies
vi.mock('../FileSystemService', () => ({
  default: {
    saveAudioFile: vi.fn().mockResolvedValue({ id: 'test-file-id', path: 'test/path' }),
  }
}));

vi.mock('../CrashRecoveryService', () => ({
  CrashRecoveryService: {
    getInstance: vi.fn().mockReturnValue({
      getRecoveryState: vi.fn().mockResolvedValue(null),
      clearRecoveryState: vi.fn().mockResolvedValue(undefined),
      saveRecoveryState: vi.fn().mockResolvedValue(undefined),
      saveState: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

describe('AudioService', () => {
  let audioService: AudioService;

  beforeEach(() => {
    vi.clearAllMocks();
    audioService = new AudioService({
      format: 'wav',
      quality: 128
    });
  });

  afterEach(async () => {
    await audioService.cleanup();
  });

  it('should start recording successfully', async () => {
    await audioService.startRecording();
    expect(audioService.isCurrentlyRecording()).toBe(true);
  });

  it('should stop recording successfully', async () => {
    await audioService.startRecording();
    const result = await audioService.stopRecording();
    expect(result).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);
    expect(audioService.isCurrentlyRecording()).toBe(false);
    expect(mockRecorder.getBlob).toHaveBeenCalled();
    expect(mockRecorder.stopRecording).toHaveBeenCalled();
  }, 15000);

  it('should throw error when stopping recording that was not started', async () => {
    await expect(audioService.stopRecording()).rejects.toThrow('No recording in progress');
  });

  it('should handle errors during recording start', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Failed to start recording'));
    await expect(audioService.startRecording()).rejects.toThrow('Failed to start recording');
    expect(audioService.isCurrentlyRecording()).toBe(false);
  });

  it('should handle errors during recording stop', async () => {
    await audioService.startRecording();
    
    mockRecorder.getBlob.mockReturnValueOnce(null);
    
    await expect(audioService.stopRecording()).rejects.toThrow('Failed to get recording blob');
    expect(mockRecorder.destroy).toHaveBeenCalled();
  });

  it('should pause and resume recording', async () => {
    await audioService.startRecording();
    expect(audioService.isCurrentlyRecording()).toBe(true);
    
    audioService.pauseRecording();
    expect(audioService.isCurrentlyPaused()).toBe(true);
    
    audioService.resumeRecording();
    expect(audioService.isCurrentlyPaused()).toBe(false);
    expect(audioService.isCurrentlyRecording()).toBe(true);
  });

  it('should handle errors during recording', async () => {
    const error = new Error('Recording failed');
    mockMediaDevices.getUserMedia.mockRejectedValueOnce(error);
    await expect(audioService.startRecording()).rejects.toThrow('Recording failed');
  });
}); 