// linuxStealth.js - Linux-specific stealth features for process hiding and window management
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = promisify(exec);

/**
 * Apply Linux-specific stealth measures to hide windows and processes
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyLinuxStealthMeasures(mainWindow) {
    console.log('Applying Linux-specific stealth measures...');
    
    try {
        // Detect desktop environment for tailored approach
        const desktopEnv = detectDesktopEnvironment();
        console.log(`Detected desktop environment: ${desktopEnv}`);
        
        // 1. Hide from taskbar/panel using _NET_WM_STATE_SKIP_TASKBAR
        mainWindow.setSkipTaskbar(true);
        
        // 2. Make window type utility to avoid appearing in task switchers
        if (mainWindow.setWindowType) {
            mainWindow.setWindowType('utility');
        }
        
        // 3. Set window properties to avoid detection
        await setLinuxWindowProperties(mainWindow);
        
        // 4. Apply content protection
        mainWindow.setContentProtection(true);
        
        // 5. Hide from system process lists
        await obfuscateLinuxProcess();
        
        // 6. Apply additional X11/Wayland specific measures
        await applyX11Stealth();
        
        // 7. Apply Wayland-specific measures if needed
        if (isWayland()) {
            await applyWaylandStealth(mainWindow);
        }
        
        // 8. Apply desktop environment specific measures
        await applyDesktopSpecificStealth(mainWindow, desktopEnv);
        
        // 9. Apply advanced screen recording evasion
        await applyScreenRecordingEvasion(mainWindow);
        
        // 10. Apply advanced stealth measures
        await applyAdvancedStealthMeasures(mainWindow);
        
        console.log('Linux stealth measures applied successfully');
    } catch (error) {
        console.warn('Could not apply all Linux stealth measures:', error.message);
    }
}

/**
 * Set Linux-specific window properties to avoid detection
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function setLinuxWindowProperties(mainWindow) {
    try {
        // Set window type to dock/toolbar to avoid task switcher
        const win = mainWindow.getNativeWindowHandle();
        
        // Use xprop to set window properties if available
        const display = process.env.DISPLAY || ':0';
        const windowId = await getWindowId(win, display);
        
        if (windowId) {
            // Hide from taskbar and pager
            await execPromise(`xprop -f _NET_WM_STATE 32a -set _NET_WM_STATE _NET_WM_STATE_SKIP_TASKBAR,_NET_WM_STATE_SKIP_PAGER -id ${windowId}`);
            
            // Set window type to utility/dock
            await execPromise(`xprop -f _NET_WM_WINDOW_TYPE 32a -set _NET_WM_WINDOW_TYPE _NET_WM_WINDOW_TYPE_UTILITY -id ${windowId}`);
            
            // Remove from window list
            await execPromise(`xprop -f _NET_WM_DESKTOP 32c -set _NET_WM_DESKTOP 0xFFFFFFFF -id ${windowId}`);
        }
    } catch (error) {
        console.warn('Could not set Linux window properties:', error.message);
    }
}

/**
 * Get X11 window ID for the Electron window
 * @param {Buffer} winHandle - Native window handle
 * @param {string} display - X11 display identifier
 * @returns {Promise<string|null>} Window ID or null
 */
async function getWindowId(winHandle, display) {
    try {
        // Try to get window ID using xwininfo
        const { stdout } = await execPromise(`xwininfo -root -tree | grep -i electron | head -1 | awk '{print $1}'`);
        const windowId = stdout.trim();
        return windowId || null;
    } catch (error) {
        console.warn('Could not get window ID:', error.message);
        return null;
    }
}

/**
 * Obfuscate Linux process to avoid detection in process lists
 */
async function obfuscateLinuxProcess() {
    try {
        // Get current process ID
        const pid = process.pid;
        
        // Try to change process name using prctl (if available)
        try {
            const procNamePath = `/proc/${pid}/comm`;
            if (fs.existsSync(procNamePath)) {
                // Generate a random system-like process name
                const systemNames = [
                    'systemd', 'kthreadd', 'ksoftirqd', 'migration', 
                    'rcu_gp', 'rcu_par_gp', 'netns', 'kauditd',
                    'khungtaskd', 'oom_reaper', 'writeback', 'kcompactd',
                    'ksmd', 'khugepaged', 'crypto', 'kworker',
                    'kswapd', 'vmstat', 'irq/125-mei_me', 'kthrotld'
                ];
                
                const randomName = systemNames[Math.floor(Math.random() * systemNames.length)];
                
                // Try to write to comm file (may require root)
                fs.writeFile(procNamePath, randomName, (err) => {
                    if (err) {
                        console.debug('Could not change process name via /proc (normal for non-root)');
                    } else {
                        console.log(`Process name changed to: ${randomName}`);
                    }
                });
            }
        } catch (nameChangeError) {
            console.debug('Process name change not possible (normal on most systems)');
        }
        
        // Try to hide from ps command by manipulating environment
        process.title = generateRandomSystemProcessName();
        
    } catch (error) {
        console.warn('Could not obfuscate Linux process:', error.message);
    }
}

/**
 * Apply X11-specific stealth measures
 */
async function applyX11Stealth() {
    try {
        // Check if X11 is running
        if (process.env.DISPLAY) {
            // Try to manipulate window manager properties
            await execPromise('xset s off', { timeout: 1000 }).catch(() => {});
            await execPromise('xset -dpms', { timeout: 1000 }).catch(() => {});
        }
    } catch (error) {
        console.debug('X11 stealth measures not applicable or failed');
    }
}

/**
 * Generate a random system-like process name
 * @returns {string} Random system process name
 */
function generateRandomSystemProcessName() {
    const prefixes = ['systemd-', 'k', 'irq/', 'rcu', 'migration/', 'ksoftirqd/'];
    const suffixes = ['gp', 'par_gp', 'reaper', 'worker', 'thread', 'daemon', 'service'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const number = Math.floor(Math.random() * 256);
    
    return `${prefix}${number}-${suffix}`;
}

/**
 * Check if running on Wayland (more restrictive than X11)
 * @returns {boolean} True if running on Wayland
 */
function isWayland() {
    return process.env.XDG_SESSION_TYPE === 'wayland' || 
           process.env.WAYLAND_DISPLAY !== undefined;
}

/**
 * Apply Wayland-specific stealth measures
 */
async function applyWaylandStealth(mainWindow) {
    if (isWayland()) {
        console.log('Wayland detected - applying Wayland-specific stealth measures');
        try {
            // On Wayland, we have fewer options but can still:
            // 1. Ensure window is not decorated
            mainWindow.setBackgroundColor('#00000000');
            
            // 2. Position window strategically
            const { screen } = require('electron');
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.bounds;
            
            // Position at edge of screen
            mainWindow.setPosition(0, 0);
            mainWindow.setSize(Math.min(300, width), Math.min(200, height));
            
            // 3. Set always on top with lower priority
            mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            
            // 4. Additional Wayland-specific measures
            mainWindow.setFocusable(false);
            mainWindow.setMinimizable(false);
            mainWindow.setMaximizable(false);
            mainWindow.setResizable(false);
            
            // 5. Set window type for better Wayland integration
            if (mainWindow.setWindowType) {
                mainWindow.setWindowType('splash');
            }
        } catch (error) {
            console.warn('Wayland stealth measures failed:', error.message);
        }
    }
}

/**
 * Detect the current desktop environment
 * @returns {string} Desktop environment name
 */
function detectDesktopEnvironment() {
    const desktopEnv = process.env.XDG_CURRENT_DESKTOP || 
                      process.env.DESKTOP_SESSION || 
                      process.env.GDMSESSION || 
                      'unknown';
    
    // Normalize common desktop environment names
    const normalizedEnv = desktopEnv.toLowerCase();
    
    if (normalizedEnv.includes('gnome')) return 'gnome';
    if (normalizedEnv.includes('kde')) return 'kde';
    if (normalizedEnv.includes('xfce')) return 'xfce';
    if (normalizedEnv.includes('mate')) return 'mate';
    if (normalizedEnv.includes('lxde')) return 'lxde';
    if (normalizedEnv.includes('unity')) return 'unity';
    
    return normalizedEnv || 'unknown';
}

/**
 * Apply desktop environment specific stealth measures
 * @param {BrowserWindow} mainWindow - The main Electron window
 * @param {string} desktopEnv - Detected desktop environment
 */
async function applyDesktopSpecificStealth(mainWindow, desktopEnv) {
    try {
        switch (desktopEnv) {
            case 'gnome':
                await applyGNOMESpecificStealth(mainWindow);
                break;
            case 'kde':
                await applyKDESpecificStealth(mainWindow);
                break;
            case 'xfce':
                await applyXFCESpecificStealth(mainWindow);
                break;
            default:
                console.debug(`No specific stealth measures for ${desktopEnv}`);
        }
    } catch (error) {
        console.warn(`Could not apply ${desktopEnv}-specific stealth measures:`, error.message);
    }
}

/**
 * Apply GNOME-specific stealth measures
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyGNOMESpecificStealth(mainWindow) {
    console.log('Applying GNOME-specific stealth measures');
    
    try {
        // Try to set GNOME-specific window properties
        const win = mainWindow.getNativeWindowHandle();
        const display = process.env.DISPLAY || ':0';
        const windowId = await getWindowId(win, display);
        
        if (windowId) {
            // Hide from GNOME overview and activities
            await execPromise(`gsettings set org.gnome.desktop.wm.preferences button-layout ''`).catch(() => {});
            
            // Set window state to be less noticeable
            await execPromise(`xprop -f _GNOME_WM_STATE 32a -set _GNOME_WM_STATE _NET_WM_STATE_BELOW -id ${windowId}`).catch(() => {});
        }
    } catch (error) {
        console.debug('GNOME-specific stealth measures not applicable:', error.message);
    }
}

/**
 * Apply KDE-specific stealth measures
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyKDESpecificStealth(mainWindow) {
    console.log('Applying KDE-specific stealth measures');
    
    try {
        // Try to set KDE-specific window properties
        const win = mainWindow.getNativeWindowHandle();
        const display = process.env.DISPLAY || ':0';
        const windowId = await getWindowId(win, display);
        
        if (windowId) {
            // Set KDE-specific window properties to reduce visibility
            await execPromise(`xprop -f _KDE_NET_WM_WINDOW_TYPE 32a -set _KDE_NET_WM_WINDOW_TYPE _KDE_NET_WM_WINDOW_TYPE_OVERRIDE -id ${windowId}`).catch(() => {});
        }
    } catch (error) {
        console.debug('KDE-specific stealth measures not applicable:', error.message);
    }
}

/**
 * Apply XFCE-specific stealth measures
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyXFCESpecificStealth(mainWindow) {
    console.log('Applying XFCE-specific stealth measures');
    
    try {
        // XFCE generally respects standard X11 properties well
        // Additional measures can be added here if needed
        console.debug('XFCE uses standard X11 properties, no additional measures needed');
    } catch (error) {
        console.debug('XFCE-specific stealth measures not applicable:', error.message);
    }
}

/**
 * Apply advanced screen recording evasion techniques
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyScreenRecordingEvasion(mainWindow) {
    try {
        console.log('Applying advanced screen recording evasion');
        
        // 1. Dynamic window positioning to avoid static detection
        setInterval(() => {
            try {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Subtle position changes to avoid detection patterns
                    const [x, y] = mainWindow.getPosition();
                    const newX = x + (Math.random() * 3 - 1.5); // Small random movements
                    const newY = y + (Math.random() * 3 - 1.5);
                    
                    // Keep within screen bounds
                    const { screen } = require('electron');
                    const primaryDisplay = screen.getPrimaryDisplay();
                    const { width, height } = primaryDisplay.bounds;
                    
                    if (newX >= 0 && newX <= width - 100 && newY >= 0 && newY <= height - 100) {
                        mainWindow.setPosition(Math.floor(newX), Math.floor(newY));
                    }
                }
            } catch (error) {
                console.debug('Dynamic positioning adjustment failed:', error.message);
            }
        }, 30000 + Math.random() * 30000); // Every 30-60 seconds
        
        // 2. Temporarily hide window when recording is detected
        await setupRecordingDetection(mainWindow);
        
    } catch (error) {
        console.warn('Screen recording evasion measures failed:', error.message);
    }
}

/**
 * Setup recording detection to temporarily hide window
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function setupRecordingDetection(mainWindow) {
    try {
        // Check for common recording processes
        const recordingIndicators = [
            'obs', 'ffmpeg', 'recordmydesktop', 'kazam', 'simplescreenrecorder',
            'vlc', 'peek', 'byzanz', 'green-recorder', 'captures'
        ];
        
        // Periodically check for recording processes
        setInterval(async () => {
            try {
                for (const indicator of recordingIndicators) {
                    const { stdout } = await execPromise(`pgrep -f ${indicator}`, { timeout: 2000 }).catch(() => ({ stdout: '' }));
                    if (stdout.trim()) {
                        console.log(`Recording process detected: ${indicator}`);
                        
                        // Temporarily hide window
                        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
                            mainWindow.hide();
                            
                            // Show again after a random delay
                            setTimeout(() => {
                                if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.showInactive();
                                }
                            }, 5000 + Math.random() * 10000); // 5-15 seconds
                        }
                        break;
                    }
                }
            } catch (error) {
                console.debug('Recording detection check failed:', error.message);
            }
        }, 5000); // Check every 5 seconds
        
    } catch (error) {
        console.warn('Recording detection setup failed:', error.message);
    }
}

/**
 * Check if the application has root privileges
 * @returns {boolean} True if running as root
 */
function hasRootPrivileges() {
    try {
        return process.getuid && process.getuid() === 0;
    } catch (error) {
        return false;
    }
}

/**
 * Attempt to elevate privileges for advanced stealth (non-intrusive)
 * Note: This is for demonstration only. In practice, you should not 
 * automatically escalate privileges without user consent.
 */
async function attemptPrivilegeEscalation() {
    if (hasRootPrivileges()) {
        console.log('Already running with root privileges');
        return true;
    }
    
    console.log('Checking for advanced stealth capabilities (root not required)');
    
    // We won't actually escalate privileges automatically, but we can
    // check what advanced features would be available with root
    
    try {
        // Check if pkexec is available for privilege escalation
        await execPromise('which pkexec', { timeout: 1000 });
        console.log('Privilege escalation available via pkexec (user consent required)');
        return false; // Not actually escalated
    } catch (error) {
        console.debug('Privilege escalation not available or not needed');
        return false;
    }
}

/**
 * Apply advanced stealth measures that may require elevated privileges
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyAdvancedStealthMeasures(mainWindow) {
    const hasRoot = hasRootPrivileges();
    console.log(`Running with root privileges: ${hasRoot}`);
    
    try {
        // Apply advanced measures based on available privileges
        if (hasRoot) {
            await applyRootLevelStealth(mainWindow);
        } else {
            await applyUserLevelAdvancedStealth(mainWindow);
        }
    } catch (error) {
        console.warn('Advanced stealth measures failed:', error.message);
    }
}

/**
 * Apply root-level stealth measures
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyRootLevelStealth(mainWindow) {
    console.log('Applying root-level stealth measures');
    
    try {
        // 1. Advanced process name obfuscation
        const pid = process.pid;
        const procNamePath = `/proc/${pid}/comm`;
        
        if (fs.existsSync(procNamePath)) {
            // Use more convincing system process names
            const systemNames = [
                'kthreadd', 'ksoftirqd/0', 'kworker/0:0', 'kworker/0:0H',
                'migration/0', 'rcu_gp', 'rcu_par_gp', 'netns', 'kauditd',
                'khungtaskd', 'oom_reaper', 'writeback', 'kcompactd0',
                'ksmd', 'khugepaged', 'crypto', 'kworker/u4:0', 'kintegrityd',
                'kblockd', 'ata_sff', 'md', 'devfreq_wq', 'watchdogd'
            ];
            
            const randomName = systemNames[Math.floor(Math.random() * systemNames.length)];
            
            // Write to comm file with root privileges
            fs.writeFileSync(procNamePath, randomName);
            console.log(`Process name changed to system process: ${randomName}`);
            
            // Also update /proc/pid/cmdline to match
            const cmdLinePath = `/proc/${pid}/cmdline`;
            if (fs.existsSync(cmdLinePath)) {
                fs.writeFileSync(cmdLinePath, randomName.replace(/-/g, ' '));
            }
        }
        
        // 2. Network-level obfuscation (if needed in the future)
        console.log('Root-level network obfuscation available');
        
    } catch (error) {
        console.warn('Root-level stealth measures failed:', error.message);
    }
}

/**
 * Apply user-level advanced stealth measures
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
async function applyUserLevelAdvancedStealth(mainWindow) {
    console.log('Applying user-level advanced stealth measures');
    
    try {
        // 1. Enhanced environment variable obfuscation
        const fakeEnvVars = {
            'USER': 'root',
            'HOME': '/root',
            'SHELL': '/bin/bash',
            'LOGNAME': 'root',
            'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
        };
        
        // We can't actually change these, but we can log what would be ideal
        console.debug('Ideal environment for stealth:', fakeEnvVars);
        
        // 2. Enhanced process title obfuscation
        const systemProcessTitles = [
            '[kthreadd]', '[ksoftirqd/0]', '[kworker/0:0]', '[kworker/0:0H]',
            '[migration/0]', '[rcu_gp]', '[rcu_par_gp]', '[netns]', '[kauditd]',
            '[khungtaskd]', '[oom_reaper]', '[writeback]', '[kcompactd0]'
        ];
        
        const randomTitle = systemProcessTitles[Math.floor(Math.random() * systemProcessTitles.length)];
        process.title = randomTitle;
        console.log(`Process title set to: ${randomTitle}`);
        
    } catch (error) {
        console.warn('User-level advanced stealth measures failed:', error.message);
    }
}

module.exports = {
    applyLinuxStealthMeasures,
    applyWaylandStealth,
    isWayland,
    obfuscateLinuxProcess,
    detectDesktopEnvironment,
    hasRootPrivileges,
    attemptPrivilegeEscalation
};