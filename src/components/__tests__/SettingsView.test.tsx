import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsView from '../views/SettingsView';
import settingsService from '../../services/SettingsService';
import fileSystemService from '../../services/FileSystemService';

// Mock the services
vi.mock('../../services/SettingsService', () => ({
  default: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

vi.mock('../../services/FileSystemService', () => ({
  default: {
    setBaseDirectory: vi.fn(),
  },
}));

// Mock the electron API
const mockElectron = {
  ipcRenderer: {
    invoke: vi.fn(),
  },
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

const mockSettings = {
  inputDeviceId: 'default',
  format: 'wav' as const,
  quality: 128,
  splitInterval: 60,
  storageLocation: '/default/path',
};

const mockInputDevices = [
  { deviceId: 'default', kind: 'audioinput', label: 'Default Microphone' },
  { deviceId: 'device1', kind: 'audioinput', label: 'USB Microphone' },
] as MediaDeviceInfo[];

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (settingsService.getSettings as any).mockResolvedValue(mockSettings);
    
    // Mock navigator.mediaDevices.enumerateDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue(mockInputDevices),
      },
      writable: true,
    });
  });

  it('renders settings form correctly', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Audio Settings')).toBeInTheDocument();
      expect(screen.getByText('Storage Settings')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/input device/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/audio format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/split recording/i)).toBeInTheDocument();
  });

  it('loads and displays current settings', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(settingsService.getSettings).toHaveBeenCalled();
    });

    const formatSelect = screen.getByLabelText(/audio format/i) as HTMLSelectElement;
    expect(formatSelect.value).toBe('wav');

    const qualityInput = screen.getByLabelText(/quality/i) as HTMLInputElement;
    expect(qualityInput.value).toBe('128');
  });

  it('loads input devices', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled();
    });

    expect(screen.getByText('Default Microphone')).toBeInTheDocument();
    expect(screen.getByText('USB Microphone')).toBeInTheDocument();
  });

  it('handles audio format change', async () => {
    const user = userEvent.setup();
    (settingsService.updateSettings as any).mockResolvedValue(undefined);

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByLabelText(/audio format/i)).toBeInTheDocument();
    });

    const formatSelect = screen.getByLabelText(/audio format/i);
    await user.selectOptions(formatSelect, 'mp3');

    await waitFor(() => {
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'mp3',
          audioFormat: 'mp3',
        })
      );
    });
  });

  it('handles quality change', async () => {
    const user = userEvent.setup();
    (settingsService.updateSettings as any).mockResolvedValue(undefined);

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
    });

    const qualityInput = screen.getByLabelText(/quality/i);
    await user.clear(qualityInput);
    await user.type(qualityInput, '256');

    await waitFor(() => {
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 256,
          audioQuality: 256,
        })
      );
    });
  });

  it('handles split interval change', async () => {
    const user = userEvent.setup();
    (settingsService.updateSettings as any).mockResolvedValue(undefined);

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByLabelText(/split recording/i)).toBeInTheDocument();
    });

    const splitInput = screen.getByLabelText(/split recording/i);
    await user.clear(splitInput);
    await user.type(splitInput, '30');

    await waitFor(() => {
      expect(settingsService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          splitInterval: 30,
        })
      );
    });
  });

  it('handles storage location change', async () => {
    const user = userEvent.setup();
    mockElectron.ipcRenderer.invoke.mockResolvedValue({
      success: true,
      path: '/new/storage/path',
    });
    (fileSystemService.setBaseDirectory as any).mockResolvedValue(undefined);
    (settingsService.updateSettings as any).mockResolvedValue(undefined);

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Choose Directory')).toBeInTheDocument();
    });

    const chooseButton = screen.getByText('Choose Directory');
    await user.click(chooseButton);

    await waitFor(() => {
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith('select-directory');
      expect(fileSystemService.setBaseDirectory).toHaveBeenCalledWith('/new/storage/path');
      expect(settingsService.updateSettings).toHaveBeenCalledWith({
        storageLocation: '/new/storage/path',
      });
    });

    expect(screen.getByText(/storage location updated successfully/i)).toBeInTheDocument();
  });

  it('handles storage location change failure', async () => {
    const user = userEvent.setup();
    mockElectron.ipcRenderer.invoke.mockResolvedValue({
      success: false,
      error: 'User cancelled selection',
    });

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Choose Directory')).toBeInTheDocument();
    });

    const chooseButton = screen.getByText('Choose Directory');
    await user.click(chooseButton);

    await waitFor(() => {
      expect(screen.getByText(/user cancelled selection/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during storage location change', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockElectron.ipcRenderer.invoke.mockReturnValue(promise);

    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Choose Directory')).toBeInTheDocument();
    });

    const chooseButton = screen.getByText('Choose Directory');
    await user.click(chooseButton);

    // Button should be disabled during loading
    expect(chooseButton).toBeDisabled();

    // Resolve the promise
    resolvePromise!({
      success: true,
      path: '/new/path',
    });

    await waitFor(() => {
      expect(chooseButton).not.toBeDisabled();
    });
  });

  it('has proper accessibility attributes', async () => {
    render(<SettingsView />);

    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    // Check for proper labeling
    expect(screen.getByLabelText(/select audio input device/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select audio recording format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/set audio quality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/set recording split interval/i)).toBeInTheDocument();

    // Check for section headings
    expect(screen.getByRole('heading', { name: /audio settings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /storage settings/i })).toBeInTheDocument();
  });
});