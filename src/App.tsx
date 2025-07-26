import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import { RecordingOptions } from './services/AudioService';
import settingsService from './services/SettingsService';
import fileSystemService from './services/FileSystemService';
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
  const [recordingSettings] = useState<RecordingOptions>({
    format: 'wav',
    quality: 128,
    splitInterval: 30,
    splitSize: 500
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load settings and initialize storage location
        const savedSettings = await settingsService.getSettings();
        setSettings(savedSettings);
        
        // If we have a storage location, set it in the FileSystemService
        if (savedSettings.storageLocation) {
          await fileSystemService.setBaseDirectory(savedSettings.storageLocation);
        } else {
          // If no storage location is set, create a default one in the user's documents folder
          const defaultPath = 'TavernTapes_Recordings';
          await fileSystemService.setBaseDirectory(defaultPath);
          await settingsService.updateSettings({ storageLocation: defaultPath });
          savedSettings.storageLocation = defaultPath;
          setSettings(savedSettings);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitialized(true); // Still set initialized to true so the app can load
      }
    };

    initializeApp();
  }, []);


  const handleRecordingComplete = (metadata: any) => {
    // Handle recording completion
    console.log('Recording completed:', metadata);
  };

  if (!isInitialized || !settings) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <MainLayout>
          <Suspense fallback={<LoadingSpinner />}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<RecordingView settings={recordingSettings} onRecordingComplete={handleRecordingComplete} />} />
                <Route path="/sessions" element={<SessionsView />} />
                <Route 
                  path="/settings" 
                  element={<SettingsView />} 
                />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </MainLayout>
      </Router>
    </ErrorBoundary>
  );
};

export default App; 