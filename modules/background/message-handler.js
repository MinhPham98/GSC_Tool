// ===== MESSAGE HANDLER - Chrome Runtime Message Processing =====

class MessageHandler {
    constructor() {
        this.log = self.backgroundUtils.log;
        this.queueController = self.queueController;
        this.packController = self.packController;
        this.storageManager = self.storageManager;
        
        this.setupMessageListeners();
    }

    setupMessageListeners() {
        // Chrome runtime message listener
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            this.handleMessage(msg, sender, sendResponse);
            return true; // Keep the message channel open for async responses
        });

        // Service worker lifecycle listeners
        chrome.runtime.onSuspend?.addListener(() => {
            this.log('INFO', '💤 Service worker suspending...');
        });

        chrome.runtime.onConnect?.addListener((port) => {
            this.log('INFO', '🔗 Runtime connection established:', port.name);
        });
    }

    async handleMessage(msg, sender, sendResponse) {
        this.log('DEBUG', '📨 Message received:', {
            type: msg.type,
            sender: sender.tab?.id || 'popup',
            hasData: !!msg.data
        });

        try {
            let result = null;

            switch (msg.type) {
                // ========== PACK MODE MESSAGES ==========
                case "START_PACK":
                    result = await this.handleStartPack(msg, sender);
                    break;

                case "PACK_DONE":
                    result = await this.handlePackDone(msg, sender);
                    break;

                case "PAUSE_PACK":
                    result = await this.handlePausePack(msg, sender);
                    break;

                case "RESUME_PACK":
                    result = await this.handleResumePack(msg, sender);
                    break;

                case "STOP_PACK":
                    result = await this.handleStopPack(msg, sender);
                    break;

                // ========== QUEUE MODE MESSAGES ==========
                case "START_QUEUE":
                    result = await this.handleStartQueue(msg, sender);
                    break;

                case "QUEUE_URL_PROCESSED":
                    result = await this.handleQueueUrlProcessed(msg, sender);
                    break;

                case "PAUSE_QUEUE":
                    result = await this.handlePauseQueue(msg, sender);
                    break;

                case "RESUME_QUEUE":
                    result = await this.handleResumeQueue(msg, sender);
                    break;

                case "RESUME_STOPPED_QUEUE":
                    result = await this.handleResumeStoppedQueue(msg, sender);
                    break;

                case "STOP_QUEUE":
                    result = await this.handleStopQueue(msg, sender);
                    break;

                // ========== STATUS AND INFO MESSAGES ==========
                case "GET_STATUS":
                    result = await this.handleGetStatus(msg, sender);
                    break;

                case "GET_QUEUE_RESULTS":
                    result = await this.handleGetQueueResults(msg, sender);
                    break;

                case "CLEAR_ALL_DATA":
                    result = await this.handleClearAllData(msg, sender);
                    break;

                // ========== DEBUG MESSAGES ==========
                case "GET_DEBUG_INFO":
                    result = await this.handleGetDebugInfo(msg, sender);
                    break;

                default:
                    this.log('WARN', '⚠️ Unknown message type:', msg.type);
                    result = { success: false, error: 'Unknown message type' };
            }

            if (sendResponse) {
                sendResponse(result);
            }

        } catch (error) {
            this.log('ERROR', '❌ Error handling message:', {
                type: msg.type,
                error: error.message,
                stack: error.stack
            });

            if (sendResponse) {
                sendResponse({ success: false, error: error.message });
            }
        }
    }

    // ========== PACK MODE MESSAGE HANDLERS ==========

    async handleStartPack(msg, sender) {
        const { urlChunks, autoRun } = msg;
        const tabId = sender.tab?.id;

        if (!tabId) {
            throw new Error('Tab ID not found');
        }

        await this.packController.initializePack(urlChunks, tabId, autoRun);
        const success = await this.packController.sendPack();

        return { success, message: 'Pack processing started' };
    }

    async handlePackDone(msg, sender) {
        await this.packController.handlePackCompletion();
        return { success: true, message: 'Pack completion handled' };
    }

    async handlePausePack(msg, sender) {
        await this.packController.pausePack();
        return { success: true, message: 'Pack paused' };
    }

    async handleResumePack(msg, sender) {
        await this.packController.resumePack();
        return { success: true, message: 'Pack resumed' };
    }

    async handleStopPack(msg, sender) {
        await this.packController.stopPack();
        return { success: true, message: 'Pack stopped' };
    }

    // ========== QUEUE MODE MESSAGE HANDLERS ==========

    async handleStartQueue(msg, sender) {
        const { urls, temporaryRemoval } = msg;
        const tabId = sender.tab?.id;

        if (!tabId) {
            throw new Error('Tab ID not found');
        }

        const success = await this.queueController.startQueue(urls, tabId, temporaryRemoval);
        return { success, message: 'Queue processing started' };
    }

    async handleQueueUrlProcessed(msg, sender) {
        const { result } = msg;
        
        // Add result to storage
        await this.storageManager.addQueueResult(result);
        
        // Handle completion in queue controller
        await this.queueController.handleUrlCompletion(result);
        
        return { success: true, message: 'URL completion handled' };
    }

    async handlePauseQueue(msg, sender) {
        await this.queueController.pauseQueue();
        return { success: true, message: 'Queue paused' };
    }

    async handleResumeQueue(msg, sender) {
        await this.queueController.resumeQueue();
        return { success: true, message: 'Queue resumed' };
    }

    async handleResumeStoppedQueue(msg, sender) {
        const success = await this.queueController.resumeStoppedQueue();
        return { 
            success, 
            message: success ? 'Stopped queue resumed' : 'No stopped queue found' 
        };
    }

    async handleStopQueue(msg, sender) {
        await this.queueController.stopQueue();
        return { success: true, message: 'Queue stopped' };
    }

    // ========== STATUS AND INFO MESSAGE HANDLERS ==========

    async handleGetStatus(msg, sender) {
        const packState = this.packController.getState();
        const queueState = this.queueController.getState();
        const backgroundState = self.backgroundUtils.getBackgroundState();

        return {
            success: true,
            data: {
                pack: packState,
                queue: queueState,
                background: backgroundState
            }
        };
    }

    async handleGetQueueResults(msg, sender) {
        const results = await this.storageManager.getQueueResults();
        return {
            success: true,
            data: { results }
        };
    }

    async handleClearAllData(msg, sender) {
        this.log('INFO', '🧹 Clearing all extension data...');

        // Stop any ongoing processes
        await this.packController.stopPack();
        await this.queueController.stopQueue();

        // Clear all storage
        await this.storageManager.clearPackState();
        await this.storageManager.clearQueueState();
        await this.storageManager.clearStoppedQueue();
        await this.storageManager.clearQueueResults();
        await this.storageManager.resetCounters();

        // Clear sync storage
        await this.storageManager.safeStorageSet({
            URLs: null,
            temporaryRemoval: null,
            backgroundQueueMode: null,
            currentQueueIndex: null,
            isPaused: false,
            isStopped: false,
            running: false,
            currentUrlIndex: null,
            totalInPack: null
        }, 'sync');

        return { success: true, message: 'All data cleared' };
    }

    // ========== DEBUG MESSAGE HANDLERS ==========

    async handleGetDebugInfo(msg, sender) {
        const packState = this.packController.getState();
        const queueState = this.queueController.getState();
        const backgroundState = self.backgroundUtils.getBackgroundState();
        const counters = await this.storageManager.getCounters();
        const queueResults = await this.storageManager.getQueueResults();

        return {
            success: true,
            data: {
                background: backgroundState,
                pack: packState,
                queue: queueState,
                counters: counters,
                queueResultsCount: queueResults.length,
                timestamp: new Date().toISOString()
            }
        };
    }

    // ========== FORWARDING MESSAGES TO POPUP ==========

    async forwardToPopup(messageType, data = {}) {
        try {
            await chrome.runtime.sendMessage({
                type: messageType,
                data: data,
                timestamp: Date.now()
            });
            this.log('DEBUG', `📤 Message forwarded to popup: ${messageType}`);
        } catch (error) {
            this.log('DEBUG', `🔧 Could not forward message to popup (may be closed): ${messageType}`);
        }
    }
}

// Export globally
self.MessageHandler = MessageHandler;
self.messageHandler = new MessageHandler();
