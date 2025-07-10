// ===== POPUP CORE - Main Entry and Integration =====

// Import utilities and modules
// (These will be loaded via manifest, so we can use the global functions)

class PopupCore {
    constructor() {
        this.packTimeout = null;
        this.backgroundQueueActive = false;
        this.queueUpdateInterval = null;
        
        this.autoRun = false;
        this.isPaused = false;
        this.sentPackCount = 0;
        this.sentUrlCount = 0;
        this.isFileInput = false;
        this.temporaryRemoval = true;
        
        this.urlChunks = [];
        this.currentPack = 0;
        this.chunkSize = 10;
        
        this.initializePopup();
    }
    
    initializePopup() {
        popupLog('INFO', '🚀 Initializing PopupCore...');
        
        // Initialize chunk size
        this.chunkSize = parseInt(document.getElementById('chunkSize')?.value || 10, 10);
        
        // Initialize UI components and their event listeners
        this.initializeEventListeners();
        
        // Initialize queue UI state
        this.updateQueueUI();
        
        // Restore any saved state
        this.restoreState();
        
        popupLog('INFO', '✅ PopupCore initialization complete');
    }
    
    initializeEventListeners() {
        popupLog('INFO', '🔗 Setting up event listeners...');
        
        // Pack mode buttons
        const startBtn = document.getElementById("startBtn");
        const pauseBtn = document.getElementById("pauseBtn");
        const stopBtn = document.getElementById("stopBtn");
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) {
            startBtn.addEventListener("click", async () => {
                await this.handleStartPack();
            });
        }
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.handlePausePack();
            });
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.handleStopPack();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.handleResetAll();
            });
        }
        
        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (event) => {
                this.handleFileSelect(event);
            });
        }
        
        // Background mode checkbox
        const backgroundModeCheckbox = document.getElementById('backgroundModeCheckbox');
        if (backgroundModeCheckbox) {
            backgroundModeCheckbox.addEventListener('change', (event) => {
                this.handleBackgroundModeToggle(event);
            });
        }
        
        // Queue control buttons
        const pauseQueueBtn = document.getElementById('pauseQueueBtn');
        const resumeQueueBtn = document.getElementById('resumeQueueBtn');
        const resumeStoppedBtn = document.getElementById('resumeStoppedBtn');
        const stopQueueBtn = document.getElementById('stopQueueBtn');
        const downloadQueueBtn = document.getElementById('downloadQueueBtn');
        
        if (pauseQueueBtn) {
            pauseQueueBtn.addEventListener('click', () => {
                pauseQueue();
            });
        }
        
        if (resumeQueueBtn) {
            resumeQueueBtn.addEventListener('click', () => {
                resumeQueue();
            });
        }
        
        if (resumeStoppedBtn) {
            resumeStoppedBtn.addEventListener('click', () => {
                resumeStoppedQueue();
            });
        }
        
        if (stopQueueBtn) {
            stopQueueBtn.addEventListener('click', () => {
                stopQueue();
            });
        }
        
        if (downloadQueueBtn) {
            downloadQueueBtn.addEventListener('click', () => {
                downloadQueueResults();
            });
        }
        
        // Chrome runtime message listener
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            this.handleRuntimeMessage(msg, sender, sendResponse);
        });
        
        popupLog('INFO', '✅ Event listeners setup complete');
    }
    
    async handleStartPack() {
        popupLog('UI', '▶️ Start pack button clicked');
        
        const linksTextarea = document.getElementById('links');
        const autoRunCheckbox = document.getElementById('autoRunCheckbox');
        const backgroundModeCheckbox = document.getElementById('backgroundModeCheckbox');
        
        if (backgroundModeCheckbox && backgroundModeCheckbox.checked) {
            // Queue mode
            await startBackgroundQueue();
            return;
        }
        
        // Pack mode
        const urlsText = linksTextarea?.value?.trim() || '';
        
        if (!urlsText && !this.isFileInput) {
            showMessage('⚠️ Vui lòng nhập URLs hoặc chọn file', 'warning');
            return;
        }
        
        if (!this.urlChunks.length) {
            // Parse URLs first
            const urls = await parseLinksFromText(urlsText);
            if (!urls.length) {
                showMessage('⚠️ Không tìm thấy URL hợp lệ', 'warning');
                return;
            }
            
            this.chunkSize = parseInt(document.getElementById('chunkSize')?.value || 10, 10);
            this.urlChunks = this.splitIntoChunks(urls, this.chunkSize);
            this.currentPack = 0;
            this.sentPackCount = 0;
            this.sentUrlCount = 0;
            
            updatePackDisplay(this.currentPack, this.urlChunks.length);
            resetInfoTableAndCache();
        }
        
        this.autoRun = autoRunCheckbox ? autoRunCheckbox.checked : false;
        
        if (this.autoRun) {
            startPackAutoRun(this.urlChunks, this.temporaryRemoval);
        } else {
            await this.clickStartBtn();
        }
        
        const startBtn = document.getElementById("startBtn");
        if (startBtn) startBtn.disabled = this.autoRun;
    }
    
    handlePausePack() {
        popupLog('UI', '⏸️ Pause pack button clicked');
        pausePackMode();
    }
    
    handleStopPack() {
        popupLog('UI', '⏹️ Stop pack button clicked');
        stopPackMode();
    }
    
    handleResetAll() {
        popupLog('UI', '🔄 Reset button clicked');
        resetAll();
    }
    
    handleFileSelect(event) {
        popupLog('UI', '📁 File selected');
        handleFileSelect(event);
        this.isFileInput = true;
    }
    
    handleBackgroundModeToggle(event) {
        const isChecked = event.target.checked;
        popupLog('UI', '🔄 Background mode toggled:', isChecked);
        
        if (isChecked) {
            switchToQueueMode();
        } else {
            switchToPackMode();
        }
    }
    
    async handleRuntimeMessage(msg, sender, sendResponse) {
        if (msg.type === "PACK_DONE") {
            updateInfoTableFromCache();

            this.sentPackCount++;
            this.sentUrlCount += this.urlChunks[this.currentPack] ? this.urlChunks[this.currentPack].length : 0;
            
            updatePackStats(this.sentPackCount, this.sentUrlCount);

            if (this.autoRun && !this.isPaused && this.currentPack < this.urlChunks.length - 1) {
                notifyPackDoneAuto();
                this.currentPack++;
                updatePackDisplay(this.currentPack, this.urlChunks.length);
                this.packTimeout = setTimeout(async () => {
                    if (this.autoRun && !this.isPaused) {
                        await this.clickStartBtn();
                    }
                }, 1000);
            } else {
                this.autoRun = false;
                const startBtn = document.getElementById("startBtn");
                if (startBtn) startBtn.disabled = false;
                notifyDoneAll();
            }
        }

        // Handle queue messages
        if (msg.type === "QUEUE_COMPLETED") {
            popupLog('INFO', '🎉 Queue completed message received:', {
                totalProcessed: msg.totalProcessed
            });
            
            this.backgroundQueueActive = false;
            this.updateQueueUI();
            clearInterval(this.queueUpdateInterval);
            showMessage(`🎉 Background queue hoàn thành! Đã xử lý ${msg.totalProcessed} URLs.`, 'success');
        }

        if (msg.type === "QUEUE_STATUS_UPDATE") {
            updateQueueProgress(msg.data);
        }

        if (msg.type === "QUEUE_PAUSED") {
            popupLog('INFO', '⏸️ Queue paused message received');
            this.updateQueueUI();
        }

        if (msg.type === "QUEUE_RESUMED") {
            popupLog('INFO', '▶️ Queue resumed message received');
            this.updateQueueUI();
        }

        if (msg.type === "QUEUE_STOPPED") {
            popupLog('INFO', '⏹️ Queue stopped message received');
            this.backgroundQueueActive = false;
            this.updateQueueUI();
            clearInterval(this.queueUpdateInterval);
        }
    }
    
    async clickStartBtn() {
        const URLs = this.urlChunks[this.currentPack] || [];
        if (URLs.length > 0) {
            chrome.storage.sync.set({
                URLs: URLs,
                temporaryRemoval: this.temporaryRemoval
            });

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ["url-modular.js"]
                });
            });
        } else {
            setTimeout(() => {
                alert("Không có gì để xoá trong pack này.")
            }, 200);
        }
    }
    
    splitIntoChunks(array, chunkSize) {
        const results = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            results.push(array.slice(i, i + chunkSize));
        }
        return results;
    }
    
    updateQueueUI() {
        const bodyElement = document.body;
        
        if (this.backgroundQueueActive) {
            bodyElement.classList.add('queue-mode-active');
            switchToQueueMode();
            
            const queueStatusDiv = document.getElementById('queue-status');
            const downloadQueueBtn = document.getElementById('downloadQueueBtn');
            
            if (queueStatusDiv) queueStatusDiv.classList.remove('hidden');
            if (downloadQueueBtn) downloadQueueBtn.classList.remove('hidden');
            
            updateQueueInfoFromStorage();
        } else {
            bodyElement.classList.remove('queue-mode-active');
            switchToPackMode();
        }
    }
    
    restoreState() {
        // Restore any saved popup state from storage
        chrome.storage.local.get(['backgroundQueueActive'], (data) => {
            if (data.backgroundQueueActive) {
                this.backgroundQueueActive = true;
                this.updateQueueUI();
                startQueueStatusUpdates();
            }
        });
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    popupLog('INFO', '📄 DOM loaded, initializing popup...');
    window.popupCore = new PopupCore();
});

// Export for global access
window.PopupCore = PopupCore;
