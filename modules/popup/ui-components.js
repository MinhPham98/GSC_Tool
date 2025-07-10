// ========== UI COMPONENTS MODULE ==========
// Handles UI element initialization and DOM manipulation

// ========== DOM Element References ==========
const UIElements = {
    // Input elements
    chunkSizeInput: document.getElementById('chunkSize'),
    
    // Buttons
    startBtn: document.getElementById("startBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    stopBtn: document.getElementById("stopBtn"),
    resetBtn: document.getElementById("resetBtn"),
    pauseQueueBtn: document.getElementById('pauseQueueBtn'),
    stopQueueBtn: document.getElementById('stopQueueBtn'),
    resumeQueueBtn: document.getElementById('resumeQueueBtn'),
    
    // Checkboxes
    backgroundModeCheckbox: document.getElementById('backgroundModeCheckbox'),
    downloadCheckbox: document.getElementById('downloadCheckbox'),
    temporaryRemovalCheckbox: document.getElementById('temporaryRemovalCheckbox'),
    autoRunAllCheckbox: document.getElementById('autoRunAll'),
    
    // Status displays
    queueStatusDiv: document.getElementById('queue-status'),
    packStatusDiv: document.getElementById('pack-status'),
    infoTable: document.querySelector('.infoTable'),
    
    // File input
    fileInput: document.getElementById('fileInput'),
    
    // Text areas
    urlTextArea: document.getElementById('urlList')
};

// ========== UI State Management ==========
const UIState = {
    isPackMode: true,
    isQueueMode: false,
    currentMode: 'pack',
    
    setPackMode() {
        this.isPackMode = true;
        this.isQueueMode = false;
        this.currentMode = 'pack';
        this.updateModeDisplay();
    },
    
    setQueueMode() {
        this.isPackMode = false;
        this.isQueueMode = true;
        this.currentMode = 'queue';
        this.updateModeDisplay();
    },
    
    updateModeDisplay() {
        if (window.PopupUtils) {
            window.PopupUtils.log('UI', `Mode changed to: ${this.currentMode}`);
        }
        
        // Update UI based on current mode
        if (this.isPackMode) {
            window.PopupUtils?.showElement('#pack-controls');
            window.PopupUtils?.hideElement('#queue-controls');
        } else {
            window.PopupUtils?.hideElement('#pack-controls');
            window.PopupUtils?.showElement('#queue-controls');
        }
    }
};

// ========== Pack Display Functions ==========
function updatePackDisplay() {
    chrome.storage.sync.get(['currentPack', 'totalPacks'], (data) => {
        const { currentPack = 1, totalPacks = 1 } = data;
        const packInfo = `Pack ${currentPack}/${totalPacks}`;
        
        window.PopupUtils?.updateTextContent('#packInfo', packInfo);
        window.PopupUtils?.log('UI', `Pack display updated: ${packInfo}`);
    });
}

function updatePackStats() {
    chrome.storage.local.get(['urlSuccess', 'urlError'], (data) => {
        const { urlSuccess = 0, urlError = 0 } = data;
        const total = urlSuccess + urlError;
        const successRate = total > 0 ? ((urlSuccess / total) * 100).toFixed(1) : 0;
        
        const statsHTML = `
            <div class="stats-container">
                <span class="stat-item">✅ ${urlSuccess}</span>
                <span class="stat-item">❌ ${urlError}</span>
                <span class="stat-item">📊 ${successRate}%</span>
            </div>
        `;
        
        window.PopupUtils?.updateInnerHTML('#statsInfo', statsHTML);
        window.PopupUtils?.log('UI', `Pack stats updated: ${urlSuccess}/${urlError} (${successRate}%)`);
    });
}

// ========== Button State Management ==========
const ButtonStates = {
    enableStart() {
        UIElements.startBtn.disabled = false;
        UIElements.startBtn.textContent = "Start";
        UIElements.startBtn.style.backgroundColor = "#4CAF50";
        window.PopupUtils?.log('UI', 'Start button enabled');
    },
    
    disableStart() {
        UIElements.startBtn.disabled = true;
        UIElements.startBtn.style.backgroundColor = "#cccccc";
        window.PopupUtils?.log('UI', 'Start button disabled');
    },
    
    enablePause() {
        UIElements.pauseBtn.disabled = false;
        UIElements.pauseBtn.style.backgroundColor = "#ff9800";
        window.PopupUtils?.log('UI', 'Pause button enabled');
    },
    
    disablePause() {
        UIElements.pauseBtn.disabled = true;
        UIElements.pauseBtn.style.backgroundColor = "#cccccc";
        window.PopupUtils?.log('UI', 'Pause button disabled');
    },
    
    enableStop() {
        UIElements.stopBtn.disabled = false;
        UIElements.stopBtn.style.backgroundColor = "#f44336";
        window.PopupUtils?.log('UI', 'Stop button enabled');
    },
    
    disableStop() {
        UIElements.stopBtn.disabled = true;
        UIElements.stopBtn.style.backgroundColor = "#cccccc";
        window.PopupUtils?.log('UI', 'Stop button disabled');
    },
    
    setButtonsForRunning() {
        this.disableStart();
        this.enablePause();
        this.enableStop();
        window.PopupUtils?.log('UI', 'Buttons set for running state');
    },
    
    setButtonsForStopped() {
        this.enableStart();
        this.disablePause();
        this.disableStop();
        window.PopupUtils?.log('UI', 'Buttons set for stopped state');
    },
    
    setButtonsForPaused() {
        this.enableStart();
        this.disablePause();
        this.enableStop();
        UIElements.startBtn.textContent = "Resume";
        UIElements.startBtn.style.backgroundColor = "#2196F3";
        window.PopupUtils?.log('UI', 'Buttons set for paused state');
    }
};

// ========== Queue UI Functions ==========
const QueueUI = {
    updateStatus(status) {
        if (UIElements.queueStatusDiv) {
            UIElements.queueStatusDiv.textContent = status;
            window.PopupUtils?.log('UI', `Queue status updated: ${status}`);
        }
    },
    
    enableQueueButtons() {
        if (UIElements.pauseQueueBtn) UIElements.pauseQueueBtn.disabled = false;
        if (UIElements.stopQueueBtn) UIElements.stopQueueBtn.disabled = false;
        window.PopupUtils?.log('UI', 'Queue buttons enabled');
    },
    
    disableQueueButtons() {
        if (UIElements.pauseQueueBtn) UIElements.pauseQueueBtn.disabled = true;
        if (UIElements.stopQueueBtn) UIElements.stopQueueBtn.disabled = true;
        window.PopupUtils?.log('UI', 'Queue buttons disabled');
    },
    
    showResumeButton() {
        if (UIElements.resumeQueueBtn) {
            UIElements.resumeQueueBtn.style.display = 'block';
            window.PopupUtils?.log('UI', 'Resume queue button shown');
        }
    },
    
    hideResumeButton() {
        if (UIElements.resumeQueueBtn) {
            UIElements.resumeQueueBtn.style.display = 'none';
            window.PopupUtils?.log('UI', 'Resume queue button hidden');
        }
    }
};

// ========== File Input Handling ==========
function initializeFileInput() {
    if (UIElements.fileInput) {
        UIElements.fileInput.addEventListener('change', handleFileSelect);
        window.PopupUtils?.log('UI', 'File input initialized');
    }
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    window.PopupUtils?.log('INFO', `File selected: ${file.name} (${file.size} bytes)`);
    
    const reader = new FileReader();
    reader.onload = async function(fileLoadEvent) {
        try {
            const text = fileLoadEvent.target.result;
            const urls = await window.PopupUtils.parseLinksFromText(text);
            
            if (UIElements.urlTextArea) {
                UIElements.urlTextArea.value = urls.join('\n');
                window.PopupUtils?.log('INFO', `Loaded ${urls.length} URLs from file`);
            }
        } catch (error) {
            window.PopupUtils?.log('ERROR', 'Error processing file:', error);
        }
    };
    
    reader.readAsText(file);
}

// ========== Notifications ==========
const Notifications = {
    show(type, message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px',
            borderRadius: '5px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '10000',
            minWidth: '200px',
            backgroundColor: this.getBackgroundColor(type)
        });
        
        document.body.appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
        
        window.PopupUtils?.log('UI', `Notification shown: ${type} - ${message}`);
    },
    
    getBackgroundColor(type) {
        switch (type) {
            case 'success': return '#4CAF50';
            case 'error': return '#f44336';
            case 'warning': return '#ff9800';
            case 'info': return '#2196F3';
            default: return '#333333';
        }
    },
    
    success(message, duration) {
        this.show('success', message, duration);
    },
    
    error(message, duration) {
        this.show('error', message, duration);
    },
    
    warning(message, duration) {
        this.show('warning', message, duration);
    },
    
    info(message, duration) {
        this.show('info', message, duration);
    }
};

// ========== Initialize UI Components ==========
function initializeUIComponents() {
    initializeFileInput();
    updatePackDisplay();
    updatePackStats();
    ButtonStates.setButtonsForStopped();
    UIState.setPackMode();
    
    window.PopupUtils?.log('INFO', '🎨 UI Components initialized successfully');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeUIComponents);

// ========== Export Functions ==========
window.UIComponents = {
    elements: UIElements,
    state: UIState,
    buttons: ButtonStates,
    queue: QueueUI,
    notifications: Notifications,
    updatePackDisplay,
    updatePackStats,
    handleFileSelect,
    initializeUIComponents
};
