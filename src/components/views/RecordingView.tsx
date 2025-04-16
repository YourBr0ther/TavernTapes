import React, { useState, useRef } from 'react';

const RecordingView: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionName, setSessionName] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsPaused(false);
      
      // Save the recording
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `${sessionName || 'recording'}_${new Date().toISOString()}.wav`;
      a.click();
    }
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
        />
      </div>

      {/* Timer Display */}
      <div className="text-4xl font-mono mb-8">
        {new Date(recordingTime * 1000).toISOString().substr(11, 8)}
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
      <div className="mt-8 w-full max-w-2xl h-32 bg-gray-800 rounded-lg">
        {/* Audio visualization will be added here */}
      </div>
    </div>
  );
};

export default RecordingView; 