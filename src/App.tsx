import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import RecordingView from './components/views/RecordingView';
import SessionsView from './components/views/SessionsView';
import SettingsView from './components/views/SettingsView';

const App: React.FC = () => {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<RecordingView />} />
          <Route path="/sessions" element={<SessionsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </MainLayout>
    </Router>
  );
};

export default App; 