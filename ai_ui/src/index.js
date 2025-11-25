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
const { generateInterviewPdf } = require('./utils/interviewPdf');

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



function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef, randomNames);
    // Make mainWindow globally available for PDF logging
    global.mainWindow = mainWindow;
    return mainWindow;
}

// Usage counter functions
const fs = require('fs');
const path = require('path');

// Use app data directory for reliable file storage in deployed environment
const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '..');;
const USAGE_FILE = path.join(userDataPath, 'usage-count.json');
const SETTINGS_FILE = path.join(userDataPath, 'usage-settings.json');

console.log('[USAGE] Using data directory:', userDataPath);
console.log('[USAGE] Usage file path:', USAGE_FILE);
console.log('[USAGE] Settings file path:', SETTINGS_FILE);

// Default settings
let SESSION_DURATION_LIMIT = 10 * 60 * 1000; // 10 minutes (usage increments only after 10 min)
let MAX_USAGE_LIMIT = 10;

let sessionStartTime = null;
let sessionTimer = null;

// Load settings on startup
function loadUsageSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(data);
            SESSION_DURATION_LIMIT = settings.sessionDuration || SESSION_DURATION_LIMIT;
            MAX_USAGE_LIMIT = settings.maxUsage || MAX_USAGE_LIMIT;
            console.log(`[SETTINGS] Loaded: ${SESSION_DURATION_LIMIT/1000}s duration, ${MAX_USAGE_LIMIT} max usage`);
        } else {
            // Create default settings file
            saveUsageSettings();
            console.log(`[SETTINGS] Created default settings: ${SESSION_DURATION_LIMIT/1000}s duration, ${MAX_USAGE_LIMIT} max usage`);
        }
    } catch (error) {
        console.error('[SETTINGS] Error loading settings:', error);
    }
}

// Save settings
function saveUsageSettings() {
    try {
        const settings = {
            sessionDuration: SESSION_DURATION_LIMIT,
            maxUsage: MAX_USAGE_LIMIT,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
        console.log(`[SETTINGS] Saved: ${SESSION_DURATION_LIMIT/1000}s duration, ${MAX_USAGE_LIMIT} max usage`);
    } catch (error) {
        console.error('[SETTINGS] Error saving settings:', error);
    }
}

// Load settings on startup
loadUsageSettings();

function startSessionTimer() {
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    
    sessionStartTime = Date.now();
    console.log(`[TIMER] Session started at ${new Date(sessionStartTime).toLocaleTimeString()}`);
    console.log(`[TIMER] Will increment usage after ${SESSION_DURATION_LIMIT/1000} seconds of active usage`);
    
    // Set timer to check session duration
    sessionTimer = setTimeout(() => {
        const sessionDuration = Date.now() - sessionStartTime;
        console.log(`[TIMER] Session qualified! Duration: ${Math.round(sessionDuration/1000)} seconds`);
        console.log(`[TIMER] Incrementing usage count...`);
        
        incrementUsageCount();
        sessionStartTime = null;
        sessionTimer = null;
        
        console.log(`[TIMER] Usage increment completed - session qualified for usage count`);
    }, SESSION_DURATION_LIMIT);
    
    console.log(`[TIMER] Usage increment scheduled for ${new Date(Date.now() + SESSION_DURATION_LIMIT).toLocaleTimeString()}`);
}

function endSessionTimer() {
    if (sessionTimer) {
        clearTimeout(sessionTimer);
        sessionTimer = null;
        sessionStartTime = null;
        console.log('[TIMER] Session timer ended - usage only increments after 10 minutes of active usage');
    }
}

async function sendUsageNotificationEmail(newCount) {
    try {
        // Simple console notification (always works)
        console.log('🎯 ===== EMAIL NOTIFICATION =====');
        console.log(`📧 TO: deep.goyani.enora@gmail.com`);
        console.log(`📋 SUBJECT: Enora The Eon - Usage Count Updated`);
        console.log(`📊 USAGE COUNT: ${newCount}/10 sessions`);
        console.log(`⏰ TIME: ${new Date().toLocaleString()}`);
        console.log('🎯 ===== END EMAIL NOTIFICATION =====');
        
        const nodemailer = require('nodemailer');
        
        // Gmail configuration with improved error handling
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'deep.goyani.enora@gmail.com',
                pass: 'jshn iulk wxfz arxg'
            },
            tls: {
                rejectUnauthorized: false
            },
            debug: true, // Enable debug logging
            logger: true  // Enable logging
        });

        // Verify transporter configuration
        await transporter.verify();
        console.log('📧 Email transporter verified successfully');

        const mailOptions = {
            from: 'deep.goyani.enora@gmail.com',
            to: 'deep.goyani.enora@gmail.com',
            subject: `🎯 Enora The Eon - Usage Count Updated (${newCount}/10)`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4CAF50;">🚀 Enora The Eon Usage Alert</h2>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3>Session Completed Successfully!</h3>
                        <p><strong>✅ New Usage Count:</strong> ${newCount}/10 sessions</p>
                        <p><strong>📅 Date:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>⏱️ Session Duration:</strong> 10+ minutes (qualified)</p>
                        <p><strong>🔑 Access Code:</strong> enoraa(verified)</p>
                    </div>
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px;">
                        <h4>📊 Usage Statistics:</h4>
                        <ul>
                            <li>Total sessions used: ${newCount}</li>
                            <li>Sessions remaining: ${Math.max(0, 10 - newCount)}</li>
                            <li>Usage percentage: ${Math.round((newCount / 10) * 100)}%</li>
                        </ul>
                    </div>
                    ${newCount >= 10 ? `
                        <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-top: 20px;">
                            <h4 style="color: #f44336;">⚠️ Important Notice</h4>
                            <p>The user has reached the maximum usage limit of 10 sessions.</p>
                            <p>No further sessions can be started until the limit is reset.</p>
                        </div>
                    ` : ''}
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
                        <p><small>This is an automated notification from Enora The Eon</small></p>
                    </div>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Usage notification email sent successfully! Message ID: ${result.messageId}`);
        console.log(`📧 Email sent to deep.goyani.enora@gmail.com for count: ${newCount}`);
        
    } catch (error) {
        console.error('❌ Failed to send usage notification email:', error);
        console.error('❌ Error details:', {
            code: error.code,
            command: error.command,
            response: error.response,
            message: error.message
        });
        // Continue with the session even if email fails
    }
}

function incrementUsageCount() {
    let usageCount = 0;
    
    console.log('[INCREMENT] Starting usage count increment...');
    console.log('[INCREMENT] Usage file path:', USAGE_FILE);
    
    try {
        // Ensure directory exists
        const dir = path.dirname(USAGE_FILE);
        if (!fs.existsSync(dir)) {
            console.log('[INCREMENT] Creating directory:', dir);
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Read existing usage count
        if (fs.existsSync(USAGE_FILE)) {
            const data = fs.readFileSync(USAGE_FILE, 'utf8');
            console.log('[INCREMENT] Raw file data:', data);
            const parsed = JSON.parse(data);
            usageCount = parseInt(parsed.count || '0');
            console.log(`[INCREMENT] Current usage from file: ${usageCount}`);
        } else {
            console.log('[INCREMENT] Usage file does not exist, starting from 0');
        }
        
        // Check if usage limit reached
        if (usageCount >= MAX_USAGE_LIMIT) {
            console.log(`[INCREMENT] Usage limit of ${MAX_USAGE_LIMIT} reached. Cannot increment further.`);
            return usageCount;
        }
        
        // Increment count
        usageCount++;
        
        // Save new count
        const newUsageData = JSON.stringify({ count: usageCount, lastUpdated: new Date().toISOString() }, null, 2);
        fs.writeFileSync(USAGE_FILE, newUsageData, 'utf8');
        
        console.log(`[INCREMENT] Usage count incremented to ${usageCount}/${MAX_USAGE_LIMIT}`);
        console.log(`[INCREMENT] File saved successfully to: ${USAGE_FILE}`);
        console.log(`[INCREMENT] Sending email notification to deep.goyani.enora@gmail.com`);
        
        // Verify file was written correctly
        if (fs.existsSync(USAGE_FILE)) {
            const verifyData = fs.readFileSync(USAGE_FILE, 'utf8');
            console.log('[INCREMENT] Verification - file content after save:', verifyData);
        }
        
        // Send email notification asynchronously (don't block the session)
        sendUsageNotificationEmail(usageCount).catch(err => {
            console.error('[INCREMENT] Email notification failed:', err);
        });
        
        return usageCount;
    } catch (error) {
        console.error('[INCREMENT] Error managing usage count:', error);
        console.error('[INCREMENT] Error stack:', error.stack);
        return usageCount;
    }
}

function getUsageCount() {
    try {
        if (fs.existsSync(USAGE_FILE)) {
            const data = fs.readFileSync(USAGE_FILE, 'utf8');
            return parseInt(JSON.parse(data).count || '0');
        }
        return 0;
    } catch (error) {
        console.error('Error reading usage count:', error);
        return 0;
    }
}

function isUsageLimitReached() {
    const currentUsage = getUsageCount();
    return currentUsage >= MAX_USAGE_LIMIT;
}

function resetUsageCount() {
    try {
        const resetData = JSON.stringify({ count: 0, lastUpdated: new Date().toISOString() }, null, 2);
        const dir = path.dirname(USAGE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(USAGE_FILE, resetData, 'utf8');
        console.log('[USAGE] Usage count reset to 0');
        return { success: true };
    } catch (error) {
        console.error('[USAGE] Failed to reset usage count:', error);
        return { success: false, error: error.message };
    }
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

    ipcMain.on('emergency-stop-loader', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('emergency-stop-loader');
        }
    });

    ipcMain.handle('get-usage-count', (event) => {
        return getUsageCount();
    });

    // Handle session timer management
    ipcMain.handle('start-session-timer', (event) => {
        const currentUsage = getUsageCount();
        console.log(`[IPC] start-session-timer called. Current usage: ${currentUsage}/${MAX_USAGE_LIMIT}`);
        
        const limitReached = isUsageLimitReached();
        if (limitReached) {
            console.log('[IPC] Usage limit reached - cannot start new session');
            return { success: false, message: 'Usage limit reached' };
        }
        
        console.log('[IPC] Starting session timer...');
        startSessionTimer();
        return { success: true, message: 'Session timer started' };
    });

    // Handle settings management
    ipcMain.handle('update-usage-settings', (event, newSettings) => {
        try {
            if (newSettings.sessionDuration) {
                SESSION_DURATION_LIMIT = newSettings.sessionDuration;
            }
            if (newSettings.maxUsage) {
                MAX_USAGE_LIMIT = newSettings.maxUsage;
            }
            saveUsageSettings();
            
            console.log(`[SETTINGS] Updated: ${SESSION_DURATION_LIMIT/1000}s duration, ${MAX_USAGE_LIMIT} max usage`);
            return { 
                success: true, 
                sessionDuration: SESSION_DURATION_LIMIT,
                maxUsage: MAX_USAGE_LIMIT
            };
        } catch (error) {
            console.error('[SETTINGS] Error updating settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-usage-settings', (event) => {
        return {
            sessionDuration: SESSION_DURATION_LIMIT,
            maxUsage: MAX_USAGE_LIMIT,
            currentUsage: getUsageCount(),
            remaining: Math.max(0, MAX_USAGE_LIMIT - getUsageCount())
        };
    });

    ipcMain.handle('reset-usage-count', () => {
        return resetUsageCount();
    });

    ipcMain.handle('end-session-timer', (event) => {
        endSessionTimer();
        return { success: true, message: 'Session timer ended' };
    });

    ipcMain.handle('check-usage-limit', (event) => {
        const currentUsage = getUsageCount();
        const limitReached = isUsageLimitReached();
        return { 
            currentUsage, 
            maxUsage: MAX_USAGE_LIMIT, 
            limitReached,
            remaining: Math.max(0, MAX_USAGE_LIMIT - currentUsage)
        };
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
