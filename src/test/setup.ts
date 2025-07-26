import { vi, afterEach } from 'vitest';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn().mockImplementation(() => ({
    result: null,
    error: null,
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null
  })),
  deleteDatabase: vi.fn()
};

// Mock window.crypto
const mockCrypto = {
  randomUUID: vi.fn().mockReturnValue('test-uuid'),
  getRandomValues: vi.fn(),
  subtle: {}
};

// Mock window.AudioContext
const mockAudioContext = vi.fn().mockImplementation(() => ({
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn()
  }),
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 0,
    frequencyBinCount: 1,
    getByteFrequencyData: vi.fn()
  }),
  close: vi.fn()
}));

// Mock window.navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
  }),
  enumerateDevices: vi.fn().mockResolvedValue([
    { kind: 'audioinput', deviceId: 'default', label: 'Default' }
  ])
};

// Mock window.navigator
const mockNavigator = {
  mediaDevices: mockMediaDevices
};

// Stub globals
vi.stubGlobal('indexedDB', mockIndexedDB);
vi.stubGlobal('crypto', mockCrypto);
vi.stubGlobal('AudioContext', mockAudioContext);
vi.stubGlobal('navigator', mockNavigator);

// Clean up mocks after each test
afterEach(() => {
  vi.clearAllMocks();
}); 