import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import { RecordingOptions } from './services/AudioService';
import settingsService from './services/SettingsService';
import { Settings } from './services/SettingsService';

// Lazy load the view components
const RecordingView = lazy(() => import('./components/views/RecordingView'));
const SessionsView = lazy(() => import('./components/views/SessionsView'));
const SettingsView = lazy(() => import('./components/views/SettingsView'));

// Loading component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const App: React.FC = () => {
  const [recordingSettings, setRecordingSettings] = useState<RecordingOptions>({
    format: 'wav',
    quality: 128,
    splitInterval: 30,
    splitSize: 500
  });
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await settingsService.getSettings();
        setSettings(savedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        // Use default settings if loading fails
        setSettings(settingsService.defaultSettings);
      }
    };

    loadSettings();
  }, []);

  const handleSettingsChange = (settings: RecordingOptions) => {
    setRecordingSettings(settings);
  };

  if (!settings) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <MainLayout>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<RecordingView settings={recordingSettings} />} />
            <Route path="/sessions" element={<SessionsView />} />
            <Route 
              path="/settings" 
              element={<SettingsView onSettingsChange={handleSettingsChange} />} 
            />
          </Routes>
        </Suspense>
      </MainLayout>
    </Router>
  );
};

export default App; 