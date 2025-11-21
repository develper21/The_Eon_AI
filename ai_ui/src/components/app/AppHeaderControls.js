import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

class AppHeaderControls extends LitElement {
    static styles = css`
        :host {
            display: block;
            margin-top: 8px;
            -webkit-app-region: no-drag;
        }

        .panel {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--border-radius, 10px);
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
            background: var(--header-background, rgba(0, 0, 0, 0.45));
        }

        .fast-mode-active {
            background: rgba(99, 102, 241, 0.2);
            border-color: rgba(99, 102, 241, 0.5);
        }

        .control-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: var(--header-button-padding, 6px 14px);
            border-radius: 8px;
            font-size: var(--header-font-size-small, 12px);
            font-weight: 500;
            transition: background 0.2s ease, opacity 0.2s ease;
        }

        .control-button.leet-button {
            border-color: rgba(250, 204, 21, 0.85);
            color: #facc15;
            font-weight: 600;
        }

        .control-button.fast-mode-active {
            border-color: var(--success-border, rgba(52, 211, 153, 0.4));
            color: var(--success-color, #34d399);
        }

        .control-button:hover {
            background: var(--hover-background);
        }

        .key {
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            margin: 0px;
        }
    `;

    static properties = {
        fastMode: { type: Boolean },
        onManualScreenshot: { type: Function },
        onLeetScreenshot: { type: Function },
        onFastModeToggle: { type: Function },
        onForceReconnect: { type: Function },
        onRestartCapture: { type: Function },
        onFullReset: { type: Function },
        onHideToggleClick: { type: Function },
    };

    constructor() {
        super();
        this.fastMode = false;
        this.onManualScreenshot = () => {};
        this.onLeetScreenshot = () => {};
        this.onFastModeToggle = () => {};
        this.onForceReconnect = () => {};
        this.onRestartCapture = () => {};
        this.onFullReset = () => {};
        this.onHideToggleClick = () => {};
    }

    render() {
        return html`
            <div class="panel">
                <button class="control-button" @click=${this.onManualScreenshot} title="Send manual screenshot">
                    Send Screenshot
                </button>
                <button
                    class="control-button ${this.fastMode ? 'fast-mode-active' : ''}"
                    @click=${this.onFastModeToggle}
                    title="Toggle performance mode"
                >
                    Fast Mode: ${this.fastMode ? 'On' : 'Off'}
                </button>
                <button class="control-button leet-button" @click=${this.onLeetScreenshot} title="Capture full LeetCode screenshot">
                    Leet
                </button>
                <button class="control-button" @click=${this.onForceReconnect} title="Force session reconnect">
                    Force Reconnect
                </button>
                <button class="control-button" @click=${this.onRestartCapture} title="Restart capture stream">
                    Restart Capture
                </button>
                <button class="control-button" @click=${this.onFullReset} title="Restart capture and listening pipelines">
                    Reset Stream
                </button>
                <button class="control-button" @click=${this.onHideToggleClick}>
                    Hide&nbsp;&nbsp;<span class="key" style="pointer-events: none;">${cheddar.isMacOS ? 'Cmd' : 'Ctrl'}</span
                    >&nbsp;&nbsp;<span class="key">&bsol;</span>
                </button>
            </div>
        `;
    }
}

customElements.define('app-header-controls', AppHeaderControls);
