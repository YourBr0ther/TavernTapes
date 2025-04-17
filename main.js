import { app, BrowserWindow, ipcMain, powerSaveBlocker } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';
import { TrayManager } from './src/main/tray';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let trayManager;
let powerSaveBlockerId = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: join(__dirname, 'src', 'preload.js'),
      permissions: {
        media: true,
        audioCapture: true,
      }
    },
    icon: join(__dirname, 'logo.png')
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
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle window minimize
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
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
    mainWindow.loadFile(join(__dirname, 'dist', 'index.html'));
  }

  return mainWindow;
}

// Handle app quit
app.on('before-quit', () => {
  app.isQuitting = true;
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
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // If we're recording, try to save the state
  if (trayManager && trayManager.isRecording) {
    // Send a message to the renderer to save state
    if (mainWindow) {
      mainWindow.webContents.send('save-state-before-crash');
    }
  }
  // Give the renderer a moment to save state
  setTimeout(() => {
    app.quit();
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // If we're recording, try to save the state
  if (trayManager && trayManager.isRecording) {
    // Send a message to the renderer to save state
    if (mainWindow) {
      mainWindow.webContents.send('save-state-before-crash');
    }
  }
  // Give the renderer a moment to save state
  setTimeout(() => {
    app.quit();
  }, 1000);
});

// Handle window crashes
app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process crashed:', details);
  // If we're recording, try to save the state
  if (trayManager && trayManager.isRecording) {
    // Send a message to the renderer to save state
    if (mainWindow) {
      mainWindow.webContents.send('save-state-before-crash');
    }
  }
  // Give the renderer a moment to save state
  setTimeout(() => {
    app.quit();
  }, 1000);
}); 