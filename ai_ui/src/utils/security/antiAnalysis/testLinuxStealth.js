// testLinuxStealth.js - Test script for Linux stealth features

const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Test Linux stealth features
 */
async function testLinuxStealth() {
    console.log('Testing Linux stealth features...\n');
    
    // Test 1: Check if running on Linux
    console.log('1. Platform check:');
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Is Linux: ${process.platform === 'linux'}\n`);
    
    if (process.platform !== 'linux') {
        console.log('   Skipping Linux-specific tests on non-Linux platform\n');
        return;
    }
    
    // Test 2: Check DISPLAY environment variable
    console.log('2. Display environment:');
    console.log(`   DISPLAY: ${process.env.DISPLAY || 'Not set'}`);
    console.log(`   XDG_SESSION_TYPE: ${process.env.XDG_SESSION_TYPE || 'Not set'}\n`);
    
    // Test 3: Check for X11 tools
    try {
        await execPromise('which xprop', { timeout: 2000 });
        console.log('3. X11 tools: Available\n');
    } catch (error) {
        console.log('3. X11 tools: Not available or not in PATH\n');
    }
    
    // Test 4: Check window manager
    try {
        const { stdout } = await execPromise('echo $XDG_CURRENT_DESKTOP', { timeout: 2000 });
        console.log('4. Desktop environment:');
        console.log(`   Current DE: ${stdout.trim() || 'Unknown'}\n`);
    } catch (error) {
        console.log('4. Desktop environment: Could not determine\n');
    }
    
    // Test 5: Check process name
    console.log('5. Process information:');
    console.log(`   Process title: ${process.title}`);
    console.log(`   Process PID: ${process.pid}\n`);
    
    // Test 6: Check for common process monitoring tools
    const monitoringTools = ['ps', 'top', 'htop', 'pstree'];
    console.log('6. System monitoring tools availability:');
    
    for (const tool of monitoringTools) {
        try {
            await execPromise(`which ${tool}`, { timeout: 1000 });
            console.log(`   ${tool}: Available`);
        } catch (error) {
            console.log(`   ${tool}: Not available`);
        }
    }
    
    console.log('\nLinux stealth testing completed.');
}

/**
 * Simulate process obfuscation test
 */
async function testProcessObfuscation() {
    console.log('\n--- Process Obfuscation Test ---');
    
    // This would normally be called from processRandomizer.js
    // For testing purposes, we'll simulate the Linux process obfuscation
    
    const systemNames = [
        'systemd', 'kthreadd', 'ksoftirqd', 'migration', 
        'rcu_gp', 'rcu_par_gp', 'netns', 'kauditd',
        'khungtaskd', 'oom_reaper', 'writeback', 'kcompactd',
        'ksmd', 'khugepaged', 'crypto', 'kworker'
    ];
    
    const randomName = systemNames[Math.floor(Math.random() * systemNames.length)];
    console.log(`Simulated process name change to: ${randomName}`);
    
    // Test generating Linux-specific process names
    const linuxPrefixes = ['systemd-', 'k', 'irq/', 'rcu', 'migration/'];
    const linuxSuffixes = ['gp', 'par_gp', 'reaper', 'worker', 'thread'];
    
    const prefix = linuxPrefixes[Math.floor(Math.random() * linuxPrefixes.length)];
    const suffix = linuxSuffixes[Math.floor(Math.random() * linuxSuffixes.length)];
    const number = Math.floor(Math.random() * 256);
    
    const generatedName = `${prefix}${number}-${suffix}`;
    console.log(`Generated Linux process name: ${generatedName}`);
}

// Run tests if script is executed directly
if (require.main === module) {
    testLinuxStealth()
        .then(() => testProcessObfuscation())
        .then(() => {
            console.log('\nAll tests completed successfully.');
        })
        .catch((error) => {
            console.error('Test failed:', error.message);
        });
}

module.exports = {
    testLinuxStealth,
    testProcessObfuscation
};