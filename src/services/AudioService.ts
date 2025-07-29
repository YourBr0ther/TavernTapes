import RecordRTC from 'recordrtc';
import sessionService from './SessionService';
import { Session } from '../types/Session';
import { CrashRecoveryService } from './CrashRecoveryService';
import fileSystemService, { FileReference } from './FileSystemService';
import { createServiceLogger } from '../utils/logger';

interface RecoveryState {
  sessionName: string;
  startTime: Date;
  duration: number;
  isPaused: boolean;
  currentFileReference: FileReference | null;
  metadata: RecordingMetadata;
}

export interface RecordingOptions {
  format: 'wav' | 'mp3';
  quality: number;
  splitInterval?: number; // in minutes
  splitSize?: number; // in MB
  inputDeviceId?: string; // Add input device ID option
}

export interface RecordingMetadata {
  sessionName: string;
  startTime: Date;
  duration: number;
  fileSize: number;
  format: string;
  quality: number;
}

export type AudioLevelCallback = (level: number) => void;

export class AudioService {
  private static instance: AudioService | null = null;
  private recorder: RecordRTC | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime: Date | null = null;
  private recordingOptions: RecordingOptions;
  private currentSessionName: string = '';
  private _isRecording: boolean = false;
  private _isPaused: boolean = false;
  private recordingTimer: NodeJS.Timeout | null = null;
  private currentDuration: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevelCallback: ((level: number) => void) | null = null;
  private animationFrameId: number | null = null;
  private mediaStream: MediaStream | null = null;
  private maxChunks: number = 100;
  private lastSplitTime: number = 0;
  private crashRecoveryService: CrashRecoveryService;
  private stateSaveInterval: NodeJS.Timeout | null = null;
  private currentSessionId: string | null = null;
  private currentFileReference: FileReference | null = null;
  private logger = createServiceLogger('AudioService');

  private constructor(options: RecordingOptions) {
    this.recordingOptions = options;
    this.crashRecoveryService = CrashRecoveryService.getInstance();
    this.logger.info('AudioService initialized', { 
      options: this.recordingOptions,
      maxChunks: this.maxChunks 
    });
  }

  public static getInstance(options?: RecordingOptions): AudioService {
    try {
      if (!AudioService.instance && options) {
        AudioService.instance = new AudioService(options);
      } else if (!AudioService.instance) {
        const error = new Error('AudioService must be initialized with options first');
        console.error('[AudioService] Failed to get instance - no options provided');
        throw error;
      }
      return AudioService.instance;
    } catch (error) {
      console.error('[AudioService] Error getting instance:', error);
      throw error;
    }
  }

  public static resetInstance(): void {
    try {
      if (AudioService.instance) {
        console.log('[AudioService] Resetting instance and cleaning up resources');
        AudioService.instance.cleanup();
      }
      AudioService.instance = null;
    } catch (error) {
      console.error('[AudioService] Error during instance reset:', error);
      AudioService.instance = null; // Force reset even on error
    }
  }

  public updateOptions(options: RecordingOptions): void {
    try {
      const previousOptions = { ...this.recordingOptions };
      this.recordingOptions = { ...this.recordingOptions, ...options };
      this.logger.info('Recording options updated', { 
        method: 'updateOptions',
        previousOptions, 
        newOptions: this.recordingOptions 
      });
    } catch (error) {
      this.logger.error('Failed to update recording options', error, { 
        method: 'updateOptions',
        attemptedOptions: options 
      });
      throw error;
    }
  }

  public setAudioLevelCallback(callback: (level: number) => void): void {
    this.audioLevelCallback = callback;
  }

  // Add method to get available input devices
  static async getInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      console.log('[AudioService] Enumerating audio input devices');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      console.log(`[AudioService] Found ${audioInputs.length} audio input devices:`, 
        audioInputs.map(d => ({ id: d.deviceId, label: d.label || 'Unknown Device' })));
      return audioInputs;
    } catch (error) {
      console.error('[AudioService] Error getting input devices:', error);
      return [];
    }
  }

  // Public methods for recording control
  public async start(sessionName?: string): Promise<void> {
    return this.startRecording(sessionName);
  }

  public async stop(): Promise<RecordingMetadata> {
    return this.stopRecording();
  }

  public pause(): void {
    this.pauseRecording();
  }

  public resume(): void {
    this.resumeRecording();
  }

  // Add a force stop method to handle stuck states
  public async forceStop(): Promise<RecordingMetadata | null> {
    this.logger.warn('Force stop requested', {
      method: 'forceStop',
      isRecording: this._isRecording,
      isPaused: this._isPaused,
      hasRecorder: !!this.recorder,
      hasMediaStream: !!this.mediaStream
    });

    try {
      // Try to reset state and stop properly
      if (this.recorder) {
        this._isRecording = true; // Force the state to allow stopping
        return await this.stopRecording();
      }
    } catch (error) {
      this.logger.error('Force stop also failed, performing emergency cleanup', error, { method: 'forceStop' });
    }

    // Emergency cleanup
    this.cleanup();
    this._isRecording = false;
    this._isPaused = false;
    this.currentDuration = 0;
    
    return null;
  }

  // Public methods for state checking
  public isRecording(): boolean {
    return this._isRecording;
  }

  public isPaused(): boolean {
    return this._isPaused;
  }

  async startRecording(sessionName: string = ''): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Starting recording session', { 
      method: 'startRecording',
      sessionName,
      currentState: {
        isRecording: this._isRecording,
        isPaused: this._isPaused
      },
      options: this.recordingOptions
    });

    try {
      // Check for crash recovery
      const recoveryState = await this.crashRecoveryService.getRecoveryState();
      if (recoveryState) {
        this.logger.info('Found crash recovery state', { 
          method: 'startRecording',
          recoveryState: {
            sessionName: recoveryState.sessionName,
            startTime: recoveryState.startTime,
            duration: recoveryState.duration,
            isPaused: recoveryState.isPaused
          }
        });

        const shouldRecover = window.confirm(
          'A previous recording session was interrupted. Would you like to recover it?'
        );
        
        if (shouldRecover) {
          this.logger.info('User chose to recover previous session');
          this.currentSessionName = recoveryState.sessionName;
          this.recordingStartTime = recoveryState.startTime;
          this.currentDuration = recoveryState.duration;
          this._isPaused = recoveryState.isPaused;
          this.currentFileReference = recoveryState.currentFileReference;
          await this.crashRecoveryService.clearRecoveryState();
        } else {
          this.logger.info('User chose not to recover previous session');
        }
      }

      if (this._isRecording) {
        const error = new Error('Recording is already in progress');
        this.logger.error('Cannot start recording - already in progress', error, { method: 'startRecording' });
        throw error;
      }

      // Test microphone permissions first
      this.logger.debug('Testing microphone permissions');
      try {
        const permissionResult = await navigator.mediaDevices.getUserMedia({ audio: true });
        permissionResult.getTracks().forEach(track => track.stop());
        this.logger.debug('Microphone permission test successful');
      } catch (permError) {
        this.logger.error('Microphone permission denied or unavailable', permError, { method: 'startRecording' });
        throw new Error('Microphone access denied. Please grant microphone permissions and try again.');
      }

      // Get media stream with full configuration
      const audioConstraints = {
        deviceId: this.recordingOptions.inputDeviceId ? { exact: this.recordingOptions.inputDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 2,
        sampleRate: 44100
      };

      this.logger.debug('Requesting media stream', { audioConstraints });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      this.mediaStream = stream;
      this.logger.info('Media stream obtained successfully', {
        method: 'startRecording',
        streamId: stream.id,
        trackCount: stream.getAudioTracks().length
      });

      // Set up audio analysis
      try {
        this.logger.debug('Setting up audio analysis context');
        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.startAudioLevelMonitoring();
        this.logger.debug('Audio analysis setup completed');
      } catch (error) {
        this.logger.error('Audio analysis setup failed', error, { method: 'startRecording' });
        // Continue without audio analysis - not critical for recording
      }

      const options: RecordRTC.Options & { onerror?: (error: any) => void } = {
        type: 'audio',
        mimeType: this.recordingOptions.format === 'wav' 
          ? 'audio/wav' 
          : 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 44100,
        bitrate: this.recordingOptions.quality * 1000,
        timeSlice: 1000,
        ondataavailable: async (blob: Blob) => {
          try {
            if (this._isRecording && !this._isPaused) {
              if (!this.currentSessionId) {
                this.currentSessionId = crypto.randomUUID();
                this.logger.debug('Generated new session ID', { sessionId: this.currentSessionId });
              }

              const metadata: RecordingMetadata = {
                sessionName: this.currentSessionName,
                startTime: this.recordingStartTime!,
                duration: this.currentDuration,
                fileSize: blob.size,
                format: this.recordingOptions.format,
                quality: this.recordingOptions.quality
              };

              this.currentFileReference = await fileSystemService.saveAudioFile(
                this.currentSessionId,
                blob,
                metadata
              );

              this.logger.debug('Audio chunk saved', { 
                blobSize: blob.size,
                duration: this.currentDuration,
                sessionId: this.currentSessionId
              });
            }
          } catch (error) {
            this.logger.error('Failed to save audio chunk', error, { 
              method: 'ondataavailable',
              blobSize: blob.size,
              sessionId: this.currentSessionId
            });
          }
        },
        onerror: (error: any) => {
          this.logger.error('RecordRTC error occurred', error, { method: 'startRecording' });
          this.cleanup();
          throw new Error('Recording failed: ' + error.message);
        }
      };

      this.logger.debug('Creating RecordRTC instance', { options: { ...options, ondataavailable: '[Function]', onerror: '[Function]' } });
      this.recorder = new RecordRTC(stream, options);
      
      const date = new Date();
      const formattedDate = date.toISOString().split('T')[0];
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${hours}${minutes}`;
      
      this.currentSessionName = sessionName || `Session_${formattedDate}_${formattedTime}`;
      this.recordingStartTime = new Date();
      this._isRecording = true;
      this._isPaused = false;
      this.currentDuration = 0;
      this.currentSessionId = crypto.randomUUID();

      this.logger.info('Recording configuration set', {
        method: 'startRecording',
        sessionName: this.currentSessionName,
        sessionId: this.currentSessionId,
        startTime: this.recordingStartTime
      });

      await this.recorder.startRecording();
      this.startTimer();
      this.startStateSaving();

      const totalSetupTime = Date.now() - startTime;
      this.logger.info('Recording started successfully', {
        method: 'startRecording',
        sessionName: this.currentSessionName,
        sessionId: this.currentSessionId,
        setupTimeMs: totalSetupTime
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error('Failed to start recording', error, {
        method: 'startRecording',
        sessionName,
        setupTimeMs: totalTime,
        options: this.recordingOptions
      });

      this.cleanup();
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone access was denied. Please grant permission to record audio.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'OverconstrainedError') {
          throw new Error('The selected audio device does not meet the required constraints. Please try a different microphone.');
        } else {
          throw new Error(`Failed to start recording: ${error.message}`);
        }
      }
      throw error;
    }
  }

  private startAudioLevelMonitoring(): void {
    if (!this.analyser || !this.audioLevelCallback) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!this.analyser || !this.audioLevelCallback) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = average / 255; // Normalize to 0-1
      
      this.audioLevelCallback(normalizedLevel);
      this.animationFrameId = requestAnimationFrame(updateLevel);
    };

    this.animationFrameId = requestAnimationFrame(updateLevel);
  }

  private stopAudioLevelMonitoring(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  pauseRecording(): void {
    if (this.recorder && this._isRecording && !this._isPaused) {
      this.recorder.pauseRecording();
      this._isPaused = true;
      this.stopTimer();
      this.stopAudioLevelMonitoring();
    }
  }

  resumeRecording(): void {
    if (this.recorder && this._isRecording && this._isPaused) {
      this.recorder.resumeRecording();
      this._isPaused = false;
      this.startTimer();
      this.startAudioLevelMonitoring();
    }
  }

  async stopRecording(): Promise<RecordingMetadata> {
    const stopStartTime = Date.now();
    this.logger.info('Stopping recording session', { 
      method: 'stopRecording',
      sessionName: this.currentSessionName,
      sessionId: this.currentSessionId,
      duration: this.currentDuration,
      isRecording: this._isRecording,
      isPaused: this._isPaused,
      hasRecorder: !!this.recorder,
      hasMediaStream: !!this.mediaStream
    });

    // Check if we have a recorder even if the flag is wrong
    if (!this._isRecording && !this.recorder) {
      const error = new Error('No recording in progress');
      this.logger.error('Cannot stop recording - not currently recording and no recorder', error, { method: 'stopRecording' });
      throw error;
    }

    // If we have a recorder but the flag is wrong, fix the state and continue
    if (!this._isRecording && this.recorder) {
      this.logger.warn('State inconsistency detected: have recorder but _isRecording is false, correcting state', {
        method: 'stopRecording',
        hasRecorder: true,
        isRecording: this._isRecording
      });
      this._isRecording = true; // Correct the state
    }

    if (!this.recorder) {
      const error = new Error('Recorder not initialized');
      this.logger.error('Cannot stop recording - recorder not initialized', error, { method: 'stopRecording' });
      throw error;
    }

    if (this._isPaused) {
      this.logger.debug('Recording is paused, resuming before stop');
      this.resumeRecording();
    }

    return new Promise<RecordingMetadata>((resolve, reject) => {
      try {
        // Set a flag to prevent multiple stop attempts
        let stopCompleted = false;

        // Set a timeout to prevent hanging
        const timeoutId = setTimeout(() => {
          if (!stopCompleted) {
            stopCompleted = true;
            const timeoutError = new Error('Recording stop operation timed out');
            this.logger.error('Recording stop operation timed out', timeoutError, { 
              method: 'stopRecording',
              timeoutMs: 10000,
              sessionId: this.currentSessionId
            });
            this.cleanup();
            reject(timeoutError);
          }
        }, 10000); // 10 second timeout

        // First, get the current blob before stopping
        if (!this.recorder) {
          clearTimeout(timeoutId);
          const error = new Error('Recorder not initialized during stop');
          this.logger.error('Recorder became null during stop operation', error, { method: 'stopRecording' });
          this.cleanup();
          reject(error);
          return;
        }
        
        this.logger.debug('Initiating recording stop without pre-fetching blob');
        
        // Don't try to get blob before stopping - let RecordRTC handle it
        this.recorder.stopRecording(async () => {
          try {
            if (stopCompleted) {
              this.logger.warn('Stop callback called multiple times, ignoring', { method: 'stopRecording' });
              return;
            }
            stopCompleted = true;
            clearTimeout(timeoutId);

            this.logger.debug('Recording stop callback triggered, getting final blob');

            // Get the blob after stopping
            let finalBlob: Blob;
            try {
              finalBlob = this.recorder!.getBlob();
              this.logger.debug('Got final blob after stop', { size: finalBlob.size });
            } catch (blobError) {
              this.logger.error('Failed to get final blob after stop', blobError, { method: 'stopRecording' });
              // Create empty blob as fallback
              finalBlob = new Blob([], { type: 'audio/wav' });
            }

            if (!finalBlob || finalBlob.size === 0) {
              this.logger.warn('Final blob is empty or null, creating fallback blob');
              finalBlob = new Blob([], { type: 'audio/wav' });
            }

            const metadata: RecordingMetadata = {
              sessionName: this.currentSessionName,
              startTime: this.recordingStartTime!,
              duration: this.currentDuration,
              fileSize: finalBlob.size,
              format: this.recordingOptions.format,
              quality: this.recordingOptions.quality
            };

            this.logger.debug('Saving recording data', { metadata });

            // Save recording before cleanup
            if (finalBlob.size > 0) {
              await this.saveRecording(finalBlob, metadata);
            } else {
              this.logger.warn('Skipping save of empty recording blob');
            }
            this.logger.debug('Recording saved successfully');

            await this.crashRecoveryService.clearRecoveryState();
            this.logger.debug('Crash recovery state cleared');
            
            // Stop timers and monitoring before cleanup
            this.stopTimer();
            this.stopStateSaving();
            this.stopAudioLevelMonitoring();
            this.logger.debug('Timers and monitoring stopped');
            
            // Final cleanup
            this.cleanup();
            this.logger.debug('Cleanup completed');
            
            const totalStopTime = Date.now() - stopStartTime;
            this.logger.info('Recording stopped successfully', { 
              method: 'stopRecording',
              sessionName: this.currentSessionName,
              sessionId: this.currentSessionId,
              finalDuration: this.currentDuration,
              stopTimeMs: totalStopTime,
              fileSize: finalBlob.size
            });

            resolve(metadata);
          } catch (error) {
            const totalStopTime = Date.now() - stopStartTime;
            this.logger.error('Error in stopRecording callback', error, { 
              method: 'stopRecording',
              sessionId: this.currentSessionId,
              stopTimeMs: totalStopTime
            });
            this.cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      } catch (error) {
        const totalStopTime = Date.now() - stopStartTime;
        this.logger.error('Error initiating recording stop', error, { 
          method: 'stopRecording',
          sessionId: this.currentSessionId,
          stopTimeMs: totalStopTime
        });
        this.cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private startTimer(): void {
    this.recordingTimer = setInterval(() => {
      this.currentDuration += 1;
    }, 1000);
  }

  private stopTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  private checkSplitConditions(): void {
    if (!this.recordingOptions.splitInterval && !this.recordingOptions.splitSize) {
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastSplit = (currentTime - this.lastSplitTime) / 1000 / 60; // in minutes
    
    if (!this.recorder) {
      return;
    }
    
    const blob = this.recorder.getBlob();
    const currentSizeMB = blob.size / (1024 * 1024);

    if ((this.recordingOptions.splitInterval && timeSinceLastSplit >= this.recordingOptions.splitInterval) ||
        (this.recordingOptions.splitSize && currentSizeMB >= this.recordingOptions.splitSize)) {
      this.splitRecording();
      this.lastSplitTime = currentTime;
    }
  }

  private splitRecording(): void {
    if (!this.recorder) {
      console.error('Cannot split recording - recorder not initialized');
      return;
    }
    
    // Get the current recording data
    const blob = this.recorder.getBlob();
    
    // Format the date for the filename
    const date = new Date();
    const formattedDate = date.toISOString().split('T')[0];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}${minutes}`;
    
    // Get the part number with leading zeros
    const partNumber = Math.floor(this.currentDuration / (this.recordingOptions.splitInterval! * 60)) + 1;
    const formattedPartNumber = partNumber.toString().padStart(3, '0');
    
    const metadata: RecordingMetadata = {
      sessionName: `${this.currentSessionName}_${formattedDate}_${formattedTime}_part${formattedPartNumber}`,
      startTime: this.recordingStartTime!,
      duration: this.currentDuration,
      fileSize: blob.size,
      format: this.recordingOptions.format,
      quality: this.recordingOptions.quality
    };

    // Save the current recording
    this.saveRecording(blob, metadata);
    
    // Create a new recorder with the same settings
    const newRecorder = new RecordRTC(this.mediaStream!, {
      type: 'audio',
      mimeType: this.recordingOptions.format === 'wav' 
        ? 'audio/wav' 
        : 'audio/webm',
      recorderType: RecordRTC.StereoAudioRecorder,
      numberOfAudioChannels: 2,
      desiredSampRate: 44100,
      bitrate: this.recordingOptions.quality * 1000,
      timeSlice: 1000,
      ondataavailable: (blob: Blob) => {
        if (this._isRecording && !this._isPaused) {
          this.audioChunks.push(blob);
          
          // Check if we need to split based on memory management
          if (this.audioChunks.length >= this.maxChunks) {
            this.splitRecording();
          }
          
          // Periodic cleanup to prevent excessive memory usage
          if (this.audioChunks.length > this.maxChunks * 0.8) {
            // Keep only the most recent chunks to maintain continuity
            const keepChunks = Math.floor(this.maxChunks * 0.5);
            this.audioChunks = this.audioChunks.slice(-keepChunks);
          }
          
          // Check if we need to split based on time or size
          this.checkSplitConditions();
        }
      }
    } as RecordRTC.Options);

    // Start the new recorder before stopping the old one
    newRecorder.startRecording();
    
    // Stop and destroy the old recorder
    this.recorder!.stopRecording(() => {
      this.recorder!.destroy();
      this.recorder = newRecorder;
      this.audioChunks = [];
    });
  }

  private async saveRecording(blob: Blob, metadata: RecordingMetadata): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active session');
    }

    try {
      // Save the recording using FileSystemService
      const fileReference = await fileSystemService.saveAudioFile(
        this.currentSessionId,
        blob,
        metadata
      );

      // Update the current file reference
      this.currentFileReference = fileReference;

      // Save the session metadata
      const session: Session = {
        id: this.currentSessionId,
        createdAt: metadata.startTime,
        metadata: {
          sessionName: metadata.sessionName,
          duration: metadata.duration,
          format: metadata.format as 'wav' | 'mp3',
          quality: metadata.quality,
          fileSize: metadata.fileSize
        },
        filePath: fileReference.path
      };

      await sessionService.addSession(session);
    } catch (error) {
      console.error('Error saving recording:', error);
      throw new Error('Failed to save recording');
    }
  }

  public async getRecoveryState(): Promise<RecoveryState | null> {
    return this.crashRecoveryService.getRecoveryState();
  }

  public async clearRecoveryState(): Promise<void> {
    return this.crashRecoveryService.clearRecoveryState();
  }

  public async saveState(): Promise<void> {
    if (!this._isRecording || !this.recordingStartTime) return;

    const state: RecoveryState = {
      sessionName: this.currentSessionName,
      startTime: this.recordingStartTime,
      duration: this.currentDuration,
      isPaused: this._isPaused,
      currentFileReference: this.currentFileReference,
      metadata: {
        sessionName: this.currentSessionName,
        startTime: this.recordingStartTime,
        duration: this.currentDuration,
        fileSize: this.currentFileReference?.metadata.fileSize || 0,
        format: this.recordingOptions.format,
        quality: this.recordingOptions.quality
      }
    };

    await this.crashRecoveryService.saveState(state);
  }

  private startStateSaving(): void {
    if (this.stateSaveInterval) {
      clearInterval(this.stateSaveInterval);
    }
    this.stateSaveInterval = setInterval(() => {
      this.saveState();
    }, 5000); // Save state every 5 seconds
  }

  private stopStateSaving(): void {
    if (this.stateSaveInterval) {
      clearInterval(this.stateSaveInterval);
      this.stateSaveInterval = null;
    }
  }

  private cleanup(): void {
    this.logger.debug('Starting cleanup process', { method: 'cleanup' });
    
    try {
      // Stop timers and monitoring first to prevent further operations
      this.stopAudioLevelMonitoring();
      this.stopTimer();
      this.stopStateSaving();
      this.logger.debug('Timers and monitoring stopped');

      // Destroy recorder safely
      if (this.recorder) {
        try {
          this.recorder.destroy();
          this.logger.debug('Recorder destroyed successfully');
        } catch (recorderError) {
          this.logger.error('Error destroying recorder', recorderError, { method: 'cleanup' });
        }
        this.recorder = null;
      }

      // Stop media stream tracks
      if (this.mediaStream) {
        try {
          this.mediaStream.getTracks().forEach(track => {
            track.stop();
            this.logger.debug('Stopped media track', { trackId: track.id, kind: track.kind });
          });
        } catch (streamError) {
          this.logger.error('Error stopping media stream tracks', streamError, { method: 'cleanup' });
        }
        this.mediaStream = null;
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
          this.logger.debug('Audio context closed');
        } catch (contextError) {
          this.logger.error('Error closing audio context', contextError, { method: 'cleanup' });
        }
        this.audioContext = null;
      }

      // Reset all state
      this._isRecording = false;
      this._isPaused = false;
      this.recordingStartTime = null;
      this.currentDuration = 0;
      this.currentSessionId = null;
      this.currentFileReference = null;
      this.audioChunks = [];
      this.lastSplitTime = 0;
      this.analyser = null;
      
      this.logger.debug('Cleanup completed successfully');
      
    } catch (error) {
      this.logger.error('Error during cleanup', error, { method: 'cleanup' });
      // Reset critical state even if cleanup fails
      this._isRecording = false;
      this._isPaused = false;
      this.recorder = null;
      this.mediaStream = null;
      this.audioChunks = [];
    }
  }

  getCurrentDuration(): number {
    return this.currentDuration;
  }

  // For testing purposes only
  async simulateCrash(): Promise<void> {
    if (!this._isRecording) {
      throw new Error('No active recording to simulate crash for');
    }

    try {
      console.log('Simulating crash and saving state...');
      await this.saveState();
      console.log('State saved successfully');
    } catch (error) {
      console.error('Error simulating crash:', error);
      throw error;
    }
  }
} 