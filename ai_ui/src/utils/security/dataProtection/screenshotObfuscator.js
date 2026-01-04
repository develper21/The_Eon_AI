// screenshotObfuscator.js - Advanced screenshot capture obfuscation

const crypto = require('crypto');
const { enhancedSecurityManager } = require('./securityManager');

// Try to load sharp, but make it optional
let sharp;
try {
    sharp = require('sharp');
} catch (error) {
    console.warn('Sharp not available, using fallback image processing');
    sharp = null;
}

class ScreenshotObfuscator {
    constructor() {
        this.compressionLevel = 0.7 + Math.random() * 0.3; // 70-100%
        this.noisePatterns = new Map();
        this.captureHistory = [];
        this.lastCaptureTime = 0;
        this.behavioralProfile = enhancedSecurityManager.behavioralProfile;
    }

    /**
     * Obfuscate screenshot before processing/storage
     */
    async obfuscateScreenshot(imageBuffer, options = {}) {
        try {
            // Add realistic delay between captures
            await this.addCaptureDelay();
            
            // Apply multiple obfuscation layers
            let processedBuffer = imageBuffer;
            
            // Use fallback if sharp is not available
            if (!sharp) {
                return this.fallbackObfuscation(imageBuffer, options);
            }
            
            // 1. Add subtle noise to avoid perfect pattern detection
            if (options.addNoise !== false) {
                processedBuffer = await this.addSubtleNoise(processedBuffer);
            }
            
            // 2. Randomize compression and quality
            processedBuffer = await this.randomizeCompression(processedBuffer);
            
            // 3. Add timestamp-based variations
            processedBuffer = await this.addTemporalVariations(processedBuffer);
            
            // 4. Encrypt sensitive regions if detected
            if (options.encryptSensitive) {
                processedBuffer = await this.encryptSensitiveRegions(processedBuffer);
            }
            
            // 5. Add metadata obfuscation
            processedBuffer = await this.obfuscateMetadata(processedBuffer);
            
            // Record capture for pattern analysis
            this.recordCapture(processedBuffer);
            
            return processedBuffer;
            
        } catch (error) {
            console.error('Screenshot obfuscation failed:', error);
            return imageBuffer; // Fallback to original
        }
    }

    /**
     * Fallback obfuscation when sharp is not available
     */
    fallbackObfuscation(imageBuffer, options = {}) {
        try {
            // Simple buffer manipulation without sharp
            let processedBuffer = Buffer.from(imageBuffer);
            
            // Add some random noise to the buffer
            for (let i = 0; i < Math.min(100, processedBuffer.length); i++) {
                const randomIndex = Math.floor(Math.random() * processedBuffer.length);
                processedBuffer[randomIndex] ^= Math.floor(Math.random() * 256);
            }
            
            // Record capture
            this.recordCapture(processedBuffer);
            
            return processedBuffer;
        } catch (error) {
            console.error('Fallback obfuscation failed:', error);
            return imageBuffer;
        }
    }

    /**
     * Add realistic delay between captures based on human behavior
     */
    async addCaptureDelay() {
        const now = Date.now();
        const timeSinceLastCapture = now - this.lastCaptureTime;
        
        // Human-like delay: 2-10 seconds between actions
        const minDelay = this.behavioralProfile.clickDelay;
        const maxDelay = minDelay * 10;
        const targetDelay = minDelay + Math.random() * (maxDelay - minDelay);
        
        if (timeSinceLastCapture < targetDelay) {
            const waitTime = targetDelay - timeSinceLastCapture;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastCaptureTime = Date.now();
    }

    /**
     * Add subtle noise to avoid detection algorithms
     */
    async addSubtleNoise(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            
            // Generate noise pattern based on timestamp
            const noiseSeed = Date.now() % 1000;
            const noiseLevel = 0.02 + Math.random() * 0.03; // 2-5% noise
            
            // Apply very subtle gaussian noise
            const processed = await image
                .modulate({
                    brightness: 0.98 + Math.random() * 0.04, // ±2% brightness
                    saturation: 0.95 + Math.random() * 0.1    // ±5% saturation
                })
                .sharpen({
                    sigma: 0.1 + Math.random() * 0.3,          // Very subtle sharpen
                    flat: 1.0,
                    jagged: 1.0
                })
                .composite([{
                    input: await this.generateNoiseOverlay(metadata.width, metadata.height, noiseLevel, noiseSeed),
                    blend: 'overlay'
                }])
                .png({
                    compressionLevel: 6 + Math.floor(Math.random() * 3),
                    adaptiveFiltering: false,
                    force: true
                })
                .toBuffer();
                
            return processed;
        } catch (error) {
            console.error('Noise addition failed:', error);
            return imageBuffer;
        }
    }

    /**
     * Generate noise overlay pattern
     */
    async generateNoiseOverlay(width, height, level, seed) {
        // Create a subtle noise pattern
        const noiseBuffer = Buffer.from(
            `<?xml version="1.0" encoding="UTF-8"?>
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="noise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="${seed}" />
                        <feColorMatrix type="saturate" values="0"/>
                        <feComponentTransfer>
                            <feFuncA type="discrete" tableValues="0 ${level}"/>
                        </feComponentTransfer>
                    </filter>
                </defs>
                <rect width="100%" height="100%" filter="url(#noise)" opacity="0.1"/>
            </svg>`
        );
        
        return sharp(noiseBuffer)
            .resize(width, height)
            .png()
            .toBuffer();
    }

    /**
     * Randomize compression to avoid consistent file sizes
     */
    async randomizeCompression(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            const quality = 70 + Math.floor(Math.random() * 30); // 70-100% quality
            
            // Randomly choose compression format
            const formats = ['jpeg', 'png', 'webp'];
            const format = formats[Math.floor(Math.random() * formats.length)];
            
            if (format === 'jpeg') {
                return await image
                    .jpeg({ 
                        quality,
                        progressive: Math.random() > 0.5,
                        mozjpeg: true
                    })
                    .toBuffer();
            } else if (format === 'png') {
                return await image
                    .png({ 
                        compressionLevel: 6 + Math.floor(Math.random() * 3),
                        progressive: Math.random() > 0.5,
                        adaptiveFiltering: false
                    })
                    .toBuffer();
            } else {
                return await image
                    .webp({ 
                        quality,
                        effort: 4 + Math.floor(Math.random() * 3)
                    })
                    .toBuffer();
            }
        } catch (error) {
            console.error('Compression randomization failed:', error);
            return imageBuffer;
        }
    }

    /**
     * Add temporal variations based on time of day
     */
    async addTemporalVariations(imageBuffer) {
        try {
            const hour = new Date().getHours();
            const image = sharp(imageBuffer);
            
            // Subtle adjustments based on time of day
            let brightnessAdjust = 1.0;
            let contrastAdjust = 1.0;
            
            if (hour >= 6 && hour < 12) {
                // Morning: slightly brighter
                brightnessAdjust = 1.02 + Math.random() * 0.02;
                contrastAdjust = 1.01 + Math.random() * 0.01;
            } else if (hour >= 12 && hour < 18) {
                // Afternoon: normal to slightly warm
                brightnessAdjust = 1.0 + Math.random() * 0.02;
                contrastAdjust = 1.0 + Math.random() * 0.02;
            } else if (hour >= 18 && hour < 22) {
                // Evening: slightly warmer, less contrast
                brightnessAdjust = 0.98 + Math.random() * 0.02;
                contrastAdjust = 0.99 + Math.random() * 0.01;
            } else {
                // Night: darker, more contrast
                brightnessAdjust = 0.96 + Math.random() * 0.02;
                contrastAdjust = 1.02 + Math.random() * 0.02;
            }
            
            return await image
                .modulate({
                    brightness: brightnessAdjust,
                    contrast: contrastAdjust
                })
                .toBuffer();
                
        } catch (error) {
            console.error('Temporal variations failed:', error);
            return imageBuffer;
        }
    }

    /**
     * Detect and encrypt potentially sensitive regions
     */
    async encryptSensitiveRegions(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            
            // Simple heuristic for detecting potential sensitive content
            // (This is a basic implementation - could be enhanced with ML)
            const sensitiveRegions = await this.detectSensitiveRegions(imageBuffer);
            
            if (sensitiveRegions.length === 0) {
                return imageBuffer;
            }
            
            // Apply blur or pixelation to sensitive regions
            let processedImage = image;
            
            for (const region of sensitiveRegions) {
                processedImage = processedImage.composite([{
                    input: await this.createRegionMask(metadata.width, metadata.height, region),
                    blend: 'dest-in'
                }]);
            }
            
            return await processedImage.toBuffer();
            
        } catch (error) {
            console.error('Sensitive region encryption failed:', error);
            return imageBuffer;
        }
    }

    /**
     * Basic detection of potentially sensitive regions
     */
    async detectSensitiveRegions(imageBuffer) {
        // This is a placeholder implementation
        // In production, this would use ML models to detect:
        // - Terminal windows
        // - Code editors
        // - Password fields
        // - Personal information
        
        const regions = [];
        
        // Simulate detection with some randomness
        if (Math.random() > 0.7) {
            regions.push({
                x: Math.floor(Math.random() * 200),
                y: Math.floor(Math.random() * 200),
                width: 200 + Math.floor(Math.random() * 100),
                height: 100 + Math.floor(Math.random() * 50)
            });
        }
        
        return regions;
    }

    /**
     * Create mask for sensitive region
     */
    async createRegionMask(imageWidth, imageHeight, region) {
        const maskBuffer = Buffer.from(
            `<?xml version="1.0" encoding="UTF-8"?>
            <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
                <rect x="${region.x}" y="${region.y}" width="${region.width}" height="${region.height}" 
                      fill="black" opacity="0.8"/>
            </svg>`
        );
        
        return sharp(maskBuffer)
            .png()
            .toBuffer();
    }

    /**
     * Obfuscate image metadata to avoid forensic analysis
     */
    async obfuscateMetadata(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            
            // Remove all EXIF data and add fake metadata
            return await image
                .withMetadata({
                    exif: {
                        // Add fake camera metadata
                        Make: ['Canon', 'Nikon', 'Sony', 'Apple'][Math.floor(Math.random() * 4)],
                        Model: `Model ${Math.floor(Math.random() * 9000) + 1000}`,
                        DateTime: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
                        Software: ['Photoshop', 'GIMP', 'Paint', 'Preview'][Math.floor(Math.random() * 4)]
                    }
                })
                .toBuffer();
                
        } catch (error) {
            console.error('Metadata obfuscation failed:', error);
            return imageBuffer;
        }
    }

    /**
     * Record capture for pattern analysis
     */
    recordCapture(imageBuffer) {
        const capture = {
            timestamp: Date.now(),
            size: imageBuffer.length,
            compression: this.compressionLevel,
            noiseLevel: this.noisePatterns.size,
            sessionTime: Date.now() - (this.sessionStartTime || Date.now())
        };
        
        this.captureHistory.push(capture);
        
        // Keep only last 100 captures
        if (this.captureHistory.length > 100) {
            this.captureHistory.shift();
        }
        
        // Update behavioral patterns
        this.updateBehavioralPatterns(capture);
    }

    /**
     * Update behavioral patterns based on capture history
     */
    updateBehavioralPatterns(capture) {
        // Analyze capture patterns to detect anomalies
        if (this.captureHistory.length > 10) {
            const recentCaptures = this.captureHistory.slice(-10);
            const avgInterval = this.calculateAverageInterval(recentCaptures);
            
            // If captures are too frequent, add more delays
            if (avgInterval < 2000) { // Less than 2 seconds average
                this.behavioralProfile.clickDelay *= 1.2; // Increase delays
            }
        }
    }

    /**
     * Calculate average interval between captures
     */
    calculateAverageInterval(captures) {
        if (captures.length < 2) return 0;
        
        let totalInterval = 0;
        for (let i = 1; i < captures.length; i++) {
            totalInterval += captures[i].timestamp - captures[i-1].timestamp;
        }
        
        return totalInterval / (captures.length - 1);
    }

    /**
     * Get capture statistics
     */
    getCaptureStats() {
        return {
            totalCaptures: this.captureHistory.length,
            averageInterval: this.calculateAverageInterval(this.captureHistory),
            lastCapture: this.lastCaptureTime,
            noisePatterns: this.noisePatterns.size,
            compressionLevel: this.compressionLevel
        };
    }

    /**
     * Reset capture session
     */
    resetSession() {
        this.captureHistory = [];
        this.lastCaptureTime = 0;
        this.sessionStartTime = Date.now();
        this.compressionLevel = 0.7 + Math.random() * 0.3;
    }
}

module.exports = ScreenshotObfuscator;
