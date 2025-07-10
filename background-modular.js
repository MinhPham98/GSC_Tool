// ===== GSC TOOL BACKGROUND - MODULAR ARCHITECTURE =====
// Main entry point for the background service worker
// This file coordinates all background modules and maintains backward compatibility

// Import order is important - dependencies must be loaded first
importScripts(
    'modules/background/background-utils.js',
    'modules/background/storage-manager.js',
    'modules/background/queue-controller.js',
    'modules/background/pack-controller.js',
    'modules/background/message-handler.js',
    'modules/background/background-core.js'
);

// Log the successful initialization
console.log('🏗️ GSC Tool Background Script - Modular Architecture Loaded');
console.log('📊 Service Worker Status:', {
    version: chrome.runtime.getManifest().version,
    timestamp: new Date().toISOString(),
    architecture: 'modular',
    modules: [
        'background-utils.js',
        'storage-manager.js', 
        'queue-controller.js',
        'pack-controller.js',
        'message-handler.js',
        'background-core.js'
    ]
});

// ===== LEGACY SUPPORT VARIABLES =====
// These maintain compatibility with existing code

let urlChunks = [];
let currentPack = 0;
let autoRun = false;
let isPaused = false;
let tabId = null;

// Background queue system variables
let urlQueue = [];
let currentUrlIndex = 0;
let backgroundMode = false;
let queueProcessing = false;
let queuePaused = false;
let targetTabId = null;
let processingInterval = null;

// Export legacy variables for compatibility
self.urlChunks = urlChunks;
self.currentPack = currentPack;
self.autoRun = autoRun;
self.isPaused = isPaused;
self.tabId = tabId;
self.urlQueue = urlQueue;
self.currentUrlIndex = currentUrlIndex;
self.backgroundMode = backgroundMode;
self.queueProcessing = queueProcessing;
self.queuePaused = queuePaused;
self.targetTabId = targetTabId;
self.processingInterval = processingInterval;

// ===== LEGACY SUPPORT FUNCTIONS =====
// These functions provide backward compatibility

/**
 * Legacy pack sending function
 */
async function sendPack() {
    if (self.packController) {
        return await self.packController.sendPack();
    }
    console.warn('⚠️ PackController not available, using legacy function');
    return false;
}

/**
 * Legacy queue start function  
 */
async function startQueueProcessing() {
    if (self.queueController) {
        return await self.queueController.startQueueProcessing();
    }
    console.warn('⚠️ QueueController not available, using legacy function');
    return false;
}

/**
 * Legacy process next URL function
 */
async function processNextUrl() {
    if (self.queueController) {
        return await self.queueController.processNextUrl();
    }
    console.warn('⚠️ QueueController not available, using legacy function');
    return false;
}

// Export legacy functions globally
self.sendPack = sendPack;
self.startQueueProcessing = startQueueProcessing;
self.processNextUrl = processNextUrl;

// ===== MODULE VERIFICATION =====
// Verify all modules loaded correctly

function verifyModules() {
    const modules = {
        backgroundUtils: typeof self.backgroundUtils !== 'undefined',
        storageManager: typeof self.storageManager !== 'undefined', 
        queueController: typeof self.queueController !== 'undefined',
        packController: typeof self.packController !== 'undefined',
        messageHandler: typeof self.messageHandler !== 'undefined',
        backgroundCore: typeof self.BackgroundCore !== 'undefined'
    };

    const allLoaded = Object.values(modules).every(loaded => loaded);
    
    if (allLoaded) {
        console.log('✅ All background modules loaded successfully:', modules);
    } else {
        console.error('❌ Some background modules failed to load:', modules);
    }

    return { allLoaded, modules };
}

// Verify modules after a short delay to ensure imports complete
setTimeout(() => {
    const verification = verifyModules();
    
    if (verification.allLoaded) {
        console.log('🎯 Background modular architecture ready');
        
        // Initialize debug help
        if (self.gscToolDebug) {
            console.log('🔧 Debug interface available: gscToolDebug.help()');
        }
    } else {
        console.error('💥 Module loading incomplete, some features may not work');
    }
}, 100);

// ===== ERROR HANDLING =====
// Global error handling for the entire background script

self.addEventListener('error', (event) => {
    console.error('💥 Background Script Error:', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
    });
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('💥 Unhandled Promise Rejection in Background:', {
        reason: event.reason,
        stack: event.reason?.stack
    });
});

console.log('🏁 GSC Tool Background Script - Modular Entry Point Complete');
