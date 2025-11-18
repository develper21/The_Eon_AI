const { URL } = require('url');
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
};
