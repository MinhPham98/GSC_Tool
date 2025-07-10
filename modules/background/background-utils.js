// ===== BACKGROUND UTILITIES - Logging và Helper Functions =====

// ========== ENHANCED LOGGING SYSTEM ==========
let logStartTime = Date.now();
let logCounter = 0;
let serviceWorkerStartTime = Date.now();

// Hàm log cải tiến với timestamp và structured data serialization
function log(level, message, ...args) {
    logCounter++;
    const now = Date.now();
    const uptime = Math.round((now - serviceWorkerStartTime) / 1000);
    const timestamp = new Date(now).toLocaleTimeString();
    
    const prefix = `[${timestamp}] [SW:${uptime}s] [${logCounter}] [${level}]`;
    
    // Serialize objects to JSON for better visibility
    const serializedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return arg;
    });
    
    const logMessage = serializedArgs.length > 0 
        ? `${message} ${serializedArgs.join(' ')}`
        : message;
    
    switch(level) {
        case 'INFO':
            console.log(`🔵 ${prefix} ${logMessage}`);
            break;
        case 'WARN':
            console.warn(`🟡 ${prefix} ${logMessage}`);
            break;
        case 'ERROR':
            console.error(`🔴 ${prefix} ${logMessage}`);
            break;
        case 'DEBUG':
            console.log(`🔧 ${prefix} ${logMessage}`);
            break;
        case 'QUEUE':
            console.log(`🚀 ${prefix} ${logMessage}`);
            break;
        case 'PACK':
            console.log(`📦 ${prefix} ${logMessage}`);
            break;
        default:
            console.log(`⚪ ${prefix} ${logMessage}`);
    }
}

// Log khởi động service worker
log('INFO', '🚀 GSC Tool Background Script Initialized (Modular)', {
    startTime: new Date(serviceWorkerStartTime).toLocaleString(),
    version: chrome.runtime.getManifest().version
});

// ========== UTILITY FUNCTIONS ==========

/**
 * Delay function for async operations
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe storage getter with error handling
 */
async function safeStorageGet(keys, storageType = 'local') {
    try {
        const storage = storageType === 'local' ? chrome.storage.local : chrome.storage.sync;
        return await storage.get(keys);
    } catch (error) {
        log('ERROR', `❌ Storage get error for keys:`, { keys, error: error.message });
        return {};
    }
}

/**
 * Safe storage setter with error handling
 */
async function safeStorageSet(data, storageType = 'local') {
    try {
        const storage = storageType === 'local' ? chrome.storage.local : chrome.storage.sync;
        await storage.set(data);
        log('DEBUG', `💾 Storage set successful:`, { keys: Object.keys(data), storageType });
        return true;
    } catch (error) {
        log('ERROR', `❌ Storage set error:`, { data: Object.keys(data), error: error.message });
        return false;
    }
}

/**
 * Check if a tab exists and is valid
 */
async function isTabValid(tabId) {
    if (!tabId) return false;
    try {
        const tab = await chrome.tabs.get(tabId);
        return tab && tab.url && tab.url.includes('search.google.com/search-console/removals');
    } catch (error) {
        log('WARN', `⚠️ Tab ${tabId} no longer exists:`, error.message);
        return false;
    }
}

/**
 * Execute script safely with error handling
 */
async function safeExecuteScript(tabId, files) {
    try {
        if (!(await isTabValid(tabId))) {
            log('ERROR', `❌ Cannot execute script - invalid tab: ${tabId}`);
            return false;
        }
        
        await chrome.scripting.executeScript({
            target: { tabId },
            files
        });
        
        log('DEBUG', `✅ Script executed successfully on tab ${tabId}:`, files);
        return true;
    } catch (error) {
        log('ERROR', `❌ Script execution failed on tab ${tabId}:`, {
            files,
            error: error.message
        });
        return false;
    }
}

// ========== LOG MANAGEMENT FUNCTIONS ==========
/**
 * Clear logs manually
 */
function clearLogs() {
    console.clear();
    logCounter = 0;
    serviceWorkerStartTime = Date.now();
    log('INFO', '🧹 Logs cleared manually');
}

/**
 * Get current background state for debugging
 */
function getBackgroundState() {
    return {
        serviceWorkerUptime: Math.round((Date.now() - serviceWorkerStartTime) / 1000),
        logCounter,
        startTime: new Date(serviceWorkerStartTime).toLocaleString(),
        version: chrome.runtime.getManifest().version
    };
}

// Export functions globally for other modules
self.backgroundUtils = {
    log,
    delay,
    safeStorageGet,
    safeStorageSet,
    isTabValid,
    safeExecuteScript,
    clearLogs,
    getBackgroundState,
    serviceWorkerStartTime,
    logStartTime
};

// For backward compatibility, export log function globally
self.log = log;
