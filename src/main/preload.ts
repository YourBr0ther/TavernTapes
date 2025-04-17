import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      send: (channel: string, data: any) => {
        // whitelist channels
        const validChannels = ['recording-status'];
        if (validChannels.includes(channel)) {
          ipcRenderer.send(channel, data);
        }
      },
      invoke: (channel: string, data?: any) => {
        const validChannels = ['select-directory', 'save-file', 'read-file', 'delete-file'];
        if (validChannels.includes(channel)) {
          return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`Invalid channel: ${channel}`));
      },
      on: (channel: string, func: (...args: any[]) => void) => {
        const validChannels = ['save-state-before-crash'];
        if (validChannels.includes(channel)) {
          // Strip event as it includes `sender` 
          ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
      },
      removeAllListeners: (channel: string) => {
        const validChannels = ['save-state-before-crash'];
        if (validChannels.includes(channel)) {
          ipcRenderer.removeAllListeners(channel);
        }
      }
    }
  }
); 