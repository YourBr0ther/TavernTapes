import React, { useState, useRef, useEffect } from 'react';
import { AudioService, RecordingOptions } from '../../services/AudioService';
import { formatTime } from '../../utils/timeUtils';

interface RecordingViewProps {
  onRecordingComplete: (metadata: any) => void;
  settings: RecordingOptions;
}

const RecordingView: React.FC<RecordingViewProps> = ({ onRecordingComplete, settings }) => {
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

  useEffect(() => {
    // Initialize audio service with provided settings
    audioServiceRef.current = new AudioService(settings);
    audioServiceRef.current.setAudioLevelCallback(setAudioLevel);

    // Cleanup on unmount
    return () => {
      if (audioServiceRef.current?.isCurrentlyRecording()) {
        audioServiceRef.current.stopRecording();
      }
      if (noAudioTimeoutRef.current) {
        clearTimeout(noAudioTimeoutRef.current);
      }
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

    // Set up the visualization style
    ctx.fillStyle = '#4CAF50'; // Green color for the visualization
    ctx.strokeStyle = '#2E7D32'; // Darker green for the border
    ctx.lineWidth = 2;

    // Draw the audio level bar
    const barWidth = canvas.width;
    const barHeight = canvas.height * audioLevel;
    const y = canvas.height - barHeight;

    ctx.fillRect(0, y, barWidth, barHeight);
    ctx.strokeRect(0, y, barWidth, barHeight);

    // Add a subtle gradient effect
    const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(76, 175, 80, 0.8)');
    gradient.addColorStop(1, 'rgba(76, 175, 80, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, barWidth, barHeight);
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
    try {
      setIsLoading(true);
      setError(null);
      await audioServiceRef.current?.startRecording(sessionName);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
    } catch (error) {
      console.error('Error starting recording:', error);
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
    try {
      audioServiceRef.current?.pauseRecording();
      setIsPaused(true);
    } catch (error) {
      console.error('Error pausing recording:', error);
      setError('Failed to pause recording');
    }
  };

  const resumeRecording = () => {
    try {
      setError(null);
      audioServiceRef.current?.resumeRecording();
      setIsPaused(false);
    } catch (error) {
      console.error('Error resuming recording:', error);
      setError('Failed to resume recording');
    }
  };

  const stopRecording = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const metadata = await audioServiceRef.current?.stopRecording();
      onRecordingComplete(metadata);
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setSessionName('');
      setAudioLevel(0);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError('Failed to stop recording');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-[#1C1C1C] border border-red-700/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* No Audio Warning */}
        {noAudioWarning && (
          <div className="p-4 bg-[#1C1C1C] border border-amber-700/50 rounded-lg text-amber-200">
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
        <div className="text-4xl font-mono mb-8 text-white">
          {formatTime(duration)}
        </div>

        {/* Recording Controls */}
        <div className="flex space-x-4 mb-8">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isLoading}
              className="px-6 py-3 bg-[#3A1078] hover:bg-[#3A1078]/90 rounded-lg text-white font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-6 py-3 bg-[#FFC107] hover:bg-[#FFC107]/90 rounded-lg text-white font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="absolute top-1/4 left-0 right-0 h-px bg-[#3A1078]/30"></div>
              <div className="absolute top-1/2 left-0 right-0 h-px bg-[#3A1078]/30"></div>
              <div className="absolute top-3/4 left-0 right-0 h-px bg-[#3A1078]/30"></div>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-400 text-center">
            {isRecording ? 'Audio Level' : 'Ready to Record'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordingView; 