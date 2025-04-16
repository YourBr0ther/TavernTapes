import React, { useState, useEffect } from 'react';
import { RecordingOptions } from '../../services/AudioService';

interface SettingsViewProps {
  onSettingsChange?: (settings: RecordingOptions) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<RecordingOptions>({
    format: 'wav',
    quality: 128,
    splitInterval: 30,
    splitSize: 500
  });

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('tavernTapesSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSettingChange = (key: keyof RecordingOptions, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('tavernTapesSettings', JSON.stringify(newSettings));
    onSettingsChange?.(newSettings);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      
      <div className="space-y-6">
        {/* Audio Format */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Audio Format</label>
          <select
            value={settings.format}
            onChange={(e) => handleSettingChange('format', e.target.value)}
            className="w-full px-4 py-2 rounded bg-gray-800 border border-purple-700 focus:outline-none focus:border-purple-500"
          >
            <option value="wav">WAV (Uncompressed)</option>
            <option value="mp3">MP3 (Compressed)</option>
          </select>
        </div>

        {/* Audio Quality */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Audio Quality ({settings.quality} kbps)
          </label>
          <input
            type="range"
            min="64"
            max="320"
            step="32"
            value={settings.quality}
            onChange={(e) => handleSettingChange('quality', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>64 kbps</span>
            <span>320 kbps</span>
          </div>
        </div>

        {/* Split Interval */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Split Recording Every (minutes)
          </label>
          <input
            type="number"
            min="0"
            max="120"
            value={settings.splitInterval}
            onChange={(e) => handleSettingChange('splitInterval', parseInt(e.target.value))}
            className="w-full px-4 py-2 rounded bg-gray-800 border border-purple-700 focus:outline-none focus:border-purple-500"
          />
          <p className="text-xs text-gray-400">
            Set to 0 to disable time-based splitting
          </p>
        </div>

        {/* Split Size */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Split Recording at Size (MB)
          </label>
          <input
            type="number"
            min="0"
            max="1000"
            value={settings.splitSize}
            onChange={(e) => handleSettingChange('splitSize', parseInt(e.target.value))}
            className="w-full px-4 py-2 rounded bg-gray-800 border border-purple-700 focus:outline-none focus:border-purple-500"
          />
          <p className="text-xs text-gray-400">
            Set to 0 to disable size-based splitting
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsView; 