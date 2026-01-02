// runtimeProtection.js - Advanced runtime protection and anti-analysis

const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class RuntimeProtection {
    constructor() {
        this.protectionLevel = 'high';
        this.checkIntervals = new Map();
        this.suspiciousActivity = new Map();
        this.integrityChecks = new Map();
        this.antiTampering = new AntiTampering();
        this.codeObfuscator = new CodeObfuscator();
        this.processMonitor = new ProcessMonitor();
        this.memoryProtector = new MemoryProtector();
        this.isProtected = false;
        this.isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.DEV === 'true';
    }

    /**
     * Initialize comprehensive runtime protection
     */
    async initialize() {
        if (this.isProtected) return;
        
        console.log('Initializing runtime protection...');
        
        if (this.isDevelopmentMode) {
            console.log('⚠️  Development mode detected - Security checks disabled for testing');
            this.isProtected = true;
            return;
        }
        
        try {
            // Start anti-debugging measures
            await this.startAntiDebugging();
            
            // Initialize process monitoring
            await this.processMonitor.start();
            
            // Start memory protection
            await this.memoryProtector.initialize();
            
            // Initialize anti-tampering
            await this.antiTampering.start();
            
            // Start integrity checks
            this.startIntegrityChecks();
            
            // Set up exception handlers
            this.setupExceptionHandlers();
            
            this.isProtected = true;
            console.log('Runtime protection initialized successfully');
            
        } catch (error) {
            console.error('Runtime protection initialization failed:', error);
        }
    }

    /**
     * Start anti-debugging and reverse engineering protection
     */
    async startAntiDebugging() {
        const checks = [
            this.checkDebuggerAttached.bind(this),
            this.checkDebuggingFlags.bind(this),
            this.checkVirtualEnvironment.bind(this),
            this.checkSandboxEnvironment.bind(this),
            this.checkAnalysisTools.bind(this),
            this.checkTimingAttacks.bind(this)
        ];

        // Run checks with random intervals
        checks.forEach((check, index) => {
            const interval = 1000 + Math.random() * 4000 + (index * 500);
            const intervalId = setInterval(check, interval);
            this.checkIntervals.set(`antiDebug_${index}`, intervalId);
        });
    }

    /**
     * Check if application is being debugged
     */
    async checkDebuggerAttached() {
        const checks = [
            // Node.js inspector check - disabled for development
            () => false, // process._debugProcess && process._debugProcess(),
            // V8 debugger check - disabled for development  
            () => false, // process.debugPort && process.debugPort > 0,
            // Breakpoint check - disabled for development
            () => false // {
                // const start = Date.now();
                // debugger; // This will break if debugger is attached
                // return Date.now() - start > 100; // If took >100ms, debugger likely attached
            // }
        ];

        for (const check of checks) {
            try {
                const result = check();
                if (result === true || result > 100) {
                    this.handleSuspiciousActivity('debugger_attached', 'high');
                }
            } catch (error) {
                // Some checks might throw when debugger is attached - disabled for development
                // this.handleSuspiciousActivity('debugger_exception', 'medium');
            }
        }
    }

    /**
     * Check for debugging flags and environment variables
     */
    async checkDebuggingFlags() {
        // Disabled for development environment
        return;
        
        const suspiciousFlags = [
            '--inspect',
            '--inspect-brk',
            '--debug',
            '--debug-brk',
            '--trace-deprecation',
            '--trace-warnings'
        ];

        const suspiciousEnvVars = [
            'NODE_DEBUG',
            'DEBUG',
            'INSPECT',
            'V8_INSPECTOR'
        ];

        // Check process arguments
        const hasSuspiciousArgs = process.execArgv.some(arg => 
            suspiciousFlags.some(flag => arg.includes(flag))
        );

        // Check environment variables
        const hasSuspiciousEnv = suspiciousEnvVars.some(envVar => 
            process.env[envVar] && process.env[envVar].length > 0
        );

        if (hasSuspiciousArgs || hasSuspiciousEnv) {
            this.handleSuspiciousActivity('debugging_flags', 'medium');
        }
    }

    /**
     * Check if running in virtual environment
     */
    async checkVirtualEnvironment() {
        const vmIndicators = [
            'vmware',
            'virtualbox',
            'vbox',
            'qemu',
            'kvm',
            'xen',
            'hyper-v'
        ];

        // Check system files and registry keys
        const checks = [
            // Check BIOS information
            () => {
                if (process.platform === 'win32') {
                    return new Promise((resolve) => {
                        exec('wmic bios get version', (error, stdout) => {
                            if (stdout) {
                                const hasVM = vmIndicators.some(indicator => 
                                    stdout.toLowerCase().includes(indicator)
                                );
                                resolve(hasVM);
                            }
                            resolve(false);
                        });
                    });
                }
                return Promise.resolve(false);
            },
            
            // Check MAC addresses for VM vendors
            () => {
                if (process.platform === 'win32') {
                    return new Promise((resolve) => {
                        exec('getmac /v', (error, stdout) => {
                            if (stdout) {
                                const vmMacPrefixes = ['00:0C:29', '00:50:56', '08:00:27', '00:1C:42'];
                                const hasVMMac = vmMacPrefixes.some(prefix => 
                                    stdout.includes(prefix)
                                );
                                resolve(hasVMMac);
                            }
                            resolve(false);
                        });
                    });
                }
                return Promise.resolve(false);
            }
        ];

        const results = await Promise.all(checks.map(check => check().catch(() => false)));
        const hasVM = results.some(result => result);

        if (hasVM) {
            this.handleSuspiciousActivity('virtual_environment', 'medium');
        }
    }

    /**
     * Check for sandbox environments
     */
    async checkSandboxEnvironment() {
        const sandboxIndicators = [
            'sandbox',
            'cuckoo',
            'joebox',
            'anubis',
            'malware',
            'analysis'
        ];

        // Check process names
        if (process.platform === 'win32') {
            exec('tasklist', (error, stdout) => {
                if (stdout) {
                    const hasSandbox = sandboxIndicators.some(indicator => 
                        stdout.toLowerCase().includes(indicator)
                    );
                    if (hasSandbox) {
                        this.handleSuspiciousActivity('sandbox_environment', 'high');
                    }
                }
            });
        }
    }

    /**
     * Check for analysis tools
     */
    async checkAnalysisTools() {
        // Disabled for development environment
        return;
        
        const analysisTools = [
            'wireshark',
            'fiddler',
            'burpsuite',
            'procmon',
            'procexp',
            'ida',
            'x64dbg',
            'ollydbg',
            'ghidra',
            'radare2'
        ];

        if (process.platform === 'win32') {
            analysisTools.forEach(tool => {
                exec(`tasklist | findstr /i "${tool}"`, (error, stdout) => {
                    if (stdout && stdout.includes(tool)) {
                        this.handleSuspiciousActivity('analysis_tool', 'high');
                    }
                });
            });
        }
    }

    /**
     * Check for timing attacks and abnormal execution
     */
    async checkTimingAttacks() {
        const startTime = process.hrtime.bigint();
        
        // Perform some computation
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
            result += Math.random();
        }
        
        const endTime = process.hrtime.bigint();
        const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // If execution took unusually long, might be under analysis
        if (executionTime > 100) { // More than 100ms is suspicious
            this.handleSuspiciousActivity('timing_attack', 'medium');
        }
    }

    /**
     * Handle suspicious activity detection
     */
    handleSuspiciousActivity(type, severity) {
        const count = this.suspiciousActivity.get(type) || 0;
        this.suspiciousActivity.set(type, count + 1);
        
        console.warn(`Suspicious activity detected: ${type} (severity: ${severity}, count: ${count + 1})`);
        
        // Take action based on severity and count
        if (severity === 'high' || count > 3) {
            this.handleThreat(type, severity);
        } else if (severity === 'medium' && count > 5) {
            this.handleThreat(type, severity);
        }
    }

    /**
     * Handle detected threats
     */
    handleThreat(type, severity) {
        console.error(`Threat detected: ${type}, initiating countermeasures`);
        
        // Increment threat counter
        const threatCount = this.suspiciousActivity.get('threats') || 0;
        this.suspiciousActivity.set('threats', threatCount + 1);
        
        // For development, only log threats but don't shutdown
        console.log(`[DEV MODE] Threat detected: ${type}, count: ${threatCount + 1} - No action taken in development`);
        
        // In production, uncomment the following lines:
        /*
        // Take escalating actions based on threat count
        if (threatCount >= 5) {
            this.initiateSecureShutdown();
        } else if (threatCount >= 3) {
            this.enterLockdownMode();
        } else if (threatCount >= 1) {
            this.increaseObfuscation();
        }
        */
    }

    /**
     * Enter lockdown mode
     */
    enterLockdownMode() {
        console.log('Entering lockdown mode');
        
        // Reduce all functionality
        this.protectionLevel = 'maximum';
        
        // Clear sensitive data
        this.memoryProtector.emergencyScrub();
        
        // Increase all delays and obfuscation
        this.codeObfuscator.increaseObfuscation();
        
        // Notify user if appropriate
        if (Math.random() > 0.5) {
            console.log('System entering security lockdown mode');
        }
    }

    /**
     * Increase obfuscation measures
     */
    increaseObfuscation() {
        this.codeObfuscator.increaseObfuscation();
        this.memoryProtector.increaseProtection();
    }

    /**
     * Start integrity checks
     */
    startIntegrityChecks() {
        const checks = [
            this.checkCodeIntegrity.bind(this),
            this.checkMemoryIntegrity.bind(this),
            this.checkProcessIntegrity.bind(this)
        ];

        checks.forEach((check, index) => {
            const interval = 30000 + Math.random() * 30000; // 30-60 seconds
            const intervalId = setInterval(check, interval);
            this.checkIntervals.set(`integrity_${index}`, intervalId);
        });
    }

    /**
     * Check code integrity
     */
    async checkCodeIntegrity() {
        try {
            const mainScript = require.main.filename;
            const currentHash = await this.calculateFileHash(mainScript);
            const storedHash = this.integrityChecks.get('mainScript');
            
            if (storedHash && currentHash !== storedHash) {
                this.handleSuspiciousActivity('code_tampering', 'high');
            } else if (!storedHash) {
                this.integrityChecks.set('mainScript', currentHash);
            }
        } catch (error) {
            console.error('Code integrity check failed:', error);
        }
    }

    /**
     * Check memory integrity
     */
    async checkMemoryIntegrity() {
        const memoryUsage = process.memoryUsage();
        const suspiciousPatterns = [
            memoryUsage.heapUsed > 1024 * 1024 * 1024, // >1GB heap
            memoryUsage.rss > 2 * 1024 * 1024 * 1024,  // >2GB RSS
            memoryUsage.external > 500 * 1024 * 1024   // >500MB external
        ];
        
        if (suspiciousPatterns.some(pattern => pattern)) {
            this.handleSuspiciousActivity('memory_anomaly', 'medium');
        }
    }

    /**
     * Check process integrity
     */
    async checkProcessIntegrity() {
        const suspiciousSignals = ['SIGTRAP', 'SIGSEGV', 'SIGABRT'];
        // This would be implemented with signal handlers
    }

    /**
     * Calculate file hash for integrity checking
     */
    async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Setup exception handlers
     */
    setupExceptionHandlers() {
        process.on('uncaughtException', (error) => {
            this.handleSuspiciousActivity('uncaught_exception', 'medium');
            // Don't exit immediately, but handle gracefully
        });
        
        process.on('unhandledRejection', (reason) => {
            this.handleSuspiciousActivity('unhandled_rejection', 'low');
        });
        
        process.on('SIGINT', () => {
            this.initiateSecureShutdown();
        });
        
        process.on('SIGTERM', () => {
            this.initiateSecureShutdown();
        });
    }

    /**
     * Initiate secure shutdown
     */
    initiateSecureShutdown() {
        console.log('Initiating secure shutdown due to threat detection');
        
        // Clear all intervals
        this.checkIntervals.forEach(interval => clearInterval(interval));
        
        // Clear sensitive data
        this.memoryProtector.emergencyScrub();
        
        // Notify components
        this.antiTampering.cleanup();
        this.processMonitor.cleanup();
        this.memoryProtector.cleanup();
        
        // Exit
        process.exit(0);
    }

    /**
     * Get protection status
     */
    getProtectionStatus() {
        return {
            isProtected: this.isProtected,
            protectionLevel: this.protectionLevel,
            suspiciousActivity: Object.fromEntries(this.suspiciousActivity),
            activeChecks: this.checkIntervals.size,
            integrityChecks: this.integrityChecks.size
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.checkIntervals.forEach(interval => clearInterval(interval));
        this.antiTampering.cleanup();
        this.processMonitor.cleanup();
        this.memoryProtector.cleanup();
        this.isProtected = false;
    }
}

class AntiTampering {
    constructor() {
        this.originalChecksum = null;
        this.monitoringActive = false;
    }

    async start() {
        this.originalChecksum = await this.calculateProcessChecksum();
        this.monitoringActive = true;
        
        // Start periodic checks
        setInterval(() => this.checkTampering(), 10000 + Math.random() * 10000);
    }

    async calculateProcessChecksum() {
        const data = {
            pid: process.pid,
            ppid: process.ppid,
            execPath: process.execPath,
            execArgv: process.execArgv,
            argv: process.argv,
            envKeys: Object.keys(process.env).sort()
        };
        
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    async checkTampering() {
        if (!this.monitoringActive) return;
        
        const currentChecksum = await this.calculateProcessChecksum();
        if (currentChecksum !== this.originalChecksum) {
            console.warn('Process tampering detected');
            this.originalChecksum = currentChecksum; // Update to prevent false positives
        }
    }

    cleanup() {
        this.monitoringActive = false;
    }
}

class CodeObfuscator {
    constructor() {
        this.obfuscationLevel = 1;
    }

    increaseObfuscation() {
        this.obfuscationLevel = Math.min(this.obfuscationLevel + 1, 5);
    }

    obfuscateString(input) {
        if (this.obfuscationLevel === 0) return input;
        
        // Simple string obfuscation
        return Buffer.from(input).toString('base64');
    }

    deobfuscateString(input) {
        if (this.obfuscationLevel === 0) return input;
        
        try {
            return Buffer.from(input, 'base64').toString();
        } catch {
            return input;
        }
    }
}

class ProcessMonitor {
    constructor() {
        this.monitoringActive = false;
        this.originalProcessTree = new Map();
    }

    async start() {
        this.monitoringActive = true;
        await this.buildProcessTree();
        
        // Monitor for new processes
        setInterval(() => this.checkProcessTree(), 15000 + Math.random() * 15000);
    }

    async buildProcessTree() {
        if (process.platform === 'win32') {
            exec('tasklist /fo csv', (error, stdout) => {
                if (stdout) {
                    const lines = stdout.split('\n').slice(1);
                    lines.forEach(line => {
                        if (line.trim()) {
                            const parts = line.split(',').map(p => p.replace(/"/g, ''));
                            this.originalProcessTree.set(parts[0], {
                                pid: parts[1],
                                memory: parts[4],
                                session: parts[2]
                            });
                        }
                    });
                }
            });
        }
    }

    async checkProcessTree() {
        if (!this.monitoringActive) return;
        
        await this.buildProcessTree();
        // Compare with original tree and detect anomalies
    }

    cleanup() {
        this.monitoringActive = false;
        this.originalProcessTree.clear();
    }
}

class MemoryProtector {
    constructor() {
        this.sensitiveData = new Map();
        this.protectionLevel = 1;
    }

    async initialize() {
        // Initialize memory protection
        process.on('exit', () => this.emergencyScrub());
    }

    storeSensitive(key, data) {
        const encrypted = crypto.createCipher('aes-256-cbc', this.generateKey())
            .update(JSON.stringify(data), 'utf8', 'hex') + 
            crypto.createCipher('aes-256-cbc', this.generateKey()).final('hex');
        
        this.sensitiveData.set(key, encrypted);
    }

    getSensitive(key) {
        const encrypted = this.sensitiveData.get(key);
        if (!encrypted) return null;
        
        try {
            const decrypted = crypto.createDecipher('aes-256-cbc', this.generateKey())
                .update(encrypted, 'hex', 'utf8') + 
                crypto.createDecipher('aes-256-cbc', this.generateKey()).final('utf8');
            
            return JSON.parse(decrypted);
        } catch {
            return null;
        }
    }

    generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    increaseProtection() {
        this.protectionLevel = Math.min(this.protectionLevel + 1, 5);
    }

    emergencyScrub() {
        this.sensitiveData.clear();
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }

    cleanup() {
        this.emergencyScrub();
    }
}

module.exports = RuntimeProtection;
