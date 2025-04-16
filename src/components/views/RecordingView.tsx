import React, { useState, useRef, useEffect } from 'react';
import { AudioService, RecordingOptions } from '../../services/AudioService';

interface RecordingViewProps {
  settings: RecordingOptions;
}

const RecordingView: React.FC<RecordingViewProps> = ({ settings }) => {
  const [sessionName, setSessionName] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioServiceRef = useRef<AudioService | null>(null);
  const visualizationRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize audio service with provided settings
    audioServiceRef.current = new AudioService(settings);
    audioServiceRef.current.setAudioLevelCallback(setAudioLevel);

    // Cleanup on unmount
    return () => {
      if (audioServiceRef.current?.isCurrentlyRecording()) {
        audioServiceRef.current.stopRecording();
      }
    };
  }, [settings]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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

  const startRecording = async () => {
    try {
      await audioServiceRef.current?.startRecording(sessionName);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      // TODO: Show error to user
    }
  };

  const pauseRecording = () => {
    audioServiceRef.current?.pauseRecording();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    audioServiceRef.current?.resumeRecording();
    setIsPaused(false);
  };

  const stopRecording = async () => {
    try {
      await audioServiceRef.current?.stopRecording();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      setSessionName('');
      setAudioLevel(0);
    } catch (error) {
      console.error('Error stopping recording:', error);
      // TODO: Show error to user
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      {/* Session Name Input */}
      <div className="mb-8 w-full max-w-md">
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Enter session name (optional)"
          className="w-full px-4 py-2 rounded bg-gray-800 border border-purple-700 focus:outline-none focus:border-purple-500"
          disabled={isRecording}
        />
      </div>

      {/* Timer Display */}
      <div className="text-4xl font-mono mb-8">
        {formatTime(recordingTime)}
      </div>

      {/* Recording Controls */}
      <div className="flex space-x-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white font-bold"
          >
            Start Recording
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-full text-white font-bold"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-full text-white font-bold"
              >
                Pause
              </button>
            )}
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-full text-white font-bold"
            >
              Stop
            </button>
          </>
        )}
      </div>

      {/* Audio Visualization */}
      <div className="mt-8 w-full max-w-md">
        <div className="relative h-32 bg-gray-800 rounded-lg overflow-hidden">
          <canvas
            ref={visualizationRef}
            className="w-full h-full"
            width={800}
            height={128}
          />
          {/* Audio level indicator lines */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-0 right-0 h-px bg-gray-700 opacity-50"></div>
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-700 opacity-50"></div>
            <div className="absolute top-3/4 left-0 right-0 h-px bg-gray-700 opacity-50"></div>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-400 text-center">
          {isRecording ? 'Audio Level' : 'Ready to Record'}
        </div>
      </div>
    </div>
  );
};

export default RecordingView; 