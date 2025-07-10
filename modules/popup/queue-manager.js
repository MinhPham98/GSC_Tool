// ========== QUEUE MANAGER MODULE ==========
// Handles queue mode operations and background processing

// ========== Queue State ==========
const QueueState = {
    isActive: false,
    isPaused: false,
    isStopped: false,
    currentQueue: [],
    processedCount: 0,
    totalCount: 0,
    startTime: null,
    pauseTime: null,
    
    reset() {
        this.isActive = false;
        this.isPaused = false;
        this.isStopped = false;
        this.currentQueue = [];
        this.processedCount = 0;
        this.totalCount = 0;
        this.startTime = null;
        this.pauseTime = null;
        
        window.PopupUtils?.log('DEBUG', '🚀 Queue state reset');
    },
    
    start(urls) {
        this.isActive = true;
        this.isPaused = false;
        this.isStopped = false;
        this.currentQueue = [...urls];
        this.totalCount = urls.length;
        this.processedCount = 0;
        this.startTime = Date.now();
        
        window.PopupUtils?.log('INFO', `🚀 Queue started with ${urls.length} URLs`);
    },
    
    pause() {
        if (this.isActive && !this.isPaused) {
            this.isPaused = true;
            this.pauseTime = Date.now();
            window.PopupUtils?.log('INFO', '⏸️ Queue paused');
        }
    },
    
    resume() {
        if (this.isActive && this.isPaused) {
            this.isPaused = false;
            this.pauseTime = null;
            window.PopupUtils?.log('INFO', '▶️ Queue resumed');
        }
    },
    
    stop() {
        this.isActive = false;
        this.isPaused = false;
        this.isStopped = true;
        window.PopupUtils?.log('INFO', '⏹️ Queue stopped');
    }
};

// ========== Queue Operations ==========
const QueueOperations = {
    async startQueue(urls) {
        try {
            window.PopupUtils?.log('INFO', `🚀 Starting background queue with ${urls.length} URLs`);
            
            // Reset queue state
            QueueState.start(urls);
            
            // Clear previous results
            await this.clearQueueResults();
            
            // Start progress tracking
            window.ProgressTracker?.queue.startQueue(urls.length);
            
            // Update UI
            window.UIComponents?.queue.enableQueueButtons();
            window.UIComponents?.queue.hideResumeButton();
            window.UIComponents?.state.setQueueMode();
            
            // Send start command to background script
            chrome.runtime.sendMessage({
                type: "START_BACKGROUND_QUEUE",
                urls: urls,
                settings: await this.getQueueSettings()
            });
            
            window.PopupUtils?.log('INFO', '🚀 Queue start command sent to background');
            
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Failed to start queue:', error);
            window.UIComponents?.notifications.error('Failed to start queue: ' + error.message);
        }
    },
    
    async pauseQueue() {
        try {
            QueueState.pause();
            
            chrome.runtime.sendMessage({ type: "PAUSE_QUEUE" });
            window.PopupUtils?.log('INFO', '⏸️ Queue pause command sent');
            
            window.UIComponents?.queue.updateStatus('Paused');
            window.ProgressTracker?.state.pause();
            
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Failed to pause queue:', error);
        }
    },
    
    async resumeQueue() {
        try {
            QueueState.resume();
            
            chrome.runtime.sendMessage({ type: "RESUME_QUEUE" });
            window.PopupUtils?.log('INFO', '▶️ Queue resume command sent');
            
            window.UIComponents?.queue.updateStatus('Running');
            window.ProgressTracker?.state.resume();
            window.UIComponents?.queue.hideResumeButton();
            
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Failed to resume queue:', error);
        }
    },
    
    async stopQueue() {
        try {
            QueueState.stop();
            
            chrome.runtime.sendMessage({ type: "STOP_QUEUE" });
            window.PopupUtils?.log('INFO', '⏹️ Queue stop command sent');
            
            window.UIComponents?.queue.updateStatus('Stopped');
            window.UIComponents?.queue.disableQueueButtons();
            window.UIComponents?.queue.hideResumeButton();
            
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Failed to stop queue:', error);
        }
    },
    
    async getQueueSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([
                'temporaryRemoval',
                'downloadCheckbox'
            ], (data) => {
                resolve({
                    temporaryRemoval: data.temporaryRemoval || false,
                    downloadCheckbox: data.downloadCheckbox || false
                });
            });
        });
    },
    
    async clearQueueResults() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['queueResults', 'queueProcessingLocks'], () => {
                window.PopupUtils?.log('DEBUG', 'Queue results cleared');
                resolve();
            });
        });
    },
    
    async getQueueResults() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['queueResults'], (data) => {
                resolve(data.queueResults || []);
            });
        });
    }
};

// ========== Resume Functionality ==========
const ResumeManager = {
    async checkForStoppedQueue() {
        try {
            chrome.storage.local.get(['stoppedQueueState'], (data) => {
                if (data.stoppedQueueState) {
                    window.PopupUtils?.log('INFO', '🔄 Found stopped queue state, showing resume option');
                    this.showResumeOption(data.stoppedQueueState);
                }
            });
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Error checking for stopped queue:', error);
        }
    },
    
    showResumeOption(stoppedState) {
        // Show resume button
        window.UIComponents?.queue.showResumeButton();
        
        // Update status
        const remainingUrls = stoppedState.totalUrls - stoppedState.processedUrls;
        window.UIComponents?.queue.updateStatus(
            `Stopped at ${stoppedState.processedUrls}/${stoppedState.totalUrls} (${remainingUrls} remaining)`
        );
        
        // Add resume button click handler
        const resumeBtn = window.UIComponents?.elements.resumeQueueBtn;
        if (resumeBtn) {
            resumeBtn.onclick = () => this.resumeStoppedQueue(stoppedState);
        }
    },
    
    async resumeStoppedQueue(stoppedState) {
        const confirmResume = confirm(
            `Resume queue from where it stopped?\n\n` +
            `Processed: ${stoppedState.processedUrls}/${stoppedState.totalUrls}\n` +
            `Remaining: ${stoppedState.totalUrls - stoppedState.processedUrls} URLs\n` +
            `Original ETA: ${stoppedState.eta || 'Unknown'}`
        );
        
        if (confirmResume) {
            try {
                window.PopupUtils?.log('INFO', '🔄 Resuming stopped queue');
                
                // Clear stopped state
                chrome.storage.local.remove(['stoppedQueueState']);
                
                // Start queue with remaining URLs
                const remainingUrls = stoppedState.remainingUrls || [];
                await QueueOperations.startQueue(remainingUrls);
                
                window.UIComponents?.notifications.success('Queue resumed successfully!');
                
            } catch (error) {
                window.PopupUtils?.log('ERROR', 'Failed to resume queue:', error);
                window.UIComponents?.notifications.error('Failed to resume queue: ' + error.message);
            }
        }
    }
};

// ========== Queue Event Handlers ==========
function initializeQueueEventHandlers() {
    const elements = window.UIComponents?.elements;
    
    if (elements?.pauseQueueBtn) {
        elements.pauseQueueBtn.onclick = QueueOperations.pauseQueue;
    }
    
    if (elements?.stopQueueBtn) {
        elements.stopQueueBtn.onclick = QueueOperations.stopQueue;
    }
    
    if (elements?.resumeQueueBtn) {
        elements.resumeQueueBtn.onclick = QueueOperations.resumeQueue;
    }
    
    if (elements?.backgroundModeCheckbox) {
        elements.backgroundModeCheckbox.onchange = (event) => {
            const isQueueMode = event.target.checked;
            if (isQueueMode) {
                window.UIComponents?.state.setQueueMode();
            } else {
                window.UIComponents?.state.setPackMode();
            }
            
            window.PopupUtils?.log('UI', `Mode switched to: ${isQueueMode ? 'Queue' : 'Pack'}`);
        };
    }
    
    window.PopupUtils?.log('INFO', '🎛️ Queue event handlers initialized');
}

// ========== Message Handler for Queue Updates ==========
function handleQueueMessage(message) {
    switch (message.type) {
        case 'QUEUE_URL_PROCESSED':
            handleQueueUrlProcessed(message.result);
            break;
            
        case 'QUEUE_PAUSED':
            handleQueuePaused();
            break;
            
        case 'QUEUE_RESUMED':
            handleQueueResumed();
            break;
            
        case 'QUEUE_STOPPED':
            handleQueueStopped(message.state);
            break;
            
        case 'QUEUE_COMPLETED':
            handleQueueCompleted();
            break;
            
        default:
            window.PopupUtils?.log('DEBUG', 'Unknown queue message:', message);
    }
}

function handleQueueUrlProcessed(result) {
    QueueState.processedCount++;
    
    window.PopupUtils?.log('DEBUG', `Queue URL processed: ${result.url} - ${result.status}`);
    
    // Update progress
    QueueOperations.getQueueResults().then(results => {
        window.ProgressTracker?.queue.updateQueue(results);
    });
}

function handleQueuePaused() {
    QueueState.pause();
    window.UIComponents?.queue.updateStatus('Paused');
    window.UIComponents?.queue.showResumeButton();
    window.PopupUtils?.log('INFO', '⏸️ Queue paused');
}

function handleQueueResumed() {
    QueueState.resume();
    window.UIComponents?.queue.updateStatus('Running');
    window.UIComponents?.queue.hideResumeButton();
    window.PopupUtils?.log('INFO', '▶️ Queue resumed');
}

function handleQueueStopped(state) {
    QueueState.stop();
    window.UIComponents?.queue.updateStatus('Stopped');
    window.UIComponents?.queue.disableQueueButtons();
    
    if (state && state.hasRemaining) {
        // Save stopped state for potential resume
        chrome.storage.local.set({ stoppedQueueState: state });
        window.UIComponents?.queue.showResumeButton();
    }
    
    window.PopupUtils?.log('INFO', '⏹️ Queue stopped');
}

function handleQueueCompleted() {
    QueueState.reset();
    window.UIComponents?.queue.updateStatus('Completed');
    window.UIComponents?.queue.disableQueueButtons();
    window.ProgressTracker?.queue.completeQueue();
    
    window.PopupUtils?.log('INFO', '🎉 Queue completed');
}

// ========== Initialize Queue Manager ==========
function initializeQueueManager() {
    initializeQueueEventHandlers();
    ResumeManager.checkForStoppedQueue();
    
    window.PopupUtils?.log('INFO', '🚀 Queue Manager initialized');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeQueueManager);

// ========== Export Functions ==========
window.QueueManager = {
    state: QueueState,
    operations: QueueOperations,
    resume: ResumeManager,
    handleMessage: handleQueueMessage,
    initialize: initializeQueueManager
};
