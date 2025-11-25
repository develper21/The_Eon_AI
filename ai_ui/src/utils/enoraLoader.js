// Enora The Eon Loading System
class EnoraLoader {
    constructor() {
        this.isLoading = false;
        this.loadingElement = null;
        this.overlayElement = null;
        this.currentStep = 'listening';
        this.loadingSteps = ['listening', 'processing'];
        this.stepIndex = 0;
        this.stepInterval = null;
        this.hideTimeout = null;
        this.responseStarted = false; // Track if response has started
        this.globalBlock = false; // Global block to prevent any loader during response
        this.dotAnimationInterval = null;
        this.dotDirection = 1; // 1 for forward (1-2-3), -1 for backward (3-2-1)
        this.currentDotCount = 1;
    }

    init() {
        // Load CSS styles
        this.loadStyles();
    }

    loadStyles() {
        if (!document.getElementById('enora-loading-styles')) {
            const link = document.createElement('link');
            link.id = 'enora-loading-styles';
            link.rel = 'stylesheet';
            link.href = './assets/loading-styles.css';
            document.head.appendChild(link);
        }
    }

    show(message = 'Listening...', subtext = 'Speak now...') {
        // AGGRESSIVE BLOCKING - Don't show loader if ANY blocking condition is met
        if (this.responseStarted || this.globalBlock) {
            console.log('🚫🚫 LOADER BLOCKED - response in progress');
            return;
        }
        
        // Don't show loader if it was recently hidden (within 2 seconds)
        if (this._lastHideTime && (Date.now() - this._lastHideTime) < 2000) {
            console.log('🚫 Loader blocked - recently hidden');
            return;
        }
        
        this.isLoading = true;
        this._showTime = Date.now(); // Track when loader was shown
        
        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        if (this.loadingElement) {
            // Update existing loader
            this.updateMessage(message, subtext);
        } else {
            // Create new loader
            this.createLoadingElements(message, subtext);
            this.startStepAnimation();
            this.startDotAnimation();
        }
        
        console.log('✅ Loader shown:', message);
    }

    hide() {
        if (!this.isLoading) return;
        
        // AGGRESSIVE BLOCKING - Set all block flags to prevent any re-showing
        this.responseStarted = true;
        this.globalBlock = true;
        this._lastHideTime = Date.now(); // Track when loader was hidden
        
        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        // Set a short timeout to prevent flickering for rapid calls
        this.hideTimeout = setTimeout(() => {
            this.isLoading = false;
            this.stopStepAnimation();
            this.stopDotAnimation();
            this.removeLoadingElements();
            this.hideTimeout = null;
            console.log('✅ Loader hidden - ALL BLOCKS ACTIVE');
        }, 200); // 200ms delay
    }

    updateMessage(message, subtext = null) {
        const textElement = document.querySelector('.enora-loading-text');
        const subtextElement = document.querySelector('.enora-loading-subtext');
        
        if (textElement) {
            textElement.textContent = message;
        }
        
        if (subtext && subtextElement) {
            subtextElement.textContent = subtext;
        }
    }

    // Reset for new question
    resetForNewQuestion() {
        console.log('🔄 RESET - Clearing ALL blocks for new question');
        this.responseStarted = false;
        this.globalBlock = false; // Clear global block
        this._lastHideTime = 0; // Reset hide time
        this._lastAnimatedWordCount = 0;
        this._lastRenderedResponse = '';
        this.currentStep = 'listening';
        this.stepIndex = 0;
        this.dotDirection = 1;
        this.currentDotCount = 1;
      
        if (this.isLoading) {
            this.hide();
        }
    }

    // Emergency stop - force hide and block all future loaders
    emergencyStop() {
        console.log('🚨 EMERGENCY STOP - Force hiding and blocking all loaders');
        this.globalBlock = true;
        this.responseStarted = true;
        
        if (this.isLoading) {
            this.isLoading = false;
            this.stopStepAnimation();
            this.stopDotAnimation();
            this.removeLoadingElements();
        }
        
        // Clear any timeouts
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }

    createLoadingElements(message, subtext) {
        // Create overlay - but make it non-blocking
        this.overlayElement = document.createElement('div');
        this.overlayElement.className = 'enora-loading-overlay';
        this.overlayElement.style.pointerEvents = 'none'; // Important: Don't block interactions!
        this.overlayElement.style.userSelect = 'none';
        
        // Create loading container
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = `enora-loading-container ${this.currentStep}`;
        this.loadingElement.style.pointerEvents = 'none'; // Important: Don't block interactions!
        this.loadingElement.style.userSelect = 'none';
        
        this.loadingElement.innerHTML = `
            <div class="enora-logo-container">
                <div class="enora-logo-glow"></div>
                <img src="./assets/enora-logo.svg" alt="Enora The Eon" class="enora-logo">
            </div>
            <div class="enora-loading-text">
                ${message}
                <div class="enora-dots">
                    <div class="enora-dot"></div>
                    <div class="enora-dot"></div>
                    <div class="enora-dot"></div>
                </div>
            </div>
            <div class="enora-loading-subtext">${subtext}</div>
        `;
        
        document.body.appendChild(this.overlayElement);
        document.body.appendChild(this.loadingElement);
        
        // Add entrance animation
        requestAnimationFrame(() => {
            this.overlayElement.style.opacity = '1';
            this.loadingElement.style.opacity = '1';
            this.loadingElement.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    }

    removeLoadingElements() {
        if (this.overlayElement) {
            this.overlayElement.style.opacity = '0';
            setTimeout(() => {
                if (this.overlayElement && this.overlayElement.parentNode) {
                    this.overlayElement.parentNode.removeChild(this.overlayElement);
                }
            }, 200);
        }
        
        if (this.loadingElement) {
            this.loadingElement.style.opacity = '0';
            this.loadingElement.style.transform = 'translate(-50%, -50%) scale(0.9)';
            setTimeout(() => {
                if (this.loadingElement && this.loadingElement.parentNode) {
                    this.loadingElement.parentNode.removeChild(this.loadingElement);
                }
            }, 200);
        }
        
        this.overlayElement = null;
        this.loadingElement = null;
    }

    startStepAnimation() {
        this.stepIndex = 0;
        this.updateStep();
        
        this.stepInterval = setInterval(() => {
            this.stepIndex = (this.stepIndex + 1) % this.loadingSteps.length;
            this.updateStep();
        }, 2000);
    }

    startDotAnimation() {
        this.stopDotAnimation(); // Clear any existing animation
        
        this.dotAnimationInterval = setInterval(() => {
            this.updateDotCount();
        }, 400); // Change dots every 400ms
    }

    stopDotAnimation() {
        if (this.dotAnimationInterval) {
            clearInterval(this.dotAnimationInterval);
            this.dotAnimationInterval = null;
        }
    }

    updateDotCount() {
        const dots = document.querySelectorAll('.enora-dot');
        
        // Update direction and count
        if (this.dotDirection === 1) {
            // Forward: 1 -> 2 -> 3
            this.currentDotCount++;
            if (this.currentDotCount >= 3) {
                this.currentDotCount = 3;
                this.dotDirection = -1; // Switch to backward
            }
        } else {
            // Backward: 3 -> 2 -> 1
            this.currentDotCount--;
            if (this.currentDotCount <= 1) {
                this.currentDotCount = 1;
                this.dotDirection = 1; // Switch to forward
            }
        }
        
        // Update dot visibility
        dots.forEach((dot, index) => {
            if (index < this.currentDotCount) {
                dot.style.opacity = '1';
                dot.style.transform = 'scale(1.2)';
            } else {
                dot.style.opacity = '0.3';
                dot.style.transform = 'scale(0.8)';
            }
        });
    }

    stopStepAnimation() {
        if (this.stepInterval) {
            clearInterval(this.stepInterval);
            this.stepInterval = null;
        }
    }

    updateStep() {
        this.currentStep = this.loadingSteps[this.stepIndex];
        
        if (this.loadingElement) {
            // Remove all step classes
            this.loadingElement.classList.remove('listening', 'processing');
            // Add current step class
            this.loadingElement.classList.add(this.currentStep);
            
            // Update message based on step
            const messages = {
                'listening': 'Listening...',
                'processing': 'Processing the answer...'
            };
            
            const subtexts = {
                'listening': 'Speak now...',
                'processing': 'AI is generating response...'
            };
            
            this.updateMessage(messages[this.currentStep], subtexts[this.currentStep]);
        }
    }

    // New method to switch to processing mode when response starts
    switchToProcessing() {
        this.currentStep = 'processing';
        this.stepIndex = 1;
        this.updateStep();
        console.log('🔄 Switched to processing mode');
    }

    // Static methods for easy access
    static getInstance() {
        if (!window.enoraLoader) {
            window.enoraLoader = new EnoraLoader();
            window.enoraLoader.init();
        }
        return window.enoraLoader;
    }

    static show(message, subtext) {
        EnoraLoader.getInstance().show(message, subtext);
    }

    static hide() {
        EnoraLoader.getInstance().hide();
    }

    static updateMessage(message, subtext) {
        EnoraLoader.getInstance().updateMessage(message, subtext);
    }

    static switchToProcessing() {
        EnoraLoader.getInstance().switchToProcessing();
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        EnoraLoader.getInstance();
    });
} else {
    EnoraLoader.getInstance();
}

// Export for global access
window.EnoraLoader = EnoraLoader;
