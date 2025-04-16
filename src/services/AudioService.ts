import RecordRTC from 'recordrtc';

export interface RecordingOptions {
  format: 'wav' | 'mp3';
  quality: number;
  splitInterval?: number; // in minutes
  splitSize?: number; // in MB
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

  constructor(options: RecordingOptions) {
    this.recordingOptions = options;
  }

  async startRecording(sessionName: string = ''): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.mediaStream = stream;

      // Set up audio analysis
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.startAudioLevelMonitoring();

      const options = {
        type: 'audio',
        mimeType: this.recordingOptions.format === 'wav' 
          ? 'audio/wav' 
          : 'audio/mp3',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 44100,
        bitrate: this.recordingOptions.quality * 1000
      };

      this.recorder = new RecordRTC(stream, options);
      this.audioChunks = [];
      this.currentSessionName = sessionName || `Session_${new Date().toISOString()}`;
      this.recordingStartTime = new Date();
      this.isRecording = true;
      this.isPaused = false;
      this.currentDuration = 0;

      this.recorder.startRecording();
      this.startTimer();

      // Set up data collection for file splitting
      setInterval(() => {
        if (this.isRecording && !this.isPaused) {
          this.recorder?.getInternalRecorder().requestData();
          this.checkSplitConditions();
        }
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
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

    const blob = this.recorder!.getBlob();
    const currentSizeMB = blob.size / (1024 * 1024);
    const currentDurationMinutes = this.currentDuration / 60;

    if ((this.recordingOptions.splitInterval && currentDurationMinutes >= this.recordingOptions.splitInterval) ||
        (this.recordingOptions.splitSize && currentSizeMB >= this.recordingOptions.splitSize)) {
      this.splitRecording();
    }
  }

  private splitRecording(): void {
    const blob = this.recorder!.getBlob();
    
    const metadata: RecordingMetadata = {
      sessionName: `${this.currentSessionName}_part${Math.floor(this.currentDuration / (this.recordingOptions.splitInterval! * 60)) + 1}`,
      startTime: this.recordingStartTime!,
      duration: this.currentDuration,
      fileSize: blob.size,
      format: this.recordingOptions.format,
      quality: this.recordingOptions.quality
    };

    this.saveRecording(blob, metadata);
    
    // Reset the recorder to start a new segment
    this.recorder!.reset();
    this.recorder!.startRecording();
  }

  private saveRecording(blob: Blob, metadata: RecordingMetadata): void {
    // TODO: Implement proper file saving with metadata
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.sessionName}.${metadata.format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private cleanup(): void {
    if (this.recorder) {
      this.recorder.destroy();
      this.recorder = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.audioChunks = [];
    this.recordingStartTime = null;
    this.currentSessionName = '';
    this.currentDuration = 0;
    this.stopAudioLevelMonitoring();
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
} 