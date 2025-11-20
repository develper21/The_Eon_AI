import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { AppHeader } from './AppHeader.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AdvancedView } from '../views/AdvancedView.js';

export class EnoraTheEonApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0px;
            padding: 0px;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            background-color: var(--background-transparent);
            color: var(--text-color);
        }

        .window-container {
            height: 100vh;
            border-radius: 7px;
            overflow: hidden;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .main-content {
            flex: 1;
            padding: var(--main-content-padding);
            overflow-y: auto;
            margin-top: var(--main-content-margin-top);
            border-radius: var(--content-border-radius);
            transition: all 0.15s ease-out;
            background: var(--main-content-background);
        }

        .main-content.with-border {
            border: 1px solid var(--border-color);
        }

        .main-content.assistant-view {
            padding: 10px;
            border: none;
        }

        .main-content.onboarding-view {
            padding: 0;
            border: none;
            background: transparent;
        }

        .view-container {
            opacity: 1;
            transform: translateY(0);
            transition: opacity 0.15s ease-out, transform 0.15s ease-out;
            height: 100%;
        }

        .view-container.entering {
            opacity: 0;
            transform: translateY(10px);
        }

        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: var(--scrollbar-background);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }
    `;

    async handleRestartCapture() {
        if (typeof cheddar.stopCapture === 'function') {
            cheddar.stopCapture();
        }

        const captureInterval = this.fastMode ? 'manual' : this.selectedScreenshotInterval;
        const captureQuality = this.fastMode ? 'low' : this.selectedImageQuality;

        try {
            await cheddar.startCapture(captureInterval, captureQuality, { fastMode: this.fastMode });
            this.captureError = null;
            this.setStatus('Capture restarted');
        } catch (error) {
            console.error('Failed to restart capture:', error);
            this.captureError = error?.message || 'Failed to restart capture';
        }

        this.requestUpdate();
    }

    async handleFullReset() {
        if (this._pendingReset) return;
        this._pendingReset = true;
        this.setStatus('Resetting capture & listening...');

        try {
            if (typeof cheddar.stopCapture === 'function') {
                cheddar.stopCapture();
            }

            await cheddar.initializeGemini(this.selectedProfile, 'en-US');

            const captureInterval = 'manual';
            const captureQuality = 'low';

            await cheddar.startCapture(captureInterval, captureQuality, { fastMode: true });

            this.fastMode = true;
            this.selectedScreenshotInterval = 'manual';
            this.selectedImageQuality = 'low';
            localStorage.setItem('fastMode', 'true');
            localStorage.setItem('selectedScreenshotInterval', 'manual');
            localStorage.setItem('selectedImageQuality', 'low');

            this.captureError = null;
            this.setStatus('Ready');
        } catch (error) {
            console.error('Full reset failed:', error);
            this.captureError = error?.message || 'Failed to reset stream';
            this.setStatus(`Reset failed: ${this.captureError}`);
        } finally {
            this._pendingReset = false;
            this.requestUpdate();
        }
    }

    async handleRetryCapture() {
        const captureInterval = this.fastMode ? 'manual' : this.selectedScreenshotInterval;
        const captureQuality = this.fastMode ? 'low' : this.selectedImageQuality;
        this.captureError = null;
        this.requestUpdate();
        cheddar.startCapture(captureInterval, captureQuality, { fastMode: this.fastMode });
    }

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        isRecording: { type: Boolean },
        sessionActive: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        advancedMode: { type: Boolean },
        fastMode: { type: Boolean },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        _awaitingNewResponse: { state: true },
        shouldAnimateResponse: { type: Boolean },
        autoResetAfterResponse: { type: Boolean },
    };

    constructor() {
        super();
        this.currentView = localStorage.getItem('onboardingCompleted') ? 'main' : 'onboarding';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        this.selectedLanguage = 'en-US';
        localStorage.setItem('selectedLanguage', 'en-US');
        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this.layoutMode = localStorage.getItem('layoutMode') || 'normal';
        this.advancedMode = localStorage.getItem('advancedMode') === 'true';
        this.fastMode = localStorage.getItem('fastMode') === 'true';
        this.responses = [];
        this.currentResponseIndex = -1;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this._awaitingNewResponse = false;
        this._currentResponseIsComplete = true;
        this.shouldAnimateResponse = false;
        this.manualScreenshotStatus = 'idle';
        this._lastAudioActivity = 0;
        this._audioStatusTimeout = null;
        this.latestDraftMessage = '';
        this._responseWatchdog = null;
        this._pendingReset = false;
        this.autoResetAfterResponse = true;
        this._autoResetPending = false;
        this._autoResetInProgress = false;
        this.connectionHealth = null;
        this.connectionAlert = null;

        // Apply layout mode to document root
        this.updateLayoutMode();
    }

    connectedCallback() {
        super.connectedCallback();

        // Set up IPC listeners if needed
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('update-response', (_, response) => {
                this.setResponse(response);
            });
            ipcRenderer.on('update-status', (_, status) => {
                this.setStatus(status);
            });
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
        }

        this._captureErrorListener = event => {
            this.captureError = event.detail?.message || 'Capture failed';
            this.requestUpdate();
        };
        window.addEventListener('capture-error', this._captureErrorListener);

        this._manualScreenshotStatusListener = event => {
            const { state, message } = event.detail || {};
            this.manualScreenshotStatus = state || 'idle';
            if (state === 'pending') {
                this.setStatus('Sending screenshot...');
                this.startResponseWatchdog();
            } else if (state === 'sent') {
                this.setStatus('Screenshot sent. Waiting for AI...');
                this._awaitingNewResponse = true;
                this.startResponseWatchdog();
            } else if (state === 'error') {
                this.setStatus(`Screenshot failed${message ? ': ' + message : ''}`);
                this.clearResponseWatchdog();
            }
        };
        window.addEventListener('manual-screenshot-status', this._manualScreenshotStatusListener);

        this._audioActivityListener = () => {
            this._lastAudioActivity = Date.now();
            this.setStatus('Listening...');
            if (this._audioStatusTimeout) {
                clearTimeout(this._audioStatusTimeout);
            }
            this._audioStatusTimeout = setTimeout(() => {
                const elapsed = Date.now() - this._lastAudioActivity;
                if (elapsed >= 1200 && this.statusText === 'Listening...') {
                    this.setStatus('Thinking...');
                }
            }, 1500);
        };
        window.addEventListener('audio-activity', this._audioActivityListener);

        this._draftListener = event => {
            this.handleTextDraftChanged(event.detail?.text || '');
        };
        window.addEventListener('draft-changed', this._draftListener);

        this._manualScreenshotHandler = async () => {
            try {
                const draftText = (this.latestDraftMessage || '').trim();
                const quality = this.selectedImageQuality || 'medium';
                if (typeof window.captureManualScreenshot === 'function') {
                    await window.captureManualScreenshot(quality, draftText);
                } else {
                    throw new Error('Screenshot module not loaded');
                }
            } catch (error) {
                console.error('Manual screenshot failed:', error);
                this.setStatus('Screenshot failed: ' + (error?.message || 'unknown error'));
            }
        };

        this.handleManualScreenshotWithText = this._manualScreenshotHandler;

        this._connectionMetricsListener = event => {
            this.connectionHealth = event.detail || null;
            this.requestUpdate();
        };
        window.addEventListener('connection-metrics', this._connectionMetricsListener);

        this._connectionAlertListener = event => {
            this.connectionAlert = event.detail || null;
            if (this.connectionAlert?.message) {
                this.setStatus(this.connectionAlert.message);
            }
            this.requestUpdate();
        };
        window.addEventListener('connection-alert', this._connectionAlertListener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
        }

        if (this._captureErrorListener) {
            window.removeEventListener('capture-error', this._captureErrorListener);
        }

        if (this._manualScreenshotStatusListener) {
            window.removeEventListener('manual-screenshot-status', this._manualScreenshotStatusListener);
        }

        if (this._audioActivityListener) {
            window.removeEventListener('audio-activity', this._audioActivityListener);
        }

        if (this._audioStatusTimeout) {
            clearTimeout(this._audioStatusTimeout);
            this._audioStatusTimeout = null;
        }

        if (this._draftListener) {
            window.removeEventListener('draft-changed', this._draftListener);
        }

        if (this._connectionMetricsListener) {
            window.removeEventListener('connection-metrics', this._connectionMetricsListener);
        }

        if (this._connectionAlertListener) {
            window.removeEventListener('connection-alert', this._connectionAlertListener);
        }

        this.clearResponseWatchdog();
    }

    setStatus(text) {
        const wasIncomplete = !this._currentResponseIsComplete;
        this.statusText = text;

        // Mark response as complete when we get certain status messages
        if (text.includes('Ready') || text.includes('Listening') || text.includes('Error')) {
            this._currentResponseIsComplete = true;
            console.log('[setStatus] Marked current response as complete');
            if (wasIncomplete) {
                this.handleResponseCompleted();
            }
        }
    }

    setResponse(response) {
        // Check if this looks like a filler response (very short responses to hmm, ok, etc)
        const isFillerResponse =
            response.length < 30 &&
            (response.toLowerCase().includes('hmm') ||
                response.toLowerCase().includes('okay') ||
                response.toLowerCase().includes('next') ||
                response.toLowerCase().includes('go on') ||
                response.toLowerCase().includes('continue'));

        if (this._awaitingNewResponse || this.responses.length === 0) {
            // Always add as new response when explicitly waiting for one
            this.responses = [...this.responses, response];
            this.currentResponseIndex = this.responses.length - 1;
            this._awaitingNewResponse = false;
            this._currentResponseIsComplete = false;
            if (this.autoResetAfterResponse) {
                this._autoResetPending = true;
            }
            this.clearResponseWatchdog();
            console.log('[setResponse] Pushed new response:', response);
        } else if (!this._currentResponseIsComplete && !isFillerResponse && this.responses.length > 0) {
            // For substantial responses, update the last one (streaming behavior)
            // Only update if the current response is not marked as complete
            this.responses = [...this.responses.slice(0, this.responses.length - 1), response];
            this.clearResponseWatchdog();
            console.log('[setResponse] Updated last response:', response);
        } else {
            // For filler responses or when current response is complete, add as new
            this.responses = [...this.responses, response];
            this.currentResponseIndex = this.responses.length - 1;
            this._currentResponseIsComplete = false;
            if (this.autoResetAfterResponse) {
                this._autoResetPending = true;
            }
            this.clearResponseWatchdog();
            console.log('[setResponse] Added response as new:', response);
        }
        this.shouldAnimateResponse = true;
        this.requestUpdate();
    }

    handleResponseCompleted() {
        if (!this.autoResetAfterResponse) {
            return;
        }

        if (!this._autoResetPending) {
            return;
        }

        this._autoResetPending = false;
        this.triggerAutoResetSequence();
    }

    async triggerAutoResetSequence() {
        if (this._autoResetInProgress) {
            return;
        }

        this._autoResetInProgress = true;
        this.setStatus('Auto-resetting stream for next prompt...');

        try {
            await this.handleFullReset();
            await this.handleRestartCapture();
        } catch (error) {
            console.error('Auto reset sequence failed:', error);
        } finally {
            this._autoResetInProgress = false;
        }
    }

    // Header event handlers
    handleCustomizeClick() {
        this.currentView = 'customize';
        this.requestUpdate();
    }

    handleHelpClick() {
        this.currentView = 'help';
        this.requestUpdate();
    }

    handleHistoryClick() {
        this.currentView = 'history';
        this.requestUpdate();
    }

    handleAdvancedClick() {
        this.currentView = 'advanced';
        this.requestUpdate();
    }

    async handleClose() {
        if (this.currentView === 'customize' || this.currentView === 'help' || this.currentView === 'history') {
            this.currentView = 'main';
        } else if (this.currentView === 'assistant') {
            cheddar.stopCapture();

            // Close the session
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-session');
            }
            this.sessionActive = false;
            this.currentView = 'main';
            console.log('Session closed');
        } else {
            // Quit the entire application
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // Main view event handlers
    async handleStart() {
        // check if api key is empty do nothing
        const apiKey = localStorage.getItem('apiKey')?.trim();
        if (!apiKey || apiKey === '') {
            // Trigger the red blink animation on the API key input
            const mainView = this.shadowRoot.querySelector('main-view');
            if (mainView && mainView.triggerApiKeyError) {
                mainView.triggerApiKeyError();
            }
            return;
        }

        if (typeof cheddar.stopCapture === 'function') {
            cheddar.stopCapture();
        }

        if (!this.fastMode) {
            this.handleFastModeChange(true);
        }

        await cheddar.initializeGemini(this.selectedProfile, 'en-US');

        const captureInterval = this.fastMode ? 'manual' : this.selectedScreenshotInterval;
        const captureQuality = this.fastMode ? 'low' : this.selectedImageQuality;

        this.captureError = null;
        this.requestUpdate();

        cheddar.startCapture(captureInterval, captureQuality, { fastMode: this.fastMode });
        this.responses = [];
        this.currentResponseIndex = -1;
        this.startTime = Date.now();
        this.currentView = 'assistant';
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', '');
        }
    }

    // Customize view event handlers
    handleProfileChange(profile) {
        this.selectedProfile = profile;
    }

    handleLanguageChange(language) {
        console.log('Language selection requested:', language, '- forcing English (en-US).');
        this.selectedLanguage = 'en-US';
        localStorage.setItem('selectedLanguage', 'en-US');
    }

    handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
    }

    handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        localStorage.setItem('selectedImageQuality', quality);
    }

    handleAdvancedModeChange(advancedMode) {
        this.advancedMode = advancedMode;
        localStorage.setItem('advancedMode', advancedMode.toString());
    }

    handleFastModeChange(fastMode) {
        this.fastMode = fastMode;
        localStorage.setItem('fastMode', fastMode.toString());

        if (fastMode) {
            this.selectedScreenshotInterval = 'manual';
            this.selectedImageQuality = 'low';
            localStorage.setItem('selectedScreenshotInterval', 'manual');
            localStorage.setItem('selectedImageQuality', 'low');
        }
    }

    handleBackClick() {
        this.currentView = 'main';
        this.requestUpdate();
    }

    // Help view event handlers
    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    // Assistant view event handlers
    async handleSendText(message) {
        this.setStatus('Sending message...');
        const result = await window.cheddar.sendTextMessage(message);

        if (!result.success) {
            console.error('Failed to send message:', result.error);
            this.setStatus('Error sending message: ' + result.error);
        } else {
            this.setStatus('Message sent. Waiting for AI...');
            this._awaitingNewResponse = true;
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
        this.shouldAnimateResponse = false;
        this.requestUpdate();
    }

    async handleForceReconnect() {
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('force-reconnect');
                this.setStatus('Attempting to reconnect...');
            } catch (error) {
                console.error('Force reconnect failed:', error);
                this.setStatus('Failed to force reconnect');
            }
        }
    }

    // Onboarding event handlers
    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    startResponseWatchdog() {
        this.clearResponseWatchdog();
        this._responseWatchdog = setTimeout(() => {
            if (this._awaitingNewResponse) {
                console.warn('Response watchdog triggered - restarting capture for fresh stream');
                this.setStatus('Refreshing capture for faster response...');
                this.handleRestartCapture();
            }
        }, 6000);
    }

    clearResponseWatchdog() {
        if (this._responseWatchdog) {
            clearTimeout(this._responseWatchdog);
            this._responseWatchdog = null;
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Only notify main process of view change if the view actually changed
        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);

            // Add a small delay to smooth out the transition
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
        if (changedProperties.has('advancedMode')) {
            localStorage.setItem('advancedMode', this.advancedMode.toString());
        }
    }

    renderCurrentView() {
        // Only re-render the view if it hasn't been cached or if critical properties changed
        const viewKey = `${this.currentView}-${this.selectedProfile}-${this.selectedLanguage}`;

        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .onStart=${() => this.handleStart()}
                        .onAPIKeyHelp=${() => this.handleAPIKeyHelp()}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                    ></main-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .advancedMode=${this.advancedMode}
                        .fastMode=${this.fastMode}
                        .onProfileChange=${profile => this.handleProfileChange(profile)}
                        .onLanguageChange=${language => this.handleLanguageChange(language)}
                        .onScreenshotIntervalChange=${interval => this.handleScreenshotIntervalChange(interval)}
                        .onImageQualityChange=${quality => this.handleImageQualityChange(quality)}
                        .onLayoutModeChange=${layoutMode => this.handleLayoutModeChange(layoutMode)}
                        .onAdvancedModeChange=${advancedMode => this.handleAdvancedModeChange(advancedMode)}
                        .onFastModeChange=${fastMode => this.handleFastModeChange(fastMode)}
                    ></customize-view>
                `;

            case 'help':
                return html` <help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view> `;

            case 'history':
                return html` <history-view></history-view> `;

            case 'advanced':
                return html` <advanced-view></advanced-view> `;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${message => this.handleSendText(message)}
                        .shouldAnimateResponse=${this.shouldAnimateResponse}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @draft-changed=${event => this.handleTextDraftChanged(event.detail.text)}
                        @response-animation-complete=${() => {
                            this.shouldAnimateResponse = false;
                            this._currentResponseIsComplete = true;
                            console.log('[response-animation-complete] Marked current response as complete');
                            this.requestUpdate();
                        }}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    render() {
        const mainContentClass = `main-content ${
            this.currentView === 'assistant' ? 'assistant-view' : this.currentView === 'onboarding' ? 'onboarding-view' : 'with-border'
        }`;

        return html`
            <div class="window-container">
                <div class="container">
                    <app-header
                        .currentView=${this.currentView}
                        .statusText=${this.statusText}
                        .startTime=${this.startTime}
                        .connectionHealth=${this.connectionHealth}
                        .connectionAlert=${this.connectionAlert}
                        .advancedMode=${this.advancedMode}
                        .fastMode=${this.fastMode}
                        .onCustomizeClick=${() => this.handleCustomizeClick()}
                        .onHelpClick=${() => this.handleHelpClick()}
                        .onHistoryClick=${() => this.handleHistoryClick()}
                        .onAdvancedClick=${() => this.handleAdvancedClick()}
                        .onCloseClick=${() => this.handleClose()}
                        .onBackClick=${() => this.handleBackClick()}
                        .onHideToggleClick=${() => this.handleHideToggle()}
                        .onManualScreenshot=${() => this._manualScreenshotHandler()}
                        .onFastModeToggle=${() => this.handleFastModeChange(!this.fastMode)}
                        .onRestartCapture=${() => this.handleRestartCapture()}
                        .onFullReset=${() => this.handleFullReset()}
                        .onForceReconnect=${() => this.handleForceReconnect()}
                        ?isClickThrough=${this._isClickThrough}
                    ></app-header>
                    <div class="${mainContentClass}">
                        ${this.captureError && this.currentView === 'assistant'
                            ? html`
                                  <div class="capture-error-banner">
                                      <div>
                                          <strong>Capture error:</strong> ${this.captureError}
                                      </div>
                                      <button @click=${() => this.handleRetryCapture()}>Retry Capture</button>
                                  </div>
                              `
                            : ''}
                        <div class="view-container">${this.renderCurrentView()}</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateLayoutMode() {
        // Apply or remove compact layout class to document root
        if (this.layoutMode === 'compact') {
            document.documentElement.classList.add('compact-layout');
        } else {
            document.documentElement.classList.remove('compact-layout');
        }
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        localStorage.setItem('layoutMode', layoutMode);
        this.updateLayoutMode();

        // Notify main process about layout change for window resizing
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-sizes');
            } catch (error) {
                console.error('Failed to update sizes in main process:', error);
            }
        }

        this.requestUpdate();
    }
}

customElements.define('enora-theeon-app', EnoraTheEonApp);
