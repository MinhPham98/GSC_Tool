// ===== BACKGROUND CORE - Main Service Worker Entry Point =====

class BackgroundCore {
    constructor() {
        this.log = self.backgroundUtils.log;
        this.storageManager = self.storageManager;
        this.queueController = self.queueController;
        this.packController = self.packController;
        this.messageHandler = self.messageHandler;
        
        this.initializeServiceWorker();
    }

    async initializeServiceWorker() {
        this.log('INFO', '🚀 Initializing Background Core...');

        try {
            // Restore previous state if any
            await this.restoreApplicationState();
            
            // Setup global error handling
            this.setupErrorHandling();
            
            // Setup debug interface
            this.setupDebugInterface();
            
            this.log('INFO', '✅ Background Core initialization complete');
            
        } catch (error) {
            this.log('ERROR', '❌ Failed to initialize Background Core:', error);
        }
    }

    async restoreApplicationState() {
        this.log('INFO', '🔄 Restoring application state...');

        try {
            // Try to restore queue state first (higher priority)
            const queueRestored = await this.queueController.restoreState();
            
            if (!queueRestored) {
                // If no queue state, try to restore pack state
                await this.packController.restoreState();
            }

            this.log('INFO', '✅ Application state restoration complete');

        } catch (error) {
            this.log('ERROR', '❌ Error restoring application state:', error);
        }
    }

    setupErrorHandling() {
        // Global error handling for service worker
        self.addEventListener('error', (event) => {
            this.log('ERROR', '❌ Global service worker error:', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error?.stack
            });
        });

        self.addEventListener('unhandledrejection', (event) => {
            this.log('ERROR', '❌ Unhandled promise rejection in service worker:', {
                reason: event.reason,
                stack: event.reason?.stack
            });
        });
    }

    setupDebugInterface() {
        // Enhanced debug interface for console access
        self.gscToolDebug = {
            // Logging
            clearLogs: self.backgroundUtils.clearLogs,
            log: self.backgroundUtils.log,
            
            // State getters
            getBackgroundState: () => self.backgroundUtils.getBackgroundState(),
            getPackState: () => self.packController.getState(),
            getQueueState: () => self.queueController.getState(),
            
            // Controllers
            packController: self.packController,
            queueController: self.queueController,
            storageManager: self.storageManager,
            
            // Quick actions
            stopAll: async () => {
                await self.packController.stopPack();
                await self.queueController.stopQueue();
                return 'All processes stopped';
            },
            
            clearAllData: async () => {
                const result = await self.messageHandler.handleClearAllData({}, {});
                return result.message;
            },
            
            getFullStatus: async () => {
                const result = await self.messageHandler.handleGetStatus({}, {});
                return result.data;
            },
            
            // Storage helpers
            getCounters: () => self.storageManager.getCounters(),
            getQueueResults: () => self.storageManager.getQueueResults(),
            
            // Utilities
            version: chrome.runtime.getManifest().version,
            uptime: () => Math.round((Date.now() - self.backgroundUtils.serviceWorkerStartTime) / 1000),
            
            help: () => {
                console.log(`
🔧 GSC Tool Debug Interface:

📊 State:
- gscToolDebug.getFullStatus() - Complete application status
- gscToolDebug.getPackState() - Pack mode state
- gscToolDebug.getQueueState() - Queue mode state
- gscToolDebug.getBackgroundState() - Service worker state

🛠️ Actions:
- gscToolDebug.stopAll() - Stop all processes
- gscToolDebug.clearAllData() - Clear all data
- gscToolDebug.clearLogs() - Clear console logs

📦 Storage:
- gscToolDebug.getCounters() - Get success/error counters
- gscToolDebug.getQueueResults() - Get queue processing results

🏗️ Controllers:
- gscToolDebug.packController - Direct pack controller access
- gscToolDebug.queueController - Direct queue controller access
- gscToolDebug.storageManager - Direct storage manager access

ℹ️ Info:
- gscToolDebug.version - Extension version
- gscToolDebug.uptime() - Service worker uptime in seconds
                `);
            }
        };

        this.log('DEBUG', '🔧 Debug interface setup complete. Use gscToolDebug.help() for commands.');
    }

    // ========== APPLICATION LIFECYCLE ==========

    async shutdown() {
        this.log('INFO', '💤 Background Core shutting down...');

        try {
            // Save current states
            await this.saveCurrentStates();
            
            // Cleanup resources
            await this.cleanup();
            
            this.log('INFO', '✅ Background Core shutdown complete');
            
        } catch (error) {
            this.log('ERROR', '❌ Error during shutdown:', error);
        }
    }

    async saveCurrentStates() {
        // Save pack state if active
        const packState = this.packController.getState();
        if (packState.totalPacks > 0) {
            this.log('DEBUG', '💾 Saving pack state before shutdown');
            // Pack state is automatically saved by controller
        }

        // Save queue state if active
        const queueState = this.queueController.getState();
        if (queueState.urlQueue > 0) {
            this.log('DEBUG', '💾 Saving queue state before shutdown');
            // Queue state is automatically saved by controller
        }
    }

    async cleanup() {
        // Clear any intervals or timeouts
        // (Controllers handle their own cleanup)
        
        this.log('DEBUG', '🧹 Cleanup complete');
    }

    // ========== HEALTH CHECK ==========

    async healthCheck() {
        try {
            const health = {
                serviceWorker: {
                    status: 'healthy',
                    uptime: Math.round((Date.now() - self.backgroundUtils.serviceWorkerStartTime) / 1000)
                },
                storage: {
                    status: 'healthy',
                    canRead: false,
                    canWrite: false
                },
                controllers: {
                    pack: this.packController ? 'loaded' : 'missing',
                    queue: this.queueController ? 'loaded' : 'missing',
                    storage: this.storageManager ? 'loaded' : 'missing',
                    message: this.messageHandler ? 'loaded' : 'missing'
                }
            };

            // Test storage
            try {
                await self.backgroundUtils.safeStorageGet(['test'], 'local');
                health.storage.canRead = true;
                
                await self.backgroundUtils.safeStorageSet({ healthCheck: Date.now() }, 'local');
                health.storage.canWrite = true;
            } catch (error) {
                health.storage.status = 'error';
                health.storage.error = error.message;
            }

            return health;

        } catch (error) {
            this.log('ERROR', '❌ Health check failed:', error);
            return {
                serviceWorker: { status: 'error', error: error.message },
                storage: { status: 'unknown' },
                controllers: { status: 'unknown' }
            };
        }
    }

    // ========== GETTERS ==========

    getStatus() {
        return {
            initialized: true,
            packState: this.packController.getState(),
            queueState: this.queueController.getState(),
            backgroundState: self.backgroundUtils.getBackgroundState()
        };
    }
}

// Initialize Background Core when service worker starts
self.addEventListener('install', (event) => {
    console.log('🔧 GSC Tool Service Worker installing...');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('🚀 GSC Tool Service Worker activating...');
    event.waitUntil(
        (async () => {
            await self.clients.claim();
            // Initialize core after activation
            self.backgroundCore = new BackgroundCore();
        })()
    );
});

// Handle service worker suspension
if (chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(async () => {
        if (self.backgroundCore) {
            await self.backgroundCore.shutdown();
        }
    });
}

// Export for global access
self.BackgroundCore = BackgroundCore;
