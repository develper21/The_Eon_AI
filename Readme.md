Enrora – The Eon is a stealth-focused desktop assistant designed for interviews, meetings, and rapid question-answering scenarios. It works quietly in the background while providing real-time intelligence powered by a Gemini Live session.

What it does

Enrora captures your screen, listens to ongoing conversations, and streams both visuals and audio/text to a persistent Gemini live session. The AI then transcribes what’s happening, extracts the important question or context, and responds with short, precise, and context-aware answers—perfect for interviews, oral exams, or fast meetings.

How it works

1. Frontend (Electron App)

Manages all capture controls

Lets the user switch between:

Fast Mode (continuous rapid screenshots)

Manual Capture (press-to-capture)

Lets the user adjust:

Screenshot quality

Capture frequency

Microphone input

Handles UI notifications and minimal alerts to keep it stealthy

2. Backend (Node.js Service)

Creates and manages a persistent Gemini Live session

Streams:

Screenshot data (base64 or buffer)

Audio chunks from the mic

Quick text prompts

Handles auto-reconnect, session timeouts, and restart logic

Manages IPC between Electron → Node → Gemini API

Core Capabilities

Stealth Mode: Runs quietly, minimal pop-ups

Real-time Q&A: Gemini listens and returns short, smart answers

Dual Capture: Continuous or manual screenshot mode

Audio Streaming: Sends small audio chunks for speech recognition

Cross-channel Context: Combines screen + audio + quick prompts for better answers

Session Stability: Auto-retry, reconnection, and fallback handling

Ideal Use Cases

Technical interviews

Online viva/practical exams

Business meetings

Customer support calls

Rapid research tasks

Any scenario where the user needs fast, context-aware assistance without tab-switching