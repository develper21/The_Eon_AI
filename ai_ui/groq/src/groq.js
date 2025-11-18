// groq.js - Groq API client and session management
const { ipcMain } = require('electron');
const https = require('https');
const { URL } = require('url');

// Session state
let groqSessionRef = { current: null };
let messageBuffer = '';
let isInitializingSession = false;

// Groq API configuration
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_CHAT_ENDPOINT = `${GROQ_BASE_URL}/chat/completions`;
const GROQ_TRANSCRIPTION_ENDPOINT = `${GROQ_BASE_URL}/audio/transcriptions`;

// Default model for chat completions
const DEFAULT_MODEL = 'llama-3.1-70b-versatile';

// Session management
class GroqSession {
    constructor(apiKey, profile = 'interview', language = 'en-US') {
        this.apiKey = apiKey;
        this.profile = profile;
        this.language = language;
        this.conversationHistory = [];
        this.isActive = true;
        this.systemPrompt = this.getSystemPrompt(profile);
    }

    getSystemPrompt(profile) {
        const prompts = {
            interview: `You are an AI assistant helping during job interviews. Provide concise, professional responses that help the user answer interview questions effectively. Keep responses brief and actionable.`,
            sales: `You are an AI assistant helping during sales calls. Provide quick, persuasive talking points and objection handling suggestions. Keep responses short and impactful.`,
            meeting: `You are an AI assistant helping during meetings. Provide brief summaries, action items, and relevant insights. Keep responses concise and professional.`
        };
        return prompts[profile] || prompts.interview;
    }

    async sendChatCompletion(messages, stream = false) {
        const payload = {
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: this.systemPrompt },
                ...messages
            ],
            stream: stream,
            temperature: 0.7,
            max_tokens: 1000
        };

        return this.makeRequest(GROQ_CHAT_ENDPOINT, payload, stream);
    }

    addMessageToHistory(role, content) {
        this.conversationHistory.push({ role, content });
        // Keep conversation history manageable (last 20 messages)
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    async makeRequest(url, payload, stream = false) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const postData = JSON.stringify(payload);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                if (stream) {
                    let accumulatedResponse = '';
                    // Handle streaming response
                    res.on('data', (chunk) => {
                        const lines = chunk.toString().split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim();
                                if (jsonStr === '[DONE]') {
                                    // Add the complete response to conversation history
                                    if (accumulatedResponse.trim()) {
                                        this.addMessageToHistory('assistant', accumulatedResponse.trim());
                                    }
                                    resolve({ success: true, complete: true });
                                    return;
                                }
                                try {
                                    const parsed = JSON.parse(jsonStr);
                                    if (parsed.choices?.[0]?.delta?.content) {
                                        const content = parsed.choices[0].delta.content;
                                        accumulatedResponse += content;
                                        // Emit streaming content to renderer
                                        this.sendToRenderer('update-response', accumulatedResponse);
                                    }
                                } catch (e) {
                                    // Ignore parsing errors for incomplete chunks
                                }
                            }
                        }
                    });
                } else {
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                }

                res.on('end', () => {
                    if (!stream) {
                        try {
                            const response = JSON.parse(data);
                            resolve({ success: true, data: response });
                        } catch (error) {
                            reject(new Error(`Failed to parse response: ${error.message}`));
                        }
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    sendToRenderer(channel, data) {
        // Send updates to renderer process
        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
            global.mainWindow.webContents.send(channel, data);
        }
    }

    async sendTextMessage(text) {
        if (!this.isActive) {
            throw new Error('Session is not active');
        }

        // Add user message to conversation history
        this.addMessageToHistory('user', text);

        try {
            // Send streaming chat completion
            const result = await this.sendChatCompletion(this.conversationHistory, true);
            
            if (result.success) {
                // Note: For streaming, the assistant's response is handled in the stream chunks
                // We'll add it to history when the stream completes
                this.sendToRenderer('update-status', 'Listening...');
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error sending text message to Groq:', error);
            this.sendToRenderer('update-status', `Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async sendImageContent(base64Data) {
        // Groq doesn't support vision models yet, so we'll convert image to text description
        // This is a placeholder - in practice you might use a separate vision API
        const imageDescription = "User shared a screenshot (image analysis not yet supported with Groq)";
        return this.sendTextMessage(`Context: ${imageDescription}`);
    }

    async sendAudioContent(audioData, mimeType) {
        try {
            const transcription = await this.transcribeAudio(audioData, mimeType);
            if (transcription && transcription.text && transcription.text.trim().length > 0) {
                return this.sendTextMessage(transcription.text.trim());
            }
            return { success: false, error: 'No transcription received' };
        } catch (error) {
            console.error('Error processing audio with Groq:', error);
            this.sendToRenderer('update-status', `Groq audio error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async transcribeAudio(audioData, mimeType) {
        const audioBuffer = Buffer.from(audioData, 'base64');
        if (!audioBuffer.length) {
            throw new Error('Empty audio buffer received');
        }

        const sampleRateMatch = /rate=(\d+)/i.exec(mimeType || '');
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
        const wavBuffer = convertPcm16ToWav(audioBuffer, sampleRate);

        const boundary = `----GroqBoundary${Date.now()}`;
        const normalizedLanguage = normalizeGroqLanguage(this.language);
        const fields = {
            model: 'whisper-large-v3',
        };
        if (normalizedLanguage) {
            fields.language = normalizedLanguage;
        }
        const bodyBuffer = buildMultipartBody(boundary, wavBuffer, fields);

        return new Promise((resolve, reject) => {
            const requestOptions = {
                hostname: 'api.groq.com',
                path: '/openai/v1/audio/transcriptions',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': bodyBuffer.length,
                },
            };

            const req = https.request(requestOptions, res => {
                let responseData = '';
                res.on('data', chunk => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (parsed.error) {
                            reject(new Error(parsed.error.message || 'Groq transcription error'));
                            return;
                        }
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error(`Failed to parse transcription response: ${error.message}`));
                    }
                });
            });

            req.on('error', error => {
                reject(new Error(`Groq transcription request failed: ${error.message}`));
            });

            req.write(bodyBuffer);
            req.end();
        });
    }

    close() {
        this.isActive = false;
        this.conversationHistory = [];
    }
}

// Initialize Groq session
async function initializeGroqSession(apiKey, customPrompt = '', profile = 'interview', language = 'en-US') {
    if (isInitializingSession) {
        console.log('Groq session initialization already in progress');
        return false;
    }

    isInitializingSession = true;
    
    try {
        // Test API key with a simple request
        const testSession = new GroqSession(apiKey, profile, language);
        const testResult = await testSession.sendChatCompletion([
            { role: 'user', content: 'Hello' }
        ], false);

        if (testResult.success) {
            groqSessionRef.current = testSession;
            testSession.sendToRenderer('update-status', 'Groq session connected');
            console.log('Groq session initialized successfully');
            return testSession;
        } else {
            throw new Error('Failed to initialize Groq session');
        }
    } catch (error) {
        console.error('Failed to initialize Groq session:', error);
        if (global.mainWindow && !global.mainWindow.isDestroyed()) {
            global.mainWindow.webContents.send('update-status', `Groq Error: ${error.message}`);
        }
        return null;
    } finally {
        isInitializingSession = false;
    }
}

// Setup Groq IPC handlers
function setupGroqIpcHandlers() {
    ipcMain.handle('initialize-groq', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US') => {
        const session = await initializeGroqSession(apiKey, customPrompt, profile, language);
        if (session) {
            return true;
        }
        return false;
    });

    ipcMain.handle('send-groq-text-message', async (event, text) => {
        if (!groqSessionRef.current) {
            return { success: false, error: 'No active Groq session' };
        }

        try {
            return await groqSessionRef.current.sendTextMessage(text);
        } catch (error) {
            console.error('Error sending text to Groq:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-groq-image-content', async (event, { data }) => {
        if (!groqSessionRef.current) {
            return { success: false, error: 'No active Groq session' };
        }

        try {
            return await groqSessionRef.current.sendImageContent(data);
        } catch (error) {
            console.error('Error sending image to Groq:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-groq-audio-content', async (event, { data, mimeType }) => {
        if (!groqSessionRef.current) {
            return { success: false, error: 'No active Groq session' };
        }

        try {
            return await groqSessionRef.current.sendAudioContent(data, mimeType);
        } catch (error) {
            console.error('Error sending audio to Groq:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('close-groq-session', async (event) => {
        try {
            if (groqSessionRef.current) {
                groqSessionRef.current.close();
                groqSessionRef.current = null;
            }
            return { success: true };
        } catch (error) {
            console.error('Error closing Groq session:', error);
            return { success: false, error: error.message };
        }
    });
}

// Add sendToRenderer function for compatibility
function sendToRenderer(channel, data) {
    if (global.mainWindow && !global.mainWindow.isDestroyed()) {
        global.mainWindow.webContents.send(channel, data);
    }
}

function convertPcm16ToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const dataSize = pcmBuffer.length;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(dataSize + 36, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

function buildMultipartBody(boundary, wavBuffer, fields = {}) {
    const CRLF = '\r\n';
    const parts = [];

    Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        parts.push(Buffer.from(`--${boundary}${CRLF}`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}`));
        parts.push(Buffer.from(`${value}${CRLF}`));
    });

    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.wav"${CRLF}`));
    parts.push(Buffer.from(`Content-Type: audio/wav${CRLF}${CRLF}`));
    parts.push(wavBuffer);
    parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));

    return Buffer.concat(parts);
}

function normalizeGroqLanguage(language) {
    if (!language) return null;
    const base = language.split(/[-_]/)[0]?.toLowerCase();
    if (!base) return null;

    const supported = new Set([
        'af','am','ar','as','az','ba','be','bg','bn','bo','br','bs','ca','cs','cy','da','de','el','en','es','et','eu','fa','fi','fo','fr','gl','gu','ha','haw','he','hi','hr','ht','hu','hy','id','is','it','ja','jv','ka','kk','km','kn','ko','lb','lo','ln','lt','lv','mg','mi','mk','ml','mn','mr','ms','mt','my','ne','nl','nn','no','oc','pa','pl','ps','pt','ro','ru','sa','sd','si','sk','sl','sn','so','sq','sr','su','sv','sw','ta','te','tg','th','tk','tl','tr','tt','uk','ur','uz','vi','yi','yo','yue','zh'
    ]);

    return supported.has(base) ? base : null;
}

module.exports = {
    initializeGroqSession,
    setupGroqIpcHandlers,
    GroqSession,
    sendToRenderer
};
