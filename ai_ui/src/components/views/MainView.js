import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class MainView extends LitElement {

  static styles = css`
    * {
      font-family: 'Inter', sans-serif;
      cursor: default;
      user-select: none;
    }

    .welcome {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: 600;
      margin-top: auto;
    }

    .input-group {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .input-group input {
      flex: 1;
    }

    input {
      background: var(--input-background);
      color: var(--text-color);
      border: 1px solid var(--button-border);
      padding: 10px 14px;
      width: 100%;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s ease;
    }

    input:focus {
      outline: none;
      border-color: var(--focus-border-color);
      box-shadow: 0 0 0 3px var(--focus-box-shadow);
      background: var(--input-focus-background);
    }

    input::placeholder {
      color: var(--placeholder-color);
    }

    input.api-key-error {
      animation: blink-red 1s ease-in-out;
      border-color: #ff4444;
    }

    @keyframes blink-red {
      0%, 100% {
        border-color: var(--button-border);
        background: var(--input-background);
      }
      25%, 75% {
        border-color: #ff4444;
        background: rgba(255, 68, 68, 0.1);
      }
      50% {
        border-color: #ff6666;
        background: rgba(255, 68, 68, 0.15);
      }
    }

    .start-button {
      background: var(--start-button-background);
      color: var(--start-button-color);
      border: 1px solid var(--start-button-border);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .start-button:hover {
      background: var(--start-button-hover-background);
      border-color: var(--start-button-hover-border);
    }

    .start-button.initializing {
      opacity: 0.5;
    }

    .shortcut-icons {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-left: 4px;
    }

    .shortcut-icons svg {
      width: 14px;
      height: 14px;
    }

    .shortcut-icons svg path {
      stroke: currentColor;
    }

    :host {
      height: 100%;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 500px;
    }
  `;

  static properties = {
    onStart: { type: Function },
    onAPIKeyHelp: { type: Function },
    isInitializing: { type: Boolean },
    onLayoutModeChange: { type: Function },
    showApiKeyError: { type: Boolean },
    apiKey: { type: String },
    accessCode: { type: String },
    showAccessCodeError: { type: Boolean },
    isAccessVerified: { type: Boolean },
    usageCount: { type: Number },
    usageLimitReached: { type: Boolean },
    remainingUsage: { type: Number },
    accessCodeErrorMessage: { type: String },
  };

  constructor() {
    super();
    this.onStart = () => {};
    this.onAPIKeyHelp = () => {};
    this.isInitializing = false;
    this.onLayoutModeChange = () => {};
    this.showApiKeyError = false;
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.apiKey = localStorage.getItem('apiKey') || '';
    this.accessCode = localStorage.getItem('accessCode') || '';
    this.showAccessCodeError = false;
    this.isAccessVerified = localStorage.getItem('accessVerified') === 'true';
    this.usageCount = 0;
    this.usageLimitReached = false;
    this.remainingUsage = 10;
    this.accessCodeErrorMessage = '';
  }

  connectedCallback() {
    super.connectedCallback();
    window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
      this.isInitializing = isInitializing;
    });
    document.addEventListener('keydown', this.boundKeydownHandler);
    this.loadLayoutMode?.();
    resizeLayout();
    // Fetch usage count from main process
    this.fetchUsageCount();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.electron?.ipcRenderer?.removeAllListeners('session-initializing');
    document.removeEventListener('keydown', this.boundKeydownHandler);
  }

  loadLayoutMode() {
    const savedLayoutMode = localStorage.getItem('layoutMode');
    if (savedLayoutMode && typeof this.onLayoutModeChange === 'function') {
      this.onLayoutModeChange(savedLayoutMode);
    }
  }

  handleKeydown(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isStartShortcut = isMac ? e.metaKey && e.key === 'Enter' : e.ctrlKey && e.key === 'Enter';
    if (isStartShortcut) {
      e.preventDefault();
      this.handleStartClick();
    }
  }

  handleInput(e) {
    this.apiKey = e.target.value.trim();
    localStorage.setItem('apiKey', this.apiKey);
    if (this.showApiKeyError) this.showApiKeyError = false;
  }

  handleAccessCodeInput(e) {
    this.accessCode = e.target.value.trim();
    localStorage.setItem('accessCode', this.accessCode);
    if (this.showAccessCodeError) this.showAccessCodeError = false;
  }

  async verifyAccessCode() {
    // Check usage limit first
    if (this.usageLimitReached) {
      this.showAccessCodeError = true;
      this.accessCodeErrorMessage = '❌ Usage limit reached (10/10 sessions). Access codes are no longer valid.';
      return false;
    }

    const validAccessCodes = ["ENORA2025", "AKSHAR2025", "ADITYA2025"];
    
    if (!this.accessCode) {
      this.showAccessCodeError = true;
      this.accessCodeErrorMessage = 'Please enter an access code';
      return false;
    }

    if (validAccessCodes.includes(this.accessCode)) {
      this.isAccessVerified = true;
      localStorage.setItem('accessVerified', 'true');
      this.showAccessCodeError = false;
      this.accessCodeErrorMessage = '';
      return true;
    } else {
      this.showAccessCodeError = true;
      this.isAccessVerified = false;
      this.accessCodeErrorMessage = '❌ Invalid access code. Usage limit may be reached or code is incorrect.';
      localStorage.setItem('accessVerified', 'false');
      return false;
    }
  }

  async handleStartClick() {
    if (this.isInitializing) return;

    // Check access code first
    if (!this.isAccessVerified) {
      const isVerified = await this.verifyAccessCode();
      if (!isVerified) {
        return;
      }
    }

    if (!this.apiKey) {
      this.showApiKeyError = true;
      return;
    }

    // Start session timer (only increments after 10 minutes)
    try {
      console.log('[UI] Attempting to start session timer...');
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('start-session-timer');
      
      if (!result.success) {
        console.log('[UI] Cannot start session:', result.message);
        // Optionally show user feedback about limit reached
        return;
      }
      console.log('[UI] Session timer started:', result.message);
    } catch (error) {
      console.error('[UI] Error starting session timer:', error);
    }

    this.onStart();
  }

  handleAPIKeyHelpClick() {
    this.onAPIKeyHelp();
  }

  async fetchUsageCount() {
    try {
      const { ipcRenderer } = require('electron');
      const usageInfo = await ipcRenderer.invoke('check-usage-limit');
      this.usageCount = usageInfo.currentUsage;
      this.usageLimitReached = usageInfo.limitReached;
      this.remainingUsage = usageInfo.remaining;
      console.log('Usage info fetched:', usageInfo);
    } catch (error) {
      console.error('Error fetching usage count:', error);
      this.usageCount = 0;
      this.usageLimitReached = false;
      this.remainingUsage = 10;
    }
  }

  getStartButtonText() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const enterIcon = html`<svg width="14px" height="14px" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.25 19.25L6.75 15.75L10.25 12.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M6.75 15.75H12.75C14.9591 15.75 16.75 13.9591 16.75 11.75V4.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
    return html`Start Session <span class="shortcut-icons">${isMac ? '⌘' : 'Ctrl'}${enterIcon}</span>`;
  }

  render() {
    return html`
      <div class="welcome">Welcome</div>
      
      <!-- Usage Count Display with Limit -->
      <div style="text-align: center; margin-bottom: 20px; color: #888; font-size: 14px;">
        <div style="margin-bottom: 8px;">
          📊 Usage Count: <strong>${this.usageCount}/10</strong> sessions
        </div>
        <div style="font-size: 12px; color: ${this.usageLimitReached ? '#ff4444' : '#666'};">
          ${this.usageLimitReached 
            ? '⚠️ Usage limit reached' 
            : `✅ ${this.remainingUsage} sessions remaining`
          }
        </div>
        <div style="font-size: 11px; color: #999; margin-top: 4px;">
          (Counts only after 10+ minute sessions)
        </div>
      </div>

      <!-- Access Code Input -->
      <div class="input-group">
        <input
          type="password"
          placeholder="Enter Access Code"
          .value=${this.accessCode}
          @input=${this.handleAccessCodeInput}
          class="${this.showAccessCodeError ? 'api-key-error' : ''}"
          ?disabled=${this.isAccessVerified || this.usageLimitReached}
        />
        <button
          @click=${this.verifyAccessCode}
          class="start-button"
          ?disabled=${this.isAccessVerified || this.usageLimitReached}
        >
          ${this.usageLimitReached ? 'Limit Reached' : (this.isAccessVerified ? '✓ Verified' : 'Verify')}
        </button>
      </div>

      ${this.showAccessCodeError ? html`
        <div style="color: #ff4444; font-size: 12px; text-align: center; margin-bottom: 15px;">
          ${this.accessCodeErrorMessage}
        </div>
      ` : ''}

      <!-- API Key Input (only enabled if access code is verified) -->
      <div class="input-group">
        <input
          type="password"
          placeholder="Enter your Gemini API Key"
          .value=${this.apiKey}
          @input=${this.handleInput}
          class="${this.showApiKeyError ? 'api-key-error' : ''}"
          ?disabled=${!this.isAccessVerified || this.usageLimitReached}
        />
        <button
          @click=${this.handleStartClick}
          class="start-button ${this.isInitializing ? 'initializing' : ''}"
        </button>
      </div>
 `;
}
}

customElements.define('main-view', MainView);