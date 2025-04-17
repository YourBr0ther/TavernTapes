import { AudioService } from '../AudioService';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AudioService', () => {
  let audioService: AudioService;
  let mockMediaRecorder: any;
  let mockStream: any;

  beforeEach(() => {
    // Mock the MediaRecorder
    mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
      onerror: null,
    };

    // Mock the MediaStream
    mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    };

    // Mock the navigator.mediaDevices.getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    } as any;

    // Mock the MediaRecorder constructor
    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder);

    audioService = AudioService.getInstance({
      format: 'wav',
      quality: 128,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(audioService).toBeDefined();
    expect(audioService.isCurrentlyRecording()).toBe(false);
  });

  it('should start recording when startRecording is called', async () => {
    await audioService.startRecording('Test Session');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 2,
        sampleRate: 44100
      }
    });
    expect(audioService.isCurrentlyRecording()).toBe(true);
  });

  it('should stop recording when stopRecording is called', async () => {
    await audioService.startRecording('Test Session');
    await audioService.stopRecording();
    expect(audioService.isCurrentlyRecording()).toBe(false);
  });

  it('should pause and resume recording', async () => {
    await audioService.startRecording('Test Session');
    audioService.pauseRecording();
    expect(audioService.isCurrentlyPaused()).toBe(true);

    audioService.resumeRecording();
    expect(audioService.isCurrentlyPaused()).toBe(false);
  });

  it('should handle errors during recording', async () => {
    const error = new Error('Test error');
    mockMediaRecorder.onerror(error);
    expect(audioService.isCurrentlyRecording()).toBe(false);
  });
}); 