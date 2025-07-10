// ===== STORAGE MANAGER - Chrome Storage Operations =====

class StorageManager {
    constructor() {
        this.log = self.backgroundUtils.log;
        this.safeStorageGet = self.backgroundUtils.safeStorageGet;
        this.safeStorageSet = self.backgroundUtils.safeStorageSet;
    }

    // ========== PACK MODE STORAGE ==========
    
    /**
     * Save pack processing state
     */
    async savePackState(packData) {
        const data = {
            urlChunks: packData.urlChunks || [],
            currentPack: packData.currentPack || 0,
            autoRun: packData.autoRun || false,
            isPaused: packData.isPaused || false,
            tabId: packData.tabId || null,
            temporaryRemoval: packData.temporaryRemoval || true
        };
        
        const success = await this.safeStorageSet(data, 'sync');
        if (success) {
            this.log('PACK', '💾 Pack state saved:', data);
        }
        return success;
    }

    /**
     * Load pack processing state
     */
    async loadPackState() {
        const data = await this.safeStorageGet([
            'urlChunks', 'currentPack', 'autoRun', 'isPaused', 'tabId', 'temporaryRemoval'
        ], 'sync');
        
        this.log('PACK', '📖 Pack state loaded:', data);
        return data;
    }

    /**
     * Clear pack state
     */
    async clearPackState() {
        const keys = ['urlChunks', 'currentPack', 'autoRun', 'isPaused', 'tabId', 'temporaryRemoval'];
        const clearData = {};
        keys.forEach(key => clearData[key] = null);
        
        const success = await this.safeStorageSet(clearData, 'sync');
        if (success) {
            this.log('PACK', '🧹 Pack state cleared');
        }
        return success;
    }

    // ========== QUEUE MODE STORAGE ==========

    /**
     * Save queue state
     */
    async saveQueueState(queueData) {
        const data = {
            urlQueue: queueData.urlQueue || [],
            currentUrlIndex: queueData.currentUrlIndex || 0,
            backgroundMode: queueData.backgroundMode || false,
            queueProcessing: queueData.queueProcessing || false,
            queuePaused: queueData.queuePaused || false,
            targetTabId: queueData.targetTabId || null,
            backgroundQueueActive: queueData.backgroundQueueActive || false
        };

        const success = await this.safeStorageSet(data, 'local');
        if (success) {
            this.log('QUEUE', '💾 Queue state saved:', {
                urlCount: data.urlQueue.length,
                currentIndex: data.currentUrlIndex,
                processing: data.queueProcessing,
                paused: data.queuePaused
            });
        }
        return success;
    }

    /**
     * Load queue state
     */
    async loadQueueState() {
        const data = await this.safeStorageGet([
            'urlQueue', 'currentUrlIndex', 'backgroundMode', 'queueProcessing', 
            'queuePaused', 'targetTabId', 'backgroundQueueActive'
        ], 'local');

        this.log('QUEUE', '📖 Queue state loaded:', {
            urlCount: data.urlQueue?.length || 0,
            currentIndex: data.currentUrlIndex || 0,
            processing: data.queueProcessing || false,
            paused: data.queuePaused || false
        });
        return data;
    }

    /**
     * Clear queue state
     */
    async clearQueueState() {
        const keys = [
            'urlQueue', 'currentUrlIndex', 'backgroundMode', 'queueProcessing',
            'queuePaused', 'targetTabId', 'backgroundQueueActive'
        ];
        const clearData = {};
        keys.forEach(key => clearData[key] = null);

        const success = await this.safeStorageSet(clearData, 'local');
        if (success) {
            this.log('QUEUE', '🧹 Queue state cleared');
        }
        return success;
    }

    /**
     * Save stopped queue for resume later
     */
    async saveStoppedQueue(queueData) {
        const data = {
            stoppedQueue: {
                urlQueue: queueData.urlQueue || [],
                currentUrlIndex: queueData.currentUrlIndex || 0,
                targetTabId: queueData.targetTabId || null,
                timestamp: new Date().toISOString()
            }
        };

        const success = await this.safeStorageSet(data, 'local');
        if (success) {
            this.log('QUEUE', '💾 Stopped queue saved for resume:', {
                urlCount: data.stoppedQueue.urlQueue.length,
                currentIndex: data.stoppedQueue.currentUrlIndex
            });
        }
        return success;
    }

    /**
     * Load stopped queue
     */
    async loadStoppedQueue() {
        const data = await this.safeStorageGet(['stoppedQueue'], 'local');
        
        if (data.stoppedQueue) {
            this.log('QUEUE', '📖 Stopped queue loaded:', {
                urlCount: data.stoppedQueue.urlQueue?.length || 0,
                currentIndex: data.stoppedQueue.currentUrlIndex || 0,
                timestamp: data.stoppedQueue.timestamp
            });
        }
        
        return data.stoppedQueue || null;
    }

    /**
     * Clear stopped queue
     */
    async clearStoppedQueue() {
        const success = await this.safeStorageSet({ stoppedQueue: null }, 'local');
        if (success) {
            this.log('QUEUE', '🧹 Stopped queue cleared');
        }
        return success;
    }

    // ========== RESULTS STORAGE ==========

    /**
     * Get queue results
     */
    async getQueueResults() {
        const data = await this.safeStorageGet(['queueResults'], 'local');
        return data.queueResults || [];
    }

    /**
     * Add queue result
     */
    async addQueueResult(result) {
        const queueResults = await this.getQueueResults();
        queueResults.push(result);
        
        const success = await this.safeStorageSet({ queueResults }, 'local');
        if (success) {
            this.log('QUEUE', '💾 Queue result added:', {
                stt: result.id,
                url: result.url,
                status: result.status,
                totalResults: queueResults.length
            });
        }
        return success;
    }

    /**
     * Clear queue results
     */
    async clearQueueResults() {
        const success = await this.safeStorageSet({ queueResults: [] }, 'local');
        if (success) {
            this.log('QUEUE', '🧹 Queue results cleared');
        }
        return success;
    }

    // ========== STATISTICS STORAGE ==========

    /**
     * Update success/error counters
     */
    async updateCounters(successCount = 0, errorCount = 0) {
        const data = await this.safeStorageGet(['urlSuccess', 'urlError'], 'local');
        
        const newData = {
            urlSuccess: (data.urlSuccess || 0) + successCount,
            urlError: (data.urlError || 0) + errorCount
        };

        const success = await this.safeStorageSet(newData, 'local');
        if (success) {
            this.log('INFO', '📊 Counters updated:', newData);
        }
        return success;
    }

    /**
     * Get current counters
     */
    async getCounters() {
        const data = await this.safeStorageGet(['urlSuccess', 'urlError'], 'local');
        return {
            urlSuccess: data.urlSuccess || 0,
            urlError: data.urlError || 0
        };
    }

    /**
     * Reset counters
     */
    async resetCounters() {
        const success = await this.safeStorageSet({
            urlSuccess: 0,
            urlError: 0
        }, 'local');
        
        if (success) {
            this.log('INFO', '🔄 Counters reset');
        }
        return success;
    }
}

// Export globally
self.StorageManager = StorageManager;
self.storageManager = new StorageManager();
