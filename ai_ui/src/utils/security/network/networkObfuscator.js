// networkObfuscator.js - Advanced network traffic obfuscation

const crypto = require('crypto');
const { enhancedSecurityManager } = require('../dataProtection/securityManager');

class NetworkObfuscator {
    constructor() {
        this.sessionKey = this.generateSessionKey();
        this.requestQueue = [];
        this.trafficPatterns = new Map();
        this.mimicryProfiles = this.loadMimicryProfiles();
        this.noiseGenerator = new NoiseGenerator();
        this.packetDistributor = new PacketDistributor();
    }

    /**
     * Generate unique session key for encryption
     */
    generateSessionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Load profiles that mimic legitimate application traffic
     */
    loadMimicryProfiles() {
        return {
            microsoftTeams: {
                domains: ['teams.microsoft.com', 'config.teams.microsoft.com', 'statics.teams.microsoft.com'],
                patterns: ['/api/config', '/messages', '/presence', '/channels'],
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Teams/1.5.0.0',
                    'X-Ms-User-Agent': 'Teams/1.5.0.0',
                    'Accept': 'application/json, text/plain, */*'
                },
                timing: { min: 200, max: 2000, burst: true }
            },
            slack: {
                domains: ['slack.com', 'files.slack.com', 'api.slack.com'],
                patterns: ['/api/conversations', '/messages', '/presence', '/files.upload'],
                headers: {
                    'User-Agent': 'SlackDesktop/4.31.0 (Windows 10; Win64; x64)',
                    'X-Slack-User-Agent': 'SlackDesktop/4.31.0',
                    'Accept': 'application/json'
                },
                timing: { min: 100, max: 1500, burst: false }
            },
            zoom: {
                domains: ['zoom.us', 'api.zoom.us', 'cdn.zoom.us'],
                patterns: ['/v2/users', '/meetings', '/recordings', '/files'],
                headers: {
                    'User-Agent': 'Zoom/5.14.0 (Windows 10)',
                    'X-Zoom-User-Agent': 'ZoomDesktop/5.14.0',
                    'Accept': 'application/json, text/plain'
                },
                timing: { min: 500, max: 3000, burst: true }
            },
            discord: {
                domains: ['discord.com', 'cdn.discordapp.com', 'media.discordapp.net'],
                patterns: ['/api/v9/channels', '/messages', '/gateway', '/experiments'],
                headers: {
                    'User-Agent': 'DiscordClient/2.0.1 (Windows 10)',
                    'X-Discord-User-Agent': 'DiscordDesktop/2.0.1',
                    'Accept': 'application/json'
                },
                timing: { min: 50, max: 800, burst: true }
            }
        };
    }

    /**
     * Obfuscate request to look like legitimate application traffic
     */
    obfuscateRequest(originalUrl, payload, options = {}) {
        const profile = this.selectMimicryProfile();
        const obfuscatedRequest = this.buildMimicryRequest(originalUrl, payload, profile, options);
        
        // Add to traffic pattern queue
        this.queueRequest(obfuscatedRequest);
        
        return obfuscatedRequest;
    }

    /**
     * Select appropriate mimicry profile based on context
     */
    selectMimicryProfile() {
        const profiles = Object.keys(this.mimicryProfiles);
        const weights = [0.3, 0.25, 0.25, 0.2]; // Microsoft Teams, Slack, Zoom, Discord
        
        const random = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < profiles.length; i++) {
            cumulative += weights[i];
            if (random <= cumulative) {
                return this.mimicryProfiles[profiles[i]];
            }
        }
        
        return this.mimicryProfiles.microsoftTeams;
    }

    /**
     * Build request that mimics legitimate application
     */
    buildMimicryRequest(originalUrl, payload, profile, options) {
        const domain = profile.domains[Math.floor(Math.random() * profile.domains.length)];
        const pattern = profile.patterns[Math.floor(Math.random() * profile.patterns.length)];
        const path = `${pattern}/${crypto.randomBytes(8).toString('hex')}`;
        
        // Encrypt payload
        const encryptedPayload = this.encryptPayload(payload, profile);
        
        // Build legitimate headers
        const headers = this.buildLegitimateHeaders(profile);
        
        // Add timing information
        const timing = this.calculateTiming(profile, options);
        
        return {
            originalUrl,
            obfuscatedUrl: `https://${domain}${path}`,
            method: options.method || 'POST',
            headers,
            payload: encryptedPayload,
            timing,
            profile: profile.name || 'unknown',
            metadata: {
                encrypted: true,
                mimics: domain,
                timestamp: Date.now(),
                requestId: crypto.randomBytes(16).toString('hex')
            }
        };
    }

    /**
     * Encrypt payload with profile-specific key
     */
    encryptPayload(payload, profile) {
        try {
            const key = crypto.pbkdf2Sync(this.sessionKey, profile.name || 'default', 10000, 32, 'sha256');
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            
            let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted: true,
                data: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                wrapper: this.generateWrapper(payload, profile)
            };
        } catch (error) {
            console.error('Payload encryption failed:', error);
            return { encrypted: false, data: payload };
        }
    }

    /**
     * Generate wrapper data to make payload look legitimate
     */
    generateWrapper(payload, profile) {
        const wrappers = {
            microsoftTeams: {
                type: 'message',
                content: payload,
                messageType: 'text',
                clientMessageId: crypto.randomBytes(16).toString('hex'),
                compositionTime: Date.now(),
                mentions: [],
                attachments: []
            },
            slack: {
                type: 'message',
                channel: crypto.randomBytes(8).toString('hex'),
                text: JSON.stringify(payload),
                user: crypto.randomBytes(8).toString('hex'),
                ts: (Date.now() / 1000).toFixed(6)
            },
            zoom: {
                action: 'send',
                data: payload,
                sessionId: crypto.randomBytes(16).toString('hex'),
                timestamp: Date.now()
            },
            discord: {
                type: 0,
                content: JSON.stringify(payload),
                nonce: crypto.randomBytes(16).toString('hex'),
                tts: false,
                flags: 0
            }
        };

        return wrappers[profile.name] || wrappers.microsoftTeams;
    }

    /**
     * Build headers that match the mimicked application
     */
    buildLegitimateHeaders(profile) {
        const baseHeaders = { ...profile.headers };
        
        // Add dynamic headers
        baseHeaders['X-Request-ID'] = crypto.randomBytes(16).toString('hex');
        baseHeaders['X-Timestamp'] = Date.now().toString();
        baseHeaders['X-Client-Version'] = this.generateVersionString();
        
        // Add authentication-like headers
        if (Math.random() > 0.3) {
            baseHeaders['Authorization'] = `Bearer ${crypto.randomBytes(32).toString('hex')}`;
        }
        
        // Add content-specific headers
        baseHeaders['Content-Type'] = 'application/json';
        baseHeaders['Content-Length'] = Math.floor(Math.random() * 10000 + 1000).toString();
        
        return baseHeaders;
    }

    /**
     * Generate realistic version string
     */
    generateVersionString() {
        const major = Math.floor(Math.random() * 5) + 1;
        const minor = Math.floor(Math.random() * 50);
        const patch = Math.floor(Math.random() * 100);
        const build = Math.floor(Math.random() * 9999);
        
        return `${major}.${minor}.${patch}.${build}`;
    }

    /**
     * Calculate realistic timing for the request
     */
    calculateTiming(profile, options) {
        const baseTiming = profile.timing;
        const delay = baseTiming.min + Math.random() * (baseTiming.max - baseTiming.min);
        
        // Add jitter
        const jitter = delay * 0.1 * (Math.random() - 0.5);
        
        // Burst mode handling
        let finalDelay = delay + jitter;
        if (baseTiming.burst && Math.random() > 0.7) {
            finalDelay *= 0.3; // Faster during burst
        }
        
        return {
            delay: Math.max(50, finalDelay), // Minimum 50ms
            burst: baseTiming.burst,
            priority: Math.random() > 0.8 ? 'high' : 'normal'
        };
    }

    /**
     * Queue request with noise generation
     */
    queueRequest(request) {
        this.requestQueue.push({
            ...request,
            queuedAt: Date.now(),
            scheduledFor: Date.now() + request.timing.delay
        });
        
        // Add noise requests
        if (Math.random() > 0.6) {
            this.addNoiseRequests(request);
        }
    }

    /**
     * Add noise requests to mask real traffic
     */
    addNoiseRequests(originalRequest) {
        const noiseCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < noiseCount; i++) {
            const noiseRequest = this.noiseGenerator.generateNoiseRequest(originalRequest);
            this.requestQueue.push(noiseRequest);
        }
    }

    /**
     * Get next request from queue with proper timing
     */
    getNextRequest() {
        const now = Date.now();
        const readyRequests = this.requestQueue.filter(req => req.scheduledFor <= now);
        
        if (readyRequests.length === 0) {
            return null;
        }
        
        // Sort by priority and scheduled time
        readyRequests.sort((a, b) => {
            if (a.timing.priority !== b.timing.priority) {
                return a.timing.priority === 'high' ? -1 : 1;
            }
            return a.scheduledFor - b.scheduledFor;
        });
        
        const request = readyRequests.shift();
        this.requestQueue = this.requestQueue.filter(req => req !== request);
        
        return request;
    }

    /**
     * Obfuscate response data
     */
    obfuscateResponse(response, originalRequest) {
        if (!response || !originalRequest.metadata.encrypted) {
            return response;
        }

        try {
            const profile = this.mimicryProfiles[originalRequest.profile] || this.mimicryProfiles.microsoftTeams;
            const key = crypto.pbkdf2Sync(this.sessionKey, profile.name || 'default', 10000, 32, 'sha256');
            
            if (response.data && response.data.encrypted) {
                const iv = Buffer.from(response.data.iv, 'hex');
                const authTag = Buffer.from(response.data.authTag, 'hex');
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(authTag);
                
                let decrypted = decipher.update(response.data.data, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                
                return JSON.parse(decrypted);
            }
        } catch (error) {
            console.error('Response decryption failed:', error);
        }
        
        return response;
    }

    /**
     * Get traffic statistics for monitoring
     */
    getTrafficStats() {
        return {
            queuedRequests: this.requestQueue.length,
            activeProfiles: Object.keys(this.mimicryProfiles),
            sessionAge: Date.now() - (this.sessionStartTime || Date.now()),
            totalProcessed: this.totalProcessed || 0,
            noiseRatio: this.noiseGenerator ? this.noiseGenerator.getNoiseRatio() : 0
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.requestQueue = [];
        this.trafficPatterns.clear();
        if (this.noiseGenerator) {
            this.noiseGenerator.cleanup();
        }
        if (this.packetDistributor) {
            this.packetDistributor.cleanup();
        }
    }
}

class NoiseGenerator {
    constructor() {
        this.noiseCount = 0;
        this.totalCount = 0;
    }

    generateNoiseRequest(originalRequest) {
        this.totalCount++;
        this.noiseCount++;
        
        const noiseTypes = ['heartbeat', 'ping', 'status', 'telemetry', 'analytics'];
        const noiseType = noiseTypes[Math.floor(Math.random() * noiseTypes.length)];
        
        return {
            isNoise: true,
            obfuscatedUrl: originalRequest.obfuscatedUrl,
            method: 'GET',
            headers: originalRequest.headers,
            payload: this.generateNoisePayload(noiseType),
            timing: { delay: Math.random() * 1000, priority: 'low' },
            metadata: {
                noiseType,
                timestamp: Date.now(),
                requestId: crypto.randomBytes(16).toString('hex')
            }
        };
    }

    generateNoisePayload(type) {
        const payloads = {
            heartbeat: { status: 'ok', timestamp: Date.now() },
            ping: { pong: true, time: Date.now() },
            status: { online: true, active: true },
            telemetry: { metrics: {}, session: crypto.randomBytes(8).toString('hex') },
            analytics: { event: 'page_view', data: {} }
        };
        
        return payloads[type] || payloads.heartbeat;
    }

    getNoiseRatio() {
        return this.totalCount > 0 ? this.noiseCount / this.totalCount : 0;
    }

    cleanup() {
        this.noiseCount = 0;
        this.totalCount = 0;
    }
}

class PacketDistributor {
    constructor() {
        this.distributionIntervals = new Map();
    }

    distributePackets(requests) {
        // Distribute packets across time to avoid patterns
        return requests.map((request, index) => ({
            ...request,
            scheduledFor: request.scheduledFor + (index * Math.random() * 500)
        }));
    }

    cleanup() {
        this.distributionIntervals.forEach(interval => clearInterval(interval));
        this.distributionIntervals.clear();
    }
}

module.exports = NetworkObfuscator;
