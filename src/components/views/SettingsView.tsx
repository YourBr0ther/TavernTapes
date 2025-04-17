import React, { useState, useEffect } from 'react';
import { RecordingOptions, AudioService } from '../../services/AudioService';

interface SettingsViewProps {
  onSettingsChange?: (settings: RecordingOptions) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<RecordingOptions>({
    format: 'wav',
    quality: 128,
    splitInterval: 30,
    splitSize: 500,
    inputDeviceId: undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('tavernTapesSettings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load saved settings');
      }
    }

    // Load input devices
    loadInputDevices();
  }, []);

  const loadInputDevices = async () => {
    try {
      setIsLoading(true);
      const devices = await AudioService.getInputDevices();
      setInputDevices(devices);
      
      // If no device is selected and we have devices, select the first one
      if (!settings.inputDeviceId && devices.length > 0) {
        setSettings(prev => ({ ...prev, inputDeviceId: devices[0].deviceId }));
      }
    } catch (err) {
      console.error('Error loading input devices:', err);
      setError('Failed to load input devices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (key: keyof RecordingOptions, value: any) => {
    // Validate numeric inputs
    if (['quality', 'splitInterval', 'splitSize'].includes(key)) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        setError(`Invalid value for ${key}`);
        return;
      }
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setError(null);
  };

  const handleStorageLocationChange = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Implement storage location change logic here
      // This would typically open a file dialog
      setSuccess('Storage location updated successfully');
    } catch (err) {
      console.error('Error changing storage location:', err);
      setError('Failed to change storage location');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);
      localStorage.setItem('tavernTapesSettings', JSON.stringify(settings));
      onSettingsChange?.(settings);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-[#1C1C1C] border border-[#F44336]/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-[#1C1C1C] border border-[#4CAF50]/50 rounded-lg text-green-200">
            {success}
          </div>
        )}

        {/* Audio Settings Section */}
        <div className="bg-[#1C1C1C] rounded-lg p-6 border border-[#3A1078]/20">
          <h2 className="text-xl font-bold mb-4 text-[#FFD700]">Audio Settings</h2>
          
          {/* Input Device Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#FFD700]/80 mb-2">
              Input Device
            </label>
            <select
              value={settings.inputDeviceId}
              onChange={(e) => handleSettingChange('inputDeviceId', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#3A1078]/30 focus:outline-none focus:border-[#FFD700]/50 text-white"
              disabled={isLoading}
            >
              {inputDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#FFD700]/80 mb-2">
              Audio Format
            </label>
            <select
              value={settings.format}
              onChange={(e) => handleSettingChange('format', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#3A1078]/30 focus:outline-none focus:border-[#FFD700]/50 text-white"
            >
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
            </select>
          </div>

          {/* Quality Settings */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#FFD700]/80 mb-2">
              Quality (kbps)
            </label>
            <input
              type="number"
              value={settings.quality}
              onChange={(e) => handleSettingChange('quality', Number(e.target.value))}
              min="64"
              max="320"
              step="32"
              className="w-full px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#3A1078]/30 focus:outline-none focus:border-[#FFD700]/50 text-white"
            />
          </div>

          {/* File Splitting Settings */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#FFD700]/80 mb-2">
              Split Recording Every (minutes)
            </label>
            <input
              type="number"
              value={settings.splitInterval}
              onChange={(e) => handleSettingChange('splitInterval', Number(e.target.value))}
              min="1"
              max="120"
              className="w-full px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#3A1078]/30 focus:outline-none focus:border-[#FFD700]/50 text-white"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 rounded-lg text-[#FFD700] font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Storage Settings Section */}
        <div className="bg-[#1C1C1C] rounded-lg p-6 border border-[#3A1078]/20">
          <h2 className="text-xl font-bold mb-4 text-[#FFD700]">Storage Settings</h2>
          
          {/* Storage Location */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#FFD700]/80 mb-2">
              Storage Location
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={settings.storageLocation}
                readOnly
                className="flex-1 px-4 py-2 rounded-lg bg-[#1C1C1C] border border-[#3A1078]/30 text-white"
              />
              <button
                onClick={handleStorageLocationChange}
                disabled={isLoading}
                className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 rounded-lg text-[#FFD700] font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Changing...' : 'Change'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView; 