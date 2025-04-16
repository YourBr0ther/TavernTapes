import React from 'react';

const SettingsView: React.FC = () => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      
      <div className="space-y-6">
        {/* Audio Settings */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Audio Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Audio Format</label>
              <select className="input-primary w-full">
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quality</label>
              <select className="input-primary w-full">
                <option value="high">High (320kbps)</option>
                <option value="medium">Medium (192kbps)</option>
                <option value="low">Low (128kbps)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Storage Settings */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Storage Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Save Location</label>
              <div className="flex space-x-2">
                <input type="text" className="input-primary flex-1" value="C:\Recordings" readOnly />
                <button className="btn-primary">Browse</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auto-split Recording</label>
              <select className="input-primary w-full">
                <option value="none">Don't split</option>
                <option value="1h">Every hour</option>
                <option value="2h">Every 2 hours</option>
                <option value="4h">Every 4 hours</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Theme</label>
              <select className="input-primary w-full">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView; 