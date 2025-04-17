import { app, BrowserWindow, ipcMain, powerSaveBlocker, dialog, Event as ElectronEvent } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';
import { TrayManager } from './tray';
import { promises as fs } from 'fs';
import * as path from 'path';
import { isDevelopment } from './utils';

// App state management
const appState = {
  isQuitting: false
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let powerSaveBlockerId: number | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: isDev 
        ? join(__dirname, '..', '..', 'dist', 'main', 'preload.js')
        : join(__dirname, 'preload.js'),
    },
    icon: join(__dirname, '..', '..', 'logo.png')
  });

  // Set permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      callback(true); // Grant permission
    } else {
      callback(false); // Deny permission
    }
  });

  // Initialize tray manager
  trayManager = new TrayManager(mainWindow);

  // Handle window close
  mainWindow?.on('close', async (event: ElectronEvent) => {
    if (!appState.isQuitting && mainWindow) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle window minimize
  mainWindow.on('minimize', (event: ElectronEvent) => {
    event.preventDefault();
    mainWindow?.hide();
  });

  // Handle window focus
  mainWindow.on('focus', () => {
    if (trayManager) {
      trayManager.updateContextMenu();
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'));
  }

  return mainWindow;
}

// Handle app quit
app.on('before-quit', () => {
  appState.isQuitting = true;
  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
});

// Handle recording status updates
ipcMain.on('recording-status', (event, isRecording) => {
  if (trayManager) {
    trayManager.setRecordingStatus(isRecording);
  }

  // Handle power save blocker
  if (isRecording && powerSaveBlockerId === null) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  } else if (!isRecording && powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);

  if (trayManager && trayManager.recording) {
    // Send save state event to renderer
    mainWindow?.webContents.send('save-state-before-crash');
  }

  if (!appState.isQuitting) {
    dialog.showErrorBox(
      'Error',
      'An unexpected error occurred. The application will now close.'
    );
  }

  app.quit();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (trayManager && trayManager.recording) {
    if (mainWindow) {
      mainWindow.webContents.send('save-state-before-crash');
    }
  }
  setTimeout(() => {
    app.quit();
  }, 1000);
});

// Handle window crashes
app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process crashed:', details);
  if (trayManager && trayManager.recording) {
    if (mainWindow) {
      mainWindow.webContents.send('save-state-before-crash');
    }
  }
  setTimeout(() => {
    app.quit();
  }, 1000);
});

// Add file system IPC handlers
ipcMain.handle('save-file', async (event, { path: filePath, buffer }) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, Buffer.from(buffer));
    return { success: true };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Add directory selection handler
ipcMain.handle('select-directory', async () => {
  console.log('Directory selection requested');
  try {
    if (!mainWindow) {
      console.error('No main window available');
      return { success: false, error: 'Application window not available' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Recording Storage Location',
      buttonLabel: 'Select Folder',
      defaultPath: app.getPath('documents') // Start in Documents folder
    });

    console.log('Directory selection result:', result);

    if (result.canceled) {
      console.log('Directory selection cancelled');
      return { success: false, error: 'Directory selection was cancelled' };
    }

    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error('Error in directory selection:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}); 