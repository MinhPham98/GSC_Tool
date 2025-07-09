let urlChunks = [];
let currentPack = 0;
let autoRun = false;
let isPaused = false;
let tabId = null;

// ========== BACKGROUND QUEUE SYSTEM ==========
let urlQueue = [];
let currentUrlIndex = 0;
let backgroundMode = false;
let queueProcessing = false;
let queuePaused = false;
let targetTabId = null;
let processingInterval = null;

// ========== ENHANCED LOGGING SYSTEM ==========
let logStartTime = Date.now();
let logCounter = 0;
let serviceWorkerStartTime = Date.now();

// Hàm log cải tiến với timestamp và persistence
function log(level, message, ...args) {
    logCounter++;
    const now = Date.now();
    const uptime = Math.round((now - serviceWorkerStartTime) / 1000);
    const timestamp = new Date(now).toLocaleTimeString();
    
    const prefix = `[${timestamp}] [SW:${uptime}s] [${logCounter}] [${level}]`;
    
    switch(level) {
        case 'INFO':
            console.log(`🔵 ${prefix}`, message, ...args);
            break;
        case 'WARN':
            console.warn(`🟡 ${prefix}`, message, ...args);
            break;
        case 'ERROR':
            console.error(`🔴 ${prefix}`, message, ...args);
            break;
        case 'DEBUG':
            console.log(`🔧 ${prefix}`, message, ...args);
            break;
        case 'QUEUE':
            console.log(`🚀 ${prefix}`, message, ...args);
            break;
        default:
            console.log(`⚪ ${prefix}`, message, ...args);
    }
}

// Log khởi động service worker
log('INFO', '🚀 GSC Tool Background Service Worker Started', {
    startTime: new Date(serviceWorkerStartTime).toLocaleString(),
    version: chrome.runtime.getManifest().version
});

// Theo dõi khi service worker bị terminate
chrome.runtime.onSuspend.addListener(() => {
    log('WARN', '⚠️ Service Worker is being suspended/terminated');
});

// Đảm bảo service worker không bị terminate quá sớm
chrome.runtime.onConnect.addListener((port) => {
    log('DEBUG', '🔗 Port connected:', port.name);
});

// Lắng nghe lệnh từ popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
        log('DEBUG', '� Message received:', { 
            type: msg?.type, 
            sender: sender?.tab?.id || 'popup',
            hasResponse: !!sendResponse
        });
        
        // Early return if no message type
        if (!msg || !msg.type) {
            log('ERROR', '❌ Invalid message received:', msg);
            return false;
        }
    
    // ========== BACKGROUND QUEUE PROCESSING ==========
    if (msg.type === "START_BACKGROUND_QUEUE") {
        (async () => {
            urlQueue = msg.urls;
            currentUrlIndex = 0;
            backgroundMode = true;
            queueProcessing = true;
            queuePaused = false;
            targetTabId = msg.tabId;
            
            // Lưu queue vào storage
            await chrome.storage.local.set({
                urlQueue: urlQueue,
                currentUrlIndex: 0,
                backgroundMode: true,
                queueProcessing: true,
                queuePaused: false,
                targetTabId: targetTabId
            });
            
            log('QUEUE', '🚀 Background queue started:', {
                totalUrls: urlQueue.length,
                tabId: targetTabId,
                firstUrl: urlQueue[0] || 'none'
            });
            await startQueueProcessing();
        })();
        return true; // Keep message channel open
    }
    
    if (msg.type === "PAUSE_BACKGROUND_QUEUE") {
        queuePaused = true;
        chrome.storage.local.set({ queuePaused: true });
        log('QUEUE', '⏸️ Background queue paused');
        return false;
    }
    
    if (msg.type === "RESUME_BACKGROUND_QUEUE") {
        (async () => {
            queuePaused = false;
            await chrome.storage.local.set({ queuePaused: false });
            log('QUEUE', '▶️ Background queue resumed');
            await startQueueProcessing();
        })();
        return false;
    }
    
    if (msg.type === "STOP_BACKGROUND_QUEUE") {
        log('QUEUE', '⏹️ Background queue stop requested');
        stopQueueProcessing();
        return false;
    }
    
    if (msg.type === "GET_QUEUE_STATUS") {
        log('DEBUG', '🔍 Queue status requested');
        
        const statusData = {
            backgroundMode,
            queueProcessing,
            queuePaused,
            currentUrlIndex,
            totalUrls: urlQueue.length,
            remainingUrls: urlQueue.length - currentUrlIndex
        };
        
        log('DEBUG', '📤 Sending queue status:', statusData);
        
        // Gửi response ĐỒNG BỘ, không async
        sendResponse(statusData);
        log('DEBUG', '✅ Queue status sent successfully');
        
        return false; // Đóng message channel ngay
    }
    
    // ========== ORIGINAL PACK PROCESSING ==========
    if (msg.type === "START_AUTO_RUN") {
        (async () => {
            urlChunks = msg.urlChunks;
            currentPack = 0;
            autoRun = true;
            isPaused = false;
            tabId = msg.tabId;
            await sendPack();
        })();
        return true;
    }
    if (msg.type === "PAUSE_AUTO_RUN") {
        isPaused = true;
        return true;
    }
    if (msg.type === "RESUME_AUTO_RUN") {
        (async () => {
            isPaused = false;
            await sendPack();
        })();
        return true;
    }
    if (msg.type === "STOP_AUTO_RUN") {
        autoRun = false;
        isPaused = false;
        currentPack = 0;
        urlChunks = [];
        return true;
    }
    
    // ========== PACK COMPLETION HANDLING ==========
    if (msg.type === "PACK_DONE") {
        if (autoRun && !isPaused && currentPack < urlChunks.length - 1) {
            currentPack++;
            sendPack();
        } else {
            autoRun = false;
            isPaused = false;
            currentPack = 0;
            urlChunks = [];
        }
        return true;
    }
    
    // ========== BACKGROUND QUEUE RESPONSE ==========
    if (msg.type === "QUEUE_URL_PROCESSED") {
        log('QUEUE', '✅ URL processed, moving to next:', {
            current: currentUrlIndex + 1,
            total: urlQueue.length
        });
        processNextUrl();
        return false;
    }
    
    // ========== UNKNOWN MESSAGE TYPE ==========
    log('WARN', '⚠️ Unknown message type:', msg?.type);
    return false; // Don't keep channel open for unknown messages
    
    } catch (error) {
        log('ERROR', '❌ Message handler error:', error);
        log('ERROR', '❌ Problematic message:', msg);
        return false;
    }
});

// Hàm gửi pack hiện tại
async function sendPack() {
    log('DEBUG', '📦 Sending pack:', {
        currentPack,
        tabId,
        packSize: urlChunks[currentPack]?.length || 0
    });
    
    if (!autoRun || isPaused || currentPack >= urlChunks.length) return;
    
    await chrome.storage.sync.set({ URLs: urlChunks[currentPack] });
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["url.js"]
        });
        log('INFO', '✅ url.js injected successfully for pack');
    } catch (e) {
        log('ERROR', '❌ Failed to inject url.js for pack:', e);
    }
}

// ========== BACKGROUND QUEUE FUNCTIONS ==========
async function startQueueProcessing() {
    if (!backgroundMode || !queueProcessing || queuePaused || currentUrlIndex >= urlQueue.length) {
        log('DEBUG', '🚫 Queue processing skipped:', {
            backgroundMode, queueProcessing, queuePaused,
            currentUrlIndex, totalUrls: urlQueue.length
        });
        return;
    }
    
    const urlToProcess = urlQueue[currentUrlIndex];
    log('QUEUE', '🔄 Processing URL:', {
        index: currentUrlIndex + 1,
        total: urlQueue.length,
        url: urlToProcess,
        remaining: urlQueue.length - currentUrlIndex - 1
    });
    
    try {
        // Kiểm tra tab còn tồn tại
        await chrome.tabs.get(targetTabId);
        
        // Gửi URL hiện tại để xử lý
        await chrome.storage.sync.set({ 
            URLs: [urlToProcess],
            backgroundQueueMode: true,
            currentQueueIndex: currentUrlIndex
        });
        
        // Inject script để xử lý
        await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ["url.js"]
        });
        
        log('QUEUE', '✅ url.js injected for queue URL:', urlToProcess);
        
    } catch (error) {
        log('ERROR', '❌ Error processing queue URL:', {
            error: error.message,
            url: urlToProcess,
            index: currentUrlIndex
        });
        // Tab có thể đã đóng, tạm dừng queue
        await pauseQueueProcessing();
    }
}

async function processNextUrl() {
    currentUrlIndex++;
    
    // Cập nhật storage
    await chrome.storage.local.set({ 
        currentUrlIndex: currentUrlIndex 
    });
    
    log('QUEUE', '➡️ Moving to next URL:', {
        newIndex: currentUrlIndex,
        total: urlQueue.length,
        completed: currentUrlIndex,
        remaining: urlQueue.length - currentUrlIndex
    });
    
    if (currentUrlIndex >= urlQueue.length) {
        // Hoàn thành queue
        log('QUEUE', '🎉 Background queue completed!', {
            totalProcessed: urlQueue.length,
            finalIndex: currentUrlIndex
        });
        await stopQueueProcessing();
        
        // Thông báo hoàn thành
        chrome.runtime.sendMessage({ 
            type: "QUEUE_COMPLETED",
            totalProcessed: urlQueue.length 
        });
    } else {
        // Tiếp tục URL tiếp theo
        if (!queuePaused && queueProcessing) {
            await startQueueProcessing();
        }
    }
}

async function pauseQueueProcessing() {
    queuePaused = true;
    await chrome.storage.local.set({ queuePaused: true });
    log('QUEUE', '⏸️ Queue processing paused due to error');
}

async function stopQueueProcessing() {
    const wasActive = backgroundMode && queueProcessing;
    
    backgroundMode = false;
    queueProcessing = false;
    queuePaused = false;
    const processedCount = currentUrlIndex;
    urlQueue = [];
    currentUrlIndex = 0;
    targetTabId = null;
    
    await chrome.storage.local.set({
        backgroundMode: false,
        queueProcessing: false,
        queuePaused: false,
        urlQueue: [],
        currentUrlIndex: 0
    });
    
    if (wasActive) {
        log('QUEUE', '🛑 Background queue stopped', {
            processedUrls: processedCount,
            wasCompleted: processedCount > 0
        });
    }
}

// Khôi phục queue khi service worker restart
chrome.runtime.onStartup.addListener(async () => {
    log('INFO', '🔄 Browser startup detected - restoring queue state');
    await restoreQueueState();
});

// Cũng restore khi service worker được installed lại
chrome.runtime.onInstalled.addListener(async (details) => {
    log('INFO', '🔄 Extension installed/updated:', details.reason);
    await restoreQueueState();
});

// Restore state khi service worker đầu tiên được load
(async () => {
    log('INFO', '🔄 Service worker initialization - restoring state');
    await restoreQueueState();
})();

/**
 * Khôi phục trạng thái queue từ storage
 */
async function restoreQueueState() {
    try {
        const data = await chrome.storage.local.get([
            'urlQueue', 'currentUrlIndex', 'backgroundMode', 'queueProcessing', 'queuePaused', 'targetTabId'
        ]);
        
        log('INFO', '� Checking stored queue state:', {
            hasQueue: !!data.urlQueue,
            queueLength: data.urlQueue?.length || 0,
            currentIndex: data.currentUrlIndex || 0,
            backgroundMode: data.backgroundMode,
            processing: data.queueProcessing,
            paused: data.queuePaused
        });
        
        if (data.backgroundMode && data.queueProcessing && data.urlQueue && data.urlQueue.length > 0) {
            urlQueue = data.urlQueue;
            currentUrlIndex = data.currentUrlIndex || 0;
            backgroundMode = true;
            queueProcessing = true;
            queuePaused = data.queuePaused || false;
            targetTabId = data.targetTabId;
            
            log('QUEUE', '✅ Queue state restored:', {
                totalUrls: urlQueue.length,
                currentIndex: currentUrlIndex,
                remaining: urlQueue.length - currentUrlIndex,
                processing: queueProcessing,
                paused: queuePaused,
                targetTab: targetTabId
            });
            
            // Nếu không bị pause và chưa hoàn thành, tiếp tục processing
            if (!queuePaused && currentUrlIndex < urlQueue.length) {
                log('QUEUE', '🔄 Auto-resuming queue processing in 2 seconds...');
                // Chờ một chút để đảm bảo tab sẵn sàng
                setTimeout(() => {
                    startQueueProcessing();
                }, 2000);
            } else if (queuePaused) {
                log('QUEUE', '⏸️ Queue restored but paused - waiting for manual resume');
            } else {
                log('QUEUE', '✅ Queue restored but already completed');
            }
        } else {
            log('INFO', '📦 No active queue found - staying in pack mode');
        }
    } catch (error) {
        log('ERROR', '❌ Error restoring queue state:', error);
    }
}

// ========== LOG MANAGEMENT FUNCTIONS ==========
// Hàm để clear logs (có thể gọi từ popup)
function clearLogs() {
    console.clear();
    logCounter = 0;
    serviceWorkerStartTime = Date.now();
    log('INFO', '🧹 Logs cleared manually');
}

// Export cho console debugging
self.gscToolDebug = {
    clearLogs,
    getQueueState: () => ({
        urlQueue: urlQueue.length,
        currentUrlIndex,
        backgroundMode,
        queueProcessing,
        queuePaused,
        targetTabId,
        serviceWorkerUptime: Math.round((Date.now() - serviceWorkerStartTime) / 1000),
        logCounter
    }),
    log
};