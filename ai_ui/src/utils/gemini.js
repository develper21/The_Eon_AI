const { GoogleGenAI } = require('@google/genai');
const { BrowserWindow, ipcMain, app } = require('electron');
const { spawn } = require('child_process');
const { saveDebugAudio } = require('../audioUtils');
const { getSystemPrompt } = require('./prompts');
const fs = require('fs');
const path = require('path');

let currentSessionId = null;
let currentTranscription = '';
let conversationHistory = [];
let isInitializingSession = false;
let isRefreshingSession = false;
let lastSessionRefresh = 0;
let turnsSinceRefresh = 0;
const AUTO_REFRESH_TURN_LIMIT = 6;

const CONNECTION_CONSTANTS = {
    pingInterval: 60000,
    pongTimeout: 30000,
    sustainedFailureThreshold: 6,
    initialReconnectDelay: 1000,
    backoffMultiplier: 2,
    maxReconnectDelay: 180000,
    jitter: 0.2,
    maxReconnectAttemptsBeforeLongPoll: 15,
    durableWindowMs: 240000,
    reconnectOnHeartbeatTimeout: false,
};

class ChunkBufferStore {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.bufferPath = path.join(baseDir, 'session-buffer.json');
        this.state = { chunks: [] };
        this.maxWindowMs = CONNECTION_CONSTANTS.durableWindowMs;
    }

    load() {
        try {
            if (fs.existsSync(this.bufferPath)) {
                this.state = JSON.parse(fs.readFileSync(this.bufferPath, 'utf-8'));
            }
        } catch (error) {
            console.warn('Failed to load buffer store, starting fresh:', error.message);
            this.state = { chunks: [] };
        }
    }

    save() {
        try {
            fs.writeFileSync(this.bufferPath, JSON.stringify(this.state, null, 2), 'utf-8');
        } catch (error) {
            console.error('Failed to persist buffer store:', error.message);
        }
    }

    addChunk(chunk) {
        this.state.chunks.push(chunk);
        this.trimWindow();
        this.save();
    }

    markAcked(seq) {
        const before = this.state.chunks.length;
        this.state.chunks = this.state.chunks.filter(entry => entry.seq !== seq);
        if (this.state.chunks.length !== before) {
            this.save();
        }
    }

    getPendingChunks() {
        return [...this.state.chunks].sort((a, b) => a.seq - b.seq);
    }

    trimWindow() {
        const cutoff = Date.now() - this.maxWindowMs;
        this.state.chunks = this.state.chunks.filter(entry => entry.timestamp >= cutoff);
    }
}

class PersistentConnectionManager {
    constructor(bufferStore) {
        this.bufferStore = bufferStore;
        this.session = null;
        this.sessionParams = null;
        this.seqCounter = 1;
        this.pendingAcks = new Map();
        this.heartbeatTimer = null;
        this.pongTimer = null;
        this.failureStreak = 0;
        this.reconnectDelay = CONNECTION_CONSTANTS.initialReconnectDelay;
        this.reconnectAttempts = 0;
        this.longPollMode = false;
        this.metrics = {
            lastPing: null,
            lastPong: null,
            reconnectAttempts: 0,
            pendingChunks: 0,
            degraded: false,
        };
        this.controlQueue = [];
    }

    attachSession(session, params) {
        if (this.session && this.session !== session) {
            this.detachSession();
        }

        this.session = session;
        this.sessionParams = params;
        this.failureStreak = 0;
        this.reconnectDelay = CONNECTION_CONSTANTS.initialReconnectDelay;
        this.reconnectAttempts = 0;
        this.metrics.degraded = false;
        this.startHeartbeats();
        this.processBufferedChunks();
        this.flushControlQueue();
        sendToRenderer('connection-metrics', this.metrics);
    }

    detachSession() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
        this.session = null;
    }

    recordInboundActivity() {
        this.failureStreak = 0;
        this.metrics.lastPong = Date.now();
        if (this.metrics.degraded) {
            this.metrics.degraded = false;
            sendToRenderer('connection-alert', {
                message: 'Connection healthy',
                severity: 'info',
            });
        }
        if (this.pongTimer) {
            clearTimeout(this.pongTimer);
            this.pongTimer = null;
        }
        sendToRenderer('connection-metrics', this.metrics);
    }

    startHeartbeats() {
        if (!this.session) return;
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        this.metrics.lastPing = Date.now();
        this.heartbeatTimer = setInterval(() => {
            this.sendPing();
        }, CONNECTION_CONSTANTS.pingInterval);
        this.sendPing();
    }

    sendPing() {
        if (!this.session) return;
        try {
            this.metrics.lastPing = Date.now();
            this.session.sendRealtimeInput({
                eventType: 'PING',
                serverMetadata: {
                    type: 'ping',
                    timestamp: this.metrics.lastPing,
                },
            });
            if (this.pongTimer) {
                clearTimeout(this.pongTimer);
            }
            this.pongTimer = setTimeout(() => this.handleMissedHeartbeat(), CONNECTION_CONSTANTS.pongTimeout);
        } catch (error) {
            console.warn('Unable to send ping:', error.message);
            this.handleMissedHeartbeat();
        }
        sendToRenderer('connection-metrics', this.metrics);
    }

    handleMissedHeartbeat() {
        this.failureStreak += 1;
        if (this.failureStreak >= CONNECTION_CONSTANTS.sustainedFailureThreshold) {
            this.metrics.degraded = true;
            sendToRenderer('connection-alert', {
                message: 'Connection degraded, attempting graceful recovery...',
                severity: 'warning',
            });
            if (CONNECTION_CONSTANTS.reconnectOnHeartbeatTimeout) {
                this.triggerReconnect();
            }
        }
    }

    triggerReconnect() {
        if (!this.sessionParams || this.longPollMode) {
            return;
        }

        this.reconnectAttempts += 1;
        this.metrics.reconnectAttempts = this.reconnectAttempts;
        sendToRenderer('connection-metrics', this.metrics);

        if (this.reconnectAttempts > CONNECTION_CONSTANTS.maxReconnectAttemptsBeforeLongPoll) {
            this.longPollMode = true;
            sendToRenderer('connection-alert', {
                message: 'Switching to low-bandwidth fallback while attempting to resume the live session.',
                severity: 'error',
            });
        }

        const jitter = 1 + (Math.random() * 2 - 1) * CONNECTION_CONSTANTS.jitter;
        const delay = Math.min(this.reconnectDelay * jitter, CONNECTION_CONSTANTS.maxReconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * CONNECTION_CONSTANTS.backoffMultiplier, CONNECTION_CONSTANTS.maxReconnectDelay);

        setTimeout(() => {
            if (typeof attemptReconnection === 'function') {
                attemptReconnection(true);
            }
        }, delay);
    }

    queueChunk(type, payload) {
        const seq = this.seqCounter++;
        const entry = {
            seq,
            type,
            payload,
            timestamp: Date.now(),
            attempts: 0,
        };
        this.bufferStore.addChunk(entry);
        this.pendingAcks.set(seq, entry);
        this.metrics.pendingChunks = this.pendingAcks.size;
        sendToRenderer('connection-metrics', this.metrics);
        this.trySendChunk(entry);
        return seq;
    }

    async trySendChunk(entry) {
        if (!this.session) {
            return;
        }
        entry.attempts += 1;
        try {
            if (entry.type === 'audio') {
                await this.session.sendRealtimeInput({
                    mediaChunks: [
                        {
                            data: entry.payload.data,
                            mimeType: entry.payload.mimeType,
                            isFinal: entry.payload.isFinal || false,
                            metadata: { seq: entry.seq },
                        },
                    ],
                });
            } else if (entry.type === 'text') {
                await this.session.sendRealtimeInput({
                    text: entry.payload.text,
                    serverMetadata: { seq: entry.seq, isFinal: entry.payload.isFinal || false },
                });
            }
        } catch (error) {
            console.warn(`Chunk ${entry.seq} send failed (attempt ${entry.attempts}):`, error.message);
            if (entry.attempts < CONNECTION_CONSTANTS.sustainedFailureThreshold) {
                setTimeout(() => this.trySendChunk(entry), this.reconnectDelay);
            } else {
                this.handleMissedHeartbeat();
            }
        }
    }

    processBufferedChunks() {
        const pending = this.bufferStore.getPendingChunks();
        pending.forEach(entry => {
            // Avoid double-sending if already pending
            if (!this.pendingAcks.has(entry.seq)) {
                this.pendingAcks.set(entry.seq, entry);
            }
            this.trySendChunk(entry);
        });
        this.metrics.pendingChunks = this.pendingAcks.size;
        sendToRenderer('connection-metrics', this.metrics);
    }

    markAcked(seq) {
        if (this.pendingAcks.has(seq)) {
            this.pendingAcks.delete(seq);
            this.bufferStore.markAcked(seq);
            this.metrics.pendingChunks = this.pendingAcks.size;
            sendToRenderer('connection-metrics', this.metrics);
        }
    }

    handleAcknowledgements(seqs = []) {
        seqs.forEach(seq => this.markAcked(seq));
    }

    signalTurnComplete(details = {}) {
        const payload = {
            eventType: 'TURN_COMPLETE',
            reason: details.reason || 'user',
            stats: details.stats || null,
            timestamp: Date.now(),
        };
        if (!this.session) {
            this.controlQueue.push(payload);
            return;
        }
        this.sendControlEvent(payload);
    }

    flushControlQueue() {
        if (!this.session || this.controlQueue.length === 0) {
            return;
        }
        const queue = [...this.controlQueue];
        this.controlQueue.length = 0;
        queue.forEach(payload => this.sendControlEvent(payload));
    }

    sendControlEvent(payload) {
        if (!this.session) return;
        try {
            this.session.sendRealtimeInput({
                eventType: payload.eventType || 'TURN_COMPLETE',
                serverMetadata: {
                    reason: payload.reason,
                    timestamp: payload.timestamp,
                    stats: payload.stats || undefined,
                },
            });
        } catch (error) {
            console.warn('Failed to send control event:', error.message);
            this.controlQueue.push(payload);
        }
    }
}

function extractAckSeqsFromMessage(message) {
    const seqs = new Set();
    const pushSeq = value => {
        const num = Number(value);
        if (Number.isFinite(num)) {
            seqs.add(num);
        }
    };

    const collectFromMetadata = meta => {
        if (!meta) return;
        if (meta.ackSeq !== undefined) pushSeq(meta.ackSeq);
        if (Array.isArray(meta.ackSeqs)) meta.ackSeqs.forEach(pushSeq);
        if (meta.seq !== undefined) pushSeq(meta.seq);
    };

    collectFromMetadata(message?.serverContent?.metadata);
    collectFromMetadata(message?.clientContent?.metadata);

    if (Array.isArray(message?.serverContent?.modelTurn?.parts)) {
        message.serverContent.modelTurn.parts.forEach(part => collectFromMetadata(part?.metadata));
    }

    if (Array.isArray(message?.serverContent?.inputTranscription?.results)) {
        message.serverContent.inputTranscription.results.forEach(result => collectFromMetadata(result?.metadata));
    }

    return Array.from(seqs);
}

function formatSpeakerResults(results) {
    let text = '';
    for (const result of results) {
        if (result.transcript && result.speakerId) {
            const speakerLabel = result.speakerId === 1 ? 'Interviewer' : 'Candidate';
            text += `[${speakerLabel}]: ${result.transcript}\n`;
        }
    }
    return text;
}

module.exports.formatSpeakerResults = formatSpeakerResults;

// Persistent chunk buffering + connection resilience
const bufferStore = new ChunkBufferStore(app.getPath('userData'));
bufferStore.load();
const connectionManager = new PersistentConnectionManager(bufferStore);

// Audio capture variables
let systemAudioProc = null;
let messageBuffer = '';

// Session token cache for refresh/resume
let lastSessionParams = null;


function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

// Conversation management functions
function initializeNewSession() {
    currentSessionId = Date.now().toString();
    currentTranscription = '';
    conversationHistory = [];
    console.log('New conversation session started:', currentSessionId);
}

function saveConversationTurn(transcription, aiResponse) {
    if (!currentSessionId) {
        initializeNewSession();
    }

    const conversationTurn = {
        timestamp: Date.now(),
        transcription: transcription.trim(),
        ai_response: aiResponse.trim(),
    };

    conversationHistory.push(conversationTurn);
    console.log('Saved conversation turn:', conversationTurn);

    // Send to renderer to save in IndexedDB
    sendToRenderer('save-conversation-turn', {
        sessionId: currentSessionId,
        turn: conversationTurn,
        fullHistory: conversationHistory,
    });
}

function getCurrentSessionData() {
    return {
        sessionId: currentSessionId,
        history: conversationHistory,
    };
}

async function sendReconnectionContext() {
    if (!global.geminiSessionRef?.current || conversationHistory.length === 0) {
        return;
    }

    try {
        const transcriptions = conversationHistory
            .map(turn => turn.transcription)
            .filter(transcription => transcription && transcription.trim().length > 0);

        if (transcriptions.length === 0) {
            return;
        }

        const contextMessage = `Till now all these questions were asked in the interview, answer the last one please:\n\n${transcriptions.join(
            '\n'
        )}`;

        console.log('Sending reconnection context with', transcriptions.length, 'previous questions');

        await global.geminiSessionRef.current.sendRealtimeInput({
            text: contextMessage,
        });
    } catch (error) {
        console.error('Error sending reconnection context:', error);
    }
}

async function refreshLiveSession(reason = 'manual') {
    if (isRefreshingSession) {
        console.log('Refresh already in progress, skipping duplicate request');
        return;
    }

    if (!lastSessionParams) {
        console.warn('Cannot refresh session - no stored session params');
        return;
    }

    const now = Date.now();
    if (now - lastSessionRefresh < 60000) {
        console.log('Skipping refresh during cooldown window');
        return;
    }

    isRefreshingSession = true;
    turnsSinceRefresh = 0;

    try {
        sendToRenderer('connection-alert', {
            message: `Refreshing Gemini session (${reason})...`,
            severity: 'info',
        });

        if (global.geminiSessionRef?.current) {
            try {
                await global.geminiSessionRef.current.close();
            } catch (error) {
                console.warn('Error closing existing session during refresh:', error.message);
            }
            connectionManager.detachSession();
            global.geminiSessionRef.current = null;
        }

        const session = await initializeGeminiSession(
            lastSessionParams.apiKey,
            lastSessionParams.customPrompt,
            lastSessionParams.profile,
            lastSessionParams.language,
            false
        );

        if (session) {
            global.geminiSessionRef.current = session;
            connectionManager.attachSession(session, lastSessionParams);
            await sendReconnectionContext();
            sendToRenderer('connection-alert', {
                message: 'Gemini session refreshed for faster responses.',
                severity: 'success',
            });
            lastSessionRefresh = Date.now();
        } else {
            sendToRenderer('connection-alert', {
                message: 'Session refresh failed to start a new connection.',
                severity: 'error',
            });
        }
    } catch (error) {
        console.error('Failed to refresh session:', error);
        sendToRenderer('connection-alert', {
            message: 'Session refresh failed. Check logs.',
            severity: 'error',
        });
    } finally {
        isRefreshingSession = false;
    }
}

async function getEnabledTools() {
    const tools = [];

    // Check if Google Search is enabled (default: true)
    const googleSearchEnabled = await getStoredSetting('googleSearchEnabled', 'true');
    console.log('Google Search enabled:', googleSearchEnabled);

    if (googleSearchEnabled === 'true') {
        tools.push({ googleSearch: {} });
        console.log('Added Google Search tool');
    } else {
        console.log('Google Search tool disabled');
    }

    return tools;
}

async function getStoredSetting(key, defaultValue) {
    try {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            // Wait a bit for the renderer to be ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to get setting from renderer process localStorage
            const value = await windows[0].webContents.executeJavaScript(`
                (function() {
                    try {
                        if (typeof localStorage === 'undefined') {
                            console.log('localStorage not available yet for ${key}');
                            return '${defaultValue}';
                        }
                        const stored = localStorage.getItem('${key}');
                        console.log('Retrieved setting ${key}:', stored);
                        return stored || '${defaultValue}';
                    } catch (e) {
                        console.error('Error accessing localStorage for ${key}:', e);
                        return '${defaultValue}';
                    }
                })()
            `);
            return value;
        }
    } catch (error) {
        console.error('Error getting stored setting for', key, ':', error.message);
    }
    console.log('Using default value for', key, ':', defaultValue);
    return defaultValue;
}

async function attemptReconnection(isAuto = false) {
    if (!lastSessionParams) {
        console.log('No stored session params; cannot reconnect');
        return false;
    }

    if (!isAuto) {
        connectionManager.reconnectAttempts = 0;
        connectionManager.longPollMode = false;
    }

    try {
        const session = await initializeGeminiSession(
            lastSessionParams.apiKey,
            lastSessionParams.customPrompt,
            lastSessionParams.profile,
            lastSessionParams.language,
            true
        );

        if (session && global.geminiSessionRef) {
            global.geminiSessionRef.current = session;
            connectionManager.attachSession(session, lastSessionParams);
            console.log('Live session reconnected');

            // Replay context + pending chunks
            await sendReconnectionContext();
            connectionManager.processBufferedChunks();
            return true;
        }
    } catch (error) {
        console.error('Reconnection attempt failed:', error);
        connectionManager.triggerReconnect();
    }

    return false;
}

async function initializeGeminiSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US', isReconnection = false) {
    if (isInitializingSession) {
        console.log('Session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    sendToRenderer('session-initializing', true);

    // Store session parameters for reconnection (only if not already reconnecting)
    if (!isReconnection) {
        lastSessionParams = {
            apiKey,
            customPrompt,
            profile,
            language,
        };
        connectionManager.reconnectAttempts = 0;
    }

    const client = new GoogleGenAI({
        vertexai: false,
        apiKey: apiKey,
    });

    // Get enabled tools first to determine Google Search status
    const enabledTools = await getEnabledTools();
    const googleSearchEnabled = enabledTools.some(tool => tool.googleSearch);

    const systemPrompt = getSystemPrompt(profile, customPrompt, googleSearchEnabled);

    // Initialize new conversation session (only if not reconnecting)
    if (!isReconnection) {
        initializeNewSession();
    }

    try {
        let session;
        session = await client.live.connect({
            model: 'gemini-live-2.5-flash-preview',
            callbacks: {
                onopen: () => {
                    sendToRenderer('update-status', 'Live session connected');
                    connectionManager.attachSession(session, lastSessionParams);
                },
                onmessage: function (message) {
                    console.log('----------------', message);

                    connectionManager.recordInboundActivity();

                    const ackSeqs = extractAckSeqsFromMessage(message);
                    if (ackSeqs.length > 0) {
                        connectionManager.handleAcknowledgements(ackSeqs);
                    }

                    if (message.serverContent?.inputTranscription?.results) {
                        currentTranscription += formatSpeakerResults(message.serverContent.inputTranscription.results);
                    }

                    // Handle AI model response
                    if (message.serverContent?.modelTurn?.parts) {
                        for (const part of message.serverContent.modelTurn.parts) {
                            console.log(part);
                            if (part.text) {
                                messageBuffer += part.text;
                                sendToRenderer('update-response', messageBuffer);
                            }
                        }
                    }

                    if (message.serverContent?.generationComplete) {
                        sendToRenderer('update-response', messageBuffer);

                        // Save conversation turn when we have both transcription and AI response
                        if (currentTranscription && messageBuffer) {
                            saveConversationTurn(currentTranscription, messageBuffer);
                            currentTranscription = ''; // Reset for next turn
                        }

                        sendToRenderer('reset-chat', {
                            reason: 'generationComplete',
                            timestamp: Date.now(),
                            sessionId: currentSessionId,
                        });
                        initializeNewSession();
                        messageBuffer = '';
                        turnsSinceRefresh += 1;
                        if (turnsSinceRefresh >= AUTO_REFRESH_TURN_LIMIT) {
                            refreshLiveSession('turn-threshold');
                        }
                    }

                    if (message.serverContent?.turnComplete) {
                        sendToRenderer('update-status', 'Listening...');
                    }
                },
                onerror: function (e) {
                    console.debug('Error:', e.message);

                    // Check if the error is related to invalid API key
                    const isApiKeyError =
                        e.message &&
                        (e.message.includes('API key not valid') ||
                            e.message.includes('invalid API key') ||
                            e.message.includes('authentication failed') ||
                            e.message.includes('unauthorized'));

                    if (isApiKeyError) {
                        console.log('Error due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Error: Invalid API key');
                        return;
                    }

                    sendToRenderer('update-status', 'Error: ' + e.message);
                },
                onclose: function (e) {
                    console.debug('Session closed:', e.reason);

                    // Check if the session closed due to invalid API key
                    const isApiKeyError =
                        e.reason &&
                        (e.reason.includes('API key not valid') ||
                            e.reason.includes('invalid API key') ||
                            e.reason.includes('authentication failed') ||
                            e.reason.includes('unauthorized'));

                    if (isApiKeyError) {
                        console.log('Session closed due to invalid API key - stopping reconnection attempts');
                        lastSessionParams = null; // Clear session params to prevent reconnection
                        reconnectionAttempts = maxReconnectionAttempts; // Stop further attempts
                        sendToRenderer('update-status', 'Session closed: Invalid API key');
                        return;
                    }

                    // Attempt automatic reconnection for server-side closures
                    connectionManager.detachSession();
                    if (lastSessionParams) {
                        connectionManager.triggerReconnect();
                    }
                },
            },
            config: {
                responseModalities: ['TEXT'],
                tools: enabledTools,
                // Audio transcription configuration
                inputAudioTranscription: {},
                contextWindowCompression: { slidingWindow: {} },
                speechConfig: { languageCode: language },
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
            },
        });

        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        connectionManager.attachSession(session, lastSessionParams);
        return session;
    } catch (error) {
        console.error('Failed to initialize Gemini session:', error);
        isInitializingSession = false;
        sendToRenderer('session-initializing', false);
        return null;
    }
}

function killExistingSystemAudioDump() {
    return new Promise(resolve => {
        console.log('Checking for existing SystemAudioDump processes...');

        // Kill any existing SystemAudioDump processes
        const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
            stdio: 'ignore',
        });

        killProc.on('close', code => {
            if (code === 0) {
                console.log('Killed existing SystemAudioDump processes');
            } else {
                console.log('No existing SystemAudioDump processes found');
            }
            resolve();
        });

        killProc.on('error', err => {
            console.log('Error checking for existing processes (this is normal):', err.message);
            resolve();
        });

        // Timeout after 2 seconds
        setTimeout(() => {
            killProc.kill();
            resolve();
        }, 2000);
    });
}

async function startMacOSAudioCapture(geminiSessionRef) {
    if (process.platform !== 'darwin') return false;

    // Kill any existing SystemAudioDump processes first
    await killExistingSystemAudioDump();

    console.log('Starting macOS audio capture with SystemAudioDump...');

    const { app } = require('electron');
    const path = require('path');

    let systemAudioPath;
    if (app.isPackaged) {
        systemAudioPath = path.join(process.resourcesPath, 'SystemAudioDump');
    } else {
        systemAudioPath = path.join(__dirname, '../assets', 'SystemAudioDump');
    }

    console.log('SystemAudioDump path:', systemAudioPath);

    // Spawn SystemAudioDump with stealth options
    const spawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            // Set environment variables that might help with stealth
            PROCESS_NAME: 'AudioService',
            APP_NAME: 'System Audio Service',
        },
    };

    // On macOS, apply additional stealth measures
    if (process.platform === 'darwin') {
        spawnOptions.detached = false;
        spawnOptions.windowsHide = false;
    }

    systemAudioProc = spawn(systemAudioPath, [], spawnOptions);

    if (!systemAudioProc.pid) {
        console.error('Failed to start SystemAudioDump');
        return false;
    }

    console.log('SystemAudioDump started with PID:', systemAudioProc.pid);

    const CHUNK_DURATION = 0.1;
    const SAMPLE_RATE = 24000;
    const BYTES_PER_SAMPLE = 2;
    const CHANNELS = 2;
    const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

    let audioBuffer = Buffer.alloc(0);

    systemAudioProc.stdout.on('data', data => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= CHUNK_SIZE) {
            const chunk = audioBuffer.slice(0, CHUNK_SIZE);
            audioBuffer = audioBuffer.slice(CHUNK_SIZE);

            const monoChunk = CHANNELS === 2 ? convertStereoToMono(chunk) : chunk;
            const base64Data = monoChunk.toString('base64');
            sendAudioToGemini(base64Data, geminiSessionRef);

            if (process.env.DEBUG_AUDIO) {
                console.log(`Processed audio chunk: ${chunk.length} bytes`);
                saveDebugAudio(monoChunk, 'system_audio');
            }
        }

        const maxBufferSize = SAMPLE_RATE * BYTES_PER_SAMPLE * 1;
        if (audioBuffer.length > maxBufferSize) {
            audioBuffer = audioBuffer.slice(-maxBufferSize);
        }
    });

    systemAudioProc.stderr.on('data', data => {
        console.error('SystemAudioDump stderr:', data.toString());
    });

    systemAudioProc.on('close', code => {
        console.log('SystemAudioDump process closed with code:', code);
        systemAudioProc = null;
    });

    systemAudioProc.on('error', err => {
        console.error('SystemAudioDump process error:', err);
        systemAudioProc = null;
    });

    return true;
}

function convertStereoToMono(stereoBuffer) {
    const samples = stereoBuffer.length / 4;
    const monoBuffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
        const leftSample = stereoBuffer.readInt16LE(i * 4);
        monoBuffer.writeInt16LE(leftSample, i * 2);
    }

    return monoBuffer;
}

function stopMacOSAudioCapture() {
    if (systemAudioProc) {
        console.log('Stopping SystemAudioDump...');
        systemAudioProc.kill('SIGTERM');
        systemAudioProc = null;
    }
}

async function sendAudioToGemini(base64Data, geminiSessionRef) {
    if (!geminiSessionRef.current) return;

    try {
        process.stdout.write('.');
        await geminiSessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            },
        });
    } catch (error) {
        console.error('Error sending audio to Gemini:', error);
    }
}

function setupGeminiIpcHandlers(geminiSessionRef) {
    // Store the geminiSessionRef globally for reconnection access
    global.geminiSessionRef = geminiSessionRef;

    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        const session = await initializeGeminiSession(apiKey, customPrompt, profile, language);
        if (session) {
            geminiSessionRef.current = session;
            return true;
        }
        return false;
    });

    ipcMain.handle('send-audio-content', async (event, { data, mimeType }) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };
        try {
            process.stdout.write('.');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    });

    // Handle microphone audio on a separate channel
    ipcMain.handle('send-mic-audio-content', async (event, { data, mimeType }) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };
        try {
            process.stdout.write(',');
            await geminiSessionRef.current.sendRealtimeInput({
                audio: { data: data, mimeType: mimeType },
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending mic audio:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-image-content', async (event, { data, debug }) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

        try {
            if (!data || typeof data !== 'string') {
                console.error('Invalid image data received');
                return { success: false, error: 'Invalid image data' };
            }

            const buffer = Buffer.from(data, 'base64');

            if (buffer.length < 1000) {
                console.error(`Image buffer too small: ${buffer.length} bytes`);
                return { success: false, error: 'Image buffer too small' };
            }

            process.stdout.write('!');
            await geminiSessionRef.current.sendRealtimeInput({
                media: { data: data, mimeType: 'image/jpeg' },
            });

            return { success: true };
        } catch (error) {
            console.error('Error sending image:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-message', async (event, text) => {
        if (!geminiSessionRef.current) return { success: false, error: 'No active Gemini session' };

        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return { success: false, error: 'Invalid text message' };
            }

            console.log('Sending text message:', text);
            await geminiSessionRef.current.sendRealtimeInput({ text: text.trim() });
            return { success: true };
        } catch (error) {
            console.error('Error sending text:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-macos-audio', async event => {
        if (process.platform !== 'darwin') {
            return {
                success: false,
                error: 'macOS audio capture only available on macOS',
            };
        }

        try {
            const success = await startMacOSAudioCapture(geminiSessionRef);
            return { success };
        } catch (error) {
            console.error('Error starting macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('stop-macos-audio', async event => {
        try {
            stopMacOSAudioCapture();
            return { success: true };
        } catch (error) {
            console.error('Error stopping macOS audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-session', async event => {
        try {
            stopMacOSAudioCapture();

            // Clear session params to prevent reconnection when user closes session
            lastSessionParams = null;

            // Cleanup any pending resources and stop audio/video capture
            if (geminiSessionRef.current) {
                await geminiSessionRef.current.close();
                geminiSessionRef.current = null;
            }

            return { success: true };
        } catch (error) {
            console.error('Error closing session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('force-reconnect', async () => {
        if (!lastSessionParams) {
            return { success: false, error: 'No session to reconnect' };
        }
        attemptReconnection(false);
        return { success: true };
    });

    ipcMain.handle('notify-turn-complete', async (event, details = {}) => {
        try {
            connectionManager.signalTurnComplete(details);
            return { success: true };
        } catch (error) {
            console.error('Failed to notify turn complete:', error);
            return { success: false, error: error.message };
        }
    });

    // Conversation history IPC handlers
    ipcMain.handle('get-current-session', async event => {
        try {
            return { success: true, data: getCurrentSessionData() };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('start-new-session', async event => {
        try {
            initializeNewSession();
            return { success: true, sessionId: currentSessionId };
        } catch (error) {
            console.error('Error starting new session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-google-search-setting', async (event, enabled) => {
        try {
            console.log('Google Search setting updated to:', enabled);
            // The setting is already saved in localStorage by the renderer
            // This is just for logging/confirmation
            return { success: true };
        } catch (error) {
            console.error('Error updating Google Search setting:', error);
            return { success: false, error: error.message };
        }
    });

    // Enhanced chunk-based IPC handlers for input buffer system
        ipcMain.handle('send-audio-chunk', async (event, chunkData) => {
        try {
            const { data, mimeType, isFinal, timestamp, chunkId } = chunkData;
            const seq = queueAudioChunkFromRenderer({
                data,
                mimeType,
                isFinal,
                timestamp,
                chunkId,
            });
            return { success: true, seq };
        } catch (error) {
            console.error('Error queueing audio chunk:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-text-chunk', async (event, chunkData) => {
        try {
            const { text, isFinal, timestamp } = chunkData;
            const seq = queueTextChunkFromRenderer({
                text,
                isFinal,
                timestamp,
            });
            return { success: true, seq };
        } catch (error) {
            console.error('Error queueing text chunk:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    initializeGeminiSession,
    getEnabledTools,
    getStoredSetting,
    sendToRenderer,
    initializeNewSession,
    saveConversationTurn,
    getCurrentSessionData,
    sendReconnectionContext,
    killExistingSystemAudioDump,
    startMacOSAudioCapture,
    convertStereoToMono,
    stopMacOSAudioCapture,
    sendAudioToGemini,
    setupGeminiIpcHandlers,
    attemptReconnection,
    formatSpeakerResults,
};
