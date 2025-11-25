// Enora The Eon Simple Loading System
class EnoraLoader {
    constructor() {
        this.isLoading = false;
        this.loadingElement = null;
        this.dotAnimationInterval = null;
        this.currentDotCount = 1;
        this.dotDirection = 1;
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

    show(message = 'Loading...') {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        if (this.loadingElement) {
            this.updateMessage(message);
        } else {
            this.createLoadingElements(message);
            this.startDotAnimation();
        }
        
        console.log('✅ Simple loader shown:', message);
    }

    hide() {
        if (!this.isLoading) return;
        
        this.isLoading = false;
        this.stopDotAnimation();
        this.removeLoadingElements();
        
        console.log('✅ Simple loader hidden');
    }

    updateMessage(message) {
        const textElement = document.querySelector('.enora-loading-text');
        
        if (textElement) {
            textElement.textContent = message;
        }
    }

    // Reset for new question
    resetForNewQuestion() {
        console.log('🔄 RESET - Clearing loader for new question');
        this.dotDirection = 1;
        this.currentDotCount = 1;
      
        if (this.isLoading) {
            this.hide();
        }
    }

    // Emergency stop - force hide loader
    emergencyStop() {
        console.log('🚨 EMERGENCY STOP - Force hiding loader');
        
        if (this.isLoading) {
            this.isLoading = false;
            this.stopDotAnimation();
            this.removeLoadingElements();
        }
    }

    createLoadingElements(message) {
        // Create simple loading container
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'simple-loader';
        this.loadingElement.innerHTML = `
            <div class="simple-loader-text">
                ${message}
                <div class="simple-dots">
                    <div class="simple-dot"></div>
                    <div class="simple-dot"></div>
                    <div class="simple-dot"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.loadingElement);
        
        // Add entrance animation
        requestAnimationFrame(() => {
            this.loadingElement.style.opacity = '1';
        });
    }

    removeLoadingElements() {
        if (this.loadingElement) {
            this.loadingElement.style.opacity = '0';
            setTimeout(() => {
                if (this.loadingElement && this.loadingElement.parentNode) {
                    this.loadingElement.parentNode.removeChild(this.loadingElement);
                }
            }, 200);
        }
        
        this.loadingElement = null;
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
        const dots = document.querySelectorAll('.simple-dot');
        
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

    // Static methods for easy access
    static getInstance() {
        if (!window.enoraLoader) {
            window.enoraLoader = new EnoraLoader();
            window.enoraLoader.init();
        }
        return window.enoraLoader;
    }

    static show(message) {
        EnoraLoader.getInstance().show(message);
    }

    static hide() {
        EnoraLoader.getInstance().hide();
    }

    static updateMessage(message) {
        EnoraLoader.getInstance().updateMessage(message);
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
