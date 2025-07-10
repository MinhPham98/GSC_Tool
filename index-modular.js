// ===== GSC TOOL POPUP - MODULAR ARCHITECTURE =====
// Main entry point for the popup interface
// This file coordinates all popup modules and maintains backward compatibility

// Initialize popup logging as soon as possible
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

// Log khởi động popup
popupLog('INFO', '🚀 GSC Tool Popup Initialized (Modular)', {
    startTime: new Date(popupStartTime).toLocaleString(),
    url: window.location.href,
    architecture: 'modular'
});

// Export popupLog globally for all modules to use
window.popupLog = popupLog;
window.popupStartTime = popupStartTime;

// ===== GLOBAL VARIABLES FOR BACKWARD COMPATIBILITY =====
// These maintain compatibility with existing code while modules are loaded

let temporaryRemoval = true;
let chunkSize = parseInt(document.getElementById('chunkSize')?.value || 10, 10);
let urlChunks = [];
let currentPack = 0;
let autoRun = false;
let isPaused = false;
let sentPackCount = 0;
let sentUrlCount = 0;
let isFileInput = false;

// Pack mode timeout tracking
let packTimeout = null;

// Background queue variables
let backgroundQueueActive = false;
let queueUpdateInterval = null;

// DOM elements - cache commonly used elements
const chunkSizeInput = document.getElementById('chunkSize');
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");

// Background queue elements
const backgroundModeCheckbox = document.getElementById('backgroundModeCheckbox');
const queueStatusDiv = document.getElementById('queue-status');
const pauseQueueBtn = document.getElementById('pauseQueueBtn');
const resumeQueueBtn = document.getElementById('resumeQueueBtn');
const resumeStoppedBtn = document.getElementById('resumeStoppedBtn');
const stopQueueBtn = document.getElementById('stopQueueBtn');
const downloadQueueBtn = document.getElementById('downloadQueueBtn');
const resetBtn = document.getElementById('resetBtn');
const queueProgressFill = document.getElementById('queueProgressFill');
const queueProgress = document.getElementById('queueProgress');
const queueStatus = document.getElementById('queueStatus');

// Info table elements
const packInfoTable = document.querySelector('.info-table-container');
const queueInfoTable = document.querySelector('.queue-info-table-container');
const queueTotalUrls = document.querySelector('.queue-total-urls');
const queueSuccessUrls = document.querySelector('.queue-success-urls');
const queueErrorUrls = document.querySelector('.queue-error-urls');

// Export globals for module access
window.temporaryRemoval = temporaryRemoval;
window.chunkSize = chunkSize;
window.urlChunks = urlChunks;
window.currentPack = currentPack;
window.autoRun = autoRun;
window.isPaused = isPaused;
window.sentPackCount = sentPackCount;
window.sentUrlCount = sentUrlCount;
window.isFileInput = isFileInput;
window.packTimeout = packTimeout;
window.backgroundQueueActive = backgroundQueueActive;
window.queueUpdateInterval = queueUpdateInterval;

// DOM element references
window.chunkSizeInput = chunkSizeInput;
window.startBtn = startBtn;
window.pauseBtn = pauseBtn;
window.stopBtn = stopBtn;
window.backgroundModeCheckbox = backgroundModeCheckbox;
window.queueStatusDiv = queueStatusDiv;
window.pauseQueueBtn = pauseQueueBtn;
window.resumeQueueBtn = resumeQueueBtn;
window.resumeStoppedBtn = resumeStoppedBtn;
window.stopQueueBtn = stopQueueBtn;
window.downloadQueueBtn = downloadQueueBtn;
window.resetBtn = resetBtn;
window.queueProgressFill = queueProgressFill;
window.queueProgress = queueProgress;
window.queueStatus = queueStatus;
window.packInfoTable = packInfoTable;
window.queueInfoTable = queueInfoTable;
window.queueTotalUrls = queueTotalUrls;
window.queueSuccessUrls = queueSuccessUrls;
window.queueErrorUrls = queueErrorUrls;

// Ensure download queue button is hidden by default
if (downloadQueueBtn) {
    downloadQueueBtn.classList.add('hidden');
}

// ===== MODULE COORDINATION =====
// This section ensures all modules are properly loaded and initialized

document.addEventListener('DOMContentLoaded', () => {
    popupLog('INFO', '📄 DOM loaded, waiting for modules to initialize...');
    
    // Give modules time to load and initialize
    setTimeout(() => {
        popupLog('INFO', '🔧 Checking module availability...');
        
        // Check if all required modules are loaded
        const modulesLoaded = {
            popupUtils: typeof parseLinksFromText !== 'undefined',
            uiComponents: typeof showMessage !== 'undefined',
            progressTracker: typeof updatePackDisplay !== 'undefined',
            queueManager: typeof startBackgroundQueue !== 'undefined',
            packManager: typeof startPackAutoRun !== 'undefined',
            popupCore: typeof PopupCore !== 'undefined'
        };
        
        popupLog('INFO', '📊 Module loading status:', modulesLoaded);
        
        const allLoaded = Object.values(modulesLoaded).every(loaded => loaded);
        
        if (allLoaded) {
            popupLog('INFO', '✅ All modules loaded successfully');
            
            // Initialize the popup core if not already done
            if (!window.popupCore && window.PopupCore) {
                window.popupCore = new PopupCore();
                popupLog('INFO', '🎯 PopupCore initialized from main entry');
            }
        } else {
            popupLog('WARN', '⚠️ Some modules not loaded yet, retrying...', modulesLoaded);
            
            // Retry after a short delay
            setTimeout(() => {
                if (typeof PopupCore !== 'undefined' && !window.popupCore) {
                    window.popupCore = new PopupCore();
                    popupLog('INFO', '🎯 PopupCore initialized after retry');
                }
            }, 500);
        }
        
    }, 100);
});

// ===== LEGACY SUPPORT FUNCTIONS =====
// These functions maintain backward compatibility

/**
 * Split array into chunks (legacy support)
 */
function splitIntoChunks(array, chunkSize) {
    const results = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        results.push(array.slice(i, i + chunkSize));
    }
    return results;
}

// Export for global access
window.splitIntoChunks = splitIntoChunks;

// ===== ERROR HANDLING =====
// Global error handling for the popup

window.addEventListener('error', (event) => {
    popupLog('ERROR', '❌ Global popup error:', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error
    });
});

window.addEventListener('unhandledrejection', (event) => {
    popupLog('ERROR', '❌ Unhandled promise rejection:', {
        reason: event.reason
    });
});

popupLog('INFO', '🏗️ Popup main entry setup complete, modules loading...');
