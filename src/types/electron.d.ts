import { App as ElectronApp } from 'electron';

interface IpcRenderer {
  send: (channel: string, data: any) => void;
  invoke: (channel: string, data?: any) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeAllListeners: (channel: string) => void;
}

interface Electron {
  ipcRenderer: IpcRenderer;
}

declare global {
  interface Window {
    electron: Electron;
  }
}

declare module 'electron' {
  interface App extends ElectronApp {
    isQuitting: boolean;
  }
}

export {}; 