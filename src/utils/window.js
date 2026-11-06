const { BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('node:path');
const storage = require('../storage');

let mouseEventsIgnored = false;

const NOTCH_SIZE = { width: 620, height: 80 };
// Keep in sync with --notch-inverse-radius in CheatingDaddyApp.js.
const NOTCH_SHOULDER_OVERHANG = 28;
const NOTCH_WINDOW_WIDTH = NOTCH_SIZE.width + 2 * NOTCH_SHOULDER_OVERHANG;
const NOTCH_LINE_HEIGHT = 4;
const MAX_NOTCH_HEIGHT = 484;

function createWindow(sendToRenderer, geminiSessionRef) {
    const display = screen.getPrimaryDisplay();
    const windowWidth = Math.min(NOTCH_WINDOW_WIDTH, display.bounds.width);
    const windowHeight = NOTCH_SIZE.height;

    const mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        minWidth: windowWidth,
        minHeight: NOTCH_SIZE.height,
        maxWidth: windowWidth,
        maxHeight: MAX_NOTCH_HEIGHT,
        resizable: false,
        frame: false,
        transparent: true,
        hasShadow: false,
        alwaysOnTop: process.platform === 'win32',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // TODO: change to true
            backgroundThrottling: false,
            enableBlinkFeatures: 'GetDisplayMedia',
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        backgroundColor: '#00000000',
    });

    mainWindow.setBounds(
        {
            x: display.bounds.x + Math.round((display.bounds.width - windowWidth) / 2),
            y: display.bounds.y,
            width: windowWidth,
            height: windowHeight,
        },
        false
    );
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    const { session, desktopCapturer } = require('electron');
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
                callback({ video: sources[0], audio: 'loopback' });
            });
        },
        { useSystemPicker: true }
    );

    mainWindow.setContentProtection(true);
    if (process.platform === 'win32') {
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }

    // Hide from Windows taskbar
    if (process.platform === 'win32') {
        try {
            mainWindow.setSkipTaskbar(true);
        } catch (error) {
            console.warn('Could not hide from taskbar:', error.message);
        }
    }

    // Hide from Mission Control on macOS
    if (process.platform === 'darwin') {
        try {
            mainWindow.setHiddenInMissionControl(true);
        } catch (error) {
            console.warn('Could not hide from Mission Control:', error.message);
        }
    }

    mainWindow.loadFile(path.join(__dirname, '../index.html'));

    // After window is created, initialize keybinds
    mainWindow.webContents.once('dom-ready', () => {
        setTimeout(() => {
            const defaultKeybinds = getDefaultKeybinds();
            let keybinds = defaultKeybinds;

            // Load keybinds from storage
            const savedKeybinds = storage.getKeybinds();
            if (savedKeybinds) {
                keybinds = { ...defaultKeybinds, ...savedKeybinds };
            }

            updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }, 150);
    });

    setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef);

    return mainWindow;
}

function getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
        moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
        moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
        moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
        toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
        toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
        nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
        previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
        nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
        scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
        scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
        emergencyErase: isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E',
    };
}

function updateGlobalShortcuts(keybinds, mainWindow, sendToRenderer, geminiSessionRef) {
    console.log('Updating global shortcuts with:', keybinds);

    // Unregister all existing shortcuts
    globalShortcut.unregisterAll();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const moveIncrement = Math.floor(Math.min(width, height) * 0.1);

    const movementActions = {
        moveUp: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX, currentY - moveIncrement);
        },
        moveDown: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX, currentY + moveIncrement);
        },
        moveLeft: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX - moveIncrement, currentY);
        },
        moveRight: () => {
            if (!mainWindow.isVisible()) return;
            const [currentX, currentY] = mainWindow.getPosition();
            mainWindow.setPosition(currentX + moveIncrement, currentY);
        },
    };

    Object.keys(movementActions).forEach(action => {
        const keybind = keybinds[action];
        if (keybind) {
            try {
                globalShortcut.register(keybind, movementActions[action]);
                console.log(`Registered ${action}: ${keybind}`);
            } catch (error) {
                console.error(`Failed to register ${action} (${keybind}):`, error);
            }
        }
    });

    // Register toggle visibility shortcut
    if (keybinds.toggleVisibility) {
        try {
            globalShortcut.register(keybinds.toggleVisibility, () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.showInactive();
                }
            });
            console.log(`Registered toggleVisibility: ${keybinds.toggleVisibility}`);
        } catch (error) {
            console.error(`Failed to register toggleVisibility (${keybinds.toggleVisibility}):`, error);
        }
    }

    // Register toggle click-through shortcut
    if (keybinds.toggleClickThrough) {
        try {
            globalShortcut.register(keybinds.toggleClickThrough, () => {
                mouseEventsIgnored = !mouseEventsIgnored;
                if (mouseEventsIgnored) {
                    mainWindow.setIgnoreMouseEvents(true, { forward: true });
                    console.log('Mouse events ignored');
                } else {
                    mainWindow.setIgnoreMouseEvents(false);
                    console.log('Mouse events enabled');
                }
                mainWindow.webContents.send('click-through-toggled', mouseEventsIgnored);
            });
            console.log(`Registered toggleClickThrough: ${keybinds.toggleClickThrough}`);
        } catch (error) {
            console.error(`Failed to register toggleClickThrough (${keybinds.toggleClickThrough}):`, error);
        }
    }

    // Register next step shortcut (either starts session or takes screenshot based on view)
    if (keybinds.nextStep) {
        try {
            globalShortcut.register(keybinds.nextStep, async () => {
                console.log('Next step shortcut triggered');
                try {
                    // Determine the shortcut key format
                    const isMac = process.platform === 'darwin';
                    const shortcutKey = isMac ? 'cmd+enter' : 'ctrl+enter';

                    // Use the new handleShortcut function
                    mainWindow.webContents.executeJavaScript(`
                        cheatingDaddy.handleShortcut('${shortcutKey}');
                    `);
                } catch (error) {
                    console.error('Error handling next step shortcut:', error);
                }
            });
            console.log(`Registered nextStep: ${keybinds.nextStep}`);
        } catch (error) {
            console.error(`Failed to register nextStep (${keybinds.nextStep}):`, error);
        }
    }

    // Register previous response shortcut
    if (keybinds.previousResponse) {
        try {
            globalShortcut.register(keybinds.previousResponse, () => {
                console.log('Previous response shortcut triggered');
                sendToRenderer('navigate-previous-response');
            });
            console.log(`Registered previousResponse: ${keybinds.previousResponse}`);
        } catch (error) {
            console.error(`Failed to register previousResponse (${keybinds.previousResponse}):`, error);
        }
    }

    // Register next response shortcut
    if (keybinds.nextResponse) {
        try {
            globalShortcut.register(keybinds.nextResponse, () => {
                console.log('Next response shortcut triggered');
                sendToRenderer('navigate-next-response');
            });
            console.log(`Registered nextResponse: ${keybinds.nextResponse}`);
        } catch (error) {
            console.error(`Failed to register nextResponse (${keybinds.nextResponse}):`, error);
        }
    }

    // Register scroll up shortcut
    if (keybinds.scrollUp) {
        try {
            globalShortcut.register(keybinds.scrollUp, () => {
                console.log('Scroll up shortcut triggered');
                sendToRenderer('scroll-response-up');
            });
            console.log(`Registered scrollUp: ${keybinds.scrollUp}`);
        } catch (error) {
            console.error(`Failed to register scrollUp (${keybinds.scrollUp}):`, error);
        }
    }

    // Register scroll down shortcut
    if (keybinds.scrollDown) {
        try {
            globalShortcut.register(keybinds.scrollDown, () => {
                console.log('Scroll down shortcut triggered');
                sendToRenderer('scroll-response-down');
            });
            console.log(`Registered scrollDown: ${keybinds.scrollDown}`);
        } catch (error) {
            console.error(`Failed to register scrollDown (${keybinds.scrollDown}):`, error);
        }
    }

    // Register emergency erase shortcut
    if (keybinds.emergencyErase) {
        try {
            globalShortcut.register(keybinds.emergencyErase, () => {
                console.log('Emergency Erase triggered!');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.hide();

                    if (geminiSessionRef.current) {
                        geminiSessionRef.current.close();
                        geminiSessionRef.current = null;
                    }

                    sendToRenderer('clear-sensitive-data');

                    setTimeout(() => {
                        const { app } = require('electron');
                        app.quit();
                    }, 300);
                }
            });
            console.log(`Registered emergencyErase: ${keybinds.emergencyErase}`);
        } catch (error) {
            console.error(`Failed to register emergencyErase (${keybinds.emergencyErase}):`, error);
        }
    }
}

function setupWindowIpcHandlers(mainWindow, sendToRenderer, geminiSessionRef) {
    let sessionActive = false;
    let notchHeight = NOTCH_SIZE.height;
    let notchLineWindow = null;

    function showNotchLine() {
        const display = screen.getDisplayMatching(mainWindow.getBounds());
        const { x, y, width } = display.bounds;
        const bounds = { x, y, width, height: NOTCH_LINE_HEIGHT };

        if (!notchLineWindow || notchLineWindow.isDestroyed()) {
            notchLineWindow = new BrowserWindow({
                ...bounds,
                frame: false,
                resizable: false,
                movable: false,
                focusable: false,
                skipTaskbar: true,
                hasShadow: false,
                alwaysOnTop: true,
                backgroundColor: '#000000',
            });
            notchLineWindow.setIgnoreMouseEvents(true);
            notchLineWindow.on('closed', () => {
                notchLineWindow = null;
            });
        } else {
            notchLineWindow.setBounds(bounds, false);
        }

        notchLineWindow.setAlwaysOnTop(true);
        notchLineWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        notchLineWindow.showInactive();
    }

    function hideNotchLine() {
        if (notchLineWindow && !notchLineWindow.isDestroyed()) {
            notchLineWindow.hide();
        }
    }

    function closeNotchLine() {
        if (notchLineWindow && !notchLineWindow.isDestroyed()) {
            notchLineWindow.close();
            notchLineWindow = null;
        }
    }

    function setNotchBounds(height = notchHeight) {
        const display = screen.getDisplayMatching(mainWindow.getBounds());
        const width = Math.min(NOTCH_WINDOW_WIDTH, display.bounds.width);
        const x = display.bounds.x + Math.round((display.bounds.width - width) / 2);
        notchHeight = Math.max(NOTCH_SIZE.height, Math.min(MAX_NOTCH_HEIGHT, Math.round(height)));
        mainWindow.setMinimumSize(width, NOTCH_SIZE.height);
        mainWindow.setMaximumSize(width, MAX_NOTCH_HEIGHT);

        mainWindow.setBounds(
            {
                x,
                y: display.bounds.y,
                width,
                height: notchHeight,
            },
            false
        );
        if (sessionActive) {
            showNotchLine();
        }
    }

    mainWindow.on('hide', hideNotchLine);
    mainWindow.on('show', () => {
        if (sessionActive) {
            showNotchLine();
        }
    });
    mainWindow.on('closed', closeNotchLine);
    mainWindow.on('move', () => {
        if (sessionActive) {
            setNotchBounds();
        }
    });

    function setSessionAlwaysOnTop(enabled) {
        mainWindow.setAlwaysOnTop(enabled);
        if (process.platform !== 'win32') {
            mainWindow.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled });
        }
    }

    ipcMain.on('view-changed', (event, view) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(true);
            mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        }
    });

    ipcMain.handle('session-notch:enter', event => {
        if (event.sender !== mainWindow.webContents || mainWindow.isDestroyed()) {
            return { success: false, error: 'Main window is unavailable' };
        }

        try {
            sessionActive = true;
            setSessionAlwaysOnTop(true);
            setNotchBounds(notchHeight);
            showNotchLine();
            mainWindow.show();
            return { success: true };
        } catch (error) {
            sessionActive = false;
            closeNotchLine();
            console.error('Error entering session notch:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('app-notch:resize', (event, size) => {
        if (event.sender !== mainWindow.webContents || mainWindow.isDestroyed()) {
            return { success: false, error: 'Main window is unavailable' };
        }

        if (!size || !Number.isFinite(size.height)) {
            return { success: false, error: 'Invalid notch dimensions' };
        }

        try {
            setNotchBounds(size.height);
            return { success: true };
        } catch (error) {
            console.error('Error resizing app notch:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('session-notch:exit', event => {
        if (event.sender !== mainWindow.webContents || mainWindow.isDestroyed()) {
            return { success: false, error: 'Main window is unavailable' };
        }

        try {
            sessionActive = false;
            closeNotchLine();
            setSessionAlwaysOnTop(true);
            mainWindow.show();
            return { success: true };
        } catch (error) {
            console.error('Error exiting session notch:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('window-minimize', () => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (!mainWindow.isDestroyed()) {
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    ipcMain.handle('toggle-window-visibility', async event => {
        try {
            if (mainWindow.isDestroyed()) {
                return { success: false, error: 'Window has been destroyed' };
            }

            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.showInactive();
            }
            return { success: true };
        } catch (error) {
            console.error('Error toggling window visibility:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = {
    createWindow,
    getDefaultKeybinds,
    updateGlobalShortcuts,
    setupWindowIpcHandlers,
};
