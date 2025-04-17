import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: Electron.BrowserWindow;
  private isRecording: boolean = false;

  constructor(mainWindow: Electron.BrowserWindow) {
    this.mainWindow = mainWindow;
    this.initializeTray();
  }

  private initializeTray() {
    // Create tray icon
    const iconPath = join(__dirname, '..', 'public', 'logo.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    this.tray = new Tray(trayIcon);

    // Set tooltip
    this.tray.setToolTip('TavernTapes');

    // Create context menu
    this.updateContextMenu();

    // Handle click events
    this.tray.on('click', () => {
      this.mainWindow.show();
    });
  }

  public updateContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: this.isRecording ? 'Recording in progress...' : 'Not recording',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show TavernTapes',
        click: () => {
          this.mainWindow.show();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public setRecordingStatus(isRecording: boolean) {
    this.isRecording = isRecording;
    this.updateContextMenu();
  }
} 