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
  }

  connectedCallback() {
    super.connectedCallback();
    window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
      this.isInitializing = isInitializing;
    });
    document.addEventListener('keydown', this.boundKeydownHandler);
    this.loadLayoutMode?.();
    resizeLayout();
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





  async handleStartClick() {
    if (this.isInitializing) return;

    if (!this.apiKey) {
      this.showApiKeyError = true;
      return;
    }

    this.onStart();
  }

  handleAPIKeyHelpClick() {
    this.onAPIKeyHelp();
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
      
      <!-- API Key Input -->
      <div class="input-group">
        <input
          type="password"
          placeholder="Enter your Gemini API Key"
          .value=${this.apiKey}
          @input=${this.handleInput}
          class="${this.showApiKeyError ? 'api-key-error' : ''}"
        />
        <button
          @click=${this.handleStartClick}
          class="start-button ${this.isInitializing ? 'initializing' : ''}"
        >${this.getStartButtonText()}</button>
      </div>
 `;
}
}

customElements.define('main-view', MainView);