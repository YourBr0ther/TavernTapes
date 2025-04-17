import { contextBridge, ipcRenderer } from 'electron';

// Define the type for our exposed electron API
interface ExposedElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, data?: any) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => void;
    send: (channel: string, data?: any) => void;
    removeAllListeners: (channel: string) => void;
  };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      invoke: (channel: string, data?: any) => {
        const validChannels = ['save-file', 'read-file', 'delete-file', 'select-directory'];
        if (validChannels.includes(channel)) {
          return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`Invalid channel: ${channel}`));
      },
      on: (channel: string, func: (...args: any[]) => void) => {
        const validChannels = ['recording-status', 'save-state-before-crash'];
        if (validChannels.includes(channel)) {
          ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
      },
      send: (channel: string, data?: any) => {
        const validChannels = ['recording-status'];
        if (validChannels.includes(channel)) {
          ipcRenderer.send(channel, data);
        }
      },
      removeAllListeners: (channel: string) => {
        const validChannels = ['save-state-before-crash'];
        if (validChannels.includes(channel)) {
          ipcRenderer.removeAllListeners(channel);
        }
      }
    }
  } as ExposedElectronAPI
); 