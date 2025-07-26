import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { vi, afterEach } from 'vitest';

// Mock the TextEncoder and TextDecoder for tests
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn().mockReturnValue({
    result: {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          getAll: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null,
            result: []
          }),
          put: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          clear: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          })
        })
      })
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  })
};

global.indexedDB = mockIndexedDB as any;

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  ondataavailable: null as ((event: any) => void) | null,
  state: 'inactive' as 'inactive' | 'recording' | 'paused',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

class MockMediaRecorder {
  static isTypeSupported(): boolean {
    return true;
  }

  start = mockMediaRecorder.start;
  stop = mockMediaRecorder.stop;
  pause = mockMediaRecorder.pause;
  resume = mockMediaRecorder.resume;
  state = mockMediaRecorder.state;
  addEventListener = mockMediaRecorder.addEventListener;
  removeEventListener = mockMediaRecorder.removeEventListener;

  set ondataavailable(handler: ((event: any) => void) | null) {
    mockMediaRecorder.ondataavailable = handler;
  }

  get ondataavailable(): ((event: any) => void) | null {
    return mockMediaRecorder.ondataavailable;
  }
}

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({}),
  enumerateDevices: vi.fn().mockResolvedValue([
    { kind: 'audioinput', deviceId: 'default', label: 'Default' },
    { kind: 'audioinput', deviceId: 'device1', label: 'Microphone 1' },
  ]),
};

// Set up global mocks
Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: MockMediaRecorder,
});

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices,
});

// Mock the matchMedia function
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
}); 