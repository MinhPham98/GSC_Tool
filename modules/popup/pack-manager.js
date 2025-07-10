// ========== PACK MANAGER MODULE ==========
// Handles pack mode operations and multi-pack processing

// ========== Pack State ==========
const PackState = {
    isRunning: false,
    isPaused: false,
    isStopped: false,
    currentPack: 1,
    totalPacks: 1,
    allPacks: [],
    currentUrls: [],
    chunkSize: 50,
    autoRunAll: false,
    
    reset() {
        this.isRunning = false;
        this.isPaused = false;
        this.isStopped = false;
        this.currentPack = 1;
        this.totalPacks = 1;
        this.allPacks = [];
        this.currentUrls = [];
        
        window.PopupUtils?.log('DEBUG', '📦 Pack state reset');
    },
    
    initialize(urls, chunkSize, autoRun = false) {
        this.reset();
        this.chunkSize = chunkSize;
        this.autoRunAll = autoRun;
        this.allPacks = window.PopupUtils.splitIntoChunks(urls, chunkSize);
        this.totalPacks = this.allPacks.length;
        this.currentPack = 1;
        
        window.PopupUtils?.log('INFO', `📦 Pack state initialized: ${this.totalPacks} packs of ~${chunkSize} URLs each`);
    },
    
    getCurrentPackUrls() {
        return this.allPacks[this.currentPack - 1] || [];
    },
    
    moveToNextPack() {
        if (this.currentPack < this.totalPacks) {
            this.currentPack++;
            return true;
        }
        return false;
    },
    
    isLastPack() {
        return this.currentPack >= this.totalPacks;
    }
};

// ========== Pack Operations ==========
const PackOperations = {
    async startPack(urls, chunkSize = 50, autoRunAll = false) {
        try {
            window.PopupUtils?.log('INFO', `📦 Starting pack processing with ${urls.length} URLs`);
            
            // Initialize pack state
            PackState.initialize(urls, chunkSize, autoRunAll);
            
            // Save pack configuration to storage
            await this.savePackConfiguration();
            
            // Start first pack
            await this.runCurrentPack();
            
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Failed to start pack:', error);
            window.UIComponents?.notifications.error('Failed to start pack: ' + error.message);
        }
    },
    
    async runCurrentPack() {
        const currentUrls = PackState.getCurrentPackUrls();
        
        if (currentUrls.length === 0) {
            window.PopupUtils?.log('WARN', 'No URLs in current pack');
            return;
        }
        
        window.PopupUtils?.log('INFO', `📦 Running pack ${PackState.currentPack}/${PackState.totalPacks} with ${currentUrls.length} URLs`);
        
        // Update UI
        window.UIComponents?.updatePackDisplay();
        window.UIComponents?.buttons.setButtonsForRunning();
        
        // Clear previous results for this pack
        chrome.storage.local.remove(['resultLinks']);
        
        // Start progress tracking
        window.ProgressTracker?.state.start(currentUrls.length);
        
        // Send URLs to content script
        await this.sendUrlsToContentScript(currentUrls);
        
        PackState.isRunning = true;
        PackState.isPaused = false;
        PackState.isStopped = false;
    },
    
    async sendUrlsToContentScript(urls) {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                if (!tabs[0]) {
                    reject(new Error('No active tab found'));
                    return;
                }
                
                try {
                    // Get current settings
                    const settings = await this.getPackSettings();
                    
                    // Send to content script
                    chrome.tabs.sendMessage(tabs[0].id, {
                        URLs: urls,
                        ...settings
                    });
                    
                    window.PopupUtils?.log('DEBUG', `📦 Sent ${urls.length} URLs to content script`);
                    resolve();
                    
                } catch (error) {
                    reject(error);
                }
            });
        });
    },
    
    async getPackSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([
                'temporaryRemoval',
                'downloadCheckbox',
                'autoRunAll'
            ], (data) => {
                resolve({
                    temporaryRemoval: data.temporaryRemoval || false,
                    downloadCheckbox: data.downloadCheckbox || false,
                    autoRunAll: data.autoRunAll || false
                });
            });
        });
    },
    
    async savePackConfiguration() {
        chrome.storage.sync.set({
            currentPack: PackState.currentPack,
            totalPacks: PackState.totalPacks,
            autoRunAll: PackState.autoRunAll
        });
    },
    
    async pausePack() {
        if (PackState.isRunning && !PackState.isPaused) {
            chrome.storage.sync.set({ isPaused: true });
            PackState.isPaused = true;
            
            window.UIComponents?.buttons.setButtonsForPaused();
            window.ProgressTracker?.state.pause();
            
            window.PopupUtils?.log('INFO', '⏸️ Pack paused');
            window.UIComponents?.notifications.info('Pack paused');
        }
    },
    
    async resumePack() {
        if (PackState.isRunning && PackState.isPaused) {
            chrome.storage.sync.set({ isPaused: false });
            PackState.isPaused = false;
            
            window.UIComponents?.buttons.setButtonsForRunning();
            window.ProgressTracker?.state.resume();
            
            window.PopupUtils?.log('INFO', '▶️ Pack resumed');
            window.UIComponents?.notifications.info('Pack resumed');
        }
    },
    
    async stopPack() {
        chrome.storage.sync.set({ 
            isStopped: true,
            isPaused: false 
        });
        
        PackState.isRunning = false;
        PackState.isPaused = false;
        PackState.isStopped = true;
        
        window.UIComponents?.buttons.setButtonsForStopped();
        
        window.PopupUtils?.log('INFO', '⏹️ Pack stopped');
        window.UIComponents?.notifications.warning('Pack stopped');
    },
    
    async resetPack() {
        const confirmReset = confirm(
            'Reset all extension state?\n\n' +
            'This will:\n' +
            '• Stop all running processes\n' +
            '• Clear all results and progress\n' +
            '• Reset UI to initial state\n' +
            '• Clear all cached data\n\n' +
            'Continue?'
        );
        
        if (confirmReset) {
            try {
                window.PopupUtils?.log('INFO', '🔄 Resetting all extension state');
                
                // Stop all processes
                await this.stopPack();
                
                // Clear all storage
                chrome.storage.local.clear();
                chrome.storage.sync.clear();
                
                // Reset UI
                window.PopupUtils.resetInfoTableAndCache();
                window.UIComponents?.buttons.setButtonsForStopped();
                window.ProgressTracker?.state.reset();
                PackState.reset();
                
                window.UIComponents?.notifications.success('Extension state reset successfully!');
                
                // Optional: reload popup
                const reloadPopup = confirm('Reload popup to complete reset?');
                if (reloadPopup) {
                    window.location.reload();
                }
                
            } catch (error) {
                window.PopupUtils?.log('ERROR', 'Failed to reset extension state:', error);
                window.UIComponents?.notifications.error('Failed to reset: ' + error.message);
            }
        }
    }
};

// ========== Auto-Run All Packs ==========
const AutoRunManager = {
    async handlePackCompletion() {
        if (!PackState.autoRunAll) {
            window.PopupUtils?.log('INFO', '📦 Pack completed, auto-run disabled');
            return;
        }
        
        window.PopupUtils?.log('INFO', `📦 Pack ${PackState.currentPack}/${PackState.totalPacks} completed`);
        
        // Wait a bit before starting next pack
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (PackState.moveToNextPack()) {
            window.PopupUtils?.log('INFO', `📦 Auto-starting next pack ${PackState.currentPack}/${PackState.totalPacks}`);
            
            // Update pack configuration
            await PackOperations.savePackConfiguration();
            
            // Start next pack
            await PackOperations.runCurrentPack();
            
            window.UIComponents?.notifications.info(`Auto-started pack ${PackState.currentPack}/${PackState.totalPacks}`);
        } else {
            // All packs completed
            this.handleAllPacksCompleted();
        }
    },
    
    handleAllPacksCompleted() {
        PackState.reset();
        window.UIComponents?.buttons.setButtonsForStopped();
        
        window.PopupUtils?.log('INFO', '🎉 All packs completed!');
        window.UIComponents?.notifications.success('All packs completed successfully!');
        
        // Show completion summary
        chrome.storage.local.get(['urlSuccess', 'urlError'], (data) => {
            const { urlSuccess = 0, urlError = 0 } = data;
            const total = urlSuccess + urlError;
            const successRate = total > 0 ? ((urlSuccess / total) * 100).toFixed(1) : 0;
            
            const summary = `Processing completed!\n\n` +
                `Total URLs: ${total}\n` +
                `Success: ${urlSuccess}\n` +
                `Errors: ${urlError}\n` +
                `Success Rate: ${successRate}%`;
            
            setTimeout(() => alert(summary), 1000);
        });
    }
};

// ========== Pack Event Handlers ==========
function initializePackEventHandlers() {
    const elements = window.UIComponents?.elements;
    
    if (elements?.startBtn) {
        elements.startBtn.onclick = async () => {
            if (PackState.isPaused) {
                await PackOperations.resumePack();
            } else {
                await handleStartButtonClick();
            }
        };
    }
    
    if (elements?.pauseBtn) {
        elements.pauseBtn.onclick = PackOperations.pausePack;
    }
    
    if (elements?.stopBtn) {
        elements.stopBtn.onclick = PackOperations.stopPack;
    }
    
    if (elements?.resetBtn) {
        elements.resetBtn.onclick = PackOperations.resetPack;
    }
    
    window.PopupUtils?.log('INFO', '🎛️ Pack event handlers initialized');
}

async function handleStartButtonClick() {
    try {
        const urlText = window.UIComponents?.elements.urlTextArea?.value || '';
        const chunkSize = parseInt(window.UIComponents?.elements.chunkSizeInput?.value) || 50;
        const autoRunAll = window.UIComponents?.elements.autoRunAllCheckbox?.checked || false;
        
        if (!urlText.trim()) {
            window.UIComponents?.notifications.warning('Please enter URLs to process');
            return;
        }
        
        // Parse URLs
        const urls = await window.PopupUtils.parseLinksFromText(urlText);
        
        if (urls.length === 0) {
            window.UIComponents?.notifications.warning('No valid URLs found');
            return;
        }
        
        // Check if background mode is enabled
        const isBackgroundMode = window.UIComponents?.elements.backgroundModeCheckbox?.checked || false;
        
        if (isBackgroundMode) {
            // Start queue mode
            await window.QueueManager?.operations.startQueue(urls);
        } else {
            // Start pack mode
            await PackOperations.startPack(urls, chunkSize, autoRunAll);
        }
        
    } catch (error) {
        window.PopupUtils?.log('ERROR', 'Failed to start processing:', error);
        window.UIComponents?.notifications.error('Failed to start: ' + error.message);
    }
}

// ========== Message Handler for Pack Updates ==========
function handlePackMessage(message) {
    switch (message.type) {
        case 'PACK_DONE':
            handlePackCompleted();
            break;
            
        case 'PACK_URL_PROCESSED':
            handlePackUrlProcessed(message.result);
            break;
            
        default:
            window.PopupUtils?.log('DEBUG', 'Unknown pack message:', message);
    }
}

async function handlePackCompleted() {
    window.PopupUtils?.log('INFO', `📦 Pack ${PackState.currentPack}/${PackState.totalPacks} completed`);
    
    // Update UI
    await window.ProgressTracker?.updateInfoTableFromCache();
    window.UIComponents?.updatePackStats();
    
    if (PackState.autoRunAll && !PackState.isStopped) {
        // Handle auto-run to next pack
        await AutoRunManager.handlePackCompletion();
    } else {
        // Single pack completed
        PackState.isRunning = false;
        window.UIComponents?.buttons.setButtonsForStopped();
        
        window.UIComponents?.notifications.success(`Pack ${PackState.currentPack} completed!`);
    }
}

function handlePackUrlProcessed(result) {
    // Update progress tracking
    window.ProgressTracker?.updateInfoTableFromCache();
}

// ========== Initialize Pack Manager ==========
function initializePackManager() {
    initializePackEventHandlers();
    
    // Load saved pack state
    chrome.storage.sync.get(['currentPack', 'totalPacks', 'autoRunAll'], (data) => {
        if (data.currentPack && data.totalPacks) {
            PackState.currentPack = data.currentPack;
            PackState.totalPacks = data.totalPacks;
            PackState.autoRunAll = data.autoRunAll || false;
            
            window.UIComponents?.updatePackDisplay();
        }
    });
    
    window.PopupUtils?.log('INFO', '📦 Pack Manager initialized');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializePackManager);

// ========== Export Functions ==========
window.PackManager = {
    state: PackState,
    operations: PackOperations,
    autoRun: AutoRunManager,
    handleMessage: handlePackMessage,
    initialize: initializePackManager
};
