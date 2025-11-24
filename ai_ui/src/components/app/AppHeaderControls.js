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

        .control-button.hackerrank-button {
            border-color: rgba(34, 211, 238, 0.85);
            color: #22d3ee;
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

        .download-circle {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-color: rgba(16, 185, 129, 0.9);
            color: #22c55e;
            position: relative;
            overflow: hidden;
        }

        .download-circle.loading {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }

        .download-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .download-icon.hide {
            opacity: 0;
            transform: translateY(8px);
            position: absolute;
        }

        .success-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0;
            transform: translateY(-8px);
            position: absolute;
        }

        .success-icon.show {
            opacity: 1;
            transform: translateY(0);
            position: relative;
        }
    `;

    static properties = {
        fastMode: { type: Boolean },
        onManualScreenshot: { type: Function },
        onLeetScreenshot: { type: Function },
        onHackerrankScreenshot: { type: Function },
        onFastModeToggle: { type: Function },
        onForceReconnect: { type: Function },
        onRestartCapture: { type: Function },
        onFullReset: { type: Function },
        onHideToggleClick: { type: Function },
        onDownloadInterviewPdf: { type: Function },
        downloadState: { type: String }, // 'idle', 'loading', 'success'
    };

    constructor() {
        super();
        this.fastMode = false;
        this.onManualScreenshot = () => {};
        this.onLeetScreenshot = () => {};
        this.onHackerrankScreenshot = () => {};
        this.onFastModeToggle = () => {};
        this.onForceReconnect = () => {};
        this.onRestartCapture = () => {};
        this.onFullReset = () => {};
        this.onHideToggleClick = () => {};
        this.onDownloadInterviewPdf = () => {};
        this.downloadState = 'idle';
    }

    async handleDownloadClick() {
        console.log('[BUTTON] Download clicked, current state:', this.downloadState);
        if (this.downloadState === 'loading') {
            console.log('[BUTTON] Already loading, ignoring click');
            return;
        }
        
        this.downloadState = 'loading';
        console.log('[BUTTON] State set to loading');
        this.requestUpdate();
        
        try {
            console.log('[BUTTON] Calling onDownloadInterviewPdf...');
            await this.onDownloadInterviewPdf();
            console.log('[BUTTON] Download completed successfully');
            this.downloadState = 'success';
            this.requestUpdate();
            
            setTimeout(() => {
                console.log('[BUTTON] Resetting to idle after 2 seconds');
                this.downloadState = 'idle';
                this.requestUpdate();
            }, 2000);
        } catch (error) {
            console.error('[BUTTON] Download error:', error);
            this.downloadState = 'idle';
            this.requestUpdate();
        }
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
                <button class="control-button hackerrank-button" @click=${this.onHackerrankScreenshot} title="Capture full HackerRank screenshot">
                    HackerRank
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
                <button
                    class="control-button download-circle ${this.downloadState === 'loading' ? 'loading' : ''}"
                    @click=${() => this.handleDownloadClick()}
                    title="Download interview PDF"
                    ?disabled=${this.downloadState === 'loading'}
                >
                    <div class="download-icon ${this.downloadState === 'success' ? 'hide' : ''}">
                        <svg
                            width="18px"
                            height="18px"
                            stroke-width="1.7"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            color="currentColor"
                        >
                            <path
                                d="M12 3v11.5M12 14.5l-3.5-3.5M12 14.5l3.5-3.5"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            ></path>
                            <path
                                d="M5 18.5h14"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                            ></path>
                        </svg>
                    </div>
                    <div class="success-icon ${this.downloadState === 'success' ? 'show' : ''}">
                        <svg
                            width="18px"
                            height="18px"
                            stroke-width="1.7"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            color="currentColor"
                        >
                            <path
                                d="M20 6L9 17L4 12"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            ></path>
                        </svg>
                    </div>
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
