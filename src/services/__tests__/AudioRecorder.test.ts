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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    audioService = AudioService.getInstance();
  });

  afterEach(async () => {
    await audioService.stop().catch(() => {});
  });

  it('should start recording', async () => {
    await audioService.start();
    expect(audioService.isRecording()).toBe(true);
  });

  it('should stop recording', async () => {
    await audioService.start();
    await audioService.stop();
    expect(audioService.isRecording()).toBe(false);
  });

  it('should pause recording', async () => {
    await audioService.start();
    audioService.pause();
    expect(audioService.isPaused()).toBe(true);
  });

  it('should resume recording', async () => {
    await audioService.start();
    audioService.pause();
    audioService.resume();
    expect(audioService.isPaused()).toBe(false);
    expect(audioService.isRecording()).toBe(true);
  });

  it('should handle errors during recording start', async () => {
    const mockError = new Error('Failed to start recording');
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValueOnce(mockError);
    await expect(audioService.start()).rejects.toThrow('Failed to start recording');
    expect(audioService.isRecording()).toBe(false);
  });

  it('should handle errors during recording stop', async () => {
    await audioService.start();
    const mockError = new Error('Failed to stop recording');
    vi.spyOn(audioService as any, 'stopRecording').mockRejectedValueOnce(mockError);
    await expect(audioService.stop()).rejects.toThrow('Failed to stop recording');
  });
}); 