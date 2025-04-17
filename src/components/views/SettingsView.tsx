import React, { useEffect, useState } from 'react';
import settingsService, { Settings, defaultSettings } from '../../services/SettingsService';
import { AudioService } from '../../services/AudioService';
import fileSystemService from '../../services/FileSystemService';

// Extend Window interface to include our electron API
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, data?: any) => Promise<any>;
        on: (channel: string, func: (...args: any[]) => void) => void;
        send: (channel: string, data?: any) => void;
        removeAllListeners: (channel: string) => void;
      };
    };
  }
}

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadInputDevices();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await settingsService.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadInputDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setInputDevices(audioInputs);
    } catch (error) {
      console.error('Failed to load input devices:', error);
    }
  };

  const handleSettingChange = async (key: keyof Settings, value: Settings[keyof Settings]) => {
    const updatedSettings: Settings = {
      ...settings,
      [key]: value,
      // Handle aliases
      ...(key === 'audioFormat' ? { format: value as 'wav' | 'mp3' } : {}),
      ...(key === 'format' ? { audioFormat: value as 'wav' | 'mp3' } : {}),
      ...(key === 'audioQuality' ? { quality: value as number } : {}),
      ...(key === 'quality' ? { audioQuality: value as number } : {})
    };

    setSettings(updatedSettings);
    await saveSettings(updatedSettings);
  };

  const saveSettings = async (updatedSettings: Settings) => {
    try {
      setIsSaving(true);
      await settingsService.updateSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStorageLocationChange = async () => {
    console.log('Storage location change requested');
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('Invoking select-directory');
      const result = await window.electron.ipcRenderer.invoke('select-directory');
      console.log('Directory selection result:', result);
      
      if (result.success) {
        try {
          console.log('Updating storage location to:', result.path);
          // First update the FileSystemService
          await fileSystemService.setBaseDirectory(result.path);
          
          // Then update the settings
          const updatedSettings = { ...settings, storageLocation: result.path };
          await settingsService.updateSettings({ storageLocation: result.path });
          setSettings(updatedSettings);
          
          setSuccess('Storage location updated successfully. Your recordings will be saved to this location.');
          setTimeout(() => setSuccess(null), 5000); // Clear success message after 5 seconds
        } catch (err) {
          console.error('Error updating storage location:', err);
          setError('Failed to update storage location in settings. Please try again.');
          
          // Attempt to revert FileSystemService if settings update failed
          try {
            if (settings?.storageLocation) {
              await fileSystemService.setBaseDirectory(settings.storageLocation);
            }
          } catch (revertError) {
            console.error('Error reverting storage location:', revertError);
          }
        }
      } else {
        console.error('Directory selection failed:', result.error);
        setError(result.error || 'Failed to select directory. Please try again.');
      }
    } catch (err) {
      console.error('Error changing storage location:', err);
      setError('An unexpected error occurred while selecting the directory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!settings) {
    return <div>Loading settings...</div>;
  }

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
                  {device.label || `Microphone ${device.deviceId}`}
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
              onChange={(e) => handleSettingChange('format', e.target.value as 'wav' | 'mp3')}
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
            onClick={() => handleSettingChange('format', settings.format)}
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
              <p className="flex-1 text-white">
                {settings.storageLocation || defaultSettings.storageLocation}
              </p>
              <button
                onClick={handleStorageLocationChange}
                disabled={isLoading}
                className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 rounded-lg text-[#FFD700] font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Choose Directory
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView; 