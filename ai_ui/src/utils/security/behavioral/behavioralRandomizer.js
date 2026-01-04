// behavioralRandomizer.js - Advanced behavioral pattern randomization

const crypto = require('crypto');
const { enhancedSecurityManager } = require('../dataProtection/securityManager');

class BehavioralRandomizer {
    constructor() {
        this.behavioralProfile = enhancedSecurityManager.behavioralProfile;
        this.actionHistory = [];
        this.patternDetectors = new Map();
        this.randomizationLevel = 'medium';
        this.sessionStartTime = Date.now();
        this.lastActionTime = 0;
        this.deviationFactors = new Map();
        this.humanizationEngine = new HumanizationEngine();
        this.patternBreaker = new PatternBreaker();
    }

    /**
     * Initialize behavioral randomization
     */
    initialize() {
        console.log('Initializing behavioral randomization...');
        
        // Initialize deviation factors
        this.initializeDeviationFactors();
        
        // Start pattern monitoring
        this.startPatternMonitoring();
        
        // Initialize humanization engine
        this.humanizationEngine.initialize();
        
        console.log('Behavioral randomization initialized');
    }

    /**
     * Initialize random deviation factors
     */
    initializeDeviationFactors() {
        this.deviationFactors.set('typing', {
            speedVariation: 0.15 + Math.random() * 0.25,    // 15-40% variation
            errorRate: 0.01 + Math.random() * 0.04,         // 1-5% error rate
            pausePattern: this.generatePausePattern(),
            rhythmVariation: 0.1 + Math.random() * 0.2       // 10-30% rhythm variation
        });

        this.deviationFactors.set('mouse', {
            movementJitter: 2 + Math.random() * 8,          // 2-10 pixel jitter
            clickDelay: 50 + Math.random() * 150,           // 50-200ms click delay
            doubleClickDelay: 100 + Math.random() * 300,    // 100-400ms double-click
            movementSpeed: 200 + Math.random() * 800         // 200-1000 pixels/second
        });

        this.deviationFactors.set('scrolling', {
            scrollSpeed: 3 + Math.random() * 7,              // 3-10 lines per scroll
            scrollJitter: 0.5 + Math.random() * 2,           // 0.5-2.5 pixel jitter
            accelerationPattern: this.generateAccelerationPattern(),
            pauseFrequency: 0.1 + Math.random() * 0.3       // 10-40% pause frequency
        });

        this.deviationFactors.set('cognitive', {
            processingDelay: 500 + Math.random() * 2500,    // 0.5-3 seconds
            hesitationRate: 0.05 + Math.random() * 0.15,     // 5-20% hesitation
            focusShiftRate: 0.02 + Math.random() * 0.08,    // 2-10% focus shifts
            fatigueFactor: this.generateFatiguePattern()
        });
    }

    /**
     * Generate realistic pause patterns
     */
    generatePausePattern() {
        return {
            shortPauses: {
                frequency: 0.3 + Math.random() * 0.4,        // 30-70% frequency
                duration: 100 + Math.random() * 400         // 100-500ms
            },
            mediumPauses: {
                frequency: 0.1 + Math.random() * 0.2,        // 10-30% frequency
                duration: 500 + Math.random() * 1500        // 500-2000ms
            },
            longPauses: {
                frequency: 0.02 + Math.random() * 0.08,      // 2-10% frequency
                duration: 2000 + Math.random() * 3000       // 2-5 seconds
            }
        };
    }

    /**
     * Generate acceleration patterns for scrolling
     */
    generateAccelerationPattern() {
        return {
            initialSpeed: 0.5 + Math.random() * 1.5,        // 0.5-2x initial speed
            accelerationRate: 0.1 + Math.random() * 0.3,     // 10-40% acceleration
            decelerationPoint: 0.6 + Math.random() * 0.3,    // 60-90% through scroll
            finalSpeedMultiplier: 0.3 + Math.random() * 0.4  // 30-70% of initial speed
        };
    }

    /**
     * Generate fatigue pattern based on session duration
     */
    generateFatiguePattern() {
        return {
            onsetTime: 900000 + Math.random() * 1800000,    // 15-45 minutes
            progressionRate: 0.001 + Math.random() * 0.003,  // 0.1-0.3% per minute
            maxFatigue: 0.3 + Math.random() * 0.4,          // 30-70% max fatigue
            recoveryRate: 0.0005 + Math.random() * 0.0015   // 0.05-0.15% per minute
        };
    }

    /**
     * Start monitoring for behavioral patterns
     */
    startPatternMonitoring() {
        // Monitor action patterns every 30 seconds
        setInterval(() => {
            this.analyzeActionPatterns();
        }, 30000 + Math.random() * 15000);

        // Monitor for repetitive behaviors
        setInterval(() => {
            this.detectRepetitiveBehaviors();
        }, 60000 + Math.random() * 30000);
    }

    /**
     * Randomize typing behavior
     */
    randomizeTyping(text, options = {}) {
        const typingFactors = this.deviationFactors.get('typing');
        const sessionDuration = Date.now() - this.sessionStartTime;
        const fatigueMultiplier = this.calculateFatigueMultiplier('typing', sessionDuration);
        
        const randomizedActions = [];
        let currentPosition = 0;
        
        while (currentPosition < text.length) {
            // Determine if we should type multiple characters
            const charsToType = this.determineChunkSize(text, currentPosition);
            const chunk = text.substring(currentPosition, currentPosition + charsToType);
            
            // Add typing action
            randomizedActions.push({
                type: 'type',
                text: chunk,
                delay: this.calculateTypingDelay(chunk, typingFactors, fatigueMultiplier),
                timestamp: Date.now()
            });
            
            currentPosition += charsToType;
            
            // Add pauses based on pattern
            if (this.shouldAddPause(typingFactors.pausePattern, currentPosition, text.length, text)) {
                randomizedActions.push({
                    type: 'pause',
                    duration: this.calculatePauseDuration(typingFactors.pausePattern),
                    timestamp: Date.now()
                });
            }
            
            // Add occasional errors and corrections
            if (Math.random() < typingFactors.errorRate) {
                const errorAction = this.generateTypingError(chunk);
                if (errorAction) {
                    randomizedActions.push(errorAction);
                }
            }
        }
        
        return this.humanizationEngine.humanizeActionSequence(randomizedActions);
    }

    /**
     * Determine chunk size for typing
     */
    determineChunkSize(text, position) {
        const baseChunkSize = 1 + Math.floor(Math.random() * 3); // 1-4 characters
        
        // Increase chunk size for common words
        const remainingText = text.substring(position);
        const commonWords = ['the', 'and', 'ing', 'tion', 'com', 'www'];
        
        for (const word of commonWords) {
            if (remainingText.toLowerCase().startsWith(word)) {
                return Math.max(baseChunkSize, word.length);
            }
        }
        
        return baseChunkSize;
    }

    /**
     * Calculate typing delay with human-like variations
     */
    calculateTypingDelay(text, factors, fatigueMultiplier) {
        const baseDelay = 50 + Math.random() * 100; // 50-150ms base
        
        // Apply speed variation
        const speedVariation = 1 + (Math.random() - 0.5) * factors.speedVariation;
        
        // Apply rhythm variation
        const rhythmVariation = 1 + (Math.random() - 0.5) * factors.rhythmVariation;
        
        // Apply fatigue
        const fatigueDelay = baseDelay * fatigueMultiplier;
        
        // Character-specific delays (harder keys take longer)
        const charDelay = this.getCharacterDelay(text);
        
        return Math.max(30, fatigueDelay * speedVariation * rhythmVariation + charDelay);
    }

    /**
     * Get character-specific delay based on keyboard position
     */
    getCharacterDelay(text) {
        // Harder to reach keys have longer delays
        const hardKeys = 'qazwsxedcrfvtgbyhnujmikolp'; // Left hand home row and edges
        const veryHardKeys = '!@#$%^&*()_+{}|:"<>?~`'; // Special characters
        
        let delay = 0;
        for (const char of text) {
            if (veryHardKeys.includes(char)) {
                delay += 20 + Math.random() * 30;
            } else if (hardKeys.includes(char.toLowerCase())) {
                delay += 10 + Math.random() * 20;
            } else {
                delay += Math.random() * 10;
            }
        }
        
        return delay / text.length;
    }

    /**
     * Determine if pause should be added
     */
    shouldAddPause(pausePattern, position, totalLength, text) {
        const progress = position / totalLength;
        
        // More pauses at word boundaries and punctuation
        if (position > 0 && text && ' .,;:!?'.includes(text[position - 1])) {
            return Math.random() < 0.7;
        }
        
        // Random pauses based on pattern
        const random = Math.random();
        if (random < pausePattern.shortPauses.frequency) {
            return true;
        } else if (random < pausePattern.mediumPauses.frequency) {
            return true;
        } else if (random < pausePattern.longPauses.frequency) {
            return true;
        }
        
        return false;
    }

    /**
     * Calculate pause duration
     */
    calculatePauseDuration(pausePattern) {
        const random = Math.random();
        
        if (random < 0.7) {
            // Short pause
            return pausePattern.shortPauses.duration + (Math.random() - 0.5) * 100;
        } else if (random < 0.9) {
            // Medium pause
            return pausePattern.mediumPauses.duration + (Math.random() - 0.5) * 500;
        } else {
            // Long pause
            return pausePattern.longPauses.duration + (Math.random() - 0.5) * 1000;
        }
    }

    /**
     * Generate typing error and correction
     */
    generateTypingError(originalText) {
        const errorTypes = ['substitution', 'omission', 'insertion', 'transposition'];
        const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        
        let errorText = originalText;
        let correctionDelay = 200 + Math.random() * 800; // 200-1000ms to notice error
        
        switch (errorType) {
            case 'substitution':
                // Replace one character with nearby key
                if (originalText.length > 0) {
                    const pos = Math.floor(Math.random() * originalText.length);
                    const nearbyKeys = this.getNearbyKeys(originalText[pos]);
                    if (nearbyKeys.length > 0) {
                        errorText = originalText.substring(0, pos) + 
                                  nearbyKeys[0] + 
                                  originalText.substring(pos + 1);
                    }
                }
                break;
                
            case 'omission':
                // Skip a character
                if (originalText.length > 1) {
                    const pos = Math.floor(Math.random() * originalText.length);
                    errorText = originalText.substring(0, pos) + 
                              originalText.substring(pos + 1);
                }
                break;
                
            case 'insertion':
                // Add extra character
                const pos = Math.floor(Math.random() * (originalText.length + 1));
                const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
                errorText = originalText.substring(0, pos) + randomChar + 
                          originalText.substring(pos);
                break;
                
            case 'transposition':
                // Swap adjacent characters
                if (originalText.length > 1) {
                    const pos = Math.floor(Math.random() * (originalText.length - 1));
                    errorText = originalText.substring(0, pos) + 
                              originalText[pos + 1] + originalText[pos] + 
                              originalText.substring(pos + 2);
                }
                break;
        }
        
        return {
            type: 'error',
            incorrectText: errorText,
            correctionText: originalText,
            correctionDelay: correctionDelay,
            timestamp: Date.now()
        };
    }

    // Store reference to current text for error generation
    setCurrentText(text) {
        this.currentText = text;
    }

    /**
     * Get nearby keys on QWERTY keyboard
     */
    getNearbyKeys(key) {
        const keyboardMap = {
            'q': ['w', 'a', 's'], 'w': ['q', 'e', 'a', 's', 'd'], 'e': ['w', 'r', 's', 'd', 'f'],
            'r': ['e', 't', 'd', 'f', 'g'], 't': ['r', 'y', 'f', 'g', 'h'], 'y': ['t', 'u', 'g', 'h', 'j'],
            'u': ['y', 'i', 'h', 'j', 'k'], 'i': ['u', 'o', 'j', 'k', 'l'], 'o': ['i', 'p', 'k', 'l'],
            'p': ['o', 'l'], 'a': ['q', 'w', 's', 'z', 'x'], 's': ['q', 'w', 'e', 'a', 'd', 'z', 'x', 'c'],
            'd': ['w', 'e', 'r', 's', 'f', 'x', 'c', 'v'], 'f': ['e', 'r', 't', 'd', 'g', 'c', 'v', 'b'],
            'g': ['r', 't', 'y', 'f', 'h', 'v', 'b', 'n'], 'h': ['t', 'y', 'u', 'g', 'j', 'b', 'n', 'm'],
            'j': ['y', 'u', 'i', 'h', 'k', 'n', 'm'], 'k': ['u', 'i', 'o', 'j', 'l', 'm'],
            'l': ['i', 'o', 'p', 'k'], 'z': ['a', 's', 'x'], 'x': ['z', 'a', 's', 'd', 'c'],
            'c': ['x', 's', 'd', 'f', 'v'], 'v': ['c', 'd', 'f', 'g', 'b'], 'b': ['v', 'f', 'g', 'h', 'n'],
            'n': ['b', 'g', 'h', 'j', 'm'], 'm': ['n', 'h', 'j', 'k']
        };
        
        return keyboardMap[key.toLowerCase()] || [];
    }

    /**
     * Randomize mouse movement
     */
    randomizeMouseMovement(startX, startY, endX, endY, options = {}) {
        const mouseFactors = this.deviationFactors.get('mouse');
        const sessionDuration = Date.now() - this.sessionStartTime;
        const fatigueMultiplier = this.calculateFatigueMultiplier('mouse', sessionDuration);
        
        // Calculate direct path
        const directDistance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const directDuration = directDistance / mouseFactors.movementSpeed * 1000;
        
        // Add human-like curves and jitter
        const path = this.generateMousePath(startX, startY, endX, endY, mouseFactors);
        const movements = [];
        
        let currentTime = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const segmentDuration = this.calculateSegmentDuration(
                path[i], path[i + 1], directDuration, fatigueMultiplier
            );
            
            movements.push({
                type: 'move',
                from: path[i],
                to: path[i + 1],
                duration: segmentDuration,
                timestamp: Date.now() + currentTime
            });
            
            currentTime += segmentDuration;
        }
        
        // Add click at the end
        if (options.click !== false) {
            movements.push({
                type: 'click',
                position: { x: endX, y: endY },
                delay: mouseFactors.clickDelay * fatigueMultiplier,
                timestamp: Date.now() + currentTime
            });
        }
        
        return this.humanizationEngine.humanizeActionSequence(movements);
    }

    /**
     * Generate curved mouse path
     */
    generateMousePath(startX, startY, endX, endY, factors) {
        const path = [{ x: startX, y: startY }];
        const numPoints = 5 + Math.floor(Math.random() * 10); // 5-15 points
        
        for (let i = 1; i < numPoints - 1; i++) {
            const progress = i / numPoints;
            const baseX = startX + (endX - startX) * progress;
            const baseY = startY + (endY - startY) * progress;
            
            // Add curve deviation
            const maxDeviation = 50 + Math.random() * 100;
            const angle = Math.random() * Math.PI * 2;
            const deviation = Math.sin(progress * Math.PI) * maxDeviation;
            
            const x = baseX + Math.cos(angle) * deviation + (Math.random() - 0.5) * factors.movementJitter;
            const y = baseY + Math.sin(angle) * deviation + (Math.random() - 0.5) * factors.movementJitter;
            
            path.push({ x, y });
        }
        
        path.push({ x: endX, y: endY });
        return path;
    }

    /**
     * Calculate segment duration for mouse movement
     */
    calculateSegmentDuration(from, to, totalDuration, fatigueMultiplier) {
        const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
        const baseSpeed = 200 + Math.random() * 800; // 200-1000 pixels/second
        const segmentDuration = (distance / baseSpeed) * 1000;
        
        return Math.max(10, segmentDuration * fatigueMultiplier);
    }

    /**
     * Calculate fatigue multiplier based on session duration
     */
    calculateFatigueMultiplier(actionType, sessionDuration) {
        const fatiguePattern = this.deviationFactors.get('cognitive').fatigueFactor;
        
        if (sessionDuration < fatiguePattern.onsetTime) {
            return 1.0; // No fatigue yet
        }
        
        const fatigueProgress = (sessionDuration - fatiguePattern.onsetTime) / 3600000; // Hours since onset
        const currentFatigue = Math.min(fatigueProgress * fatiguePattern.progressionRate, fatiguePattern.maxFatigue);
        
        // Different actions affected differently by fatigue
        const fatigueSensitivity = {
            typing: 1.5,    // Typing slows down significantly
            mouse: 1.2,    // Mouse movement slightly slower
            scrolling: 1.1, // Scrolling minimally affected
            cognitive: 2.0  // Cognitive processing most affected
        };
        
        return 1.0 + (currentFatigue * (fatigueSensitivity[actionType] || 1.0));
    }

    /**
     * Analyze action patterns for detection
     */
    analyzeActionPatterns() {
        if (this.actionHistory.length < 10) return;
        
        const recentActions = this.actionHistory.slice(-50);
        const patterns = this.extractPatterns(recentActions);
        
        // Check for suspicious patterns
        for (const [patternType, patternData] of patterns) {
            if (this.isSuspiciousPattern(patternType, patternData)) {
                this.handleSuspiciousPattern(patternType, patternData);
            }
        }
    }

    /**
     * Extract patterns from action history
     */
    extractPatterns(actions) {
        const patterns = new Map();
        
        // Timing patterns
        const intervals = this.calculateIntervals(actions);
        patterns.set('timing', {
            avgInterval: intervals.reduce((a, b) => a + b, 0) / intervals.length,
            variance: this.calculateVariance(intervals),
            regularity: this.calculateRegularity(intervals)
        });
        
        // Action frequency patterns
        const actionCounts = this.countActionTypes(actions);
        patterns.set('frequency', actionCounts);
        
        // Sequential patterns
        const sequences = this.extractSequences(actions);
        patterns.set('sequences', sequences);
        
        return patterns;
    }

    /**
     * Calculate intervals between actions
     */
    calculateIntervals(actions) {
        const intervals = [];
        for (let i = 1; i < actions.length; i++) {
            intervals.push(actions[i].timestamp - actions[i-1].timestamp);
        }
        return intervals;
    }

    /**
     * Calculate variance in timing
     */
    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Calculate regularity score (lower is more regular)
     */
    calculateRegularity(intervals) {
        if (intervals.length < 2) return 0;
        
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const deviations = intervals.map(interval => Math.abs(interval - mean));
        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        
        return avgDeviation / mean; // Coefficient of variation
    }

    /**
     * Count action types
     */
    countActionTypes(actions) {
        const counts = {};
        actions.forEach(action => {
            counts[action.type] = (counts[action.type] || 0) + 1;
        });
        return counts;
    }

    /**
     * Extract sequential patterns
     */
    extractSequences(actions) {
        const sequences = [];
        let currentSequence = [actions[0].type];
        
        for (let i = 1; i < actions.length; i++) {
            if (actions[i].type === actions[i-1].type) {
                currentSequence.push(actions[i].type);
            } else {
                if (currentSequence.length > 1) {
                    sequences.push([...currentSequence]);
                }
                currentSequence = [actions[i].type];
            }
        }
        
        if (currentSequence.length > 1) {
            sequences.push(currentSequence);
        }
        
        return sequences;
    }

    /**
     * Check if pattern is suspicious
     */
    isSuspiciousPattern(patternType, patternData) {
        switch (patternType) {
            case 'timing':
                // Too regular timing is suspicious
                return patternData.regularity < 0.1;
                
            case 'frequency':
                // Imbalanced action distribution
                const total = Object.values(patternData).reduce((a, b) => a + b, 0);
                const maxCount = Math.max(...Object.values(patternData));
                return maxCount / total > 0.8;
                
            case 'sequences':
                // Long repetitive sequences
                return patternData.some(seq => seq.length > 10);
                
            default:
                return false;
        }
    }

    /**
     * Handle suspicious pattern detection
     */
    handleSuspiciousPattern(patternType, patternData) {
        console.warn(`Suspicious behavioral pattern detected: ${patternType}`);
        
        // Increase randomization
        this.increaseRandomization();
        
        // Break the pattern
        this.patternBreaker.breakPattern(patternType, patternData);
    }

    /**
     * Increase randomization level
     */
    increaseRandomization() {
        const levels = ['low', 'medium', 'high', 'maximum'];
        const currentIndex = levels.indexOf(this.randomizationLevel);
        
        if (currentIndex < levels.length - 1) {
            this.randomizationLevel = levels[currentIndex + 1];
            console.log(`Increased randomization to: ${this.randomizationLevel}`);
        }
        
        // Adjust deviation factors
        this.adjustDeviationFactors();
    }

    /**
     * Adjust deviation factors for more randomness
     */
    adjustDeviationFactors() {
        for (const [key, factors] of this.deviationFactors) {
            for (const [subKey, value] of Object.entries(factors)) {
                if (typeof value === 'number') {
                    factors[subKey] = value * (1.1 + Math.random() * 0.3);
                }
            }
        }
    }

    /**
     * Record action for pattern analysis
     */
    recordAction(action) {
        this.actionHistory.push({
            ...action,
            timestamp: Date.now()
        });
        
        // Keep only recent actions
        if (this.actionHistory.length > 1000) {
            this.actionHistory = this.actionHistory.slice(-500);
        }
        
        this.lastActionTime = Date.now();
    }

    /**
     * Get current behavioral status
     */
    getBehavioralStatus() {
        return {
            randomizationLevel: this.randomizationLevel,
            sessionDuration: Date.now() - this.sessionStartTime,
            actionHistorySize: this.actionHistory.length,
            deviationFactors: Object.fromEntries(
                Array.from(this.deviationFactors.entries()).map(([key, value]) => [
                    key, 
                    Object.fromEntries(value.entries())
                ])
            )
        };
    }
}

class HumanizationEngine {
    constructor() {
        this.microBehaviors = new Map();
        this.contextualFactors = new Map();
    }

    initialize() {
        this.loadMicroBehaviors();
        this.loadContextualFactors();
    }

    loadMicroBehaviors() {
        this.microBehaviors.set('typing', [
            { type: 'micro_pause', probability: 0.1, duration: 50 + Math.random() * 100 },
            { type: 'rhythm_change', probability: 0.05, factor: 0.8 + Math.random() * 0.4 },
            { type: 'pressure_variation', probability: 0.15, strength: 0.9 + Math.random() * 0.2 }
        ]);
    }

    loadContextualFactors() {
        this.contextualFactors.set('time_of_day', this.getTimeOfDayFactor());
        this.contextualFactors.set('session_fatigue', 0.0);
    }

    getTimeOfDayFactor() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    humanizeActionSequence(actions) {
        return actions.map(action => this.applyHumanization(action));
    }

    applyHumanization(action) {
        const behaviors = this.microBehaviors.get(action.type) || [];
        
        for (const behavior of behaviors) {
            if (Math.random() < behavior.probability) {
                action = this.applyMicroBehavior(action, behavior);
            }
        }
        
        return action;
    }

    applyMicroBehavior(action, behavior) {
        switch (behavior.type) {
            case 'micro_pause':
                action.microPause = behavior.duration;
                break;
            case 'rhythm_change':
                action.delayMultiplier = action.delayMultiplier || 1.0;
                action.delayMultiplier *= behavior.factor;
                break;
            case 'pressure_variation':
                action.pressure = behavior.strength;
                break;
        }
        
        return action;
    }
}

class PatternBreaker {
    constructor() {
        this.breakingStrategies = new Map();
    }

    breakPattern(patternType, patternData) {
        const strategy = this.breakingStrategies.get(patternType);
        if (strategy) {
            strategy(patternData);
        }
    }
}

module.exports = BehavioralRandomizer;
