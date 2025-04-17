import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';
import { TrayManager } from './src/main/tray';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let trayManager;

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

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, 'dist', 'index.html'));
  }

  return mainWindow;
}

// Handle app ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle app quit
app.on('before-quit', () => {
  app.isQuitting = true;
});

// Handle recording status updates
ipcMain.on('recording-status', (event, isRecording) => {
  if (trayManager) {
    trayManager.setRecordingStatus(isRecording);
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 