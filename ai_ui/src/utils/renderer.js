const FRAME_WAIT_TIMEOUT_MS = 1200;

async function waitForNextVideoFrame(video, maxWait = FRAME_WAIT_TIMEOUT_MS) {
    if (!video) return;
    return new Promise(resolve => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            resolve();
        };

        if (typeof video.requestVideoFrameCallback === 'function') {
            video.requestVideoFrameCallback(() => finish());
        } else {
            const handler = () => {
                video.removeEventListener('timeupdate', handler);
                finish();
            };
            video.addEventListener('timeupdate', handler, { once: true });
        }
        if (maxWait) {
            setTimeout(finish, maxWait);
        }
    });
}

async function drawLatestFrame(forceFullResolution = false) {
    const drawToCanvas = source => {
        offscreenContext.drawImage(source, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    };

    if (imageCapture) {
        try {
            const bitmap = await imageCapture.grabFrame();
            drawToCanvas(bitmap);
            if (bitmap.close) bitmap.close();
            return;
        } catch (error) {
            console.warn('ImageCapture grabFrame failed, falling back to video:', error.message);
            imageCapture = null;
            lastVideoTrackId = null;
        }
    }

    drawToCanvas(hiddenVideo);
}

async function prepareCaptureSurfaces(forceFullResolution = false) {
    if (!mediaStream) {
        throw new Error('No active media stream');
    }

    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState === 'ended') {
        throw new Error('Screen share is not active');
    }

    if (typeof ImageCapture === 'function' && videoTrack.id !== lastVideoTrackId) {
        try {
            imageCapture = new ImageCapture(videoTrack);
            lastVideoTrackId = videoTrack.id;
            console.log('ImageCapture initialized for track', lastVideoTrackId);
        } catch (error) {
            console.warn('ImageCapture not available, using video fallback:', error.message);
            imageCapture = null;
            lastVideoTrackId = null;
        }
    }

    const needsNewVideo = !hiddenVideo;
    if (needsNewVideo) {
        hiddenVideo = document.createElement('video');
        hiddenVideo.muted = true;
        hiddenVideo.playsInline = true;
    }

    if (hiddenVideo.srcObject !== mediaStream) {
        hiddenVideo.srcObject = mediaStream;
    }

    if (hiddenVideo.paused || hiddenVideo.readyState < 2) {
        try {
            await hiddenVideo.play();
        } catch (error) {
            console.warn('Failed to autoplay hidden video for capture:', error);
        }
        await new Promise(resolve => {
            if (hiddenVideo.readyState >= 2) {
                resolve();
                return;
            }
            hiddenVideo.onloadedmetadata = () => resolve();
        });
    }

    await waitForNextVideoFrame(hiddenVideo);

    const downscaleFactor = forceFullResolution ? 1 : localStorage.getItem('fastMode') === 'true' ? 0.5 : 1;
    const targetWidth = Math.max(1, Math.round(hiddenVideo.videoWidth * downscaleFactor));
    const targetHeight = Math.max(1, Math.round(hiddenVideo.videoHeight * downscaleFactor));

    const canvasStale =
        !offscreenCanvas ||
        lastCanvasConfig.width !== targetWidth ||
        lastCanvasConfig.height !== targetHeight ||
        lastCanvasConfig.downscaleFactor !== downscaleFactor;

    if (canvasStale) {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = targetWidth;
        offscreenCanvas.height = targetHeight;
        offscreenContext = offscreenCanvas.getContext('2d');
        lastCanvasConfig = { width: targetWidth, height: targetHeight, downscaleFactor };
        console.log(
            `Refreshed capture canvas ${targetWidth}x${targetHeight} (forceFullResolution=${forceFullResolution})`
        );
    }
}
const { ipcRenderer } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let createTesseractWorker = null;
try {
    const tesseractModule = require('tesseract.js/dist/tesseract.min.js');
    ({ createWorker: createTesseractWorker } = tesseractModule);
} catch (ocrError) {
    console.warn('Tesseract OCR module not available. Leet autodetection disabled.', ocrError);
    createTesseractWorker = null;
}

const toFileUrl = relativePath => pathToFileURL(path.join(__dirname, relativePath)).href;

const TESSERACT_PATHS = {
    workerPath: toFileUrl('..\\node_modules\\tesseract.js\\dist\\worker.min.js'),
    corePath: toFileUrl('..\\node_modules\\tesseract.js-core\\tesseract-core.wasm.js'),
    langPath: toFileUrl('..\\node_modules\\tesseract.js\\dist'),
};

let ocrWorkerPromise = null;

async function getOcrWorker() {
    if (!createTesseractWorker) {
        console.warn('Tesseract createWorker not available');
        return null;
    }

    if (!ocrWorkerPromise) {
        ocrWorkerPromise = (async () => {
            try {
                console.log('Initializing OCR worker with paths:', TESSERACT_PATHS);
                const worker = await createTesseractWorker({
                    workerPath: TESSERACT_PATHS.workerPath,
                    corePath: TESSERACT_PATHS.corePath,
                    langPath: TESSERACT_PATHS.langPath,
                    logger: (msg) => console.log('Tesseract:', msg),
                });

                console.log('Worker created, loading...');
                await worker.load();
                console.log('Worker loaded, loading language...');
                await worker.loadLanguage('eng');
                console.log('Language loaded, initializing...');
                await worker.initialize('eng');
                console.log('OCR worker ready');
                return worker;
            } catch (error) {
                console.error('Failed to initialize OCR worker:', error.message, error);
                ocrWorkerPromise = null;
                return null;
            }
        })();
    }

    return ocrWorkerPromise;
}

let buildLeetScreenshotPrompt;
try {
    ({ buildLeetScreenshotPrompt } = require(path.join(__dirname, 'utils', 'leetAssistant')));
} catch (error) {
    console.error('Failed to load leetAssistant module:', error);
    buildLeetScreenshotPrompt = () =>
        'Leet prompt helper missing. Please reinstall or contact support before using the Leet feature.';
}

const InputBuffer = window.InputBuffer;

function emitAppEvent(name, detail = {}) {
    window.dispatchEvent(
        new CustomEvent(name, {
            detail,
        })
    );
}

window.randomDisplayName = null;

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
const AUDIO_CHUNK_DURATION = 0.1;
const BUFFER_SIZE = 4096;
const SCREEN_CAPTURE_FRAMERATE = 3;

let hiddenVideo = null;
let offscreenCanvas = null;
let offscreenContext = null;
let currentImageQuality = 'fast';
let lastCanvasConfig = {
    width: 0,
    height: 0,
    downscaleFactor: 1,
};
let imageCapture = null;
let lastVideoTrackId = null;
let inputBuffer = null;
let screenshotDebouncer = null;
let lastScreenshotTime = 0;

const SCREENSHOT_MIN_INTERVAL = 2000;
const isLinux = process.platform === 'linux';
const isMacOS = process.platform === 'darwin';

let tokenTracker = {
    tokens: [],
    audioStartTime: null,

    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });
        this.cleanOldTokens();
    },

    calculateImageTokens(width, height) {
        if (width <= 384 && height <= 384) {
            return 258;
        }
        const tilesX = Math.ceil(width / 768);
        const tilesY = Math.ceil(height / 768);
        const totalTiles = tilesX * tilesY;
        return totalTiles * 258;
    },

    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;
        const audioTokens = Math.floor(elapsedSeconds * 32);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    shouldThrottle() {
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

    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
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

ipcRenderer.on('update-status', (event, status) => {
    console.log('Status update:', status);
    cheddar.setStatus(status);
});

ipcRenderer.on('connection-metrics', (event, metrics) => {
    emitAppEvent('connection-metrics', metrics || {});
});

ipcRenderer.on('connection-alert', (event, alert) => {
    emitAppEvent('connection-alert', alert || {});
});

// ipcRenderer.on('update-response', (event, response) => {
//     console.log('Gemini response:', response);
//     cheddar.e().setResponse(response);
//     // You can add UI elements to display the response if needed
// });

async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {
    currentImageQuality = imageQuality;

    tokenTracker.reset();
    console.log('Token tracker reset for new capture session');

    const audioMode = localStorage.getItem('audioMode') || 'speaker_only';

    try {
        if (isMacOS) {
            console.log('Starting macOS capture with SystemAudioDump...');

            const audioResult = await ipcRenderer.invoke('start-macos-audio');
            if (!audioResult.success) {
                throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
            }

            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: SCREEN_CAPTURE_FRAMERATE,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
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
            try {
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: SCREEN_CAPTURE_FRAMERATE,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                });

                console.log('Linux system audio capture via getDisplayMedia succeeded');

                setupLinuxSystemAudioProcessing();
            } catch (systemAudioError) {
                console.warn('System audio via getDisplayMedia failed, trying screen-only capture:', systemAudioError);

                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: SCREEN_CAPTURE_FRAMERATE,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    },
                    audio: false,
                });
            }

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

                    setupLinuxMicProcessing(micStream);
                } catch (micError) {
                    console.warn('Failed to get microphone access on Linux:', micError);
                }
            }

            console.log('Linux capture started - system audio:', mediaStream.getAudioTracks().length > 0, 'microphone mode:', audioMode);
        } else {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: SCREEN_CAPTURE_FRAMERATE,
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

        if (screenshotIntervalSeconds === 'manual' || screenshotIntervalSeconds === 'Manual') {
            console.log('Manual mode enabled - screenshots will be captured on demand only');
        } else {
            const intervalMilliseconds = parseInt(screenshotIntervalSeconds) * 1000;
            screenshotInterval = setInterval(() => captureScreenshot(imageQuality), intervalMilliseconds);
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
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        if (inputBuffer) {
            const success = inputBuffer.addAudioChunk(inputData, Date.now());
            if (success) {
                emitAppEvent('audio-activity', { source: 'mic', success: true, rms: inputBuffer.calculateRMS(inputData) });
            }
        } else {
            audioBuffer.push(...inputData);

            while (audioBuffer.length >= samplesPerChunk) {
                const chunk = audioBuffer.splice(0, samplesPerChunk);
                const pcmData16 = convertFloat32ToInt16(chunk);
                const base64Data = arrayBufferToBase64(pcmData16.buffer);

                const result = await ipcRenderer.invoke('send-mic-audio-content', {
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=24000',
                });
                emitAppEvent('audio-activity', { source: 'mic', success: true });
            }
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);
    micAudioProcessor = micProcessor;
}

function setupLinuxSystemAudioProcessing() {
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

            const result = await ipcRenderer.invoke('send-audio-content', {
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
}

async function captureScreenshot(imageQuality = 'medium', isManual = false, manualPrompt = '', options = {}) {
    const { forceFullResolution = false, manualModeTag = null } = options || {};
    const frameHash = () => {
        if (!offscreenCanvas) return 'no-canvas';
        const ctx = offscreenContext;
        const img = ctx.getImageData(0, 0, 1, 1).data;
        return img.slice(0, 3).join('-');
    };
    const emitManualStatus = (state, extra = {}) => {
        if (!isManual) return;
        emitAppEvent('manual-screenshot-status', {
            state,
            ...extra,
            ...(manualModeTag ? { mode: manualModeTag } : {}),
        });
    };
    console.log(`Capturing ${isManual ? 'manual' : 'automated'} screenshot...`);
    if (!mediaStream) {
        if (isManual && manualModeTag === 'leet') {
            const fileBase64 = await promptLeetImageFileSelection();
            if (!fileBase64) {
                emitManualStatus('error', {
                    message: 'No image selected. Please choose a LeetCode screenshot.',
                });
                return;
            }
            await processManualImageBase64(fileBase64, manualPrompt, manualModeTag, emitManualStatus);
            return;
        }

        emitManualStatus('error', {
            message: 'Screen share is not active. Start capture first.',
        });
        return;
    }

    const now = Date.now();
    
    if (!isManual) {
        if (inputBuffer && inputBuffer.isSpeaking) {
            console.log('📸 Screenshot skipped - audio input active');
            return;
        }
        
        if (now - lastScreenshotTime < SCREENSHOT_MIN_INTERVAL) {
            console.log('📸 Screenshot skipped - too frequent');
            return;
        }
        
        if (tokenTracker.shouldThrottle()) {
            console.log('Automated screenshot skipped due to rate limiting');
            return;
        }
    }
    
    lastScreenshotTime = now;

    await prepareCaptureSurfaces(forceFullResolution);

    if (hiddenVideo.readyState < 2) {
        console.warn('Video not ready yet, skipping screenshot');
        emitManualStatus('error', {
            message: 'Screen preview is still initializing.',
        });
        return;
    }

    await drawLatestFrame(forceFullResolution);

    const beforeHash = frameHash();
    console.log(`Frame hash before capture: ${beforeHash}`);
    
    const centerPixel = offscreenContext.getImageData(
        Math.floor(offscreenCanvas.width / 2),
        Math.floor(offscreenCanvas.height / 2),
        1, 1
    ).data;
    const isCenterBlank = centerPixel.slice(0, 3).every(v => v === 0);
    if (isCenterBlank) {
        console.warn('Center pixel is black - possible stale frame');
    }

    const imageData = offscreenContext.getImageData(0, 0, 1, 1);
    const isBlank = imageData.data.every((value, index) => {
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
            qualityValue = 0.7;
    }

    offscreenCanvas.toBlob(
        async blob => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                emitManualStatus('error', {
                    message: 'Failed to generate screenshot',
                });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                if (!base64data || base64data.length < 100) {
                    console.error('Invalid base64 data generated');
                    emitManualStatus('error', {
                        message: 'Generated screenshot data was empty',
                    });
                    return;
                }

                try {
                    const result = await ipcRenderer.invoke('send-image-content', {
                        data: base64data,
                    });

                    if (result.success) {
                        const imageTokens = tokenTracker.calculateImageTokens(offscreenCanvas.width, offscreenCanvas.height);
                        tokenTracker.addTokens(imageTokens, 'image');
                        console.log(`Image sent successfully - ${imageTokens} tokens used (${offscreenCanvas.width}x${offscreenCanvas.height})`);
                        if (isManual) {
                            await handleManualPromptFromImage(base64data, manualPrompt, manualModeTag);
                            emitManualStatus('sent');
                        }
                    } else {
                        console.error('Failed to send image:', result.error);
                        emitManualStatus('error', {
                            message: result.error,
                        });
                    }
                } catch (error) {
                    console.error('Error sending manual screenshot:', error);
                    emitManualStatus('error', {
                        message: error.message,
                    });
                }
            };
            reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityValue
    );
}

async function captureManualScreenshot(imageQuality = null, manualPrompt = '') {
    console.log('Manual screenshot triggered');
    emitAppEvent('manual-screenshot-status', { state: 'pending', mode: 'manual' });
    
    const isLeetCode = isLikelyLeetCodeContext(manualPrompt);
    
    let finalPrompt = manualPrompt;
    if (isLeetCode && manualPrompt) {
        const match = manualPrompt.match(/\d+/);
        const problemNum = match ? match[0] : '';
        
        if (problemNum) {
            const problemPrompts = {
                '1': `Solve LeetCode Problem 1: Two Sum.
Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`,
                
                '2': `Solve LeetCode Problem 2: Add Two Numbers.
You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.
Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`,
                
                '3': `Solve LeetCode Problem 3: Longest Substring Without Repeating Characters.
Given a string s, find the length of the longest substring without repeating characters.
Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`,
                
                '4': `Solve LeetCode Problem 4: Median of Two Sorted Arrays.
Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.
Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`,
                
                '5': `Solve LeetCode Problem 5: Longest Palindromic Substring.
Given a string s, return the longest palindromic substring in s.
Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`,
                
                '28': `Solve LeetCode Problem 28: Find the Index of the First Occurrence in a String.
Given two strings haystack and needle, return the index of the first occurrence of needle in haystack, or -1 if needle is not part of haystack.
Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`
            };
            
            finalPrompt = problemPrompts[problemNum] || `Solve LeetCode Problem ${problemNum}. Provide complete solution with Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, and Edge Cases.`;
            
            const result = await sendTextMessage(finalPrompt);
            if (!result?.success) {
                console.error('Failed to send LeetCode prompt:', result?.error);
            }
            return;
        }
    }
    
    const quality = imageQuality || currentImageQuality;
    await captureScreenshot(quality, true, finalPrompt, { manualModeTag: 'manual' });
}

async function captureLeetScreenshot(questionContext = '') {
    console.log('LeetCode screenshot triggered');
    console.log('DEBUG: Received questionContext:', JSON.stringify(questionContext));
    
    const problemNumber = questionContext || '';
    
    if (!problemNumber) {
        console.log('No problem number provided. Please type the problem number in the draft field before clicking Leet.');
        emitAppEvent('manual-screenshot-status', {
            state: 'error',
            mode: 'leet',
            message: 'Please type the problem number (e.g., 2, 5, 28) in the text field before clicking Leet.',
        });
        return;
    }
    
    const match = problemNumber.match(/\d+/);
    const problemNum = match ? match[0] : problemNumber;
    
    console.log('Using problem number:', problemNum);
    
    const problemPrompts = {
        '1': `Solve LeetCode Problem 1: Two Sum.
Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**Edge Cases:**

**C++17 Code:** (complete runnable code with line-by-line comments)

**Dry Run:** (step-by-step execution with comments)`,
        
        '2': `Solve LeetCode Problem 2: Add Two Numbers.
You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**Edge Cases:**

**C++17 Code:** (complete runnable code with line-by-line comments)

**Dry Run:** (step-by-step execution with comments)`,
        
        '3': `Solve LeetCode Problem 3: Longest Substring Without Repeating Characters.
Given a string s, find the length of the longest substring without repeating characters.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**Edge Cases:**

**C++17 Code:** (complete runnable code with line-by-line comments)

**Dry Run:** (step-by-step execution with comments)`,
        
        '4': `Solve LeetCode Problem 4: Median of Two Sorted Arrays.
Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**Edge Cases:**

**C++17 Code:** (complete runnable code with line-by-line comments)

**Dry Run:** (step-by-step execution with comments)`,
        
        '5': `Solve LeetCode Problem 5: Longest Palindromic Substring.
Given a string s, return the longest palindromic substring in s.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**Edge Cases:**

**C++17 Code:** (complete runnable code with line-by-line comments)

**Dry Run:** (step-by-step execution with comments)`,
        
        '28': `Solve LeetCode Problem 28: Find the Index of the First Occurrence in a String.
Given two strings haystack and needle, return the index of the first occurrence of needle in haystack, or -1 if needle is not part of haystack.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**C++17 Code:** (complete runnable code with line-by-line comments)
**Dry Run:** (step-by-step execution with comments)
**Edge Cases:`
    };
    
    const finalPrompt = problemPrompts[problemNum] || `Solve LeetCode Problem ${problemNum}.

Requirements:
- Provide solution with O(n) time and O(1) space complexity if possible
- If not possible, provide the next best time and space complexity
- Use ONLY "using namespace std;" (no other namespaces)
- Provide complete runnable code with #include, int main, and all necessary libraries
- Explain each method name and function purpose line by line
- At the end, provide a dry run with line-by-line explanation via comments

Format:
**Problem Summary:** 
**Constraints:** 
**Technique:** 
**Complexity:** 
**Edge Cases:**

**C++17 Code:** (complete runnable code with line-by-line comments)

**Dry Run:** (step-by-step execution with comments)`;
    
    console.log(' Sending prompt for problem', problemNum);
    

    
    const result = await sendTextMessage(finalPrompt);
    
    if (!result?.success) {
        console.error('Failed to send prompt:', result?.error);
        emitAppEvent('manual-screenshot-status', {
            state: 'error',
            mode: 'leet',
            message: 'Failed to send prompt: ' + (result?.error || 'unknown error'),
        });
    } else {
        emitAppEvent('manual-screenshot-status', {
            state: 'success',
            mode: 'leet',
            message: `Successfully sent prompt for Problem ${problemNum}`,
        });
    }
}




window.captureManualScreenshot = captureManualScreenshot;
window.captureLeetScreenshot = captureLeetScreenshot;


function stopCapture() {
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }

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

    if (isMacOS) {
        ipcRenderer.invoke('stop-macos-audio').catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }

    if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
        hiddenVideo = null;
    }
    offscreenCanvas = null;
    offscreenContext = null;
}

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

const LEETCODE_SIGNAL_PATTERNS = [
    /leetcode/i,
    /\blc\s*#?\s*\d+/i,
    /\bleet code/i,
];

function isLikelyLeetCodeContext(promptText = '') {
    const normalized = (promptText || '').trim();
    if (!normalized) return false;
    return LEETCODE_SIGNAL_PATTERNS.some(pattern => pattern.test(normalized));
}

function buildManualScreenshotPrompt(userPrompt = '') {
    const trimmed = userPrompt.trim();
    const contextLine = trimmed
        ? `Screenshot context: ${trimmed}`
        : 'Screenshot context: Visual content only (no extra user text).';
    return `${contextLine}

Rules:
- Describe only what is visible and give the most helpful next action in ≤3 sentences.
- If this is a LeetCode or coding challenge problem, provide a helpful solution with the same format as the Leet button (Problem Summary, Constraints, Technique, Complexity, C++17 Code, Dry Run, Edge Cases).
- Otherwise, keep the response practical and concise.`;
}

function buildManualLeetRefusalPrompt(userPrompt = '') {
    const reason = userPrompt ? `User hint: ${userPrompt}` : 'The user appears to be on a LeetCode page.';
    return `${reason}\n\nInstruction: The user pressed the general screenshot button for a LeetCode problem. Politely refuse to solve it and tell them to press the dedicated "Leet" button to get coding help.`;
}

async function sendManualScreenshotPrompt(manualPrompt = '') {
    const trimmed = (manualPrompt || '').trim();
    const message = buildManualScreenshotPrompt(trimmed);
    return sendTextMessage(message);
}

async function sendLeetScreenshotPrompt(manualPrompt = '') {
    return sendTextMessage(buildLeetScreenshotPrompt(manualPrompt || ''));
}

function buildLeetContextPayload(ocrContext = '', manualPrompt = '') {
    const segments = [];
    if (ocrContext) {
        segments.push(`Detected question: ${ocrContext}`);
    }
    if (manualPrompt) {
        segments.push(manualPrompt);
    }
    return segments.join('\n');
}

async function extractLeetQuestionContext(base64data = '') {
    const worker = await getOcrWorker();
    if (!worker) {
        console.warn('OCR worker unavailable, skipping extraction');
        return { title: '', fullText: '' };
    }

    try {
        console.log('Starting OCR on full screenshot...');
        const fullBlob = base64ToBlob(base64data, 'image/jpeg');
        if (!fullBlob) {
            console.warn('Failed to convert base64 to blob');
            return { title: '', fullText: '' };
        }

        const { data } = await worker.recognize(fullBlob, {
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 #:-().,\n',
        });

        const rawText = (data?.text || '').trim();
        console.log('OCR raw text (first 300 chars):', rawText.substring(0, 300));

        if (!rawText) {
            console.warn('OCR returned empty text');
            return { title: '', fullText: '' };
        }

        const title = extractProblemNumberAndTitle(rawText);
        if (title) {
            console.log('Detected question title (OCR):', title);
            console.log('Full extracted text length:', rawText.length);
            return { title, fullText: rawText };
        }

        console.warn('OCR completed but no problem number/title found in text');
        return { title: '', fullText: rawText };
    } catch (error) {
        console.error('OCR extraction failed:', error.message);
        return { title: '', fullText: '' };
    }
}

function extractProblemNumberAndTitle(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (const line of lines) {
        const match = line.match(/^(\d+)\s*[.:\-\)]\s*(.+?)(?:\s*\(|$)/);
        if (match) {
            const [, num, title] = match;
            return `LC ${num} - ${title.trim()}`;
        }
    }
    
    return '';
}

function summarizeLeetQuestionFromText(text) {
    const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return '';
    }

    const strongKeywords = ['leetcode', 'problem', 'add', 'sum', 'array', 'tree', 'graph'];
    const keywordLine = lines.find(line => strongKeywords.some(keyword => line.toLowerCase().includes(keyword)));
    const byNumber = lines.find(line => /^\d+\s*[.:\-)]\s*/.test(line));
    const candidate = keywordLine || byNumber || lines[0];

    const match = candidate.match(/^(\d+)\s*[.:\-)]?\s*(.+)$/);
    if (match) {
        const [, number, title] = match;
        return `LC ${number} - ${title.trim()}`;
    }

    return candidate;
}

function base64ToBlob(base64, mimeType = 'application/octet-stream') {
    if (!base64) {
        return null;
    }

    const byteCharacters = atob(base64);
    const sliceSize = 1024;
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i += 1) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mimeType });
}

async function handleManualPromptFromImage(base64data, manualPrompt, manualModeTag) {
    if (!manualModeTag) {
        return;
    }

    let leetContext = { title: '', fullText: '' };
    if (manualModeTag === 'leet') {
        try {
            leetContext = await extractLeetQuestionContext(base64data);
            if (leetContext.fullText) {
                console.log('Extracted problem text from screenshot');
                await sendTextMessage(`**Extracted Problem Text:**\n\n${leetContext.fullText}`);
            }
        } catch (error) {
            console.warn('OCR failed, will ask Gemini to read the screenshot instead:', error.message);
            leetContext = { title: '', fullText: '' };
        }
    }

    const promptContext = manualModeTag === 'leet'
        ? buildLeetContextPayload(leetContext.title, manualPrompt)
        : manualPrompt || '';

    const builtPrompt = manualModeTag === 'leet'
        ? buildLeetScreenshotPrompt(promptContext)
        : buildManualScreenshotPrompt(promptContext);

    console.log(`Sending prompt (${manualModeTag}):`, builtPrompt);
    const promptResult = await sendTextMessage(builtPrompt);
    if (!promptResult?.success) {
        throw new Error(promptResult?.error || 'Failed to send screenshot prompt');
    }
}

let leetFileInput = null;

function ensureLeetImageInput() {
    if (leetFileInput) {
        return leetFileInput;
    }

    leetFileInput = document.createElement('input');
    leetFileInput.type = 'file';
    leetFileInput.accept = 'image/png,image/jpeg';
    leetFileInput.style.display = 'none';
    document.body.appendChild(leetFileInput);
    return leetFileInput;
}

async function promptLeetImageFileSelection() {
    const input = ensureLeetImageInput();

    return new Promise(resolve => {
        const cleanup = () => {
            input.value = '';
            input.onchange = null;
        };

        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) {
                cleanup();
                resolve(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                cleanup();
                resolve(base64);
            };
            reader.onerror = () => {
                cleanup();
                resolve(null);
            };
            reader.readAsDataURL(file);
        };

        input.click();
    });
}

async function processManualImageBase64(base64data, manualPrompt, manualModeTag, emitManualStatus) {
    if (!base64data) {
        emitManualStatus?.('error', { message: 'No image data provided.' });
        return;
    }

    try {
        const dimensions = await getImageDimensionsFromBase64(base64data);
        const result = await ipcRenderer.invoke('send-image-content', {
            data: base64data,
        });

        if (!result.success) {
            emitManualStatus?.('error', { message: result.error || 'Failed to send image' });
            return;
        }

        if (dimensions) {
            const { width, height } = dimensions;
            const imageTokens = tokenTracker.calculateImageTokens(width, height);
            tokenTracker.addTokens(imageTokens, 'image');
            console.log(`Image sent successfully - ${imageTokens} tokens used (${width}x${height})`);
        }

        await handleManualPromptFromImage(base64data, manualPrompt, manualModeTag);
        emitManualStatus?.('sent');
    } catch (error) {
        console.error('Error processing manual image:', error);
        emitManualStatus?.('error', { message: error.message });
    }
}

async function getImageDimensionsFromBase64(base64data) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/jpeg;base64,${base64data}`;
    });
}

async function createQuestionCropBlob(base64data) {
    const image = await loadImageFromBase64(base64data);
    if (!image) {
        return null;
    }

    const cropRect = computeQuestionCropRect(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = cropRect.width;
    canvas.height = cropRect.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(
        image,
        cropRect.x,
        cropRect.y,
        cropRect.width,
        cropRect.height,
        0,
        0,
        cropRect.width,
        cropRect.height
    );

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
    return base64ToBlob(croppedBase64, 'image/jpeg');
}

function computeQuestionCropRect(width, height) {
    const cropWidth = Math.max(1, Math.round(width * 0.6));
    const cropHeight = Math.max(1, Math.round(height * 0.4));
    const cropX = Math.round(width * 0.2);
    const cropY = Math.round(height * 0.05);
    return {
        x: clamp(cropX, 0, Math.max(0, width - cropWidth)),
        y: clamp(cropY, 0, Math.max(0, height - cropHeight)),
        width: clamp(cropWidth, 1, width),
        height: clamp(cropHeight, 1, height),
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

async function loadImageFromBase64(base64data) {
    if (!base64data) {
        return null;
    }

    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `data:image/jpeg;base64,${base64data}`;
    });
}

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
            const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sessions);
        };
    });
}

ipcRenderer.on('save-conversation-turn', async (event, data) => {
    try {
        await saveConversationSession(data.sessionId, data.fullHistory);
        console.log('Conversation session saved:', data.sessionId);
    } catch (error) {
        console.error('Error saving conversation session:', error);
    }
});

initConversationStorage().catch(console.error);

ipcRenderer.on('clear-sensitive-data', () => {
    console.log('Clearing renderer-side sensitive data...');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('customPrompt');
});

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

function initializeInputBuffer() {
    if (typeof InputBuffer !== 'undefined') {
        inputBuffer = new InputBuffer();
        inputBuffer.updateConfig({
            textAutoFinalizeEnabled: false,
            autoFinalizeIdleThreshold: 2000,
        });
        
        inputBuffer.onPartialTranscript = (transcript) => {
            console.log('Partial transcript:', transcript);
            emitAppEvent('partial-transcript', { text: transcript });
            maybeEmitInterviewerQuestion(transcript, 'partial-transcript');
        };
        
        inputBuffer.onFinalInput = (inputData) => {
            console.log('Final input ready:', inputData);
            emitAppEvent('input-finalized', inputData);
            if (inputData?.textContent) {
                maybeEmitInterviewerQuestion(inputData.textContent, 'input-finalized');
            }
        };
        
        inputBuffer.onStateChange = (newState, oldState) => {
            console.log(`Input state: ${oldState} → ${newState}`);
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
        
        console.log('Enhanced input buffer system initialized');
    } else {
        console.warn('InputBuffer not available, using fallback processing');
    }
}

function safeInitializeInputBuffer() {
    try {
        initializeInputBuffer();
    } catch (error) {
        console.error('Error initializing input buffer:', error);
        setTimeout(safeInitializeInputBuffer, 1000);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitializeInputBuffer);
} else {
    setTimeout(safeInitializeInputBuffer, 500);
}

let enoraTheEonApp = document.querySelector('enora-theeon-app');
if (!enoraTheEonApp) {
    const waitForApp = () => {
        enoraTheEonApp = document.querySelector('enora-theeon-app');
        if (!enoraTheEonApp) {
            setTimeout(waitForApp, 100);
        }
    };
    waitForApp();
}

const QUESTION_KEYWORDS = ['why', 'what', 'how', 'where', 'when', 'which', 'who', 'can you', 'could you', 'would you', 'will you', 'did you', 'explain', 'tell me', 'walk me', 'help me understand'];
let lastInterviewerQuestion = {
    fingerprint: null,
    timestamp: 0,
};

function normalizeQuestionText(rawText = '') {
    return rawText.replace(/\s+/g, ' ').trim();
}

function looksLikeQuestion(text) {
    if (!text || text.length < 4) return false;
    const lower = text.toLowerCase();
    if (lower.endsWith('?')) return true;
    return QUESTION_KEYWORDS.some(keyword => lower.startsWith(`${keyword} `) || lower.includes(` ${keyword} `));
}

function maybeEmitInterviewerQuestion(text, source = 'unknown') {
    const normalized = normalizeQuestionText(text);
    if (!looksLikeQuestion(normalized)) return;

    const fingerprint = normalized.replace(/[?.!,]/g, '').toLowerCase();
    const now = Date.now();
    if (fingerprint && fingerprint === lastInterviewerQuestion.fingerprint && now - lastInterviewerQuestion.timestamp < 1500) {
        return;
    }

    lastInterviewerQuestion = { fingerprint, timestamp: now };
    emitAppEvent('interviewer-question', {
        text: normalized,
        source,
        timestamp: now,
    });
}

function handleTextInput(text, isComplete = false) {
    if (inputBuffer) {
        inputBuffer.addTextInput(text, isComplete);
    } else {
        if (isComplete) {
            sendTextMessage(text);
        }
    }
}

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

const cheddar = {
    element: () => enoraTheEonApp || document.querySelector('enora-theeon-app'),
    e: () => enoraTheEonApp || document.querySelector('enora-theeon-app'),

    getCurrentView: () => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        return app ? app.currentView : 'main';
    },
    getLayoutMode: () => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        return app ? app.layoutMode : 'normal';
    },

    setStatus: text => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        if (app && app.setStatus) app.setStatus(text);
    },
    setResponse: response => {
        const app = enoraTheEonApp || document.querySelector('enora-theeon-app');
        if (app && app.setResponse) app.setResponse(response);
    },

    initializeGemini,
    startCapture,
    stopCapture,
    captureManualScreenshot,
    sendTextMessage,
    handleShortcut,
    
    handleTextInput,
    sendAudioChunk: sendAudioChunkToGemini,
    sendTextChunk: sendTextChunkToGemini,
    notifyTurnComplete,
    
    getInputStatus: () => inputBuffer ? inputBuffer.getStatus() : null,
    resetInput: () => inputBuffer ? inputBuffer.reset() : null,
    configureInput: (config) => inputBuffer ? inputBuffer.updateConfig(config) : null,

    getAllConversationSessions,
    getConversationSession,
    initConversationStorage,

    getContentProtection: () => {
        const contentProtection = localStorage.getItem('contentProtection');
        return contentProtection !== null ? contentProtection === 'true' : true;
    },

    isLinux: isLinux,
    isMacOS: isMacOS,
};

window.cheddar = cheddar;
