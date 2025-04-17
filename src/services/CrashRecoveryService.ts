import { RecordingMetadata } from './AudioService';

interface RecoveryState {
  sessionName: string;
  startTime: Date;
  duration: number;
  isPaused: boolean;
  audioChunks: string[]; // Base64 encoded audio chunks
  metadata: RecordingMetadata;
}

export class CrashRecoveryService {
  private readonly RECOVERY_KEY = 'tavernTapes_recovery';
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private recoveryAttempts: number = 0;

  constructor() {
    // Clean up any stale recovery data on startup
    this.cleanupStaleRecovery();
  }

  private cleanupStaleRecovery() {
    const recoveryData = localStorage.getItem(this.RECOVERY_KEY);
    if (recoveryData) {
      try {
        const state = JSON.parse(recoveryData);
        // If recovery data is more than 24 hours old, remove it
        if (Date.now() - new Date(state.startTime).getTime() > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(this.RECOVERY_KEY);
        }
      } catch (error) {
        console.error('Error cleaning up stale recovery data:', error);
        localStorage.removeItem(this.RECOVERY_KEY);
      }
    }
  }

  async saveState(state: RecoveryState): Promise<void> {
    try {
      // Convert audio chunks to base64 for storage
      const serializedState = {
        ...state,
        audioChunks: state.audioChunks.map(chunk => btoa(chunk))
      };
      localStorage.setItem(this.RECOVERY_KEY, JSON.stringify(serializedState));
    } catch (error) {
      console.error('Error saving recovery state:', error);
      throw new Error('Failed to save recovery state');
    }
  }

  async getRecoveryState(): Promise<RecoveryState | null> {
    try {
      const recoveryData = localStorage.getItem(this.RECOVERY_KEY);
      if (!recoveryData) return null;

      const state = JSON.parse(recoveryData);
      // Convert base64 audio chunks back to strings
      return {
        ...state,
        audioChunks: state.audioChunks.map((chunk: string) => atob(chunk)),
        startTime: new Date(state.startTime)
      };
    } catch (error) {
      console.error('Error getting recovery state:', error);
      return null;
    }
  }

  async clearRecoveryState(): Promise<void> {
    try {
      localStorage.removeItem(this.RECOVERY_KEY);
    } catch (error) {
      console.error('Error clearing recovery state:', error);
    }
  }

  incrementRecoveryAttempts(): boolean {
    this.recoveryAttempts++;
    return this.recoveryAttempts <= this.MAX_RECOVERY_ATTEMPTS;
  }

  resetRecoveryAttempts(): void {
    this.recoveryAttempts = 0;
  }
} 