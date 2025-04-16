# TavernTapes

![TavernTapes Logo](logo.png)

> A modern, clean recording application designed specifically for Dungeons & Dragons sessions.

TavernTapes is the perfect companion for your D&D adventures, allowing you to record entire sessions with ease. Built with long-form recording in mind (6+ hours), it features session management, high-quality audio capabilities, and a fantasy-inspired interface that won't get in your way.

## ✨ Features

- **Extended Recording Sessions** - Record for 6+ hours without interruption
- **Pause & Resume** - Take breaks without creating multiple files
- **Session Management** - Name, organize, and browse your recorded adventures
- **Optimized Audio** - High-quality recording suitable for AI processing
- **Modern Interface** - Clean, intuitive design with subtle fantasy elements
- **File Management** - Automatic file splitting and organization

## 🚀 Getting Started

### Prerequisites

- Node.js (v16.0.0 or later)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourbr0ther/taverntapes.git
   cd taverntapes
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

### Building for Production

```bash
npm run build
# or
yarn build
```

## 📖 Usage

### Recording a Session

1. Launch TavernTapes
2. (Optional) Enter a session name (defaults to date/time)
3. Click the large record button to begin recording
4. Use pause/resume as needed during breaks
5. Click stop when your session concludes
6. Your recording will be saved automatically

### Managing Sessions

- Access your recorded sessions from the main screen
- Play, rename, delete, or export sessions as needed
- Add notes to sessions for future reference

### Settings

Access the settings panel to customize:
- Audio quality and format
- Default save location
- File splitting preferences
- Interface theme options

## 🏗️ Project Structure

```
taverntapes/
├── src/                  # Source files
│   ├── components/       # UI components
│   ├── services/         # Core functionality services
│   ├── assets/           # Images, icons, and other static assets
│   ├── utils/            # Utility functions
│   └── main.js           # Application entry point
├── public/               # Public static files
├── build/                # Build output directory
├── docs/                 # Documentation
│   ├── PLANNING.md       # Project planning document
│   ├── TASKS.md          # Development task list
│   └── DESIGN.md         # UI/UX design document
└── README.md             # This file
```

## 🧩 Technology Stack

- **Electron.js** - Cross-platform desktop application framework
- **React** - UI component library
- **Web Audio API** - Audio recording and processing
- **Tailwind CSS** - Styling

## 🗺️ Roadmap

- [x] Basic recording functionality
- [x] Session management
- [ ] Enhanced audio processing
- [ ] Mobile application version
- [ ] Cloud backup integration
- [ ] Direct OpenAI integration
- [ ] Multi-track recording support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter) - email@example.com

Project Link: [https://github.com/yourusername/taverntapes](https://github.com/yourusername/taverntapes)
