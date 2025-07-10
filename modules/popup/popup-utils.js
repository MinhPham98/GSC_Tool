// ========== POPUP UTILITIES MODULE ==========
// Common utilities and logging for popup

// ========== Enhanced Popup Logging ==========
let popupStartTime = Date.now();
let popupLogCounter = 0;

// Hàm log cho popup với timestamp và counter
function popupLog(level, message, ...args) {
    popupLogCounter++;
    const now = Date.now();
    const uptime = Math.round((now - popupStartTime) / 1000);
    const timestamp = new Date(now).toLocaleTimeString();
    
    const prefix = `[${timestamp}] [POPUP:${uptime}s] [${popupLogCounter}] [${level}]`;
    
    switch(level) {
        case 'INFO':
            console.log(`🔵 ${prefix}`, message, ...args);
            break;
        case 'WARN':
            console.warn(`🟡 ${prefix}`, message, ...args);
            break;
        case 'ERROR':
            console.error(`🔴 ${prefix}`, message, ...args);
            break;
        case 'DEBUG':
            console.log(`🔧 ${prefix}`, message, ...args);
            break;
        case 'UI':
            console.log(`🎨 ${prefix}`, message, ...args);
            break;
        default:
            console.log(`⚪ ${prefix}`, message, ...args);
    }
}

// ========== Utility Functions ==========

function splitIntoChunks(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

function insertElement(type, message, parentClass) {
    const parentElement = document.querySelector(parentClass);
    const element = document.createElement(type);
    element.textContent = message;
    parentElement.appendChild(element);
}

function isValidUrlAdvanced(url) {
    try {
        // Remove any leading/trailing whitespace
        const trimmedUrl = url.trim();
        
        // Check if it's a valid URL
        new URL(trimmedUrl);
        
        // Additional checks for specific patterns
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
            return true;
        }
        
        // Allow domain.com format (add https:// prefix)
        if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedUrl)) {
            return true;
        }
        
        return false;
    } catch (e) {
        return false;
    }
}

async function parseLinksFromText(text) {
    const lines = text.split('\n');
    const urls = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && isValidUrlAdvanced(trimmedLine)) {
            // Ensure URL has protocol
            let url = trimmedLine;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            urls.push(url);
        }
    }
    
    popupLog('DEBUG', `Parsed ${urls.length} valid URLs from text`, {
        totalLines: lines.length,
        validUrls: urls.length,
        firstFewUrls: urls.slice(0, 3)
    });
    
    return urls;
}

// ========== DOM Helper Functions ==========

function showElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.display = 'block';
    }
}

function hideElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.display = 'none';
    }
}

function updateTextContent(selector, text) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = text;
    }
}

function updateInnerHTML(selector, html) {
    const element = document.querySelector(selector);
    if (element) {
        element.innerHTML = html;
    }
}

// ========== Reset Functions ==========

function resetInfoTableAndCache() {
    popupLog('INFO', '🔄 Resetting info table and cache');
    
    // Reset table display
    const tableDiv = document.querySelector('.infoTable');
    if (tableDiv) {
        tableDiv.style.display = 'none';
        tableDiv.innerHTML = '';
    }
    
    // Clear results cache
    chrome.storage.local.remove(['resultLinks'], () => {
        popupLog('DEBUG', 'Cleared resultLinks cache');
    });
    
    // Clear other relevant caches
    chrome.storage.local.remove(['queueResults'], () => {
        popupLog('DEBUG', 'Cleared queueResults cache');
    });
    
    // Reset UI elements
    updateTextContent('#urlsProcessed', '0');
    updateTextContent('#packInfo', '');
    updateTextContent('#speedInfo', '');
    updateTextContent('#etaInfo', '');
    
    popupLog('UI', 'Info table and cache reset completed');
}

// Log popup initialization
popupLog('INFO', '🚀 GSC Tool Popup Utilities Initialized', {
    startTime: new Date(popupStartTime).toLocaleString(),
    url: window.location.href
});

// ========== Export Functions ==========
window.PopupUtils = {
    log: popupLog,
    splitIntoChunks,
    insertElement,
    isValidUrlAdvanced,
    parseLinksFromText,
    showElement,
    hideElement,
    updateTextContent,
    updateInnerHTML,
    resetInfoTableAndCache,
    get startTime() { return popupStartTime; },
    get logCounter() { return popupLogCounter; }
};
