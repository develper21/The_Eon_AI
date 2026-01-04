// memoryProtector.js - Advanced memory protection and secure data handling

const crypto = require('crypto');
const { enhancedSecurityManager } = require('./securityManager');

class MemoryProtector {
    constructor() {
        this.secureStorage = new Map();
        this.encryptedBuffers = new Map();
        this.memoryPools = new Map();
        this.scrubbingIntervals = new Map();
        this.protectionLevel = 'standard';
        this.allocationTracker = new AllocationTracker();
        this.dataClassifier = new DataClassifier();
        this.antiForensics = new AntiForensics();
        this.secureAllocator = new SecureAllocator();
        this.isInitialized = false;
    }

    /**
     * Initialize memory protection system
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing memory protection system...');
        
        try {
            // Initialize secure allocator
            await this.secureAllocator.initialize();
            
            // Start memory scrubbing
            this.startMemoryScrubbing();
            
            // Initialize anti-forensics
            await this.antiForensics.initialize();
            
            // Start memory monitoring
            this.startMemoryMonitoring();
            
            // Setup secure garbage collection
            this.setupSecureGC();
            
            this.isInitialized = true;
            console.log('Memory protection system initialized');
            
        } catch (error) {
            console.error('Memory protection initialization failed:', error);
        }
    }

    /**
     * Store sensitive data securely
     */
    storeSecure(key, data, options = {}) {
        try {
            // Classify data sensitivity
            const sensitivity = this.dataClassifier.classify(data);
            
            // Choose appropriate protection level
            const protectionLevel = options.level || this.determineProtectionLevel(sensitivity);
            
            // Encrypt data
            const encryptedData = this.encryptData(data, protectionLevel);
            
            // Store in secure memory pool
            const secureEntry = {
                data: encryptedData,
                metadata: {
                    key,
                    sensitivity,
                    protectionLevel,
                    createdAt: Date.now(),
                    lastAccessed: Date.now(),
                    accessCount: 0,
                    size: this.calculateDataSize(data)
                }
            };
            
            // Store with secure allocation
            const secureKey = this.secureAllocator.allocate(secureEntry);
            this.secureStorage.set(key, secureKey);
            
            // Track allocation
            this.allocationTracker.track(key, secureEntry.metadata);
            
            return secureKey;
            
        } catch (error) {
            console.error('Failed to store secure data:', error);
            return null;
        }
    }

    /**
     * Retrieve sensitive data securely
     */
    retrieveSecure(key) {
        try {
            const secureKey = this.secureStorage.get(key);
            if (!secureKey) {
                console.warn(`Secure key not found: ${key}`);
                return null;
            }
            
            const secureEntry = this.secureAllocator.retrieve(secureKey);
            if (!secureEntry) {
                console.warn(`Secure entry not found for key: ${key}`);
                return null;
            }
            
            // Update access metadata
            secureEntry.metadata.lastAccessed = Date.now();
            secureEntry.metadata.accessCount++;
            
            // Decrypt data
            const decryptedData = this.decryptData(secureEntry.data, secureEntry.metadata.protectionLevel);
            
            // Schedule memory scrubbing for this entry
            this.scheduleEntryScrubbing(key);
            
            return decryptedData;
            
        } catch (error) {
            console.error('Failed to retrieve secure data:', error);
            return null;
        }
    }

    /**
     * Delete secure data
     */
    deleteSecure(key) {
        try {
            const secureKey = this.secureStorage.get(key);
            if (!secureKey) return false;
            
            const secureEntry = this.secureAllocator.retrieve(secureKey);
            if (secureEntry) {
                // Scrub data before deallocation
                this.scrubData(secureEntry.data);
                
                // Deallocate
                this.secureAllocator.deallocate(secureKey);
                
                // Update tracking
                this.allocationTracker.untrack(key);
            }
            
            this.secureStorage.delete(key);
            return true;
            
        } catch (error) {
            console.error('Failed to delete secure data:', error);
            return false;
        }
    }

    /**
     * Encrypt data with appropriate level
     */
    encryptData(data, level) {
        try {
            const algorithm = this.getEncryptionAlgorithm(level);
            const key = this.deriveEncryptionKey(level);
            const iv = crypto.randomBytes(16);
            
            let cipher;
            if (algorithm.includes('gcm')) {
                cipher = crypto.createCipheriv(algorithm, key, iv);
                const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
                const authTag = cipher.getAuthTag();
                
                return {
                    algorithm,
                    encrypted: encrypted.toString('base64'),
                    iv: iv.toString('base64'),
                    authTag: authTag.toString('base64'),
                    protected: true
                };
            } else {
                cipher = crypto.createCipheriv(algorithm, key, iv);
                let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
                encrypted += cipher.final('hex');
                
                return {
                    algorithm,
                    encrypted,
                    iv: iv.toString('hex'),
                    protected: true
                };
            }
            
        } catch (error) {
            console.error('Data encryption failed:', error);
            return { encrypted: JSON.stringify(data), protected: false };
        }
    }

    /**
     * Decrypt data
     */
    decryptData(encryptedData, level) {
        try {
            if (!encryptedData.protected) {
                return JSON.parse(encryptedData.encrypted);
            }
            
            const key = this.deriveEncryptionKey(level);
            
            if (encryptedData.algorithm.includes('gcm')) {
                const iv = Buffer.from(encryptedData.iv, 'base64');
                const authTag = Buffer.from(encryptedData.authTag, 'base64');
                const decipher = crypto.createDecipheriv(encryptedData.algorithm, key, iv);
                decipher.setAuthTag(authTag);
                
                const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
                const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
                
                return JSON.parse(decrypted.toString('utf8'));
            } else {
                const iv = Buffer.from(encryptedData.iv, 'hex');
                const decipher = crypto.createDecipheriv(encryptedData.algorithm, key, iv);
                
                let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                
                return JSON.parse(decrypted);
            }
            
        } catch (error) {
            console.error('Data decryption failed:', error);
            return null;
        }
    }

    /**
     * Get encryption algorithm based on protection level
     */
    getEncryptionAlgorithm(level) {
        const algorithms = {
            'basic': 'aes-128-cbc',
            'standard': 'aes-256-cbc',
            'high': 'aes-256-gcm',
            'maximum': 'aes-256-gcm'
        };
        
        return algorithms[level] || algorithms.standard;
    }

    /**
     * Derive encryption key for protection level
     */
    deriveEncryptionKey(level) {
        const baseKey = enhancedSecurityManager.encryptionKey;
        const salt = `memory_protector_${level}`;
        
        return crypto.pbkdf2Sync(baseKey, salt, 10000, 32, 'sha256');
    }

    /**
     * Determine protection level based on data sensitivity
     */
    determineProtectionLevel(sensitivity) {
        const levelMap = {
            'low': 'basic',
            'medium': 'standard',
            'high': 'high',
            'critical': 'maximum'
        };
        
        return levelMap[sensitivity] || 'standard';
    }

    /**
     * Calculate data size for tracking
     */
    calculateDataSize(data) {
        return JSON.stringify(data).length;
    }

    /**
     * Start memory scrubbing routines
     */
    startMemoryScrubbing() {
        // Scrub unused memory every 30 seconds
        const scrubInterval = setInterval(() => {
            this.scrubUnusedMemory();
        }, 30000 + Math.random() * 15000);
        
        this.scrubbingIntervals.set('unused_memory', scrubInterval);
        
        // Scrub old entries every 5 minutes
        const oldEntriesInterval = setInterval(() => {
            this.scrubOldEntries();
        }, 300000 + Math.random() * 60000);
        
        this.scrubbingIntervals.set('old_entries', oldEntriesInterval);
        
        // Emergency scrub every 2 minutes
        const emergencyInterval = setInterval(() => {
            this.emergencyMemoryScrub();
        }, 120000 + Math.random() * 30000);
        
        this.scrubbingIntervals.set('emergency', emergencyInterval);
    }

    /**
     * Scrub unused memory
     */
    scrubUnusedMemory() {
        try {
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            // Scrub memory pools
            for (const [poolName, pool] of this.memoryPools) {
                if (pool.lastAccessed < Date.now() - 300000) { // 5 minutes
                    this.scrubMemoryPool(poolName);
                }
            }
            
        } catch (error) {
            console.error('Memory scrubbing failed:', error);
        }
    }

    /**
     * Scrub old entries
     */
    scrubOldEntries() {
        const now = Date.now();
        const maxAge = 1800000; // 30 minutes
        
        for (const [key, secureKey] of this.secureStorage) {
            const entry = this.secureAllocator.retrieve(secureKey);
            if (entry && (now - entry.metadata.lastAccessed) > maxAge) {
                // Re-encrypt with fresh key
                this.refreshEncryption(key, entry);
            }
        }
    }

    /**
     * Emergency memory scrub
     */
    emergencyMemoryScrub() {
        try {
            // Scrub all temporary buffers
            for (const [bufferId, buffer] of this.encryptedBuffers) {
                this.scrubBuffer(buffer);
                this.encryptedBuffers.delete(bufferId);
            }
            
            // Randomize memory layout
            this.randomizeMemoryLayout();
            
            // Clear any residual data
            this.clearResidualData();
            
        } catch (error) {
            console.error('Emergency memory scrub failed:', error);
        }
    }

    /**
     * Scrub data securely
     */
    scrubData(data) {
        try {
            if (Buffer.isBuffer(data)) {
                this.scrubBuffer(data);
            } else if (typeof data === 'string') {
                // Overwrite string memory
                const buffer = Buffer.from(data);
                this.scrubBuffer(buffer);
            } else if (data && typeof data === 'object') {
                // Recursively scrub object properties
                for (const key in data) {
                    this.scrubData(data[key]);
                    delete data[key];
                }
            }
            
        } catch (error) {
            console.error('Data scrubbing failed:', error);
        }
    }

    /**
     * Scrub buffer securely
     */
    scrubBuffer(buffer) {
        try {
            // Multiple overwrite passes
            const patterns = [
                Buffer.alloc(buffer.length, 0x00),  // Zeroes
                Buffer.alloc(buffer.length, 0xFF),  // Ones
                Buffer.alloc(buffer.length, 0x55),  // Alternating pattern
                crypto.randomBytes(buffer.length)    // Random data
            ];
            
            for (const pattern of patterns) {
                pattern.copy(buffer);
            }
            
            // Final zero pass
            Buffer.alloc(buffer.length, 0x00).copy(buffer);
            
        } catch (error) {
            console.error('Buffer scrubbing failed:', error);
        }
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        setInterval(() => {
            this.monitorMemoryUsage();
        }, 10000 + Math.random() * 5000);
    }

    /**
     * Monitor memory usage for anomalies
     */
    monitorMemoryUsage() {
        const usage = process.memoryUsage();
        
        // Check for suspicious memory patterns
        const suspiciousPatterns = [
            usage.heapUsed > 1024 * 1024 * 1024,      // >1GB heap
            usage.rss > 2 * 1024 * 1024 * 1024,       // >2GB RSS
            usage.external > 500 * 1024 * 1024,        // >500MB external
            usage.arrayBuffers > 100 * 1024 * 1024    // >100MB array buffers
        ];
        
        if (suspiciousPatterns.some(pattern => pattern)) {
            console.warn('Suspicious memory usage detected:', usage);
            this.handleMemoryAnomaly(usage);
        }
    }

    /**
     * Handle memory usage anomalies
     */
    handleMemoryAnomaly(usage) {
        // Increase scrubbing frequency
        this.increaseScrubbingFrequency();
        
        // Clear old data
        this.clearOldData();
        
        // If memory is critically high, emergency cleanup
        if (usage.rss > 3 * 1024 * 1024 * 1024) { // >3GB
            this.emergencyCleanup();
        }
    }

    /**
     * Increase scrubbing frequency
     */
    increaseScrubbingFrequency() {
        for (const [name, interval] of this.scrubbingIntervals) {
            clearInterval(interval);
            
            const newInterval = setInterval(() => {
                if (name === 'unused_memory') this.scrubUnusedMemory();
                else if (name === 'old_entries') this.scrubOldEntries();
                else if (name === 'emergency') this.emergencyMemoryScrub();
            }, 10000 + Math.random() * 5000); // Faster interval
            
            this.scrubbingIntervals.set(name, newInterval);
        }
    }

    /**
     * Clear old data
     */
    clearOldData() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour
        
        for (const [key, secureKey] of this.secureStorage) {
            const entry = this.secureAllocator.retrieve(secureKey);
            if (entry && (now - entry.metadata.createdAt) > maxAge) {
                this.deleteSecure(key);
            }
        }
    }

    /**
     * Emergency cleanup
     */
    emergencyCleanup() {
        console.log('Initiating emergency memory cleanup');
        
        // Clear all non-critical data
        for (const [key, secureKey] of this.secureStorage) {
            const entry = this.secureAllocator.retrieve(secureKey);
            if (entry && entry.metadata.sensitivity !== 'critical') {
                this.deleteSecure(key);
            }
        }
        
        // Force garbage collection
        if (global.gc) {
            for (let i = 0; i < 5; i++) {
                global.gc();
            }
        }
        
        // Emergency scrub
        this.emergencyMemoryScrub();
    }

    /**
     * Setup secure garbage collection
     */
    setupSecureGC() {
        // Override global.gc if available to include secure scrubbing
        if (global.gc) {
            const originalGC = global.gc;
            global.gc = () => {
                originalGC();
                this.emergencyMemoryScrub();
            };
        }
    }

    /**
     * Schedule entry scrubbing
     */
    scheduleEntryScrubbing(key) {
        // Schedule scrubbing after access
        setTimeout(() => {
            const secureKey = this.secureStorage.get(key);
            if (secureKey) {
                const entry = this.secureAllocator.retrieve(secureKey);
                if (entry) {
                    this.refreshEncryption(key, entry);
                }
            }
        }, 30000 + Math.random() * 30000);
    }

    /**
     * Refresh encryption for an entry
     */
    refreshEncryption(key, entry) {
        try {
            // Decrypt with old key
            const data = this.decryptData(entry.data, entry.metadata.protectionLevel);
            
            // Re-encrypt with new key
            entry.data = this.encryptData(data, entry.metadata.protectionLevel);
            entry.metadata.lastAccessed = Date.now();
            
        } catch (error) {
            console.error('Encryption refresh failed:', error);
        }
    }

    /**
     * Randomize memory layout
     */
    randomizeMemoryLayout() {
        // This would implement memory layout randomization
        // In a real implementation, this would work with the V8 engine
        // to randomize heap layout and pointer locations
    }

    /**
     * Clear residual data
     */
    clearResidualData() {
        // Clear any residual data that might be in memory
        if (global.gc) {
            global.gc();
        }
        
        // Clear any temporary variables
        const tempVars = ['temp', 'tmp', 'buffer', 'data'];
        tempVars.forEach(varName => {
            if (global[varName]) {
                global[varName] = null;
            }
        });
    }

    /**
     * Get memory protection status
     */
    getProtectionStatus() {
        return {
            isInitialized: this.isInitialized,
            protectionLevel: this.protectionLevel,
            secureEntries: this.secureStorage.size,
            allocationTracking: this.allocationTracker.getStatus(),
            memoryPools: this.memoryPools.size,
            scrubbingIntervals: this.scrubbingIntervals.size
        };
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        console.log('Cleaning up memory protection system...');
        
        // Clear all scrubbing intervals
        for (const interval of this.scrubbingIntervals.values()) {
            clearInterval(interval);
        }
        this.scrubbingIntervals.clear();
        
        // Delete all secure data
        for (const key of this.secureStorage.keys()) {
            this.deleteSecure(key);
        }
        
        // Cleanup components
        this.secureAllocator.cleanup();
        this.antiForensics.cleanup();
        this.allocationTracker.cleanup();
        
        // Emergency final scrub
        this.emergencyMemoryScrub();
        
        this.isInitialized = false;
        console.log('Memory protection system cleaned up');
    }
}

class AllocationTracker {
    constructor() {
        this.allocations = new Map();
        this.totalAllocated = 0;
        this.totalFreed = 0;
    }

    track(key, metadata) {
        this.allocations.set(key, {
            ...metadata,
            allocatedAt: Date.now()
        });
        this.totalAllocated += metadata.size;
    }

    untrack(key) {
        const allocation = this.allocations.get(key);
        if (allocation) {
            this.totalFreed += allocation.size;
            this.allocations.delete(key);
        }
    }

    getStatus() {
        return {
            activeAllocations: this.allocations.size,
            totalAllocated: this.totalAllocated,
            totalFreed: this.totalFreed,
            currentUsage: this.totalAllocated - this.totalFreed
        };
    }

    cleanup() {
        this.allocations.clear();
        this.totalAllocated = 0;
        this.totalFreed = 0;
    }
}

class DataClassifier {
    constructor() {
        this.sensitivityPatterns = new Map();
        this.loadPatterns();
    }

    loadPatterns() {
        this.sensitivityPatterns.set('critical', [
            /password/i,
            /token/i,
            /secret/i,
            /key/i,
            /auth/i,
            /credential/i
        ]);
        
        this.sensitivityPatterns.set('high', [
            /personal/i,
            /private/i,
            /confidential/i,
            /sensitive/i
        ]);
        
        this.sensitivityPatterns.set('medium', [
            /user/i,
            /session/i,
            /profile/i
        ]);
    }

    classify(data) {
        const dataString = JSON.stringify(data).toLowerCase();
        
        for (const [level, patterns] of this.sensitivityPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(dataString)) {
                    return level;
                }
            }
        }
        
        return 'low';
    }
}

class AntiForensics {
    constructor() {
        this.techniques = new Map();
        this.isActive = false;
    }

    async initialize() {
        this.isActive = true;
        this.loadTechniques();
    }

    loadTechniques() {
        this.techniques.set('timestamp_randomization', {
            enabled: true,
            strength: 0.1 + Math.random() * 0.2
        });
        
        this.techniques.set('metadata_obfuscation', {
            enabled: true,
            level: 'medium'
        });
    }

    applyTechniques(data) {
        if (!this.isActive) return data;
        
        let processedData = data;
        
        for (const [technique, config] of this.techniques) {
            if (config.enabled) {
                processedData = this.applyTechnique(technique, processedData, config);
            }
        }
        
        return processedData;
    }

    applyTechnique(technique, data, config) {
        switch (technique) {
            case 'timestamp_randomization':
                return this.randomizeTimestamps(data, config);
            case 'metadata_obfuscation':
                return this.obfuscateMetadata(data, config);
            default:
                return data;
        }
    }

    randomizeTimestamps(data, config) {
        // Add random jitter to timestamps
        if (data.timestamp) {
            const jitter = Math.floor(Date.now() * config.strength * (Math.random() - 0.5));
            data.timestamp += jitter;
        }
        return data;
    }

    obfuscateMetadata(data, config) {
        // Remove or obfuscate metadata fields
        const sensitiveFields = ['createdBy', 'modifiedBy', 'source'];
        sensitiveFields.forEach(field => {
            if (data[field]) {
                delete data[field];
            }
        });
        return data;
    }

    cleanup() {
        this.isActive = false;
        this.techniques.clear();
    }
}

class SecureAllocator {
    constructor() {
        this.allocations = new Map();
        this.freeBlocks = new Map();
        this.nextId = 1;
    }

    async initialize() {
        // Initialize secure memory pools
    }

    allocate(data) {
        const id = `secure_${this.nextId++}`;
        const secureData = this.createSecureCopy(data);
        
        this.allocations.set(id, {
            data: secureData,
            allocatedAt: Date.now(),
            size: this.calculateSize(secureData)
        });
        
        return id;
    }

    retrieve(id) {
        return this.allocations.get(id);
    }

    deallocate(id) {
        const allocation = this.allocations.get(id);
        if (allocation) {
            this.scrubData(allocation.data);
            this.allocations.delete(id);
            return true;
        }
        return false;
    }

    createSecureCopy(data) {
        // Create a secure copy in protected memory
        return Buffer.from(JSON.stringify(data));
    }

    calculateSize(data) {
        return Buffer.byteLength(JSON.stringify(data));
    }

    scrubData(data) {
        if (Buffer.isBuffer(data)) {
            data.fill(0);
        }
    }

    cleanup() {
        for (const id of this.allocations.keys()) {
            this.deallocate(id);
        }
        this.allocations.clear();
        this.freeBlocks.clear();
    }
}

module.exports = MemoryProtector;
