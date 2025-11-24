const { BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function ensureReportDirectory() {
    const homeDir = os.homedir();
    
    // Try common download locations for different platforms
    const possibleDirs = [
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'tmp'),
        path.join(os.tmpdir(), 'eon-interviews')
    ];
    
    for (const dir of possibleDirs) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Test write permission
            const testFile = path.join(dir, '.eon-test-' + Date.now());
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            
            console.log('[PDF] Using directory:', dir);
            return dir;
        } catch (err) {
            console.log('[PDF] Directory not accessible:', dir, err.message);
            continue;
        }
    }
    
    // Last resort: temp directory
    const fallbackDir = path.join(os.tmpdir(), 'eon-interviews');
    if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
    }
    console.log('[PDF] Using fallback directory:', fallbackDir);
    return fallbackDir;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildHtml(session) {
    const timestamp = session && typeof session.timestamp === 'number' ? session.timestamp : Date.now();
    const dateObj = new Date(timestamp);
    const dateString = dateObj.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
    const timeString = dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    });
    const turns = Array.isArray(session && session.conversationHistory) ? session.conversationHistory : [];
    const blocks = turns
        .map((turn, index) => {
            const transcription = escapeHtml(turn && turn.transcription ? turn.transcription : '');
            const aiResponse = escapeHtml(turn && turn.ai_response ? turn.ai_response : '');
            if (!transcription && !aiResponse) {
                return '';
            }
            const questionHtml = transcription.replace(/\n/g, '<br/>');
            const answerHtml = aiResponse.replace(/\n/g, '<br/>');
            return (
                '<div class="qa-block">' +
                '<div class="qa-title">Question ' +
                (index + 1) +
                '</div>' +
                '<div class="qa-question">' +
                questionHtml +
                '</div>' +
                '<div class="qa-answer-label">Suggested Answer</div>' +
                '<div class="qa-answer">' +
                answerHtml +
                '</div>' +
                '</div>'
            );
        })
        .filter(Boolean)
        .join('');
    const bodyContent = blocks || '<p class="empty">No completed interview questions available.</p>';
    const html =
        '<!doctype html>' +
        '<html>' +
        '<head>' +
        '<meta charset="utf-8" />' +
        '<title>Interview Report</title>' +
        '<style>' +
        'html,body{margin:0;padding:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#ffffff;color:#111827;}' +
        '.page{box-sizing:border-box;min-height:100vh;border:3px solid #0f172a;border-radius:8px;padding:32px 40px;position:relative;overflow:hidden;}' +
        '.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;letter-spacing:6px;color:rgba(15,23,42,0.05);pointer-events:none;white-space:nowrap;font-weight:700;}' +
        '.header-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}' +
        '.brand-left{display:flex;align-items:center;gap:10px;}' +
        '.brand-logo{width:32px;height:32px;border-radius:8px;object-fit:cover;box-shadow:0 0 0 1px rgba(15,23,42,0.1);}' +
        '.brand-title{margin:0;font-size:28px;letter-spacing:3px;}' +
        '.brand-title span{font-weight:700;}' +
        '.brand-title .c1{color:#4285F4;}' +
        '.brand-title .c2{color:#EA4335;}' +
        '.brand-title .c3{color:#FBBC05;}' +
        '.brand-title .c4{color:#34A853;}' +
        '.brand-title .c5{color:#4285F4;}' +
        '.brand-title .c6{color:#EA4335;}' +
        '.brand-title .c7{color:#FBBC05;}' +
        '.brand-title .c8{color:#34A853;}' +
        '.session-meta{text-align:right;font-size:12px;color:#4b5563;}' +
        '.session-meta-label{font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}' +
        '.session-meta-value{font-size:13px;}' +
        '.section-title{font-size:16px;font-weight:600;margin:12px 0 8px 0;padding-bottom:4px;border-bottom:1px solid #e5e7eb;}' +
        '.qa-block{margin-top:16px;padding:12px 16px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;page-break-inside:avoid;}' +
        '.qa-title{font-size:13px;font-weight:600;color:#111827;margin-bottom:6px;}' +
        '.qa-question{font-size:12px;color:#111827;margin-bottom:8px;}' +
        '.qa-answer-label{font-size:12px;font-weight:600;color:#1f2933;margin-bottom:4px;}' +
        '.qa-answer{font-size:12px;color:#111827;}' +
        '.empty{font-size:13px;color:#6b7280;margin-top:24px;}' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<div class="page">' +
        '<div class="watermark">EON AI</div>' +
        '<div class="header-row">' +
        '<div class="brand-left">' +
        '<img class="brand-logo" src="file://' +
        path.join(__dirname, '..', 'assets', 'old', '0.3', 'favicon.png').replace(/\\/g, '/') +
        '" alt="EON" />' +
        '<h1 class="brand-title">' +
        '<span class="c1">E</span>' +
        '<span class="c2">N</span>' +
        '<span class="c3">O</span>' +
        '<span class="c4">R</span>' +
        '<span class="c5">A</span>' +
        ' ' +
        '<span class="c6">THE</span>' +
        ' ' +
        '<span class="c7">E</span>' +
        '<span class="c8">O</span>' +
        '<span class="c1">N</span>' +
        '</h1>' +
        '</div>' +
        '<div class="session-meta">' +
        '<div class="session-meta-label">Interview Details</div>' +
        '<div class="session-meta-value">Date: ' +
        dateString +
        '</div>' +
        '<div class="session-meta-value">Time: ' +
        timeString +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="section-title">Interview Questions and Suggested Answers</div>' +
        bodyContent +
        '</div>' +
        '</body>' +
        '</html>';
    return html;
}

async function generateInterviewPdf(session) {
    let win = null;
    const logToRenderer = (message, type = 'log') => {
        console.log(message);
        // Forward to renderer if possible
        if (global.mainWindow && global.mainWindow.webContents) {
            global.mainWindow.webContents.send('pdf-log', { message, type, timestamp: Date.now() });
        }
    };
    
    try {
        logToRenderer('[PDF] Starting PDF generation for session: ' + (session && session.sessionId));
        
        const html = buildHtml(session || {});
        logToRenderer('[PDF] HTML built, length: ' + html.length);
        
        const dir = ensureReportDirectory();
        logToRenderer('[PDF] Report directory: ' + dir);
        
        if (!fs.existsSync(dir)) {
            logToRenderer('[PDF] Directory does not exist and could not be created', 'error');
            return { success: false, error: 'Directory not accessible' };
        }
        
        win = new BrowserWindow({
            width: 900,
            height: 1200,
            show: false,
            webPreferences: {
                offscreen: true,
                sandbox: false,
            },
        });
        logToRenderer('[PDF] BrowserWindow created');
        
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        logToRenderer('[PDF] HTML loaded into BrowserWindow');
        
        const pdfBuffer = await win.webContents.printToPDF({ 
            printBackground: true, 
            marginsType: 1, 
            pageSize: 'A4' 
        });
        logToRenderer('[PDF] PDF buffer generated, size: ' + pdfBuffer.length + ' bytes');
        
        const baseName = session && session.sessionId ? String(session.sessionId) : String(Date.now());
        const filePath = path.join(dir, 'EON_Interview_' + baseName + '.pdf');
        logToRenderer('[PDF] Writing to file: ' + filePath);
        
        fs.writeFileSync(filePath, pdfBuffer);
        logToRenderer('[PDF] File written successfully');
        
        if (!fs.existsSync(filePath)) {
            logToRenderer('[PDF] File was not created at: ' + filePath, 'error');
            return { success: false, error: 'File was not created' };
        }
        
        const fileSize = fs.statSync(filePath).size;
        logToRenderer('[PDF] File verified, size: ' + fileSize + ' bytes');
        
        await shell.openPath(filePath);
        logToRenderer('[PDF] PDF opened in viewer');
        
        win.destroy();
        logToRenderer('[PDF] Generation complete, success');
        
        return { success: true, path: filePath };
    } catch (error) {
        logToRenderer('[PDF] Error during PDF generation: ' + error.message, 'error');
        logToRenderer('[PDF] Error stack: ' + (error.stack || 'No stack available'), 'error');
        if (win) {
            try {
                win.destroy();
            } catch (e) {
                logToRenderer('[PDF] Error destroying window: ' + e.message, 'error');
            }
        }
        return { success: false, error: error.message || 'Unknown error' };
    }
}

module.exports = {
    generateInterviewPdf,
};
