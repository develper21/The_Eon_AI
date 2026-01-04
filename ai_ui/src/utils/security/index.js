// security/index.js - Main export file for security modules

// Anti-analysis modules
const runtimeProtection = require('./antiAnalysis/runtimeProtection');
const stealthFeatures = require('./antiAnalysis/stealthFeatures');
const processRandomizer = require('./antiAnalysis/processRandomizer');
const linuxStealth = require('./antiAnalysis/linuxStealth');

// Data protection modules
const memoryProtector = require('./dataProtection/memoryProtector');
const securityManager = require('./dataProtection/securityManager');
const screenshotObfuscator = require('./dataProtection/screenshotObfuscator');

// Network security modules
const networkObfuscator = require('./network/networkObfuscator');

// Behavioral modules
const behavioralRandomizer = require('./behavioral/behavioralRandomizer');

module.exports = {
    // Anti-analysis exports
    runtimeProtection,
    stealthFeatures,
    processRandomizer,
    linuxStealth,
    
    // Data protection exports
    memoryProtector,
    securityManager,
    screenshotObfuscator,
    
    // Network exports
    networkObfuscator,
    
    // Behavioral exports
    behavioralRandomizer
};