import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { AudioService, RecordingOptions } from '../../services/AudioService';
import { formatTime } from '../../utils/timeUtils';
import Validator from '../../utils/validation';
import { createComponentLogger } from '../../utils/logger';

// Lazy load the RecoveryDialog
const RecoveryDialog = lazy(() => import('../dialogs/RecoveryDialog'));

interface RecordingViewProps {
  onRecordingComplete: (metadata: any) => void;
  settings: RecordingOptions;
}

const RecordingView: React.FC<RecordingViewProps> = ({ onRecordingComplete, settings }) => {
  const logger = createComponentLogger('RecordingView');
  const [sessionName, setSessionName] = useState('');
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noAudioWarning, setNoAudioWarning] = useState(false);
  const audioServiceRef = useRef<AudioService | null>(null);
  const visualizationRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const noAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioTimeRef = useRef<number>(0);
  const audioLevelHistoryRef = useRef<number[]>([]);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryState, setRecoveryState] = useState<any>(null);

  useEffect(() => {
    // Reset and initialize audio service with provided settings
    AudioService.resetInstance();
    audioServiceRef.current = AudioService.getInstance(settings);
    audioServiceRef.current.setAudioLevelCallback(setAudioLevel);

    // Handle crash recovery messages
    if (window.electron) {
      window.electron.ipcRenderer.on('save-state-before-crash', () => {
        console.log('Received save-state-before-crash message');
        if (audioServiceRef.current?.isRecording()) {
          console.log('Attempting to save state before crash');
          audioServiceRef.current.saveState();
        }
      });
    }

    // Check for recovery state on mount
    const checkRecoveryState = async () => {
      try {
        const state = await audioServiceRef.current?.getRecoveryState();
        if (state) {
          console.log('Found recovery state:', state);
          setRecoveryState(state);
          setShowRecoveryDialog(true);
        }
      } catch (error) {
        console.error('Error checking recovery state:', error);
      }
    };
    checkRecoveryState();

    // Cleanup on unmount
    return () => {
      if (audioServiceRef.current?.isRecording()) {
        audioServiceRef.current.stopRecording();
      }
      if (noAudioTimeoutRef.current) {
        clearTimeout(noAudioTimeoutRef.current);
      }
      if (window.electron) {
        window.electron.ipcRenderer.removeAllListeners('save-state-before-crash');
      }
      AudioService.resetInstance();
    };
  }, [settings]);

  // Add effect to notify main process of recording status
  useEffect(() => {
    if (window.electron) {
      window.electron.ipcRenderer.send('recording-status', isRecording);
    }
  }, [isRecording]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording, isPaused]);

  useEffect(() => {
    const canvas = visualizationRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up the visualization style with fantasy-inspired colors
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#3A1078'); // Deep purple
    gradient.addColorStop(0.5, '#FFD700'); // Gold
    gradient.addColorStop(1, '#3A1078'); // Deep purple

    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#FFD700'; // Gold border
    ctx.lineWidth = 2;

    // Draw the audio level bar with a fantasy-inspired shape
    const barWidth = canvas.width;
    const barHeight = canvas.height * audioLevel;
    const y = canvas.height - barHeight;

    // Add a subtle pattern to the bar
    ctx.fillRect(0, y, barWidth, barHeight);
    ctx.strokeRect(0, y, barWidth, barHeight);

    // Add decorative elements
    const patternSize = 20;
    for (let i = 0; i < barWidth; i += patternSize) {
      ctx.beginPath();
      ctx.moveTo(i, y);
      ctx.lineTo(i + patternSize/2, y + patternSize/2);
      ctx.lineTo(i + patternSize, y);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [audioLevel]);

  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = visualizationRef.current;
      if (!canvas || !containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      canvas.width = containerWidth;
      canvas.height = 128;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    // Update audio level history
    if (isRecording && !isPaused) {
      audioLevelHistoryRef.current.push(audioLevel);
      if (audioLevelHistoryRef.current.length > 100) { // Keep last 100 samples
        audioLevelHistoryRef.current.shift();
      }

      // Calculate average level from history
      const avgLevel = audioLevelHistoryRef.current.reduce((a, b) => a + b, 0) / audioLevelHistoryRef.current.length;
      const threshold = Math.max(0.005, avgLevel * 0.1); // Dynamic threshold based on average level

      if (audioLevel < threshold) {
        if (!noAudioTimeoutRef.current) {
          noAudioTimeoutRef.current = setTimeout(() => {
            setNoAudioWarning(true);
          }, 5000); // Show warning after 5 seconds of no audio
        }
      } else {
        if (noAudioTimeoutRef.current) {
          clearTimeout(noAudioTimeoutRef.current);
          noAudioTimeoutRef.current = null;
        }
        setNoAudioWarning(false);
        lastAudioTimeRef.current = Date.now();
      }
    } else {
      if (noAudioTimeoutRef.current) {
        clearTimeout(noAudioTimeoutRef.current);
        noAudioTimeoutRef.current = null;
      }
      setNoAudioWarning(false);
      audioLevelHistoryRef.current = [];
    }
  }, [audioLevel, isRecording, isPaused]);

  const startRecording = async () => {
    const startTime = Date.now();
    logger.info('User initiated recording start', { 
      method: 'startRecording',
      sessionName,
      settings
    });

    try {
      setIsLoading(true);
      setError(null);
      
      // Validate session name
      const validation = Validator.validateSessionName(sessionName);
      if (!validation.isValid) {
        logger.warn('Session name validation failed', { 
          method: 'startRecording',
          sessionName,
          errors: validation.errors 
        });
        setError(validation.errors.join(', '));
        return;
      }
      
      // Sanitize session name
      const sanitizedName = Validator.sanitizeFileName(sessionName) || 'Untitled Session';
      logger.debug('Session name sanitized', { 
        original: sessionName,
        sanitized: sanitizedName 
      });
      
      await audioServiceRef.current?.startRecording(sanitizedName);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      const totalTime = Date.now() - startTime;
      logger.info('Recording started successfully', { 
        method: 'startRecording',
        sessionName: sanitizedName,
        startupTimeMs: totalTime 
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error('Failed to start recording', error, { 
        method: 'startRecording',
        sessionName,
        startupTimeMs: totalTime,
        settings
      });

      setIsRecording(false);
      setError(
        error instanceof Error 
          ? error.message 
          : 'Failed to start recording. Please check microphone permissions.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const pauseRecording = () => {
    logger.info('User initiated recording pause', { 
      method: 'pauseRecording',
      currentDuration: duration
    });

    try {
      audioServiceRef.current?.pauseRecording();
      setIsPaused(true);
      logger.debug('Recording paused successfully');
    } catch (error) {
      logger.error('Failed to pause recording', error, { method: 'pauseRecording' });
      setError('Failed to pause recording');
    }
  };

  const resumeRecording = () => {
    logger.info('User initiated recording resume', { 
      method: 'resumeRecording',
      currentDuration: duration
    });

    try {
      setError(null);
      audioServiceRef.current?.resumeRecording();
      setIsPaused(false);
      logger.debug('Recording resumed successfully');
    } catch (error) {
      logger.error('Failed to resume recording', error, { method: 'resumeRecording' });
      setError('Failed to resume recording');
    }
  };

  const stopRecording = async () => {
    const stopTime = Date.now();
    logger.info('User initiated recording stop', { 
      method: 'stopRecording',
      finalDuration: duration,
      sessionName
    });

    try {
      setIsLoading(true);
      setError(null);
      
      let metadata;
      try {
        metadata = await audioServiceRef.current?.stopRecording();
      } catch (stopError) {
        logger.warn('Regular stop failed, attempting force stop', stopError, { method: 'stopRecording' });
        
        // Try force stop if regular stop fails
        metadata = await audioServiceRef.current?.forceStop();
        
        if (!metadata) {
          logger.warn('Force stop returned null metadata, creating fallback metadata');
          metadata = {
            sessionName: sessionName || 'Emergency Stop',
            startTime: new Date(Date.now() - duration * 1000),
            duration: duration,
            fileSize: 0,
            format: 'unknown',
            quality: 0
          };
        }
      }

      onRecordingComplete(metadata);
      
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setSessionName('');
      setAudioLevel(0);

      const totalTime = Date.now() - stopTime;
      logger.info('Recording stopped successfully', { 
        method: 'stopRecording',
        metadata,
        stopTimeMs: totalTime
      });

    } catch (error) {
      const totalTime = Date.now() - stopTime;
      logger.error('Failed to stop recording even with force stop', error, { 
        method: 'stopRecording',
        duration,
        sessionName,
        stopTimeMs: totalTime
      });
      
      // Emergency UI reset if everything fails
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setSessionName('');
      setAudioLevel(0);
      
      setError('Recording was forcibly stopped due to an error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecover = async () => {
    logger.info('User chose to recover interrupted recording', { 
      method: 'handleRecover',
      recoveryState 
    });

    try {
      if (recoveryState) {
        await audioServiceRef.current?.startRecording(recoveryState.sessionName);
        setShowRecoveryDialog(false);
        setRecoveryState(null);
        logger.info('Recording recovery completed successfully');
      }
    } catch (error) {
      logger.error('Failed to recover recording', error, { 
        method: 'handleRecover',
        recoveryState 
      });
      setError('Failed to recover recording');
    }
  };

  const handleDiscard = async () => {
    logger.info('User chose to discard recovery state', { 
      method: 'handleDiscard',
      recoveryState 
    });

    try {
      await audioServiceRef.current?.clearRecoveryState();
      setShowRecoveryDialog(false);
      setRecoveryState(null);
      logger.info('Recovery state discarded successfully');
    } catch (error) {
      logger.error('Failed to discard recovery state', error, { method: 'handleDiscard' });
      setError('Failed to discard recovery state');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-6">
      {showRecoveryDialog && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>}>
          <RecoveryDialog
            sessionName={recoveryState?.sessionName || ''}
            duration={recoveryState?.duration || 0}
            onRecover={handleRecover}
            onDiscard={handleDiscard}
          />
        </Suspense>
      )}
      <div className="w-full max-w-2xl space-y-8">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-[#1C1C1C] border border-[#F44336]/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* No Audio Warning */}
        {noAudioWarning && (
          <div className="p-4 bg-[#1C1C1C] border border-[#FFC107]/50 rounded-lg text-amber-200">
            Warning: No audio input detected for the last 5 seconds. Please check your microphone connection and settings.
          </div>
        )}

        {/* Session Name Input */}
        <div className="mb-8 w-full max-w-md">
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Enter session name (optional)"
            className="w-full px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#3A1078]/30 focus:outline-none focus:border-[#FFD700]/50 text-white placeholder-gray-400"
            disabled={isRecording || isLoading}
          />
        </div>

        {/* Timer Display */}
        <div className="text-4xl font-mono mb-8 text-[#FFD700]">
          {formatTime(duration)}
        </div>

        {/* Recording Controls */}
        <div className="flex space-x-4 mb-8">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isLoading}
              className="px-6 py-3 bg-[#3A1078] hover:bg-[#3A1078]/90 rounded-lg text-[#FFD700] font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Starting...' : 'Start Recording'}
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={resumeRecording}
                  disabled={isLoading}
                  className="px-6 py-3 bg-[#4CAF50] hover:bg-[#4CAF50]/90 rounded-lg text-white font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  disabled={isLoading}
                  className="px-6 py-3 bg-[#FFC107] hover:bg-[#FFC107]/90 rounded-lg text-[#1C1C1C] font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pause
                </button>
              )}
              <button
                onClick={stopRecording}
                disabled={isLoading}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Stopping...' : 'Stop'}
              </button>
            </>
          )}
        </div>

        {/* Audio Visualization */}
        <div ref={containerRef} className="w-full max-w-2xl">
          <div className="relative h-32 bg-[#1C1C1C] rounded-lg overflow-hidden border border-[#3A1078]/20">
            <canvas
              ref={visualizationRef}
              className="w-full h-full"
            />
            {/* Audio level indicator lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-0 right-0 h-px bg-[#FFD700]/30"></div>
              <div className="absolute top-1/2 left-0 right-0 h-px bg-[#FFD700]/30"></div>
              <div className="absolute top-3/4 left-0 right-0 h-px bg-[#FFD700]/30"></div>
            </div>
          </div>
          <div className="mt-2 text-sm text-[#FFD700]/80 text-center">
            {isRecording ? 'Audio Level' : 'Ready to Record'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordingView; 