import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { MainView } from '../views/MainView.js';
import { CustomizeView } from '../views/CustomizeView.js';
import { HelpView } from '../views/HelpView.js';
import { HistoryView } from '../views/HistoryView.js';
import { AssistantView } from '../views/AssistantView.js';
import { OnboardingView } from '../views/OnboardingView.js';
import { AICustomizeView } from '../views/AICustomizeView.js';

export class CheatingDaddyApp extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: var(--font);
            margin: 0;
            padding: 0;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            width: 100%;
            height: 100vh;
            overflow: hidden;
            border-radius: 12px;
            background: var(--bg-app);
            color: var(--text-primary);
        }

        :host(.notch-mode) {
            overflow: hidden;
            border-radius: 0 0 16px 16px;
            background: transparent;
        }

        .notch-app {
            --notch-inverse-radius: 28px;
            --notch-bottom-radius: 16px;
            --notch-background: rgba(15, 15, 17, 0.98);
            --notch-border: rgba(255, 255, 255, 0.12);
            position: relative;
            width: min(620px, max(0px, calc(100% - var(--notch-inverse-radius) - var(--notch-inverse-radius))));
            min-height: 76px;
            max-height: 480px;
            margin: 0 auto;
            overflow: visible;
            border-bottom: 1px solid var(--notch-border);
            border-radius: 0 0 var(--notch-bottom-radius) var(--notch-bottom-radius);
            background: var(--notch-background);
            background-clip: padding-box;
            color: #f5f5f5;
            -webkit-app-region: no-drag;
            display: flex;
            flex-direction: column;
        }

        .notch-app::before,
        .notch-app::after {
            position: absolute;
            top: 0;
            width: var(--notch-inverse-radius);
            height: var(--notch-inverse-radius);
            content: '';
            pointer-events: none;
        }

        .notch-app::before {
            right: 100%;
        }

        .notch-app::after {
            left: 100%;
        }

        .notch-app::before {
            background-image: radial-gradient(
                circle at bottom left,
                transparent calc(var(--notch-inverse-radius) - 0.5px),
                var(--notch-background) var(--notch-inverse-radius)
            );
        }

        .notch-app::after {
            background-image: radial-gradient(
                circle at bottom right,
                transparent calc(var(--notch-inverse-radius) - 0.5px),
                var(--notch-background) var(--notch-inverse-radius)
            );
        }

        .notch-screen-edge {
            width: 100%;
        }

        .screen-edge-line {
            width: 100%;
            height: 4px;
            background: #000;
        }

        .notch-header {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 72px;
            padding: 0 14px;
            -webkit-app-region: drag;
        }

        .notch-title {
            min-width: 0;
            overflow: hidden;
            flex: 1;
            color: #f5f5f5;
            font-size: 13px;
            font-weight: 600;
            text-overflow: ellipsis;
            white-space: nowrap;
            -webkit-app-region: drag;
        }

        .notch-nav {
            width: 142px;
            min-width: 0;
            padding: 7px 26px 7px 9px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            appearance: none;
            background: rgba(255, 255, 255, 0.07);
            color: #f5f5f5;
            font: inherit;
            font-size: 12px;
            cursor: pointer;
            -webkit-app-region: no-drag;
        }

        .notch-nav:focus-visible {
            outline: 2px solid #60a5fa;
            outline-offset: 2px;
        }

        .notch-session-time {
            flex-shrink: 0;
            color: #a1a1aa;
            font-family: var(--font-mono);
            font-size: 11px;
            font-variant-numeric: tabular-nums;
            -webkit-app-region: no-drag;
        }

        .notch-indicator {
            display: flex;
            align-items: center;
            gap: 3px;
            width: 22px;
            height: 20px;
            flex-shrink: 0;
            -webkit-app-region: no-drag;
        }

        .notch-indicator.active span {
            width: 3px;
            height: 6px;
            border-radius: 3px;
            background: #60a5fa;
            animation: notch-listening 900ms ease-in-out infinite;
        }

        .notch-indicator.active span:nth-child(2) {
            animation-delay: 150ms;
        }

        .notch-indicator.active span:nth-child(3) {
            animation-delay: 300ms;
        }

        .notch-indicator.active span:nth-child(4) {
            animation-delay: 450ms;
        }

        .notch-indicator .idle-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #60a5fa;
        }

        @keyframes notch-listening {
            0%,
            100% {
                height: 5px;
                opacity: 0.55;
            }
            50% {
                height: 16px;
                opacity: 1;
            }
        }

        .notch-status {
            overflow: hidden;
            flex: 1;
            color: #d4d4d8;
            font-size: 13px;
            text-overflow: ellipsis;
            white-space: nowrap;
            -webkit-app-region: no-drag;
        }

        .notch-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
            -webkit-app-region: no-drag;
        }

        .notch-action {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            padding: 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.06);
            color: #d4d4d8;
            cursor: pointer;
            transition:
                background 150ms ease,
                color 150ms ease;
        }

        .notch-action:hover {
            background: rgba(255, 255, 255, 0.14);
            color: #fff;
        }

        .notch-action.end-session:hover {
            color: #f87171;
        }

        .notch-action svg {
            width: 15px;
            height: 15px;
        }

        .notch-panel {
            min-height: 0;
            max-height: 404px;
            overflow: auto;
            overscroll-behavior: contain;
            border-radius: 0 0 var(--notch-bottom-radius) var(--notch-bottom-radius);
            -webkit-app-region: no-drag;
        }

        .notch-update {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: 0 14px 10px;
            padding: 9px 11px;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 8px;
            background: rgba(59, 130, 246, 0.1);
            color: #bfdbfe;
            font-size: 12px;
        }

        .notch-update button {
            flex-shrink: 0;
            border: 0;
            background: none;
            color: #93c5fd;
            font: inherit;
            cursor: pointer;
        }

        .session-return {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-right: 12px;
            padding: 6px 10px;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            background: var(--bg-surface);
            color: var(--text-secondary);
            font-size: var(--font-size-xs);
            cursor: pointer;
            -webkit-app-region: no-drag;
        }

        .session-return:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
        }

        /* ── Full app shell: top bar + sidebar/content ── */

        .app-shell {
            display: flex;
            height: calc(100vh - 2px);
            margin: 1px;
            overflow: hidden;
            border: 2px solid rgba(255, 255, 255, 0.18);
            border-radius: 11px;
        }

        .top-drag-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            height: 38px;
            background: transparent;
        }

        .drag-region {
            flex: 1;
            height: 100%;
            -webkit-app-region: drag;
        }

        .top-drag-bar.hidden {
            display: none;
        }

        .traffic-lights {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 var(--space-md);
            height: 100%;
            -webkit-app-region: no-drag;
        }

        .traffic-light {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            padding: 0;
            transition:
                opacity 0.15s ease,
                transform 0.15s ease;
        }

        .traffic-light:hover {
            transform: scale(1.05);
        }

        .traffic-light svg {
            width: 8px;
            height: 8px;
            opacity: 0;
            color: rgba(0, 0, 0, 0.72);
            transition: opacity 0.15s ease;
        }

        .traffic-light:hover svg,
        .traffic-light:focus-visible svg {
            opacity: 1;
        }

        .traffic-light.close {
            background: #ff5f57;
        }

        .traffic-light.minimize {
            background: #febc2e;
        }

        .traffic-light.hide {
            background: #ff9500;
        }

        .sidebar {
            width: var(--sidebar-width);
            min-width: var(--sidebar-width);
            background: var(--bg-surface);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 42px 0 var(--space-md) 0;
            transition:
                width var(--transition),
                min-width var(--transition),
                opacity var(--transition);
        }

        .sidebar.hidden {
            width: 0;
            min-width: 0;
            padding: 0;
            overflow: hidden;
            border-right: none;
            opacity: 0;
        }

        .sidebar-brand {
            padding: var(--space-sm) var(--space-lg);
            padding-top: var(--space-md);
            margin-bottom: var(--space-lg);
        }

        .sidebar-brand h1 {
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-semibold);
            color: var(--text-primary);
            letter-spacing: -0.01em;
        }

        .sidebar-nav {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: var(--space-xs);
            padding: 0 var(--space-sm);
            -webkit-app-region: no-drag;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: var(--space-sm) var(--space-md);
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            cursor: pointer;
            transition:
                color var(--transition),
                background var(--transition);
            border: none;
            background: none;
            width: 100%;
            text-align: left;
        }

        .nav-item:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
        }

        .nav-item.active {
            color: var(--text-primary);
            background: var(--bg-elevated);
        }

        .nav-item svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }

        .sidebar-footer {
            padding: var(--space-sm);
            margin-top: var(--space-sm);
            -webkit-app-region: no-drag;
        }

        .update-btn {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            width: 100%;
            padding: var(--space-sm) var(--space-md);
            border-radius: var(--radius-md);
            border: 1px solid rgba(239, 68, 68, 0.2);
            background: rgba(239, 68, 68, 0.08);
            color: var(--danger);
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
            cursor: pointer;
            text-align: left;
            transition:
                background var(--transition),
                border-color var(--transition);
            animation: update-wobble 5s ease-in-out infinite;
        }

        .update-btn:hover {
            background: rgba(239, 68, 68, 0.14);
            border-color: rgba(239, 68, 68, 0.35);
        }

        @keyframes update-wobble {
            0%,
            90%,
            100% {
                transform: rotate(0deg);
            }
            92% {
                transform: rotate(-2deg);
            }
            94% {
                transform: rotate(2deg);
            }
            96% {
                transform: rotate(-1.5deg);
            }
            98% {
                transform: rotate(1.5deg);
            }
        }

        .update-btn svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }

        .version-text {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            padding: var(--space-xs) var(--space-md);
        }

        /* ── Main content area ── */

        .content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--bg-app);
        }

        /* Live mode top bar */
        .live-bar {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 var(--space-md);
            background: var(--bg-surface);
            border-bottom: 1px solid var(--border);
            height: 36px;
            -webkit-app-region: drag;
        }

        .live-bar-left {
            display: flex;
            align-items: center;
            -webkit-app-region: no-drag;
            z-index: 1;
        }

        .live-bar-back {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            cursor: pointer;
            background: none;
            border: none;
            padding: var(--space-xs);
            border-radius: var(--radius-sm);
            transition: color var(--transition);
        }

        .live-bar-back:hover {
            color: var(--text-primary);
        }

        .live-bar-back svg {
            width: 14px;
            height: 14px;
        }

        .live-bar-center {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-weight: var(--font-weight-medium);
            white-space: nowrap;
            pointer-events: none;
        }

        .live-bar-right {
            display: flex;
            align-items: center;
            gap: var(--space-md);
            -webkit-app-region: no-drag;
            z-index: 1;
        }

        .live-bar-text {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-family: var(--font-mono);
            white-space: nowrap;
        }

        .live-bar-text.clickable {
            cursor: pointer;
            transition: color var(--transition);
        }

        .live-bar-text.clickable:hover {
            color: var(--text-primary);
        }

        /* Content inner */
        .content-inner {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .content-inner.live {
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        /* Onboarding fills everything */
        .fullscreen {
            position: fixed;
            inset: 0;
            z-index: 100;
            background: var(--bg-app);
        }

        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border-strong);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #444444;
        }
    `;

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
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        _awaitingNewResponse: { state: true },
        shouldAnimateResponse: { type: Boolean },
        _storageLoaded: { state: true },
        _updateAvailable: { state: true },
        _whisperDownloading: { state: true },
        _localAiDownloadProgress: { state: true },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.isRecording = false;
        this.sessionActive = false;
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'en-US';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.responses = [];
        this.currentResponseIndex = -1;
        this._viewInstances = new Map();
        this._isClickThrough = false;
        this._awaitingNewResponse = false;
        this._currentResponseIsComplete = true;
        this.shouldAnimateResponse = false;
        this._storageLoaded = false;
        this._timerInterval = null;
        this._updateAvailable = false;
        this._whisperDownloading = false;
        this._localAiDownloadProgress = { active: false, label: '', percentage: null };
        this._localVersion = '';

        this._loadFromStorage();
        this._checkForUpdates();
    }

    async _checkForUpdates() {
        try {
            this._localVersion = await cheatingDaddy.getVersion();
            this.requestUpdate();

            const res = await fetch('https://raw.githubusercontent.com/sohzm/cheating-daddy/refs/heads/master/package.json');
            if (!res.ok) return;
            const remote = await res.json();
            const remoteVersion = remote.version;

            const toNum = v => v.split('.').map(Number);
            const [rMaj, rMin, rPatch] = toNum(remoteVersion);
            const [lMaj, lMin, lPatch] = toNum(this._localVersion);

            if (rMaj > lMaj || (rMaj === lMaj && rMin > lMin) || (rMaj === lMaj && rMin === lMin && rPatch > lPatch)) {
                this._updateAvailable = true;
                this.requestUpdate();
            }
        } catch (e) {
            // silently ignore
        }
    }

    async _loadFromStorage() {
        try {
            const [config, prefs] = await Promise.all([cheatingDaddy.storage.getConfig(), cheatingDaddy.storage.getPreferences()]);

            this.currentView = config.onboarded ? 'main' : 'onboarding';
            this.selectedProfile = prefs.selectedProfile || 'interview';
            this.selectedLanguage = prefs.selectedLanguage || 'en-US';
            this.selectedScreenshotInterval = prefs.selectedScreenshotInterval || '5';
            this.selectedImageQuality = prefs.selectedImageQuality || 'medium';
            this.layoutMode = config.layout || 'normal';

            this._storageLoaded = true;
            this.requestUpdate();
        } catch (error) {
            console.error('Error loading from storage:', error);
            this._storageLoaded = true;
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('new-response', (_, response) => this.addNewResponse(response));
            ipcRenderer.on('update-response', (_, response) => this.updateCurrentResponse(response));
            ipcRenderer.on('update-status', (_, status) => this.setStatus(status));
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            ipcRenderer.on('reconnect-failed', (_, data) => this.addNewResponse(data.message));
            ipcRenderer.on('whisper-downloading', (_, downloading) => {
                this._whisperDownloading = downloading;
            });
            ipcRenderer.on('local-ai-download-progress', (_, progress) => {
                this._localAiDownloadProgress = progress;
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTimer();
        if (this._notchResizeObserver) {
            this._notchResizeObserver.disconnect();
            this._notchResizeObserver = null;
        }
        if (this._notchResizeFrame) {
            cancelAnimationFrame(this._notchResizeFrame);
            this._notchResizeFrame = null;
        }
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('new-response');
            ipcRenderer.removeAllListeners('update-response');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('reconnect-failed');
            ipcRenderer.removeAllListeners('whisper-downloading');
            ipcRenderer.removeAllListeners('local-ai-download-progress');
        }
    }

    // ── Timer ──

    _startTimer() {
        this._stopTimer();
        if (this.startTime) {
            this._timerInterval = setInterval(() => this.requestUpdate(), 1000);
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    getElapsedTime() {
        if (!this.startTime) return '0:00';
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const h = Math.floor(elapsed / 3600);
        const m = Math.floor((elapsed % 3600) / 60);
        const s = elapsed % 60;
        const pad = n => String(n).padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${m}:${pad(s)}`;
    }

    // ── Status & Responses ──

    setStatus(text) {
        this.statusText = text;
        if (text.includes('Ready') || text.includes('Listening') || text.includes('Error')) {
            this._currentResponseIsComplete = true;
        }
    }

    addNewResponse(response) {
        const wasOnLatest = this.currentResponseIndex === this.responses.length - 1;
        this.responses = [...this.responses, response];
        if (wasOnLatest || this.currentResponseIndex === -1) {
            this.currentResponseIndex = this.responses.length - 1;
        }
        this._awaitingNewResponse = false;
        this.requestUpdate();
    }

    updateCurrentResponse(response) {
        if (this.responses.length > 0) {
            this.responses = [...this.responses.slice(0, -1), response];
        } else {
            this.addNewResponse(response);
        }
        this.requestUpdate();
    }

    // ── Navigation ──

    navigate(view) {
        this.currentView = view;
        this.requestUpdate();
    }

    async handleClose() {
        if (this.sessionActive) {
            cheatingDaddy.stopCapture();
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('close-session');
                await ipcRenderer.invoke('session-notch:exit');
            }
            this.sessionActive = false;
            this._stopTimer();
            this.currentView = 'main';
        } else {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('quit-application');
            }
        }
    }

    async _handleMinimize() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('window-minimize');
        }
    }

    async handleHideToggle() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('toggle-window-visibility');
        }
    }

    // ── Session start ──

    async handleStart() {
        if (this.sessionActive) return;

        const prefs = await cheatingDaddy.storage.getPreferences();
        const providerMode = prefs.providerMode === 'cloud' ? 'byok' : prefs.providerMode || 'byok';

        if (providerMode === 'cloud') {
            const creds = await cheatingDaddy.storage.getCredentials();
            if (!creds.cloudToken || creds.cloudToken.trim() === '') {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }

            const success = await cheatingDaddy.initializeCloud(this.selectedProfile);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }
        } else if (providerMode === 'local') {
            const success = await cheatingDaddy.initializeLocal(this.selectedProfile);
            if (!success) {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }
        } else {
            const apiKey = await cheatingDaddy.storage.getApiKey();
            if (!apiKey || apiKey === '') {
                const mainView = this.shadowRoot.querySelector('main-view');
                if (mainView && mainView.triggerApiKeyError) {
                    mainView.triggerApiKeyError();
                }
                return;
            }

            await cheatingDaddy.initializeGemini(this.selectedProfile, this.selectedLanguage);
        }

        cheatingDaddy.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        this.responses = [];
        this.currentResponseIndex = -1;
        this.startTime = Date.now();
        this.sessionActive = true;
        this.currentView = 'assistant';
        this._startTimer();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('session-notch:enter');
            if (!result.success) {
                console.error('Could not open session notch:', result.error);
            }
        }
    }

    async openSessionSettings() {
        this.navigate('customize');
    }

    async returnToSessionNotch() {
        this.navigate('assistant');
    }

    async handleCancelLocalDownload() {
        await cheatingDaddy.cancelLocalInitialization();
    }

    async handleAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://cheatingdaddy.com/help/api-key');
        }
    }

    async handleGroqAPIKeyHelp() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', 'https://console.groq.com/keys');
        }
    }

    // ── Settings handlers ──

    async handleProfileChange(profile) {
        this.selectedProfile = profile;
        await cheatingDaddy.storage.updatePreference('selectedProfile', profile);
    }

    async handleLanguageChange(language) {
        this.selectedLanguage = language;
        await cheatingDaddy.storage.updatePreference('selectedLanguage', language);
    }

    async handleScreenshotIntervalChange(interval) {
        this.selectedScreenshotInterval = interval;
        await cheatingDaddy.storage.updatePreference('selectedScreenshotInterval', interval);
    }

    async handleImageQualityChange(quality) {
        this.selectedImageQuality = quality;
        await cheatingDaddy.storage.updatePreference('selectedImageQuality', quality);
    }

    async handleLayoutModeChange(layoutMode) {
        this.layoutMode = layoutMode;
        await cheatingDaddy.storage.updateConfig('layout', layoutMode);
        this.requestUpdate();
    }

    async handleExternalLinkClick(url) {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('open-external', url);
        }
    }

    async handleSendText(message) {
        const result = await window.cheatingDaddy.sendTextMessage(message);
        if (!result.success) {
            this.setStatus('Error sending message: ' + result.error);
        } else {
            this.setStatus('Message sent...');
            this._awaitingNewResponse = true;
        }
    }

    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
        this.shouldAnimateResponse = false;
        this.requestUpdate();
    }

    handleOnboardingComplete() {
        this.currentView = 'main';
    }

    firstUpdated() {
        const notch = this.shadowRoot.querySelector('.notch-app');
        if (notch && typeof ResizeObserver !== 'undefined') {
            this._notchResizeObserver = new ResizeObserver(() => this._scheduleNotchResize());
            this._notchResizeObserver.observe(notch);
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('currentView') && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('view-changed', this.currentView);
        }

        this.classList.add('notch-mode');
        document.documentElement.classList.add('notch-mode');
        document.body.classList.add('notch-mode');

        this._scheduleNotchResize();
    }

    _scheduleNotchResize() {
        if (!window.require || this._notchResizeFrame) return;

        this._notchResizeFrame = requestAnimationFrame(() => {
            this._notchResizeFrame = null;
            const notch = this.shadowRoot.querySelector('.notch-app');
            if (!notch) return;

            const { ipcRenderer } = window.require('electron');
            const screenEdgeLine = this.shadowRoot.querySelector('.screen-edge-line');
            const lineHeight = screenEdgeLine ? screenEdgeLine.offsetHeight : 0;
            ipcRenderer
                .invoke('app-notch:resize', { height: notch.scrollHeight + lineHeight })
                .then(result => {
                    if (!result.success) {
                        console.error('Could not resize app notch:', result.error);
                    }
                })
                .catch(error => {
                    console.error('Could not resize app notch:', error);
                });
        });
    }

    // ── Helpers ──

    _isLiveMode() {
        return this.currentView === 'assistant';
    }

    // ── Render ──

    renderCurrentView() {
        switch (this.currentView) {
            case 'onboarding':
                return html`
                    <onboarding-view .onComplete=${() => this.handleOnboardingComplete()} .onClose=${() => this.handleClose()}></onboarding-view>
                `;

            case 'main':
                return html`
                    <main-view
                        .selectedProfile=${this.selectedProfile}
                        .sessionActive=${this.sessionActive}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                        .onStart=${() => (this.sessionActive ? this.returnToSessionNotch() : this.handleStart())}
                        .onExternalLink=${url => this.handleExternalLinkClick(url)}
                        .whisperDownloading=${this._whisperDownloading}
                        .downloadProgress=${this._localAiDownloadProgress}
                        .onCancelDownload=${() => this.handleCancelLocalDownload()}
                    ></main-view>
                `;

            case 'ai-customize':
                return html`
                    <ai-customize-view
                        .selectedProfile=${this.selectedProfile}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                    ></ai-customize-view>
                `;

            case 'customize':
                return html`
                    <customize-view
                        .selectedProfile=${this.selectedProfile}
                        .selectedLanguage=${this.selectedLanguage}
                        .selectedScreenshotInterval=${this.selectedScreenshotInterval}
                        .selectedImageQuality=${this.selectedImageQuality}
                        .layoutMode=${this.layoutMode}
                        .onProfileChange=${p => this.handleProfileChange(p)}
                        .onLanguageChange=${l => this.handleLanguageChange(l)}
                        .onScreenshotIntervalChange=${i => this.handleScreenshotIntervalChange(i)}
                        .onImageQualityChange=${q => this.handleImageQualityChange(q)}
                        .onLayoutModeChange=${lm => this.handleLayoutModeChange(lm)}
                    ></customize-view>
                `;

            case 'help':
                return html`<help-view .onExternalLinkClick=${url => this.handleExternalLinkClick(url)}></help-view>`;

            case 'history':
                return html`<history-view></history-view>`;

            case 'assistant':
                return html`
                    <assistant-view
                        .responses=${this.responses}
                        .currentResponseIndex=${this.currentResponseIndex}
                        .selectedProfile=${this.selectedProfile}
                        .onSendText=${msg => this.handleSendText(msg)}
                        .shouldAnimateResponse=${this.shouldAnimateResponse}
                        @response-index-changed=${this.handleResponseIndexChanged}
                        @response-animation-complete=${() => {
                            this.shouldAnimateResponse = false;
                            this._currentResponseIsComplete = true;
                            this.requestUpdate();
                        }}
                    ></assistant-view>
                `;

            default:
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }

    renderSidebar() {
        const items = [
            {
                id: 'main',
                label: 'Home',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path
                            d="m19 8.71l-5.333-4.148a2.666 2.666 0 0 0-3.274 0L5.059 8.71a2.67 2.67 0 0 0-1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.2c0-.823-.38-1.6-1.03-2.105"
                        />
                        <path d="M16 15c-2.21 1.333-5.792 1.333-8 0" />
                    </g>
                </svg>`,
            },
            {
                id: 'ai-customize',
                label: 'AI Customization',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <path
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 3v7h6l-8 11v-7H5z"
                    />
                </svg>`,
            },
            {
                id: 'history',
                label: 'History',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path
                            d="M10 20.777a9 9 0 0 1-2.48-.969M14 3.223a9.003 9.003 0 0 1 0 17.554m-9.421-3.684a9 9 0 0 1-1.227-2.592M3.124 10.5c.16-.95.468-1.85.9-2.675l.169-.305m2.714-2.941A9 9 0 0 1 10 3.223"
                        />
                        <path d="M12 8v4l3 3" />
                    </g>
                </svg>`,
            },
            {
                id: 'customize',
                label: 'Settings',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path
                            d="M19.875 6.27A2.23 2.23 0 0 1 21 8.218v7.284c0 .809-.443 1.555-1.158 1.948l-6.75 4.27a2.27 2.27 0 0 1-2.184 0l-6.75-4.27A2.23 2.23 0 0 1 3 15.502V8.217c0-.809.443-1.554 1.158-1.947l6.75-3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98z"
                        />
                        <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
                    </g>
                </svg>`,
            },
            {
                id: 'help',
                label: 'Help',
                icon: html`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9s-9-1.8-9-9s1.8-9 9-9m0 13v.01" />
                        <path d="M12 13a2 2 0 0 0 .914-3.782a1.98 1.98 0 0 0-2.414.483" />
                    </g>
                </svg>`,
            },
        ];

        return html`
            <div class="sidebar ${this._isLiveMode() ? 'hidden' : ''}">
                <div class="sidebar-brand">
                    <h1>Cheating Daddy</h1>
                </div>
                <nav class="sidebar-nav">
                    ${items.map(
                        item => html`
                            <button
                                class="nav-item ${this.currentView === item.id ? 'active' : ''}"
                                @click=${() => this.navigate(item.id)}
                                title=${item.label}
                            >
                                ${item.icon} ${item.label}
                            </button>
                        `
                    )}
                </nav>
                <div class="sidebar-footer">
                    ${
                        this._updateAvailable
                            ? html`
                                  <button class="update-btn" @click=${() => this.handleExternalLinkClick('https://cheatingdaddy.com/download')}>
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                          <path
                                              fill="none"
                                              stroke="currentColor"
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5m-5-7v12"
                                          />
                                      </svg>
                                      Update available
                                  </button>
                              `
                            : html` <div class="version-text">v${this._localVersion}</div> `
                    }
                </div>
            </div>
        `;
    }

    renderLiveBar() {
        if (!this._isLiveMode()) return '';

        const profileLabels = {
            interview: 'Interview',
            sales: 'Sales Call',
            meeting: 'Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam',
        };

        return html`
            <div class="live-bar">
                <div class="live-bar-left">
                    <button class="live-bar-back" @click=${() => this.handleClose()} title="End session">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path
                                fill-rule="evenodd"
                                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
                <div class="live-bar-center">${profileLabels[this.selectedProfile] || 'Session'}</div>
                <div class="live-bar-right">
                    ${this.statusText ? html`<span class="live-bar-text">${this.statusText}</span>` : ''}
                    <span class="live-bar-text">${this.getElapsedTime()}</span>
                    ${this._isClickThrough ? html`<span class="live-bar-text">[click through]</span>` : ''}
                    <span class="live-bar-text clickable" @click=${() => this.handleHideToggle()}>[hide]</span>
                </div>
            </div>
        `;
    }

    render() {
        const viewTitles = {
            onboarding: 'Welcome',
            main: 'Cheating Daddy',
            'ai-customize': 'AI Context',
            customize: 'Settings',
            help: 'Help',
            history: 'History',
            assistant: 'Live Assistant',
        };
        const navigationItems = [
            ...(this.currentView === 'onboarding' ? [{ id: 'onboarding', label: 'Getting Started' }] : []),
            { id: 'main', label: 'Home' },
            { id: 'ai-customize', label: 'AI Context' },
            ...(this.sessionActive ? [{ id: 'assistant', label: 'Live Assistant' }] : []),
            { id: 'history', label: 'History' },
            { id: 'customize', label: 'Settings' },
            { id: 'help', label: 'Help' },
        ];

        return html`
            <div class="notch-screen-edge">
                ${this.sessionActive ? html`<div class="screen-edge-line" aria-hidden="true"></div>` : ''}
                <section class="notch-app" aria-label="Cheating Daddy">
                    <header class="notch-header">
                        <div class="notch-indicator ${this.sessionActive ? 'active' : ''}" aria-hidden="true">
                            ${this.sessionActive
                                ? html`<span></span><span></span><span></span><span></span>`
                                : html`<span class="idle-indicator"></span>`}
                        </div>
                        <span class="notch-title">${viewTitles[this.currentView] || 'Cheating Daddy'}</span>
                        <select
                            class="notch-nav"
                            aria-label="Navigate to screen"
                            .value=${this.currentView}
                            @change=${event => this.navigate(event.target.value)}
                        >
                            ${navigationItems.map(item => html`<option value=${item.id}>${item.label}</option>`)}
                        </select>
                        ${this.sessionActive ? html`<span class="notch-session-time">${this.getElapsedTime()}</span>` : ''}
                        <div class="notch-actions">
                            ${this.sessionActive && this.currentView !== 'assistant'
                                ? html`
                                      <button class="notch-action" @click=${() => this.returnToSessionNotch()} title="Return to live assistant" aria-label="Return to live assistant">
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                              <path d="M3 12h3l2-7 4 14 2-7h7"></path>
                                          </svg>
                                      </button>
                                  `
                                : ''}
                            <button class="notch-action" @click=${() => this._handleMinimize()} title="Minimize" aria-label="Minimize">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                                    <path d="M5 12h14"></path>
                                </svg>
                            </button>
                            <button class="notch-action" @click=${() => this.handleHideToggle()} title="Hide window" aria-label="Hide window">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m6 9 6 6 6-6"></path>
                                </svg>
                            </button>
                            <button class="notch-action end-session" @click=${() => this.handleClose()} title=${this.sessionActive ? 'End session' : 'Quit application'} aria-label=${this.sessionActive ? 'End session' : 'Quit application'}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                                    <path d="M18 6 6 18M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </header>
                    ${this._updateAvailable
                        ? html`
                              <div class="notch-update">
                                  <span>An update is available.</span>
                                  <button @click=${() => this.handleExternalLinkClick('https://cheatingdaddy.com/download')}>Download</button>
                              </div>
                          `
                        : ''}
                    <div class="notch-panel">${this.renderCurrentView()}</div>
                </div>
            </div>
        `;
    }
}

customElements.define('cheating-daddy-app', CheatingDaddyApp);
