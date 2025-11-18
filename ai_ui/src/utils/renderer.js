// renderer.js - Enhanced Enora The Eon Input System
const { ipcRenderer } = require('electron');

// InputBuffer is provided via global script include (utils/inputBuffer.js)
const InputBuffer = window.InputBuffer;

function emitAppEvent(name, detail = {}) {
    window.dispatchEvent(
        new CustomEvent(name, {
            detail,
        })
    );
}

// Initialize random display name for UI components
window.randomDisplayName = null;

// Request random display name from main process
ipcRenderer
    .invoke('get-random-display-name')
    .then(name => {
        window.randomDisplayName = name;
        console.log('Set random display name:', name);
    })
    .catch(err => {
        console.warn('Could not get random display name:', err);
        window.randomDisplayName = 'System Monitor';
    });

let mediaStream = null;
let screenshotInterval = null;
let audioContext = null;
let audioProcessor = null;
let micAudioProcessor = null;
let audioBuffer = [];
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1; // seconds
const BUFFER_SIZE = 4096; // Increased buffer size for smoother audio

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'fast'; // Store current image quality for manual screenshots

// Enhanced input buffer system
let inputBuffer = null;
let screenshotDebouncer = null;
let lastScreenshotTime = 0;
const SCREENSHOT_MIN_INTERVAL = 2000; // Minimum 2 seconds between screenshots

const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

// Token tracking system for rate limiting
let tokenTracker = {
    tokens: [], // Array of {timestamp, count, type} objects
    audioStartTime: null,

    // Add tokens to the tracker
    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        // Clean old tokens (older than 1 minute)
        this.cleanOldTokens();
    },

    // Calculate image tokens based on Gemini 2.0 rules
    calculateImageTokens(width, height) {
        // Images ≤384px in both dimensions = 258 tokens
        if (width <= 384 && height <= 384) {
            return 258;
        }

async function captureManualScreenshot(imageQualityOverride = null) {
    const quality = imageQualityOverride || currentImageQuality || 'medium';
    return captureScreenshot(quality, true);
}

        // Larger images are tiled into 768x768 chunks, each = 258 tokens
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;

        return totalTiles * 258;
    },

    // Track audio tokens continuously
    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        // Audio = 32 tokens per second
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    // Clean tokens older than 1 minute
    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    // Get total tokens in the last minute
    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    // Check if we should throttle based on settings
    shouldThrottle() {
        // Get rate limiting settings from localStorage
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '1000000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        console.log(`Token check: ${currentTokens}/${maxTokensPerMin} (throttle at ${throttleThreshold})`);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function initializeGemini(profile = 'interview', language = 'en-US') {
    const apiKey = localStorage.getItem('apiKey')?.trim();
    if (apiKey) {
        const success = await ipcRenderer.invoke('initialize-gemini', apiKey, localStorage.getItem('customPrompt') || '', profile, language);
        if (success) {
            cheddar.setStatus('Live');
        } else {
            cheddar.setStatus('error');
        }
    }
}

// Listen for status updates
ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    cheddar.setStatus(status);
});

// Connection health events
ipcRenderer.on('connection-metrics', (event, metrics) => {
    emitAppEvent('connection-metrics', metrics || {});
});

ipcRenderer.on('connection-alert', (event, alert) => {
    emitAppEvent('connection-alert', alert || {});
});

// Listen for responses - REMOVED: This is handled in EnoraTheEonApp.js to avoid duplicates
// ipcRenderer.on('update-response', (event, response) => {
//     console.log('Gemini response:', response);
//     cheddar.e().setResponse(response);
//     // You can add UI elements to display the response if needed
// });

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    // Store the image quality for manual screenshots
    currentImageQuality = imageQuality;

    // Reset token tracker when starting new capture session
    tokenTracker.reset();
    console.log('🎯 Token tracker reset for new capture session');

    const audioMode = localStorage.getItem('audioMode') || 'speaker_only';

    try {
        if (isMacOS) {
            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen
            console.log('Starting macOS capture with SystemAudioDump...');

            // Start macOS audio capture
            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            // Get screen capture for screenshots
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use browser audio on macOS
            });

            console.log('macOS screen capture started - audio handled by SystemAudioDump');

            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('macOS microphone capture started');
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on macOS:', micError);
                }
            }
        } else if (isLinux) {
            // Linux - use display media for screen capture and try to get system audio
            try {
                // First try to get system audio via getDisplayMedia (works on newer browsers)
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false, // Don't cancel system audio
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

                console.log('Linux system audio capture via getDisplayMedia succeeded');

                // Setup audio processing for Linux system audio
                setupLinuxSystemAudioProcessing();
            } catch (systemAudioError) {
                console.warn('System audio via getDisplayMedia failed, trying screen-only capture:', systemAudioError);

                // Fallback to screen-only capture
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });
            }

            // Additionally get microphone input for Linux based on audio mode
            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });

                    console.log('Linux microphone capture started');

                    // Setup audio processing for microphone on Linux
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                    // Continue without microphone if permission denied
                }
            }

            console.log('Linux capture started - system audio:', mediaStream.getAudioTracks().length > 0, 'microphone mode:', audioMode);
        } else {
            // Windows - use display media with loopback for system audio
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            console.log('Windows capture started with loopback audio');

            // Setup audio processing for Windows loopback audio only
            setupWindowsLoopbackProcessing();

            if (audioMode === 'mic_only' || audioMode === 'both') {
                let micStream = null;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: SAMPLE_RATE,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                        },
                        video: false,
                    });
                    console.log('Windows microphone capture started');
                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Windows:', micError);
                }
            }
        }

        console.log('MediaStream obtained:', {
            hasVideo: mediaStream.getVideoTracks().length > 0,
            hasAudio: mediaStream.getAudioTracks().length > 0,
            videoTrack: mediaStream.getVideoTracks()[0]?.getSettings(),
        });

        // Start capturing screenshots - check if manual mode
        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
            // Don't start automatic capture in manual mode
        } else {
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);

            // Capture first screenshot immediately
            setTimeout(() => captureScreenshot(imageQuality), 100);
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        cheddar.setStatus('Capture failed. Click "Retry Capture" to try again.');
        emitAppEvent('capture-error', {
            message: err?.message || 'Unknown capture error',
        });
    }
}

function setupLinuxMicProcessing(micStream) {
    // Setup enhanced microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Add to enhanced input buffer for VAD and smart processing
        if (inputBuffer) {
            const success = inputBuffer.addAudioChunk(inputData, Date.now());
            if (success) {
                emitAppEvent('audio-activity', { source: 'mic', success: true, rms: inputBuffer.calculateRMS(inputData) });
            }
        } else {
            // Fallback to original processing if buffer not initialized
            audioBuffer.push(...inputData);

            while (audioBuffer.length >= samplesPerChunk) {
                const chunk = audioBuffer.splice(0, samplesPerChunk);
                const pcmData16 = convertFloat32ToInt16(chunk);
                const base64Data = arrayBufferToBase64(pcmData16.buffer);

                await ipcRenderer.invoke('send-mic-audio-content', {
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=24000',
                });
                emitAppEvent('audio-activity', { source: 'mic', success: true });
            }
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    micAudioProcessor = micProcessor;
}

function setupLinuxSystemAudioProcessing() {
    // Setup enhanced system audio processing for Linux (from getDisplayMedia)
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Add to enhanced input buffer for VAD and smart processing
        if (inputBuffer) {
            const success = inputBuffer.addAudioChunk(inputData, Date.now());
            if (success) {
                emitAppEvent('audio-activity', { source: 'system', success: true, rms: inputBuffer.calculateRMS(inputData) });
            }
        } else {
            // Fallback to original processing
            audioBuffer.push(...inputData);

            while (audioBuffer.length >= samplesPerChunk) {
                const chunk = audioBuffer.splice(0, samplesPerChunk);
                const pcmData16 = convertFloat32ToInt16(chunk);
                const base64Data = arrayBufferToBase64(pcmData16.buffer);

                await ipcRenderer.invoke('send-audio-content', {
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=24000',
                });
                emitAppEvent('audio-activity', { source: 'system', success: true });
            }
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

function setupWindowsLoopbackProcessing() {
    // Setup audio processing for Windows loopback audio only
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    audioProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false) {
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) {
        if (isManual) {
            emitAppEvent('manual-screenshot-status', {
                state: 'error',
                message: 'Screen share is not active. Start capture first.',
            });
        }
        return;
    }

    const now = Date.now();
    
    // Enhanced screenshot debouncing and prioritization
    if (!isManual) {
        // Skip if audio is actively being processed
        if (inputBuffer && inputBuffer.isSpeaking) {
            console.log('📸 Screenshot skipped - audio input active');
            return;
        }
        
        // Apply minimum interval between screenshots
        if (now - lastScreenshotTime < SCREENSHOT_MIN_INTERVAL) {
            console.log('📸 Screenshot skipped - too frequent');
            return;
        }
        
        // Check rate limiting for automated screenshots
        if (tokenTracker.shouldThrottle()) {
            console.log('⚠️ Automated screenshot skipped due to rate limiting');
            return;
        }
    }
    
    lastScreenshotTime = now;

    // Lazy init of video element
    if (!hiddenVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.srcObject = mediaStream;
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
        await hiddenVideo.play();

        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) return resolve();
            hiddenVideo.onloadedmetadata = () => resolve();
        });

        const downscaleFactor = localStorage.getItem('fastMode') === 'true' ? 0.5 : 1;
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = Math.max(1, Math.round(hiddenVideo.videoWidth * downscaleFactor));
        offscreenCanvas.height = Math.max(1, Math.round(hiddenVideo.videoHeight * downscaleFactor));
        offscreenContext = offscreenCanvas.getContext('2d');
    }

    // Check if video is ready
    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        if (isManual) {
            emitAppEvent('manual-screenshot-status', {
                state: 'error',
                message: 'Screen preview is still initializing.',
            });
        }
        return;
    }

    offscreenContext.drawImage(hiddenVideo, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Check if image was drawn properly by sampling a pixel
    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
        // Check if all pixels are black (0,0,0) or transparent
        return index === 3 ? true : value === 0;
    });

    if (isBlank) {
        console.warn('Screenshot appears to be blank/black');
    }

    let qualityValue;
    switch (imageQuality) {
        case 'high':
            qualityValue = 0.9;
            break;
        case 'medium':
            qualityValue = 0.65;
            break;
        case 'low':
            qualityValue = 0.4;
            break;
        default:
            qualityValue = 0.7; // Default to medium
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                if (isManual) {
                    emitAppEvent('manual-screenshot-status', {
                        state: 'error',
                        message: 'Failed to generate screenshot',
                    });
                }
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                // Validate base64 data
                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    if (isManual) {
                        emitAppEvent('manual-screenshot-status', {
                            state: 'error',
                            message: 'Generated screenshot data was empty',
                        });
                    }
                    return;
                }

                try {
                    const result = await ipcRenderer.invoke('send-image-content', {
                        data: base64data,
                    });

                    if (result.success) {
                        // Track image tokens after successful send
                        const imageTokens = tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
                        tokenTracker.addTokens(imageTokens, 'image');
                        console.log(`📊 Image sent successfully - ${imageTokens} tokens used (${offscreenCanvas.width}x${offscreenCanvas.height})`);
                        if (isManual) {
                            emitAppEvent('manual-screenshot-status', {
                                state: 'sent',
                            });
                        }
                    } else {
                        console.error('Failed to send image:', result.error);
                        if (isManual) {
                            emitAppEvent('manual-screenshot-status', {
                                state: 'error',
                                message: result.error,
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error sending manual screenshot:', error);
                    if (isManual) {
                        emitAppEvent('manual-screenshot-status', {
                            state: 'error',
                            message: error.message,
                        });
                    }
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

async function captureManualScreenshot(imageQuality = null, textContext = '') {
    console.log('Manual screenshot triggered');
    emitAppEvent('manual-screenshot-status', { state: 'pending' });
    const quality = imageQuality || currentImageQuality;
    const screenshotPromise = captureScreenshot(quality, true);

    let textPromise = Promise.resolve();
    if (textContext && textContext.trim().length > 0) {
        textPromise = sendTextMessage(`Question on screen: ${textContext.trim()}`);
    }

    await Promise.all([screenshotPromise, textPromise]);
}

// Expose functions to global scope for external access
window.captureManualScreenshot = captureManualScreenshot;

function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

    // Clean up microphone audio processor (Linux only)
    if (micAudioProcessor) {
        micAudioProcessor.disconnect();
        micAudioProcessor = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    // Clean up hidden elements
    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

// Send text message to Gemini
async function sendTextMessage(text) {
    if (!text || text.trim().length === 0) {
        console.warn('Cannot send empty text message');
        return { success: false, error: 'Empty message' };
    }

    try {
        const result = await ipcRenderer.invoke('send-text-message', text);
        if (result.success) {
            console.log('Text message sent successfully');
        } else {
            console.error('Failed to send text message:', result.error);
        }
        return result;
    } catch (error) {
        console.error('Error sending text message:', error);
        return { success: false, error: error.message };
    }
}

// Conversation storage functions using IndexedDB
let conversationDB = null;

async function initConversationStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ConversationHistory', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            conversationDB = request.result;
            resolve(conversationDB);
        };

        request.onupgradeneeded = event => {
            const db = event.target.result;

            // Create sessions store
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'sessionId' });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function saveConversationSession(sessionId, conversationHistory) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');

    const sessionData = {
        sessionId: sessionId,
        timestamp: parseInt(sessionId),
        conversationHistory: conversationHistory,
        lastUpdated: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(sessionData);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getConversationSession(sessionId) {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');

    return new Promise((resolve, reject) => {
        const request = store.get(sessionId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllConversationSessions() {
    if (!conversationDB) {
        await initConversationStorage();
    }

    const transaction = conversationDB.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

// Listen for conversation data from main process
ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

// Initialize conversation storage when renderer loads
initConversationStorage().catch(console.error);

// Listen for emergency erase command from main process
ipcRenderer.on('clear-sensitive-data', () => {
    console.log('Clearing renderer-side sensitive data...');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('customPrompt');
    // Consider clearing IndexedDB as well for full erasure
});

// Handle shortcuts based on current view
function handleShortcut(shortcutKey) {
    const currentView = cheddar.getCurrentView();

    if (shortcutKey === 'ctrl+enter' || shortcutKey === 'cmd+enter') {
        if (currentView === 'main') {
            cheddar.element().handleStart();
        } else {
            captureManualScreenshot();
        }
    }
}

// Initialize enhanced input buffer system
function initializeInputBuffer() {
    if (typeof InputBuffer !== 'undefined') {
        inputBuffer = new InputBuffer();
        
        // Set up callbacks for input buffer events
        inputBuffer.onPartialTranscript = (transcript) => {
            console.log('📝 Partial transcript:', transcript);
            // Update UI with partial transcript
            emitAppEvent('partial-transcript', { text: transcript });
        };
        
        inputBuffer.onFinalInput = (inputData) => {
            console.log('✅ Final input ready:', inputData);
            // Notify UI that input is complete and processing
            emitAppEvent('input-finalized', inputData);
        };
        
        inputBuffer.onStateChange = (newState, oldState) => {
            console.log(`🔄 Input state: ${oldState} → ${newState}`);
            // Update UI status based on input state
            const statusMap = {
                'idle': 'Ready',
                'listening': 'Listening...',
                'buffering': 'Processing input...',
                'finalizing': 'Finalizing response...'
            };
            
            if (cheddar && cheddar.setStatus) {
                cheddar.setStatus(statusMap[newState] || newState);
            }
        };
        
        console.log('🚀 Enhanced input buffer system initialized');
    } else {
        console.warn('⚠️ InputBuffer not available, using fallback processing');
    }
}

// Initialize when DOM is ready with error handling
function safeInitializeInputBuffer() {
    try {
        initializeInputBuffer();
    } catch (error) {
        console.error('Error initializing input buffer:', error);
        // Retry after a delay
        setTimeout(safeInitializeInputBuffer, 1000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitializeInputBuffer);
} else {
    // Wait a bit for all scripts to load
    setTimeout(safeInitializeInputBuffer, 500);
}

// Create reference to the main app element with fallback
let enoraTheEonApp = document.querySelector('enora-theeon-app');
if (!enoraTheEonApp) {
    // Wait for element to be available
    const waitForApp = () => {
        enoraTheEonApp = document.querySelector('enora-theeon-app');
        if (!enoraTheEonApp) {
            setTimeout(waitForApp, 100);
        }
    };
    waitForApp();
}

// Enhanced text input handling
function handleTextInput(text, isComplete = false) {
    if (inputBuffer) {
        inputBuffer.addTextInput(text, isComplete);
    } else {
        // Fallback to direct sending
        if (isComplete) {
            sendTextMessage(text);
        }
    }
}

// Enhanced audio chunk sending with persistent queueing
async function sendAudioChunkToGemini(chunk, isFinal = false) {
    try {
        const pcmData16 = convertFloat32ToInt16(chunk.data);
        const base64Data = arrayBufferToBase64(pcmData16.buffer);

        const payload = {
            data: base64Data,
            mimeType: 'audio/pcm;rate=24000',
            isFinal,
            timestamp: chunk.timestamp || Date.now(),
            chunkId: chunk.chunkId,
        };

        return await ipcRenderer.invoke('send-audio-chunk', payload);
    } catch (error) {
        console.error('Error queueing audio chunk:', error);
        return { success: false, error: error.message };
    }
}

// Enhanced text chunk sending with persistent queueing
async function sendTextChunkToGemini(text, isFinal = false) {
    try {
        const payload = {
            text,
            isFinal,
            timestamp: Date.now(),
        };

        return await ipcRenderer.invoke('send-text-chunk', payload);
    } catch (error) {
        console.error('Error queueing text chunk:', error);
        return { success: false, error: error.message };
    }
}

async function notifyTurnComplete(details = {}) {
    try {
        const payload = {
            reason: details.reason || 'user',
            stats: details.stats || null,
        };
        await ipcRenderer.invoke('notify-turn-complete', payload);
    } catch (error) {
        console.error('Error notifying turn complete:', error);
    }
}

// Consolidated cheddar object - all functions in one place
const cheddar = {
    // Element access with safety checks
    element: () => enoraTheEonApp || document.querySelector('enora-theeon-app'),
    e: () => enoraTheEonApp || document.querySelector('enora-theeon-app'),

    // App state functions - access properties directly from the app element
    getCurrentView: () => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        return app ? app.currentView : 'main';
    },
    getLayoutMode: () => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        return app ? app.layoutMode : 'normal';
    },

    // Status and response functions with safety checks
    setStatus: text => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        if (app && app.setStatus) app.setStatus(text);
    },
    setResponse: response => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        if (app && app.setResponse) app.setResponse(response);
    },

    // Core functionality
    initializeGemini,
    startCapture,
    stopCapture,
    captureManualScreenshot,
    sendTextMessage,
    handleShortcut,
    
    // Enhanced input handling
    handleTextInput,
    sendAudioChunk: sendAudioChunkToGemini,
    sendTextChunk: sendTextChunkToGemini,
    notifyTurnComplete,
    
    // Input buffer management
    getInputStatus: () => inputBuffer ? inputBuffer.getStatus() : null,
    resetInput: () => inputBuffer ? inputBuffer.reset() : null,
    configureInput: (config) => inputBuffer ? inputBuffer.updateConfig(config) : null,

    // Conversation history functions
    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,

    // Content protection function
    getContentProtection: () => {
        const contentProtection = localStorage.getItem('contentProtection');
        return contentProtection !== null ? contentProtection === 'true' : true;
    },

    // Platform detection
    isLinux: isLinux,
    isMacOS: isMacOS,
};

// Make it globally available
window.cheddar = cheddar;
