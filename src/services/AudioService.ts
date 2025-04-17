import RecordRTC from 'recordrtc';
import sessionService from './SessionService';
import { CrashRecoveryService } from './CrashRecoveryService';
import fileSystemService, { FileReference } from './FileSystemService';

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
  private static instance: AudioService;
  private recorder: RecordRTC | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartTime: Date | null = null;
  private recordingOptions: RecordingOptions;
  private currentSessionName: string = '';
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private recordingTimer: NodeJS.Timeout | null = null;
  private currentDuration: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private animationFrameId: number | null = null;
  private mediaStream: MediaStream | null = null;
  private maxChunks: number = 100; // Maximum number of chunks to keep in memory
  private chunkSize: number = 1024 * 1024; // 1MB chunks
  private lastSplitTime: number = 0;
  private crashRecoveryService: CrashRecoveryService;
  private stateSaveInterval: NodeJS.Timeout | null = null;
  private currentSessionId: string | null = null;
  private currentFileReference: FileReference | null = null;

  private constructor(options: RecordingOptions) {
    this.recordingOptions = options;
    this.crashRecoveryService = CrashRecoveryService.getInstance();
  }

  public static getInstance(options: RecordingOptions): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService(options);
    }
    return AudioService.instance;
  }

  // Add method to get available input devices
  static async getInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting input devices:', error);
      return [];
    }
  }

  async startRecording(sessionName: string = ''): Promise<void> {
    try {
      const recoveryState = await this.crashRecoveryService.getRecoveryState();
      if (recoveryState) {
        const shouldRecover = window.confirm(
          'A previous recording session was interrupted. Would you like to recover it?'
        );
        
        if (shouldRecover) {
          this.currentSessionName = recoveryState.sessionName;
          this.recordingStartTime = recoveryState.startTime;
          this.currentDuration = recoveryState.duration;
          this.isPaused = recoveryState.isPaused;
          this.currentFileReference = recoveryState.currentFileReference;
          await this.crashRecoveryService.clearRecoveryState();
        }
      }

      if (this.isRecording) {
        throw new Error('Recording is already in progress');
      }

      const permissionResult = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionResult.getTracks().forEach(track => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: this.recordingOptions.inputDeviceId ? { exact: this.recordingOptions.inputDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 44100
        }
      });

      this.mediaStream = stream;

      try {
        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.startAudioLevelMonitoring();
      } catch (error) {
        console.error('Audio analysis setup failed:', error);
      }

      const options = {
        type: 'audio',
        mimeType: this.recordingOptions.format === 'wav' 
          ? 'audio/wav' 
          : 'audio/mp3',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 44100,
        bitrate: this.recordingOptions.quality * 1000,
        timeSlice: 1000,
        ondataavailable: async (blob: Blob) => {
          if (this.isRecording && !this.isPaused) {
            if (!this.currentSessionId) {
              this.currentSessionId = crypto.randomUUID();
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
          }
        },
        onerror: (error: any) => {
          console.error('RecordRTC error:', error);
          this.cleanup();
          throw new Error('Recording failed: ' + error);
        }
      };

      this.recorder = new RecordRTC(stream, options);
      
      const date = new Date();
      const formattedDate = date.toISOString().split('T')[0];
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${hours}${minutes}`;
      
      this.currentSessionName = sessionName || `Session_${formattedDate}_${formattedTime}`;
      this.recordingStartTime = new Date();
      this.isRecording = true;
      this.isPaused = false;
      this.currentDuration = 0;
      this.currentSessionId = crypto.randomUUID();

      await this.recorder.startRecording();
      this.startTimer();
      this.startStateSaving();
    } catch (error) {
      this.cleanup();
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone access was denied. Please grant permission to record audio.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else {
          throw new Error(`Failed to start recording: ${error.message}`);
        }
      }
      throw error;
    }
  }

  setAudioLevelCallback(callback: AudioLevelCallback): void {
    this.audioLevelCallback = callback;
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
    if (this.recorder && this.isRecording && !this.isPaused) {
      this.recorder.pauseRecording();
      this.isPaused = true;
      this.stopTimer();
      this.stopAudioLevelMonitoring();
    }
  }

  resumeRecording(): void {
    if (this.recorder && this.isRecording && this.isPaused) {
      this.recorder.resumeRecording();
      this.isPaused = false;
      this.startTimer();
      this.startAudioLevelMonitoring();
    }
  }

  async stopRecording(): Promise<RecordingMetadata> {
    if (!this.recorder || !this.isRecording) {
      throw new Error('No active recording to stop');
    }

    return new Promise((resolve) => {
      this.recorder!.stopRecording(() => {
        this.stopTimer();
        this.stopAudioLevelMonitoring();
        this.isRecording = false;
        this.isPaused = false;

        const blob = this.recorder!.getBlob();
        const metadata: RecordingMetadata = {
          sessionName: this.currentSessionName,
          startTime: this.recordingStartTime!,
          duration: this.currentDuration,
          fileSize: blob.size,
          format: this.recordingOptions.format,
          quality: this.recordingOptions.quality
        };

        this.saveRecording(blob, metadata);
        this.cleanup();
        this.stopStateSaving();
        await this.crashRecoveryService.clearRecoveryState();
        resolve(metadata);
      });
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
    const blob = this.recorder!.getBlob();
    const currentSizeMB = blob.size / (1024 * 1024);

    if ((this.recordingOptions.splitInterval && timeSinceLastSplit >= this.recordingOptions.splitInterval) ||
        (this.recordingOptions.splitSize && currentSizeMB >= this.recordingOptions.splitSize)) {
      this.splitRecording();
      this.lastSplitTime = currentTime;
    }
  }

  private splitRecording(): void {
    // Get the current recording data
    const blob = this.recorder!.getBlob();
    
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
        : 'audio/mp3',
      recorderType: RecordRTC.StereoAudioRecorder,
      numberOfAudioChannels: 2,
      desiredSampRate: 44100,
      bitrate: this.recordingOptions.quality * 1000,
      timeSlice: 1000,
      ondataavailable: (blob: Blob) => {
        if (this.isRecording && !this.isPaused) {
          this.audioChunks.push(blob);
          
          // Check if we need to split based on memory management
          if (this.audioChunks.length >= this.maxChunks) {
            this.splitRecording();
          }
          
          // Check if we need to split based on time or size
          this.checkSplitConditions();
        }
      },
      onerror: (error: any) => {
        console.error('RecordRTC error:', error);
        this.cleanup();
        throw new Error('Recording failed: ' + error);
      }
    });

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
        name: metadata.sessionName,
        startTime: metadata.startTime,
        duration: metadata.duration,
        fileSize: metadata.fileSize,
        format: metadata.format,
        quality: metadata.quality
      };

      await sessionService.addSession(session);
    } catch (error) {
      console.error('Error saving recording:', error);
      throw new Error('Failed to save recording');
    }
  }

  private async saveState(): Promise<void> {
    if (!this.isRecording) return;

    const state = {
      sessionName: this.currentSessionName,
      startTime: this.recordingStartTime,
      duration: this.currentDuration,
      isPaused: this.isPaused,
      currentFileReference: this.currentFileReference,
      metadata: {
        sessionName: this.currentSessionName,
        startTime: this.recordingStartTime!,
        duration: this.currentDuration,
        fileSize: this.currentFileReference?.size || 0,
        format: this.recordingOptions.format,
        quality: this.recordingOptions.quality
      }
    };

    await this.crashRecoveryService.saveState(state);
  }

  private startStateSaving(): void {
    // Save state every 30 seconds
    this.stateSaveInterval = setInterval(() => {
      this.saveState();
    }, 30000);
  }

  private stopStateSaving(): void {
    if (this.stateSaveInterval) {
      clearInterval(this.stateSaveInterval);
      this.stateSaveInterval = null;
    }
  }

  private cleanup(): void {
    this.stopTimer();
    this.stopAudioLevelMonitoring();
    this.stopStateSaving();
    
    if (this.recorder) {
      this.recorder.stopRecording();
      this.recorder = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    this.isRecording = false;
    this.isPaused = false;
    this.currentDuration = 0;
    this.currentSessionId = null;
    this.currentFileReference = null;
  }

  getCurrentDuration(): number {
    return this.currentDuration;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  // For testing purposes only
  async simulateCrash(): Promise<void> {
    if (!this.isRecording) {
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