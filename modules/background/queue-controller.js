// ===== QUEUE CONTROLLER - Background Queue Processing Logic =====

class QueueController {
    constructor() {
        this.log = self.backgroundUtils.log;
        this.delay = self.backgroundUtils.delay;
        this.isTabValid = self.backgroundUtils.isTabValid;
        this.safeExecuteScript = self.backgroundUtils.safeExecuteScript;
        this.storageManager = self.storageManager;
        
        // Queue state
        this.urlQueue = [];
        this.currentUrlIndex = 0;
        this.backgroundMode = false;
        this.queueProcessing = false;
        this.queuePaused = false;
        this.targetTabId = null;
        this.processingInterval = null;
    }

    // ========== QUEUE INITIALIZATION ==========

    /**
     * Start background queue processing
     */
    async startQueue(urls, tabId, temporaryRemoval = true) {
        this.log('QUEUE', '🚀 Starting background queue:', {
            urlCount: urls.length,
            tabId: tabId,
            temporaryRemoval: temporaryRemoval
        });

        // Initialize queue state
        this.urlQueue = urls;
        this.currentUrlIndex = 0;
        this.backgroundMode = true;
        this.queueProcessing = true;
        this.queuePaused = false;
        this.targetTabId = tabId;

        // Save initial state
        await this.storageManager.saveQueueState({
            urlQueue: this.urlQueue,
            currentUrlIndex: this.currentUrlIndex,
            backgroundMode: this.backgroundMode,
            queueProcessing: this.queueProcessing,
            queuePaused: this.queuePaused,
            targetTabId: this.targetTabId,
            backgroundQueueActive: true
        });

        // Clear any existing results
        await this.storageManager.clearQueueResults();

        // Start processing
        await this.startQueueProcessing();
        
        return true;
    }

    /**
     * Start the queue processing loop
     */
    async startQueueProcessing() {
        if (this.queueProcessing) {
            this.log('WARN', '⚠️ Queue already processing, skipping start');
            return;
        }

        this.queueProcessing = true;
        await this.storageManager.saveQueueState({
            urlQueue: this.urlQueue,
            currentUrlIndex: this.currentUrlIndex,
            backgroundMode: this.backgroundMode,
            queueProcessing: this.queueProcessing,
            queuePaused: this.queuePaused,
            targetTabId: this.targetTabId,
            backgroundQueueActive: true
        });

        this.log('QUEUE', '▶️ Queue processing started:', {
            totalUrls: this.urlQueue.length,
            currentIndex: this.currentUrlIndex,
            remaining: this.urlQueue.length - this.currentUrlIndex
        });

        // Start processing with a small delay
        setTimeout(() => {
            this.processNextUrl();
        }, 1000);
    }

    /**
     * Process the next URL in queue
     */
    async processNextUrl() {
        if (!this.queueProcessing || this.queuePaused) {
            this.log('QUEUE', '⏸️ Queue processing paused or stopped');
            return;
        }

        if (this.currentUrlIndex >= this.urlQueue.length) {
            await this.completeQueue();
            return;
        }

        const url = this.urlQueue[this.currentUrlIndex];
        
        this.log('QUEUE', `🔄 Processing URL ${this.currentUrlIndex + 1}/${this.urlQueue.length}:`, {
            url: url,
            index: this.currentUrlIndex
        });

        // Check if tab is still valid
        if (!(await this.isTabValid(this.targetTabId))) {
            this.log('ERROR', '❌ Target tab no longer valid, stopping queue');
            await this.stopQueue();
            return;
        }

        try {
            // Set current URL for content script
            await this.storageManager.safeStorageSet({
                URLs: [url],
                temporaryRemoval: true,
                backgroundQueueMode: true,
                currentQueueIndex: this.currentUrlIndex
            }, 'sync');

            // Execute content script
            const success = await this.safeExecuteScript(this.targetTabId, ["url.js"]);
            
            if (!success) {
                this.log('ERROR', `❌ Failed to execute script for URL ${this.currentUrlIndex + 1}`);
                // Still increment to avoid infinite loop
                this.currentUrlIndex++;
                await this.scheduleNextUrl();
                return;
            }

            // Update state
            await this.storageManager.saveQueueState({
                urlQueue: this.urlQueue,
                currentUrlIndex: this.currentUrlIndex,
                backgroundMode: this.backgroundMode,
                queueProcessing: this.queueProcessing,
                queuePaused: this.queuePaused,
                targetTabId: this.targetTabId,
                backgroundQueueActive: true
            });

            // Send status update to popup
            await this.sendStatusUpdate();

        } catch (error) {
            this.log('ERROR', `❌ Error processing URL ${this.currentUrlIndex + 1}:`, {
                url: url,
                error: error.message
            });
            
            // Increment index and continue
            this.currentUrlIndex++;
            await this.scheduleNextUrl();
        }
    }

    /**
     * Schedule next URL processing
     */
    async scheduleNextUrl() {
        if (!this.queueProcessing || this.queuePaused) {
            return;
        }

        this.log('QUEUE', `⏱️ Scheduling next URL processing in 3 seconds...`);
        
        // Use setTimeout instead of setInterval for better control
        setTimeout(() => {
            if (this.queueProcessing && !this.queuePaused) {
                this.processNextUrl();
            }
        }, 3000);
    }

    /**
     * Handle URL processing completion from content script
     */
    async handleUrlCompletion(result) {
        this.log('QUEUE', `✅ URL ${this.currentUrlIndex + 1} completed:`, {
            url: result.url,
            status: result.status,
            reason: result.reason
        });

        // Increment index
        this.currentUrlIndex++;

        // Update state
        await this.storageManager.saveQueueState({
            urlQueue: this.urlQueue,
            currentUrlIndex: this.currentUrlIndex,
            backgroundMode: this.backgroundMode,
            queueProcessing: this.queueProcessing,
            queuePaused: this.queuePaused,
            targetTabId: this.targetTabId,
            backgroundQueueActive: true
        });

        // Send status update
        await this.sendStatusUpdate();

        // Schedule next URL
        await this.scheduleNextUrl();
    }

    // ========== QUEUE CONTROL ==========

    /**
     * Pause queue processing
     */
    async pauseQueue() {
        this.log('QUEUE', '⏸️ Pausing queue processing');
        
        this.queuePaused = true;
        
        await this.storageManager.saveQueueState({
            urlQueue: this.urlQueue,
            currentUrlIndex: this.currentUrlIndex,
            backgroundMode: this.backgroundMode,
            queueProcessing: this.queueProcessing,
            queuePaused: this.queuePaused,
            targetTabId: this.targetTabId,
            backgroundQueueActive: true
        });

        // Send message to popup
        try {
            await chrome.runtime.sendMessage({ type: "QUEUE_PAUSED" });
        } catch (error) {
            this.log('WARN', '⚠️ Could not send pause message to popup:', error.message);
        }

        await this.sendStatusUpdate();
    }

    /**
     * Resume queue processing
     */
    async resumeQueue() {
        this.log('QUEUE', '▶️ Resuming queue processing');
        
        this.queuePaused = false;
        
        await this.storageManager.saveQueueState({
            urlQueue: this.urlQueue,
            currentUrlIndex: this.currentUrlIndex,
            backgroundMode: this.backgroundMode,
            queueProcessing: this.queueProcessing,
            queuePaused: this.queuePaused,
            targetTabId: this.targetTabId,
            backgroundQueueActive: true
        });

        // Send message to popup
        try {
            await chrome.runtime.sendMessage({ type: "QUEUE_RESUMED" });
        } catch (error) {
            this.log('WARN', '⚠️ Could not send resume message to popup:', error.message);
        }

        await this.sendStatusUpdate();

        // Resume processing
        if (this.currentUrlIndex < this.urlQueue.length) {
            setTimeout(() => {
                this.processNextUrl();
            }, 1000);
        }
    }

    /**
     * Stop queue processing
     */
    async stopQueue() {
        this.log('QUEUE', '⏹️ Stopping queue processing');

        // Save current state as stopped queue for potential resume
        await this.storageManager.saveStoppedQueue({
            urlQueue: this.urlQueue,
            currentUrlIndex: this.currentUrlIndex,
            targetTabId: this.targetTabId
        });

        // Reset state
        this.queueProcessing = false;
        this.queuePaused = false;
        this.backgroundMode = false;

        // Clear active queue state
        await this.storageManager.clearQueueState();

        // Send message to popup
        try {
            await chrome.runtime.sendMessage({ type: "QUEUE_STOPPED" });
        } catch (error) {
            this.log('WARN', '⚠️ Could not send stop message to popup:', error.message);
        }

        // Clear processing interval if exists
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    /**
     * Complete queue processing
     */
    async completeQueue() {
        this.log('QUEUE', '🎉 Queue processing completed!', {
            totalProcessed: this.urlQueue.length,
            currentIndex: this.currentUrlIndex
        });

        const queueResults = await this.storageManager.getQueueResults();
        const successCount = queueResults.filter(r => r.status === 'success').length;
        const errorCount = queueResults.filter(r => r.status === 'error').length;

        // Update counters
        await this.storageManager.updateCounters(successCount, errorCount);

        // Reset processing state
        this.queueProcessing = false;
        this.queuePaused = false;
        this.backgroundMode = false;

        // Clear active queue state but keep results
        await this.storageManager.clearQueueState();

        // Send completion message to popup
        try {
            await chrome.runtime.sendMessage({ 
                type: "QUEUE_COMPLETED",
                totalProcessed: this.urlQueue.length,
                successCount: successCount,
                errorCount: errorCount
            });
        } catch (error) {
            this.log('WARN', '⚠️ Could not send completion message to popup:', error.message);
        }
    }

    /**
     * Resume stopped queue
     */
    async resumeStoppedQueue() {
        const stoppedQueue = await this.storageManager.loadStoppedQueue();
        
        if (!stoppedQueue) {
            this.log('WARN', '⚠️ No stopped queue found to resume');
            return false;
        }

        this.log('QUEUE', '🔄 Resuming stopped queue:', {
            urlCount: stoppedQueue.urlQueue.length,
            currentIndex: stoppedQueue.currentUrlIndex,
            timestamp: stoppedQueue.timestamp
        });

        // Restore state
        this.urlQueue = stoppedQueue.urlQueue;
        this.currentUrlIndex = stoppedQueue.currentUrlIndex;
        this.targetTabId = stoppedQueue.targetTabId;
        this.backgroundMode = true;
        this.queueProcessing = true;
        this.queuePaused = false;

        // Clear stopped queue
        await this.storageManager.clearStoppedQueue();

        // Start processing
        await this.startQueueProcessing();
        
        return true;
    }

    // ========== STATE RESTORATION ==========

    /**
     * Restore queue state on service worker restart
     */
    async restoreState() {
        this.log('QUEUE', '🔄 Restoring queue state...');
        
        const queueState = await this.storageManager.loadQueueState();
        
        if (queueState.backgroundQueueActive && queueState.urlQueue?.length > 0) {
            this.log('QUEUE', '📦 Restoring active queue state');
            
            // Restore all state
            this.urlQueue = queueState.urlQueue;
            this.currentUrlIndex = queueState.currentUrlIndex || 0;
            this.backgroundMode = queueState.backgroundMode;
            this.queueProcessing = queueState.queueProcessing;
            this.queuePaused = queueState.queuePaused;
            this.targetTabId = queueState.targetTabId;
            
            await this.sendStatusUpdate();
            
            // Auto-resume if not paused and not completed
            if (!this.queuePaused && this.currentUrlIndex < this.urlQueue.length) {
                this.log('QUEUE', '🔄 Auto-resuming queue processing in 2 seconds...');
                setTimeout(() => {
                    this.startQueueProcessing();
                }, 2000);
            } else if (this.queuePaused) {
                this.log('QUEUE', '⏸️ Queue restored but paused - waiting for manual resume');
            } else {
                this.log('QUEUE', '✅ Queue restored but already completed');
            }
        } else {
            this.log('INFO', '📦 No active queue found - staying in pack mode');
        }
    }

    // ========== STATUS UPDATES ==========

    /**
     * Send status update to popup
     */
    async sendStatusUpdate() {
        const statusData = {
            totalUrls: this.urlQueue.length,
            currentIndex: this.currentUrlIndex,
            remaining: this.urlQueue.length - this.currentUrlIndex,
            processing: this.queueProcessing,
            paused: this.queuePaused,
            targetTab: this.targetTabId,
            progress: this.urlQueue.length > 0 ? (this.currentUrlIndex / this.urlQueue.length) * 100 : 0
        };

        try {
            await chrome.runtime.sendMessage({
                type: "QUEUE_STATUS_UPDATE",
                data: statusData
            });
        } catch (error) {
            this.log('DEBUG', '🔧 Could not send status update (popup may be closed)');
        }
    }

    // ========== GETTERS ==========

    getState() {
        return {
            urlQueue: this.urlQueue.length,
            currentUrlIndex: this.currentUrlIndex,
            backgroundMode: this.backgroundMode,
            queueProcessing: this.queueProcessing,
            queuePaused: this.queuePaused,
            targetTabId: this.targetTabId
        };
    }
}

// Export globally
self.QueueController = QueueController;
self.queueController = new QueueController();
