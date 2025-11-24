// Enora The Eon Loading System
class EnoraLoader {
    constructor() {
        this.isLoading = false;
        this.loadingElement = null;
        this.overlayElement = null;
        this.currentStep = 'processing';
        this.loadingSteps = ['processing', 'analyzing', 'generating'];
        this.stepIndex = 0;
        this.stepInterval = null;
        this.hideTimeout = null;
        this.responseStarted = false; // Track if response has started
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

    show(message = 'Processing your request', subtext = 'AI is thinking...') {
        // Don't show loader if response has already started
        if (this.responseStarted) {
            console.log('🚫 Loader blocked - response already started');
            return;
        }
        
        // Don't show loader if it was recently hidden (within 1 second)
        if (this._lastHideTime && (Date.now() - this._lastHideTime) < 1000) {
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
        }
        
        console.log('✅ Loader shown:', message);
    }

    hide() {
        if (!this.isLoading) return;
        
        // Mark that response has started - prevent loader from showing again
        this.responseStarted = true;
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
            this.removeLoadingElements();
            this.hideTimeout = null;
            console.log('✅ Loader hidden');
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
        console.log('🔄 Resetting loader for new question');
        this.responseStarted = false;
        this._lastHideTime = 0; // Reset hide time
        this._lastAnimatedWordCount = 0;
        this._lastRenderedResponse = '';
        
        // Force hide any existing loader
        if (this.isLoading) {
            this.hide();
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
            this.loadingElement.classList.remove('processing', 'analyzing', 'generating');
            // Add current step class
            this.loadingElement.classList.add(this.currentStep);
            
            // Update message based on step
            const messages = {
                'processing': 'Processing your request',
                'analyzing': 'Analyzing the problem',
                'generating': 'Generating solution'
            };
            
            const subtexts = {
                'processing': 'AI is preparing...',
                'analyzing': 'Understanding requirements...',
                'generating': 'Creating optimal solution...'
            };
            
            this.updateMessage(messages[this.currentStep], subtexts[this.currentStep]);
        }
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
