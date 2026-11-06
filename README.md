# Eon AI

Eon AI is an Electron desktop assistant for getting contextual AI responses during interviews, meetings, presentations, and other on-screen work. It can use screen and audio input during a session and includes a local inference mode.

> **Platform note:** The bundled local inference runtime currently provides binaries for macOS (Apple Silicon and Intel) and Windows (x64). Linux builds may run the Electron app, but local inference is not currently supported there.

## Features

- **Local AI mode** using `llama.cpp` for language models and `whisper.cpp` for speech transcription.
- **Model selection** for local language models, including Qwen GGUF presets and a custom model option.
- **Speech recognition choices** for the Tiny, Base, and Small English Whisper models.
- **Screen and audio capture** for session context, subject to operating-system permissions and the selected AI provider.
- **Session tools** including configurable assistant context, conversation history, and keyboard shortcuts.
- **Resume context** by importing a PDF resume (up to 10 MB) during onboarding.
- **Electron Forge** packaging for supported desktop platforms.

## Requirements

- Node.js and npm
- macOS or Windows x64 for the bundled local AI runtime
- Internet access for installing npm packages and downloading local AI models/runtime binaries
- Screen recording and microphone permissions where required by your operating system

The local language model and Whisper model can require significant disk space and memory. Choose a model that your computer can run comfortably.

## Getting started

```bash
git clone https://github.com/develper21/The_Eon_AI.git
cd The_Eon_AI
npm install
npm start
```

To run the desktop app from an existing checkout, use `npm start`.

## Using the app

1. Launch the app and complete onboarding.
2. Add optional context such as your resume, then review the assistant settings.
3. Choose the local language model and Whisper model that suit your computer.
4. Grant screen and microphone permissions when prompted.
5. Start a session and use the navigation controls to open the assistant, context, history, settings, or help.

Some screens and settings may still use the upstream product name while the project branding is being updated.

## Local AI and privacy

In local mode, language-model inference and speech transcription run using the downloaded local runtime and models. The app downloads these components when needed and stores its configuration, models, and session history in the operating system's application data directory.

Screen and audio content is sensitive. The destination of session data depends on the selected provider and features: local mode uses local inference, while any enabled cloud provider can transmit data to that provider. Review provider settings and permissions before starting a session. Delete stored history from the app when it is no longer needed.

## Development and packaging

```bash
npm start       # Start the app in development
npm run package # Package the app
npm run make    # Create platform installers
```

The application is built with Electron, Electron Forge, and Lit-based UI components. `npm run lint` currently reports that no linter is configured.

## Git remotes

The canonical repository is [develper21/The_Eon_AI](https://github.com/develper21/The_Eon_AI). To correct the origin URL in an existing checkout:

```bash
git remote set-url origin https://github.com/develper21/The_Eon_AI.git
git remote -v
```

An optional `upstream` remote can remain configured for the original source repository; it does not change where `origin` points.
