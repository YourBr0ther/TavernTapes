import { Tray, Menu, nativeImage, app, Notification } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: Electron.BrowserWindow;
  private isRecording: boolean = false;
  private lastNotificationTime: number = 0;
  private notificationCooldown: number = 30000; // 30 seconds between notifications

  constructor(mainWindow: Electron.BrowserWindow) {
    this.mainWindow = mainWindow;
    this.initializeTray();
  }

  public get recording(): boolean {
    return this.isRecording;
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

    // Handle double click
    this.tray.on('double-click', () => {
      this.mainWindow.show();
    });
  }

  private showNotification(title: string, body: string) {
    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      return; // Skip if within cooldown period
    }

    new Notification({
      title: title,
      body: body,
      icon: join(__dirname, '..', 'public', 'logo.png')
    }).show();

    this.lastNotificationTime = now;
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
          if (this.isRecording) {
            // Show warning before quitting during recording
            this.showNotification(
              'Recording in Progress',
              'Are you sure you want to quit? This will stop the current recording.'
            );
          }
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public setRecordingStatus(isRecording: boolean) {
    const wasRecording = this.isRecording;
    this.isRecording = isRecording;
    
    // Update tray icon and menu
    this.updateContextMenu();
    
    // Show notification for state changes
    if (isRecording && !wasRecording) {
      this.showNotification(
        'Recording Started',
        'TavernTapes is now recording in the background'
      );
    } else if (!isRecording && wasRecording) {
      this.showNotification(
        'Recording Stopped',
        'TavernTapes has stopped recording'
      );
    }
  }
} 