// ========== PROGRESS TRACKER MODULE ==========
// Handles ETA calculation, progress tracking, and speed monitoring

// ========== Progress State ==========
const ProgressState = {
    startTime: null,
    lastUpdateTime: null,
    totalUrls: 0,
    processedUrls: 0,
    successCount: 0,
    errorCount: 0,
    avgTimePerUrl: 0,
    currentSpeed: 0,
    estimatedTimeRemaining: 0,
    isPaused: false,
    pauseTime: null,
    totalPauseTime: 0,
    
    reset() {
        this.startTime = null;
        this.lastUpdateTime = null;
        this.totalUrls = 0;
        this.processedUrls = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.avgTimePerUrl = 0;
        this.currentSpeed = 0;
        this.estimatedTimeRemaining = 0;
        this.isPaused = false;
        this.pauseTime = null;
        this.totalPauseTime = 0;
        
        window.PopupUtils?.log('DEBUG', '📊 Progress state reset');
    },
    
    start(totalUrls) {
        this.startTime = Date.now();
        this.lastUpdateTime = this.startTime;
        this.totalUrls = totalUrls;
        this.processedUrls = 0;
        this.totalPauseTime = 0;
        
        window.PopupUtils?.log('INFO', `📊 Progress tracking started for ${totalUrls} URLs`);
    },
    
    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.pauseTime = Date.now();
            window.PopupUtils?.log('DEBUG', '⏸️ Progress tracking paused');
        }
    },
    
    resume() {
        if (this.isPaused && this.pauseTime) {
            this.totalPauseTime += Date.now() - this.pauseTime;
            this.isPaused = false;
            this.pauseTime = null;
            window.PopupUtils?.log('DEBUG', '▶️ Progress tracking resumed');
        }
    },
    
    update(processedCount, successCount, errorCount) {
        this.processedUrls = processedCount;
        this.successCount = successCount;
        this.errorCount = errorCount;
        this.lastUpdateTime = Date.now();
        
        this.calculateMetrics();
        this.updateUI();
    },
    
    calculateMetrics() {
        if (!this.startTime || this.processedUrls === 0) return;
        
        const now = Date.now();
        const elapsedTime = now - this.startTime - this.totalPauseTime;
        const currentPauseTime = this.isPaused && this.pauseTime ? now - this.pauseTime : 0;
        const activeTime = elapsedTime - currentPauseTime;
        
        if (activeTime > 0) {
            // Calculate average time per URL
            this.avgTimePerUrl = activeTime / this.processedUrls;
            
            // Calculate current speed (URLs per minute)
            this.currentSpeed = this.processedUrls / (activeTime / 60000);
            
            // Calculate ETA
            const remainingUrls = this.totalUrls - this.processedUrls;
            this.estimatedTimeRemaining = remainingUrls * this.avgTimePerUrl;
        }
        
        window.PopupUtils?.log('DEBUG', '📊 Metrics calculated', {
            processedUrls: this.processedUrls,
            avgTimePerUrl: Math.round(this.avgTimePerUrl),
            currentSpeed: this.currentSpeed.toFixed(1),
            eta: Math.round(this.estimatedTimeRemaining / 1000)
        });
    },
    
    updateUI() {
        // Update processed count
        window.PopupUtils?.updateTextContent('#urlsProcessed', 
            `${this.processedUrls}/${this.totalUrls}`);
        
        // Update speed
        const speedText = this.isPaused ? 'Paused' : `${this.currentSpeed.toFixed(1)} URLs/min`;
        window.PopupUtils?.updateTextContent('#speedInfo', speedText);
        
        // Update ETA
        let etaText = 'Calculating...';
        if (this.isPaused) {
            etaText = 'Paused';
        } else if (this.estimatedTimeRemaining > 0) {
            etaText = this.formatTime(this.estimatedTimeRemaining);
        }
        window.PopupUtils?.updateTextContent('#etaInfo', etaText);
        
        // Update progress percentage
        const percentage = this.totalUrls > 0 ? Math.round((this.processedUrls / this.totalUrls) * 100) : 0;
        const progressBar = document.querySelector('#progressBar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
        }
        
        window.PopupUtils?.log('UI', `Progress updated: ${this.processedUrls}/${this.totalUrls} (${percentage}%)`);
    },
    
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
};

// ========== Queue Progress Tracker ==========
const QueueProgressTracker = {
    queueStartTime: null,
    queueTotalUrls: 0,
    queueProcessedUrls: 0,
    queueResults: [],
    
    startQueue(totalUrls) {
        this.queueStartTime = Date.now();
        this.queueTotalUrls = totalUrls;
        this.queueProcessedUrls = 0;
        this.queueResults = [];
        
        window.PopupUtils?.log('INFO', `🚀 Queue progress tracking started for ${totalUrls} URLs`);
        this.updateQueueUI();
    },
    
    updateQueue(results) {
        this.queueResults = results || [];
        this.queueProcessedUrls = this.queueResults.length;
        
        this.updateQueueUI();
        window.PopupUtils?.log('DEBUG', `Queue progress: ${this.queueProcessedUrls}/${this.queueTotalUrls}`);
    },
    
    updateQueueUI() {
        const successCount = this.queueResults.filter(r => r.status === 'success').length;
        const errorCount = this.queueResults.filter(r => r.status === 'error').length;
        
        // Update queue status
        const status = `${this.queueProcessedUrls}/${this.queueTotalUrls} processed (✅${successCount} ❌${errorCount})`;
        window.UIComponents?.queue.updateStatus(status);
        
        // Calculate queue ETA
        if (this.queueStartTime && this.queueProcessedUrls > 0) {
            const elapsedTime = Date.now() - this.queueStartTime;
            const avgTimePerUrl = elapsedTime / this.queueProcessedUrls;
            const remainingUrls = this.queueTotalUrls - this.queueProcessedUrls;
            const eta = remainingUrls * avgTimePerUrl;
            
            const etaText = eta > 0 ? ProgressState.formatTime(eta) : 'Complete';
            window.PopupUtils?.updateTextContent('#queueEtaInfo', etaText);
        }
        
        // Update queue progress bar
        const percentage = this.queueTotalUrls > 0 ? 
            Math.round((this.queueProcessedUrls / this.queueTotalUrls) * 100) : 0;
        
        const queueProgressBar = document.querySelector('#queueProgressBar');
        if (queueProgressBar) {
            queueProgressBar.style.width = `${percentage}%`;
            queueProgressBar.textContent = `${percentage}%`;
        }
    },
    
    completeQueue() {
        const endTime = Date.now();
        const totalTime = endTime - this.queueStartTime;
        const successCount = this.queueResults.filter(r => r.status === 'success').length;
        const errorCount = this.queueResults.filter(r => r.status === 'error').length;
        
        window.PopupUtils?.log('INFO', '🎉 Queue completed', {
            totalUrls: this.queueTotalUrls,
            processedUrls: this.queueProcessedUrls,
            successCount,
            errorCount,
            totalTime: ProgressState.formatTime(totalTime)
        });
        
        window.UIComponents?.notifications.success(
            `Queue completed: ${successCount} success, ${errorCount} errors in ${ProgressState.formatTime(totalTime)}`
        );
    }
};

// ========== Pack Progress Integration ==========
async function updateInfoTableFromCache() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['resultLinks'], (data) => {
            const resultLinks = data.resultLinks || [];
            
            if (resultLinks.length > 0) {
                // Show info table
                const infoTable = document.querySelector('.infoTable');
                if (infoTable) {
                    infoTable.style.display = 'block';
                    
                    // Create or update table content
                    let tableHTML = '<table><tr><th>STT</th><th>URL</th><th>Status</th><th>Reason</th></tr>';
                    
                    resultLinks.forEach(result => {
                        const statusIcon = result.status === 'success' ? '✅' : '❌';
                        const statusClass = result.status === 'success' ? 'success' : 'error';
                        
                        tableHTML += `
                            <tr class="${statusClass}">
                                <td>${result.id}</td>
                                <td title="${result.url}">${result.url.length > 50 ? result.url.substring(0, 50) + '...' : result.url}</td>
                                <td>${statusIcon}</td>
                                <td>${result.reason || 'N/A'}</td>
                            </tr>
                        `;
                    });
                    
                    tableHTML += '</table>';
                    infoTable.innerHTML = tableHTML;
                }
                
                // Update progress
                const successCount = resultLinks.filter(r => r.status === 'success').length;
                const errorCount = resultLinks.filter(r => r.status === 'error').length;
                
                // Update stats in UI
                window.UIComponents?.updatePackStats();
                
                window.PopupUtils?.log('UI', `Info table updated with ${resultLinks.length} results`);
            }
            
            resolve(resultLinks);
        });
    });
}

// ========== Export Functions ==========
window.ProgressTracker = {
    state: ProgressState,
    queue: QueueProgressTracker,
    updateInfoTableFromCache,
    
    // Legacy compatibility
    updateProgress: ProgressState.update.bind(ProgressState),
    resetProgress: ProgressState.reset.bind(ProgressState),
    startProgress: ProgressState.start.bind(ProgressState),
    pauseProgress: ProgressState.pause.bind(ProgressState),
    resumeProgress: ProgressState.resume.bind(ProgressState)
};
