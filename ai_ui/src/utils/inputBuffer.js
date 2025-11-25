// Enhanced Input Buffer System for Enora The Eon
// Handles unlimited-length audio/text input with VAD and smart chunking

class InputBuffer {
    constructor() {
        // Audio buffer configuration
        this.audioChunks = [];
        this.audioSampleRate = 24000;
        this.chunkDuration = 0.1; // 100ms chunks
        this.maxAudioChunks = 1000; // ~100 seconds of audio
        
        // VAD (Voice Activity Detection) configuration
        this.vadThreshold = 0.006; // RMS threshold for speech detection
        this.silenceThreshold = 500; // ms of silence before finalizing (faster turnaround)
        this.minSpeechDuration = 150; // minimum speech duration to consider valid
        this.lastSpeechTime = 0;
        this.lastActivityTime = 0;
        this.isSpeaking = false;
        this.speechStartTime = 0;
        this.maxSpeechDuration = 7000; // allow up to ~7 seconds of speech before hard cutoff
        
        // Text buffer configuration
        this.textBuffer = '';
        this.textChunks = [];
        this.lastTextActivity = 0;
        this.textSilenceThreshold = 300; // ms of no typing before considering complete
        this.autoFinalizeIdleThreshold = 400; // finalize if nothing new for 400ms
        
        // State management
        this.state = 'idle'; // idle, listening, buffering, finalizing
        this.currentSessionId = null;
        this.isFinalized = false;
        this.partialTranscript = '';
        
        // Queue and backpressure
        this.processingQueue = [];
        this.maxQueueSize = 500;
        this.isProcessing = false;
        
        // Callbacks
        this.onPartialTranscript = null;
        this.onFinalInput = null;
        this.onStateChange = null;
        
        // Performance tracking
        this.stats = {
            chunksProcessed: 0,
            totalAudioDuration: 0,
            averageLatency: 0,
            droppedChunks: 0
        };
        
        // Start VAD timer after a short delay to ensure DOM is ready
        setTimeout(() => this.startVADTimer(), 100);
    }
    
    // Voice Activity Detection
    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }
    
    calculateZeroCrossings(audioData) {
        let crossings = 0;
        for (let i = 1; i < audioData.length; i++) {
            if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / audioData.length;
    }
    
    detectSpeech(audioData) {
        const rms = this.calculateRMS(audioData);
        const zeroCrossings = this.calculateZeroCrossings(audioData);
        
        // Enhanced VAD using both RMS and zero-crossing rate
        const isSpeech = rms > this.vadThreshold && zeroCrossings > 0.01;
        
        const now = Date.now();
        
        if (isSpeech) {
            this.lastSpeechTime = now;
            this.lastActivityTime = now;
            
            if (!this.isSpeaking) {
                this.isSpeaking = true;
                this.speechStartTime = now;
                this.setState('listening');
                console.log('🎤 Speech detected - starting to listen');
                
                // Show loader when user starts speaking
                if (typeof EnoraLoader !== 'undefined') {
                    EnoraLoader.show('Listening...', 'Speak now...');
                }
            }
        }
        
        return isSpeech;
    }
    
    // Audio input handling
    addAudioChunk(audioData, timestamp = Date.now()) {
        if (this.isFinalized) return false;
        
        const isSpeech = this.detectSpeech(audioData);
        this.lastInputType = 'audio';
        
        const chunk = {
            data: audioData,
            timestamp,
            rms: this.calculateRMS(audioData),
            isSpeech,
            chunkId: this.stats.chunksProcessed++
        };
        
        // Apply backpressure if buffer is full
        if (this.audioChunks.length >= this.maxAudioChunks) {
            // Remove oldest non-speech chunks first
            const oldestNonSpeech = this.audioChunks.findIndex(c => !c.isSpeech);
            if (oldestNonSpeech !== -1) {
                this.audioChunks.splice(oldestNonSpeech, 1);
                this.stats.droppedChunks++;
            } else {
                // If all chunks are speech, remove oldest
                this.audioChunks.shift();
                this.stats.droppedChunks++;
            }
        }
        
        this.audioChunks.push(chunk);
        this.stats.totalAudioDuration += this.chunkDuration;
        
        // Queue for processing if we have speech
        if (isSpeech && this.state !== 'finalizing') {
            this.queueChunkForProcessing(chunk, false);
        }
        
        return true;
    }
    
    // Text input handling
    addTextInput(text, isComplete = false) {
        if (this.isFinalized) return false;
        
        const now = Date.now();
        this.lastTextActivity = now;
        this.lastActivityTime = now;
        
        this.lastInputType = 'text';

        if (isComplete) {
            this.textBuffer = text;
            this.finalizeInput('text');
        } else {
            this.textBuffer = text;
            this.setState('buffering');
            
            // Queue partial text update
            this.queueTextForProcessing(text, false);
        }
        
        return true;
    }
    
    // Queue management
    queueChunkForProcessing(chunk, isFinal) {
        if (this.processingQueue.length >= this.maxQueueSize) {
            // Apply intelligent dropping - keep recent speech chunks
            const oldestIndex = this.processingQueue.findIndex(item => 
                item.type === 'audio' && !item.data.isSpeech
            );
            if (oldestIndex !== -1) {
                this.processingQueue.splice(oldestIndex, 1);
            } else {
                this.processingQueue.shift(); // Remove oldest
            }
        }
        
        this.processingQueue.push({
            type: 'audio',
            data: chunk,
            isFinal,
            timestamp: Date.now()
        });
        
        this.processQueue();
    }
    
    queueTextForProcessing(text, isFinal) {
        // Merge consecutive text updates to reduce queue pressure
        const lastItem = this.processingQueue[this.processingQueue.length - 1];
        if (lastItem && lastItem.type === 'text' && !lastItem.isFinal) {
            lastItem.data = text;
            lastItem.isFinal = isFinal;
            lastItem.timestamp = Date.now();
        } else {
            this.processingQueue.push({
                type: 'text',
                data: text,
                isFinal,
                timestamp: Date.now()
            });
        }
        
        this.processQueue();
    }
    
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
            while (this.processingQueue.length > 0) {
                const item = this.processingQueue.shift();
                const startTime = Date.now();
                
                if (item.type === 'audio') {
                    await this.sendAudioChunk(item.data, item.isFinal);
                } else if (item.type === 'text') {
                    await this.sendTextChunk(item.data, item.isFinal);
                }
                
                // Update latency stats
                const latency = Date.now() - startTime;
                this.stats.averageLatency = (this.stats.averageLatency + latency) / 2;
                
                // Yield control to prevent blocking
                if (this.processingQueue.length > 10) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
        } catch (error) {
            console.error('Error processing queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }
    
    // VAD timer for silence detection
    startVADTimer() {
        setInterval(() => {
            if (this.state === 'idle' || this.isFinalized) return;
            
            const now = Date.now();
            const silenceDuration = now - this.lastSpeechTime;
            const totalSilence = now - this.lastActivityTime;
            
            // Check for speech completion
            if (this.isSpeaking && silenceDuration > this.silenceThreshold) {
                const speechDuration = this.lastSpeechTime - this.speechStartTime;
                
                if (speechDuration > this.minSpeechDuration) {
                    console.log(`🔇 Silence detected after ${speechDuration}ms of speech - finalizing input`);
                    this.finalizeInput('speech');
                } else {
                    console.log('🔇 Short speech ignored, continuing to listen');
                    this.isSpeaking = false;
                }
            }
            
            // Check for text completion (no typing activity)
            if (this.textAutoFinalizeEnabled && this.textBuffer && totalSilence > this.textSilenceThreshold) {
                console.log('⌨️ Text input timeout - finalizing');
                this.finalizeInput('text');
            }

            const shouldAutoFinalizeIdle =
                !this.isFinalized &&
                (this.state === 'listening' ||
                    (this.state === 'buffering' && (this.lastInputType !== 'text' || this.textAutoFinalizeEnabled)));

            if (shouldAutoFinalizeIdle) {
                const idleFor = now - this.lastActivityTime;
                if (idleFor > this.autoFinalizeIdleThreshold) {
                    console.log('⏩ Idle finalize triggered');
                    this.finalizeInput('idle');
                }
            }

            if (this.isSpeaking && this.maxSpeechDuration && now - this.speechStartTime > this.maxSpeechDuration) {
                console.log('⏱️ Max speech duration reached - finalizing');
                this.finalizeInput('speech');
            }

        }, 100); // Check every 100ms for responsive VAD
    }
    
    // Finalize input and send final chunk
    finalizeInput(source) {
        if (this.isFinalized || this.state === 'finalizing') return;
        
        console.log(`✅ Finalizing input from ${source}`);
        this.setState('finalizing');
        this.isFinalized = true;
        this.isSpeaking = false;
        
        // Send final audio chunk if we have speech data
        if (this.audioChunks.length > 0) {
            const speechChunks = this.audioChunks.filter(chunk => chunk.isSpeech);
            if (speechChunks.length > 0) {
                const finalChunk = speechChunks[speechChunks.length - 1];
                this.queueChunkForProcessing(finalChunk, true);
            }
        }
        
        // Send final text if we have text data
        if (this.textBuffer.trim()) {
            this.queueTextForProcessing(this.textBuffer, true);
        }
        
        // Notify completion
        if (this.onFinalInput) {
            this.onFinalInput({
                audioChunks: this.audioChunks.filter(c => c.isSpeech),
                textContent: this.textBuffer,
                stats: this.stats,
                source
            });
        }
    }
    
    // Send audio chunk to Gemini
    async sendAudioChunk(chunk, isFinal) {
        if (window.cheddar && window.cheddar.sendAudioChunk) {
            await window.cheddar.sendAudioChunk(chunk, isFinal);
        }
    }
    
    // Send text chunk to Gemini
    async sendTextChunk(text, isFinal) {
        if (window.cheddar && window.cheddar.sendTextChunk) {
            await window.cheddar.sendTextChunk(text, isFinal);
        }
    }
    
    // State management
    setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            console.log(`🔄 State: ${oldState} → ${newState}`);
            
            if (this.onStateChange) {
                this.onStateChange(newState, oldState);
            }
        }
    }
    
    // Reset buffer for new input
    reset() {
        console.log('🔄 Resetting input buffer');
        
        this.audioChunks = [];
        this.textBuffer = '';
        this.textChunks = [];
        this.processingQueue = [];
        
        this.lastSpeechTime = 0;
        this.lastActivityTime = 0;
        this.lastTextActivity = 0;
        this.isSpeaking = false;
        this.speechStartTime = 0;
        this.isFinalized = false;
        this.partialTranscript = '';
        
        this.setState('idle');
        
        // Reset stats but keep cumulative counters
        this.stats.totalAudioDuration = 0;
        this.stats.averageLatency = 0;
    }
    
    // Get current status
    getStatus() {
        return {
            state: this.state,
            audioChunks: this.audioChunks.length,
            textLength: this.textBuffer.length,
            queueSize: this.processingQueue.length,
            isSpeaking: this.isSpeaking,
            isFinalized: this.isFinalized,
            stats: { ...this.stats },
            silenceTime: this.lastSpeechTime ? Date.now() - this.lastSpeechTime : 0
        };
    }
    
    // Configuration updates
    updateConfig(config) {
        if (config.vadThreshold !== undefined) this.vadThreshold = config.vadThreshold;
        if (config.silenceThreshold !== undefined) this.silenceThreshold = config.silenceThreshold;
        if (config.minSpeechDuration !== undefined) this.minSpeechDuration = config.minSpeechDuration;
        if (config.textSilenceThreshold !== undefined) this.textSilenceThreshold = config.textSilenceThreshold;
        if (config.textAutoFinalizeEnabled !== undefined) this.textAutoFinalizeEnabled = config.textAutoFinalizeEnabled;
        
        console.log('📝 Updated buffer configuration:', config);
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputBuffer;
} else {
    window.InputBuffer = InputBuffer;
}
