if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain, dialog, autoUpdater } = require('electron');
const fetch = require("node-fetch");

const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/gemini');
const { initializeRandomProcessNames } = require('./utils/processRandomizer');
const { applyAntiAnalysisMeasures } = require('./utils/stealthFeatures');
const { getLocalConfig, writeConfig } = require('./config');

const geminiSessionRef = { current: null };
let mainWindow = null;

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

async function checkVersion() {
    const currentVersion = app.getVersion();  // version from package.json

    try {
        const response = await fetch("https://raw.githubusercontent.com/develper21/access_config/main/access_config/version.json");  
        const data = await response.json();

        if (data.version !== currentVersion) {
            dialog.showMessageBoxSync({
                type: "warning",
                buttons: ["Update Now"],
                title: "Update Required",
                message: `Your version (${currentVersion}) is outdated.\nPlease update to continue.`
            });

            app.quit(); // Force exit if version mismatch
        }
    } catch (err) {
        console.error("Version check failed:", err);

        // Optional: block or allow
        // app.quit(); // uncomment to block if server not reachable
    }
}

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef, randomNames);
    return mainWindow;
}

app.whenReady().then(async () => {
    await applyAntiAnalysisMeasures();

    await checkVersion();   

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

    // Handle loader events from Gemini
    ipcMain.on('show-loader', (event, message, subtext) => {
        if (mainWindow) {
            mainWindow.webContents.send('show-loader', message, subtext);
        }
    });

    ipcMain.on('hide-loader', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('hide-loader');
        }
    });

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
}
