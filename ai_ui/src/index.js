if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, dialog, autoUpdater } = require('electron');
const fetch = require("node-fetch");
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/gemini');
const { initializeRandomProcessNames } = require('./utils/security/antiAnalysis/processRandomizer');
const { applyAntiAnalysisMeasures } = require('./utils/security/antiAnalysis/stealthFeatures');
const { getLocalConfig, writeConfig } = require('./config');
const { generateInterviewPdf } = require('./utils/interviewPdf');
const { enhancedSecurityManager } = require('./utils/security/dataProtection/securityManager');
const NetworkObfuscator = require('./utils/security/network/networkObfuscator');
const ScreenshotObfuscator = require('./utils/security/dataProtection/screenshotObfuscator');
const RuntimeProtection = require('./utils/security/antiAnalysis/runtimeProtection');
const BehavioralRandomizer = require('./utils/security/behavioral/behavioralRandomizer');
const MemoryProtector = require('./utils/security/dataProtection/memoryProtector');

const geminiSessionRef = { current: null };
let mainWindow = null;

// Initialize enhanced security components
const networkObfuscator = new NetworkObfuscator();
const screenshotObfuscator = new ScreenshotObfuscator();
const runtimeProtection = new RuntimeProtection();
const behavioralRandomizer = new BehavioralRandomizer();
const memoryProtector = new MemoryProtector();

// Initialize random process names for stealth
const randomNames = initializeRandomProcessNames();
const UPDATE_FEED_URL = process.env.EON_AUTOUPDATE_FEED || '';

function setupAutoUpdater() {
    if (process.platform !== 'win32') {
        return;
    }

    if (!UPDATE_FEED_URL) {
        console.warn('Auto-update feed disabled: EON_AUTOUPDATE_FEED env var not set');
        return;
    }

    try {
        autoUpdater.setFeedURL({ url: UPDATE_FEED_URL });
    } catch (error) {
        console.error('Failed to configure auto-updater feed:', error);
        return;
    }

    autoUpdater.on('error', error => {
        console.error('Auto-updater error:', error);
    });

    autoUpdater.on('update-available', () => {
        console.log('Auto-updater: update available, downloading...');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-status', 'Downloading update...');
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log('Auto-updater: no updates found');
    });

    autoUpdater.on('update-downloaded', () => {
        console.log('Auto-updater: update downloaded, installing');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-status', 'Installing update...');
        }
        autoUpdater.quitAndInstall();
    });

    const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
    const checkForUpdates = () => {
        try {
            autoUpdater.checkForUpdates();
        } catch (error) {
            console.error('Auto-updater check failed:', error);
        }
    };

    checkForUpdates();
    setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef, randomNames);
    // Make mainWindow globally available for PDF logging
    global.mainWindow = mainWindow;
    return mainWindow;
}



async function checkVersion() {
    const currentVersion = app.getVersion();  // version from package.json

    try {
        const response = await fetch("https://raw.githubusercontent.com/develper21/access_config/main/access_config/version.json");  
        const data = await response.json();

        if (data.version !== currentVersion) {
            // Show a non-blocking notification instead of forcing quit
            dialog.showMessageBox({
                type: "info",
                buttons: ["OK"],
                title: "Update Available",
                message: `A new version (${data.version}) is available.\nCurrent version: ${currentVersion}\n\nConsider updating for the latest features.`
            }).catch(() => {
                // Ignore dialog errors, don't block the app
                console.log("Update notification dialog closed or failed");
            });
        }
    } catch (err) {
        console.error("Version check failed:", err);
        // Don't block the app if version check fails - just log the error
    }
}

app.whenReady().then(async () => {
    await applyAntiAnalysisMeasures();

    // Initialize enhanced security systems
    try {
        console.log('Initializing enhanced security systems...');
        await runtimeProtection.initialize();
        await memoryProtector.initialize();
        behavioralRandomizer.initialize();
        console.log('Enhanced security systems initialized successfully');
    } catch (error) {
        console.error('Failed to initialize enhanced security:', error);
    }

    // Version check disabled to prevent update notifications
    // checkVersion().catch(err => {
    //     console.log("Version check failed in background:", err);
    // });

    createMainWindow();    
    setupGeminiIpcHandlers(geminiSessionRef);
    setupGeneralIpcHandlers();
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
    
    // Cleanup enhanced security systems
    try {
        console.log('Cleaning up enhanced security systems...');
        runtimeProtection.cleanup();
        memoryProtector.cleanup();
        networkObfuscator.cleanup();
        enhancedSecurityManager.cleanup();
        console.log('Enhanced security systems cleaned up successfully');
    } catch (error) {
        console.error('Failed to cleanup enhanced security:', error);
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupGeneralIpcHandlers() {
    ipcMain.handle('set-onboarded', async (event) => {
        try {
            const config = getLocalConfig();
            config.onboarded = true;
            writeConfig(config);
            return { success: true, config };
        } catch (error) {
            console.error('Error setting onboarded:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('set-stealth-level', async (event, stealthLevel) => {
        try {
            const validLevels = ['visible', 'balanced', 'ultra'];
            if (!validLevels.includes(stealthLevel)) {
                throw new Error(`Invalid stealth level: ${stealthLevel}. Must be one of: ${validLevels.join(', ')}`);
            }
            
            const config = getLocalConfig();
            config.stealthLevel = stealthLevel;
            writeConfig(config);
            return { success: true, config };
        } catch (error) {
            console.error('Error setting stealth level:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('set-layout', async (event, layout) => {
        try {
            const validLayouts = ['normal', 'compact'];
            if (!validLayouts.includes(layout)) {
                throw new Error(`Invalid layout: ${layout}. Must be one of: ${validLayouts.join(', ')}`);
            }

            const config = getLocalConfig();
            config.layout = layout;
            writeConfig(config);
            return { success: true, config };
        } catch (error) {
            console.error('Error setting layout:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-config', async (event) => {
        try {
            const config = getLocalConfig();
            return { success: true, config };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (mainWindow) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });


    // Handle session timer management


    ipcMain.handle('update-content-protection', async (event, contentProtection) => {
        try {
            if (mainWindow) {
                const contentProtectionValue = await mainWindow.webContents.executeJavaScript('cheddar.getContentProtection()');
                mainWindow.setContentProtection(contentProtectionValue);
                console.log('Content protection updated:', contentProtectionValue);
            }
            return { success: true };
        } catch (error) {
            console.error('Error updating content protection:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-random-display-name', async event => {
        try {
            return randomNames ? randomNames.displayName : 'System Monitor';
        } catch (error) {
            console.error('Error getting random display name:', error);
            return 'System Monitor';
        }
    });

    ipcMain.handle('generate-interview-pdf', async (event, session) => {
        console.log('[MAIN] generate-interview-pdf IPC handler called');
        console.log('[MAIN] Session data:', session ? { sessionId: session.sessionId, timestamp: session.timestamp, historyLength: session.conversationHistory ? session.conversationHistory.length : 0 } : 'null');
        
        try {
            const result = await generateInterviewPdf(session || {});
            console.log('[MAIN] PDF generation result:', result);
            return result;
        } catch (error) {
            console.error('[MAIN] Error generating interview PDF:', error);
            console.error('[MAIN] Error stack:', error.stack);
            return { success: false, error: error.message };
        }
    });
}
