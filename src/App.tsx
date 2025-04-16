import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import RecordingView from './components/views/RecordingView';
import SessionsView from './components/views/SessionsView';
import SettingsView from './components/views/SettingsView';
import { RecordingOptions } from './services/AudioService';

const App: React.FC = () => {
  const [recordingSettings, setRecordingSettings] = useState<RecordingOptions>({
    format: 'wav',
    quality: 128,
    splitInterval: 30,
    splitSize: 500
  });

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('tavernTapesSettings');
    if (savedSettings) {
      setRecordingSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSettingsChange = (settings: RecordingOptions) => {
    setRecordingSettings(settings);
  };

  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<RecordingView settings={recordingSettings} />} />
          <Route path="/sessions" element={<SessionsView />} />
          <Route 
            path="/settings" 
            element={<SettingsView onSettingsChange={handleSettingsChange} />} 
          />
        </Routes>
      </MainLayout>
    </Router>
  );
};

export default App; 