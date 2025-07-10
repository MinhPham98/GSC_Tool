// ===== PACK CONTROLLER - Pack Mode Processing Logic =====

class PackController {
    constructor() {
        this.log = self.backgroundUtils.log;
        this.safeExecuteScript = self.backgroundUtils.safeExecuteScript;
        this.storageManager = self.storageManager;
        
        // Pack state
        this.urlChunks = [];
        this.currentPack = 0;
        this.autoRun = false;
        this.isPaused = false;
        this.tabId = null;
    }

    // ========== PACK INITIALIZATION ==========

    /**
     * Initialize pack processing
     */
    async initializePack(urlChunks, tabId, autoRun = false) {
        this.log('PACK', '🚀 Initializing pack processing:', {
            totalPacks: urlChunks.length,
            totalUrls: urlChunks.reduce((sum, pack) => sum + pack.length, 0),
            autoRun: autoRun,
            tabId: tabId
        });

        this.urlChunks = urlChunks;
        this.currentPack = 0;
        this.autoRun = autoRun;
        this.isPaused = false;
        this.tabId = tabId;

        // Save pack state
        await this.storageManager.savePackState({
            urlChunks: this.urlChunks,
            currentPack: this.currentPack,
            autoRun: this.autoRun,
            isPaused: this.isPaused,
            tabId: this.tabId
        });

        return true;
    }

    /**
     * Send current pack to content script
     */
    async sendPack() {
        if (this.currentPack >= this.urlChunks.length) {
            this.log('PACK', '✅ All packs completed');
            await this.completePacks();
            return false;
        }

        const currentUrls = this.urlChunks[this.currentPack];
        
        this.log('PACK', `📦 Sending pack ${this.currentPack + 1}/${this.urlChunks.length}:`, {
            packSize: currentUrls.length,
            urls: currentUrls.slice(0, 3).join(', ') + (currentUrls.length > 3 ? '...' : '')
        });

        try {
            // Set URLs for content script
            await this.storageManager.safeStorageSet({
                URLs: currentUrls,
                temporaryRemoval: true,
                backgroundQueueMode: false // This is pack mode
            }, 'sync');

            // Execute content script
            const success = await this.safeExecuteScript(this.tabId, ["url.js"]);
            
            if (success) {
                this.log('PACK', `✅ Pack ${this.currentPack + 1} sent successfully`);
                return true;
            } else {
                this.log('ERROR', `❌ Failed to send pack ${this.currentPack + 1}`);
                return false;
            }

        } catch (error) {
            this.log('ERROR', `❌ Error sending pack ${this.currentPack + 1}:`, error.message);
            return false;
        }
    }

    // ========== PACK CONTROL ==========

    /**
     * Handle pack completion
     */
    async handlePackCompletion() {
        this.log('PACK', `✅ Pack ${this.currentPack + 1} completed`);
        
        this.currentPack++;
        
        // Update state
        await this.storageManager.savePackState({
            urlChunks: this.urlChunks,
            currentPack: this.currentPack,
            autoRun: this.autoRun,
            isPaused: this.isPaused,
            tabId: this.tabId
        });

        if (this.autoRun && !this.isPaused && this.currentPack < this.urlChunks.length) {
            this.log('PACK', `🔄 Auto-running next pack ${this.currentPack + 1} in 1 second...`);
            
            setTimeout(async () => {
                if (this.autoRun && !this.isPaused) {
                    await this.sendPack();
                }
            }, 1000);
        } else if (this.currentPack >= this.urlChunks.length) {
            await this.completePacks();
        } else {
            this.log('PACK', `⏸️ Auto-run disabled or paused. Pack ${this.currentPack + 1} ready for manual trigger.`);
        }
    }

    /**
     * Pause pack processing
     */
    async pausePack() {
        this.log('PACK', '⏸️ Pausing pack processing');
        
        this.isPaused = true;
        
        await this.storageManager.savePackState({
            urlChunks: this.urlChunks,
            currentPack: this.currentPack,
            autoRun: this.autoRun,
            isPaused: this.isPaused,
            tabId: this.tabId
        });

        // Update sync storage for content script
        await this.storageManager.safeStorageSet({
            isPaused: true
        }, 'sync');
    }

    /**
     * Resume pack processing
     */
    async resumePack() {
        this.log('PACK', '▶️ Resuming pack processing');
        
        this.isPaused = false;
        
        await this.storageManager.savePackState({
            urlChunks: this.urlChunks,
            currentPack: this.currentPack,
            autoRun: this.autoRun,
            isPaused: this.isPaused,
            tabId: this.tabId
        });

        // Update sync storage for content script
        await this.storageManager.safeStorageSet({
            isPaused: false
        }, 'sync');

        // If auto-run is enabled and there are remaining packs, continue
        if (this.autoRun && this.currentPack < this.urlChunks.length) {
            setTimeout(async () => {
                await this.sendPack();
            }, 1000);
        }
    }

    /**
     * Stop pack processing
     */
    async stopPack() {
        this.log('PACK', '⏹️ Stopping pack processing');
        
        // Stop current pack processing in content script
        await this.storageManager.safeStorageSet({
            isStopped: true,
            isPaused: false,
            running: false
        }, 'sync');

        // Clear pack state
        await this.storageManager.clearPackState();

        // Reset local state
        this.urlChunks = [];
        this.currentPack = 0;
        this.autoRun = false;
        this.isPaused = false;
        this.tabId = null;
    }

    /**
     * Complete all pack processing
     */
    async completePacks() {
        this.log('PACK', '🎉 All packs completed!', {
            totalPacks: this.urlChunks.length,
            totalUrls: this.urlChunks.reduce((sum, pack) => sum + pack.length, 0)
        });

        // Clear pack state
        await this.storageManager.clearPackState();

        // Reset sync storage
        await this.storageManager.safeStorageSet({
            running: false,
            currentUrlIndex: null,
            totalInPack: null,
            isPaused: false,
            isStopped: false
        }, 'sync');

        // Reset local state
        this.urlChunks = [];
        this.currentPack = 0;
        this.autoRun = false;
        this.isPaused = false;
        this.tabId = null;
    }

    // ========== MANUAL PACK OPERATIONS ==========

    /**
     * Send next pack manually
     */
    async sendNextPack() {
        if (this.currentPack < this.urlChunks.length) {
            return await this.sendPack();
        } else {
            this.log('PACK', '⚠️ No more packs to send');
            return false;
        }
    }

    /**
     * Reset to first pack
     */
    async resetToFirstPack() {
        this.log('PACK', '🔄 Resetting to first pack');
        
        this.currentPack = 0;
        this.isPaused = false;
        
        await this.storageManager.savePackState({
            urlChunks: this.urlChunks,
            currentPack: this.currentPack,
            autoRun: this.autoRun,
            isPaused: this.isPaused,
            tabId: this.tabId
        });

        return true;
    }

    /**
     * Jump to specific pack
     */
    async jumpToPack(packIndex) {
        if (packIndex >= 0 && packIndex < this.urlChunks.length) {
            this.log('PACK', `🎯 Jumping to pack ${packIndex + 1}`);
            
            this.currentPack = packIndex;
            
            await this.storageManager.savePackState({
                urlChunks: this.urlChunks,
                currentPack: this.currentPack,
                autoRun: this.autoRun,
                isPaused: this.isPaused,
                tabId: this.tabId
            });

            return true;
        } else {
            this.log('WARN', `⚠️ Invalid pack index: ${packIndex}. Valid range: 0-${this.urlChunks.length - 1}`);
            return false;
        }
    }

    // ========== STATE RESTORATION ==========

    /**
     * Restore pack state on service worker restart
     */
    async restoreState() {
        this.log('PACK', '🔄 Restoring pack state...');
        
        const packState = await this.storageManager.loadPackState();
        
        if (packState.urlChunks?.length > 0) {
            this.log('PACK', '📦 Restoring pack state:', {
                totalPacks: packState.urlChunks.length,
                currentPack: packState.currentPack + 1,
                autoRun: packState.autoRun,
                isPaused: packState.isPaused
            });
            
            this.urlChunks = packState.urlChunks;
            this.currentPack = packState.currentPack || 0;
            this.autoRun = packState.autoRun || false;
            this.isPaused = packState.isPaused || false;
            this.tabId = packState.tabId;
            
            return true;
        } else {
            this.log('INFO', '📦 No pack state to restore');
            return false;
        }
    }

    // ========== GETTERS ==========

    getState() {
        return {
            totalPacks: this.urlChunks.length,
            currentPack: this.currentPack,
            totalUrls: this.urlChunks.reduce((sum, pack) => sum + pack.length, 0),
            autoRun: this.autoRun,
            isPaused: this.isPaused,
            tabId: this.tabId,
            hasMorePacks: this.currentPack < this.urlChunks.length
        };
    }

    getCurrentPackUrls() {
        if (this.currentPack < this.urlChunks.length) {
            return this.urlChunks[this.currentPack];
        }
        return [];
    }

    getTotalUrlCount() {
        return this.urlChunks.reduce((sum, pack) => sum + pack.length, 0);
    }
}

// Export globally
self.PackController = PackController;
self.packController = new PackController();
