// ===== GSC TOOL POPUP - MODULAR ARCHITECTURE =====
// Main entry point for the popup interface
// This file coordinates all popup modules and maintains backward compatibility

// Note: popupLog and popupStartTime are now provided by popup-utils.js module
// Access them via window.popupLog and window.popupStartTime

console.log('🏗️ GSC Tool Popup - Main Entry Point Loading...');

// Wait for popup-utils.js to load, then use its logging
setTimeout(() => {
    if (window.popupLog) {
        window.popupLog('INFO', '🚀 GSC Tool Popup Main Entry Initialized (Modular)', {
            url: window.location.href,
            architecture: 'modular'
        });
    }
}, 10);

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
    window.popupLog('INFO', '📄 DOM loaded, waiting for modules to initialize...');
    
    // Function to check module availability
    function checkModules() {
        const modulesLoaded = {
            popupUtils: typeof window.PopupUtils !== 'undefined',
            uiComponents: typeof window.UIComponents !== 'undefined', 
            progressTracker: typeof window.ProgressTracker !== 'undefined',
            queueManager: typeof window.QueueManager !== 'undefined',
            packManager: typeof window.PackManager !== 'undefined',
            popupCore: typeof PopupCore !== 'undefined'
        };
        
        window.popupLog('DEBUG', '📊 Module loading status:', modulesLoaded);
        
        // Additional debug info
        window.popupLog('DEBUG', '🔍 Available window objects:', {
            PopupUtils: !!window.PopupUtils,
            UIComponents: !!window.UIComponents,
            ProgressTracker: !!window.ProgressTracker,
            QueueManager: !!window.QueueManager,
            PackManager: !!window.PackManager,
            PopupCore: !!window.PopupCore
        });
        
        const allLoaded = Object.values(modulesLoaded).every(loaded => loaded);
        
        if (allLoaded) {
            window.popupLog('INFO', '✅ All modules loaded successfully');
            
            // Initialize the popup core if not already done
            if (!window.popupCore && window.PopupCore) {
                window.popupCore = new PopupCore();
                window.popupLog('INFO', '🎯 PopupCore initialized from main entry');
            }
            return true;
        } else {
            const missingModules = Object.entries(modulesLoaded)
                .filter(([name, loaded]) => !loaded)
                .map(([name]) => name);
            
            window.popupLog('WARN', '⚠️ Missing modules:', missingModules);
            return false;
        }
    }
    
    // Initial check with a small delay to allow scripts to execute
    setTimeout(() => {
        if (!checkModules()) {
            // Retry after a longer delay
            setTimeout(() => {
                if (!checkModules()) {
                    window.popupLog('ERROR', '❌ Modules failed to load after retries, continuing with basic functionality');
                }
            }, 1000);
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
    window.popupLog('ERROR', '❌ Global popup error:', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error
    });
});

window.addEventListener('unhandledrejection', (event) => {
    window.popupLog('ERROR', '❌ Unhandled promise rejection:', {
        reason: event.reason
    });
});

console.log('🏗️ Popup main entry setup complete, modules loading...');
