# TavernTapes Design Document

## Brand Identity

### Name: TavernTapes
The name evokes the fantasy setting of D&D while clearly communicating the app's recording purpose. This duality helps establish the app's niche focus.

### Logo Concept
- A simple microphone icon combined with a medieval tavern sign or D20 die
- Color scheme: Deep purple/blue with gold accents (colors associated with magic and fantasy)
- Clean, recognizable at small sizes for app icon use

### Typography
- Primary Font: A modern sans-serif for readability (Roboto, Inter, or similar)
- Accent Font: A slightly stylized font for headings that hints at fantasy without being difficult to read (Cinzel or similar)

## User Interface Design

### Design Principles
1. **Focused Functionality**: Prioritize recording controls and session management
2. **Minimal Distractions**: Clean interface with only essential elements
3. **Fantasy-Inspired, Not Fantasy-Dominated**: Subtle D&D-themed elements without overwhelming the professional recording functionality
4. **Accessibility**: High contrast, readable text, adequate touch targets

### Color Palette
- **Primary**: Deep purple (#3A1078) - Represents mystery and magic
- **Secondary**: Gold accent (#FFD700) - Represents treasure and adventure
- **Background**: Dark gray (#1C1C1C) - Reduces eye strain during long sessions
- **Success States**: Green (#4CAF50)
- **Alert States**: Amber (#FFC107)
- **Error States**: Red (#F44336)
- **Text**: White (#FFFFFF) on dark backgrounds, Dark (#212121) on light elements

### Layout Structure

#### Main Window
- Minimalist design with focus on the recording controls
- Large, prominent record button in the center
- Session timer display above the record button
- Audio visualization (waveform/level meter) below the record button
- Session information and settings accessible via side panel or top menu

#### Recording Controls
- Large circular record button (red when recording)
- Pause/resume button
- Stop button
- Audio level indicator
- Elapsed time display
- File size estimate

#### Session Management Panel
- List of recorded sessions with dates and durations
- Preview/playback capabilities
- Export options
- Delete/rename functions
- Session notes field

#### Settings Panel
- Audio quality settings (bitrate, format)
- Storage location settings
- File splitting preferences
- Interface customization options

## User Experience Flow

### First-Time Experience
1. Welcome screen with app name and logo
2. Optional quick tutorial highlighting key features
3. Prompt to set default save location
4. Ready-to-record main screen

### Recording Workflow
1. Optional: Name session before starting (defaults to date/time if not specified)
2. Press record button to begin
3. Running timer and audio visualization provides feedback
4. Pause/resume as needed
5. Stop recording when finished
6. Prompt to name session (if not done previously)
7. Show success confirmation with quick export options

### Session Management Workflow
1. Access session list from main screen
2. View sessions sorted by date (newest first)
3. Select session to view details
4. Options to play, export, rename, or delete

## Technical Design Considerations

### Audio Visualization
- Real-time waveform display or simple VU meter
- Low resource usage to maintain performance during long sessions
- Visual indicator when audio levels are too high/low

### Battery Optimization (for potential mobile version)
- Option to dim screen during recording
- Background mode with minimal UI
- Notification-based controls when minimized

### File Management
- Automatic file naming convention: `[SessionName]_[Date]_[SequenceNumber]`
- Metadata embedded in files for easy organization
- Automatic file splitting options:
  - By time intervals (e.g., every 30 minutes)
  - By file size (e.g., every 500MB)

## UI Components

### Custom Elements
- Circular recording button with animated recording state
- Audio level visualization (customized for fantasy theme)
- Session timer with fantasy-inspired numerals or frame
- Custom scrollbars and input elements matching the theme

### Responsive Considerations
- Adapts to different window sizes
- Maintains usability on smaller screens
- Touch-friendly controls (for future mobile version)

## Visual Mockups

### Main Screen Concept
```
+----------------------------------------------+
|  TavernTapes                        [≡] [⚙]  |
+----------------------------------------------+
|                                              |
|                                              |
|                  Session Name                |
|                "Goblin Ambush"               |
|                                              |
|                  00:45:12                    |
|                                              |
|           +-------------------+              |
|           |        [⏺]        |              |
|           +-------------------+              |
|                                              |
|          [⏸]               [⏹]              |
|                                              |
|       ▁▂▃▅▂▁▃▅█▇▆▅▂▃▄▅▆▇█▇▅▃▁▂              |
|                                              |
|                                              |
|  Storage: 1.2GB  |  Format: MP3 320kbps     |
+----------------------------------------------+
```

### Session List Concept
```
+----------------------------------------------+
|  TavernTapes                        [≡] [⚙]  |
+----------------------------------------------+
|  RECORDED SESSIONS                    [+]    |
|  ----------------------------------------    |
|  ► Goblin Ambush          4/15/25  2:15:42  |
|    Dragon's Lair          4/10/25  3:45:20  |
|    Tavern Meeting         4/05/25  1:30:15  |
|    Character Creation     3/28/25  2:20:35  |
|                                              |
|  SESSION DETAILS                             |
|  ----------------------------------------    |
|  Name: Goblin Ambush                         |
|  Date: April 15, 2025                        |
|  Duration: 2h 15m 42s                        |
|  Size: 650.4 MB (3 files)                    |
|                                              |
|  [▶] [⤓] [✎] [🗑]                           |
|                                              |
|  NOTES:                                      |
|  ----------------------------------------    |
|  Party encountered goblin ambush on the      |
|  road to Neverwinter. Thordak almost died.   |
|                                              |
+----------------------------------------------+
```

## Accessibility Considerations
- Support for screen readers
- Keyboard navigation for all functions
- High contrast mode option
- Customizable text size
- Visual indicators accompanied by text labels

## Implementation Notes
- Consider using Electron for cross-platform desktop support
- Use SVG for icons and visual elements to ensure crisp display at all resolutions
- Implement local storage for session data with proper backup mechanisms
- Use Web Audio API for recording functionality
- Consider WebWorkers for background processing to keep UI responsive
