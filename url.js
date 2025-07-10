// ========== MODULAR URL.JS ==========
// This file loads and coordinates all content script modules
// New modular architecture for better maintainability

// Note: All modules are loaded via manifest.json in proper order
// This file serves as the main entry point and coordination layer

console.log('🚀 GSC Tool Content Script - Modular Architecture Loaded');
console.log('📦 Available Modules:', {
    Utils: !!window.GSCUtils,
    Timing: !!window.GSCTiming,
    Operations: !!window.GSCOperations,
    PackProcessor: !!window.GSCPackProcessor,
    QueueProcessor: !!window.GSCQueueProcessor,
    ContentCore: !!window.GSCContentCore
});

// Legacy compatibility - export functions to global scope for backward compatibility
if (window.GSCContentCore) {
    window.linksResubmission = window.GSCContentCore.linksResubmission;
    window.reload = window.GSCContentCore.reload;
}

if (window.GSCUtils) {
    window.delay = window.GSCUtils.delay;
    window.log = window.GSCUtils.log;
    window.showCustomAlert = window.GSCUtils.showCustomAlert;
    window.checkPaused = window.GSCUtils.checkPaused;
}

if (window.GSCTiming) {
    window.timing = window.GSCTiming;
    window.urlTimingTracker = window.urlTimingTracker;
}

// Legacy global variables for compatibility
if (window.GSCPackProcessor) {
    // These getters/setters maintain compatibility with existing code
    Object.defineProperty(window, 'currentUrlIndex', {
        get: () => window.GSCPackProcessor.currentUrlIndex,
        set: (value) => { window.GSCPackProcessor.currentUrlIndex = value; }
    });
    
    Object.defineProperty(window, 'resultLinks', {
        get: () => window.GSCPackProcessor.resultLinks
    });
    
    Object.defineProperty(window, 'isPaused', {
        get: () => window.GSCPackProcessor.isPaused,
        set: (value) => { window.GSCPackProcessor.isPaused = value; }
    });
    
    Object.defineProperty(window, 'isStopped', {
        get: () => window.GSCPackProcessor.isStopped,
        set: (value) => { window.GSCPackProcessor.isStopped = value; }
    });
}

// Expose main processing functions
if (window.GSCQueueProcessor) {
    window.processSingleUrlFromQueue = window.GSCQueueProcessor.processSingleUrlFromQueue;
}

if (window.GSCPackProcessor) {
    window.removeUrlJs = window.GSCPackProcessor.removeUrlJs;
}

console.log('✅ GSC Tool - All modules loaded and integrated successfully');
console.log('🔧 Legacy compatibility layer active for existing code');
