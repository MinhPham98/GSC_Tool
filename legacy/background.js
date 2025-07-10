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

// Hàm log cải tiến với timestamp và structured data serialization
function log(level, message, ...args) {
    logCounter++;
    const now = Date.now();
    const uptime = Math.round((now - serviceWorkerStartTime) / 1000);
    const timestamp = new Date(now).toLocaleTimeString();
    
    const prefix = `[${timestamp}] [SW:${uptime}s] [${logCounter}] [${level}]`;
    
    // Serialize objects to JSON for better visibility
    const serializedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return arg;
    });
    
    const logMessage = serializedArgs.length > 0 
        ? `${message} ${serializedArgs.join(' ')}`
        : message;
    
    switch(level) {
        case 'INFO':
            console.log(`🔵 ${prefix} ${logMessage}`);
            break;
        case 'WARN':
            console.warn(`🟡 ${prefix} ${logMessage}`);
            break;
        case 'ERROR':
            console.error(`🔴 ${prefix} ${logMessage}`);
            break;
        case 'DEBUG':
            console.log(`🔧 ${prefix} ${logMessage}`);
            break;
        case 'QUEUE':
            console.log(`🚀 ${prefix} ${logMessage}`);
            break;
        default:
            console.log(`⚪ ${prefix} ${logMessage}`);
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
            
            log('QUEUE', '🚀 Background queue started with full URL list:', {
                totalUrls: urlQueue.length,
                tabId: targetTabId,
                firstUrl: urlQueue[0] || 'none',
                lastUrl: urlQueue[urlQueue.length - 1] || 'none',
                allUrls: urlQueue.length <= 20 ? urlQueue : [...urlQueue.slice(0, 10), '...', ...urlQueue.slice(-10)]
            });
            
            // Lưu queue vào storage với queueStartTime để tính ETA chính xác
            const queueStartTime = Date.now();
            await chrome.storage.local.set({
                urlQueue: urlQueue,
                currentUrlIndex: 0,
                backgroundMode: true,
                queueProcessing: true,
                queuePaused: false,
                targetTabId: targetTabId,
                queueStartTime: queueStartTime // Save start time for ETA calculation
            });
            
            log('QUEUE', '� Queue state saved to storage');
            await startQueueProcessing();
        })();
        return true; // Keep message channel open
    }
    
    if (msg.type === "PAUSE_BACKGROUND_QUEUE") {
        queuePaused = true;
        const pauseTime = Date.now();
        chrome.storage.local.set({ 
            queuePaused: true,
            queuePauseTime: pauseTime
        });
        log('QUEUE', '⏸️ Background queue paused', {
            pauseTime: new Date(pauseTime).toLocaleString()
        });
        return false;
    }
    
    if (msg.type === "RESUME_BACKGROUND_QUEUE") {
        (async () => {
            queuePaused = false;
            await chrome.storage.local.set({ 
                queuePaused: false,
                queuePauseTime: null // Clear pause time when resumed
            });
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
    
    if (msg.type === "RESUME_BACKGROUND_QUEUE") {
        log('QUEUE', '▶️ Background queue resume requested');
        (async () => {
            await resumeQueueProcessing();
        })();
        return false;
    }
    
    if (msg.type === "CHECK_STOPPED_QUEUE") {
        log('DEBUG', '🔍 Checking for stopped queue');
        (async () => {
            const data = await chrome.storage.local.get(['stoppedQueue']);
            const stoppedQueue = data.stoppedQueue;
            sendResponse({ hasStoppedQueue: !!stoppedQueue, stoppedQueue });
        })();
        return true; // Keep channel open for async response
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
        log('RESET', '🔄 Auto run stop requested - stopping all pack operations');
        
        // Stop any pack mode processing completely
        autoRun = false;
        isPaused = false;
        isRunning = false;
        currentPack = 0;
        autoRunning = false;
        urlChunks = [];
        
        // Clear pack related storage
        chrome.storage.sync.set({
            autoRun: false,
            isPaused: false,
            isStopped: true,
            running: false,
            URLs: []
        });
        
        log('INFO', '✅ Pack mode completely stopped');
        return true;
    }
    
    // ========== PACK COMPLETION HANDLING ==========
    if (msg.type === "PACK_DONE") {
        log('INFO', '📦 Pack completion received:', {
            autoRun,
            isPaused,
            currentPack,
            totalPacks: urlChunks.length
        });
        
        // Double-check if we should continue (user might have stopped)
        if (autoRun && !isPaused && currentPack < urlChunks.length - 1) {
            currentPack++;
            log('INFO', '🚀 Continuing to next pack:', currentPack);
            sendPack();
        } else {
            log('INFO', '🏁 Pack processing completed or stopped');
            autoRun = false;
            isPaused = false;
            currentPack = 0;
            urlChunks = [];
        }
        return true;
    }
    
    // ========== BACKGROUND QUEUE RESPONSE ==========
    if (msg.type === "QUEUE_URL_PROCESSED") {
        log('QUEUE', '✅ URL processed completely, moving to next:', {
            currentCompleted: currentUrlIndex + 1,
            total: urlQueue.length,
            result: msg.result || 'no-result'
        });
        
        // Reset processing flag khi URL đã hoàn thành
        isProcessingUrl = false;
        
        // Optimized delay: faster transition between URLs
        setTimeout(() => {
            processNextUrl();
        }, 500); // Reduced from 1000ms to 500ms for faster queue processing
        
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
    log('DEBUG', '📦 Attempting to send pack:', {
        currentPack,
        autoRun,
        isPaused,
        tabId,
        packSize: urlChunks[currentPack]?.length || 0
    });
    
    // Double-check conditions before sending
    if (!autoRun || isPaused || currentPack >= urlChunks.length || !urlChunks[currentPack]) {
        log('INFO', '🚫 Pack send cancelled - conditions not met');
        return;
    }
    
    await chrome.storage.sync.set({ URLs: urlChunks[currentPack] });
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["url.js"]
        });
        log('INFO', '✅ url.js injected successfully for pack:', currentPack);
    } catch (e) {
        log('ERROR', '❌ Failed to inject url.js for pack:', e);
        // Stop auto run on injection failure
        autoRun = false;
    }
}

// ========== BACKGROUND QUEUE FUNCTIONS ==========
let isProcessingUrl = false; // Flag để prevent double processing

async function startQueueProcessing() {
    if (!backgroundMode || !queueProcessing || queuePaused || currentUrlIndex >= urlQueue.length) {
        log('DEBUG', '🚫 Queue processing skipped:', {
            backgroundMode, queueProcessing, queuePaused,
            currentUrlIndex, totalUrls: urlQueue.length
        });
        return;
    }
    
    // Prevent double processing
    if (isProcessingUrl) {
        log('WARN', '⚠️ Already processing URL, skipping duplicate call');
        return;
    }
    
    isProcessingUrl = true;
    
    const urlToProcess = urlQueue[currentUrlIndex];
    const queueIndexKey = `queue_${currentUrlIndex}_${urlToProcess}`;
    
    // Double check: kiểm tra xem URL này đã được xử lý chưa
    try {
        const data = await chrome.storage.local.get(['queueResults']);
        const queueResults = data.queueResults || [];
        const alreadyProcessed = queueResults.find(r => 
            r.url === urlToProcess && r.queueIndex === currentUrlIndex + 1
        );
        
        if (alreadyProcessed) {
            log('WARN', '⚠️ URL already processed, moving to next:', {
                url: urlToProcess,
                queueIndex: currentUrlIndex + 1,
                existingResult: alreadyProcessed
            });
            isProcessingUrl = false;
            await processNextUrl();
            return;
        }
    } catch (error) {
        log('ERROR', '❌ Error checking existing results:', error);
    }
    
    log('QUEUE', '🔄 Processing URL:', {
        index: currentUrlIndex + 1,
        total: urlQueue.length,
        url: urlToProcess,
        remaining: urlQueue.length - currentUrlIndex - 1,
        queueKey: queueIndexKey
    });
    
    try {
        // Kiểm tra tab còn tồn tại
        await chrome.tabs.get(targetTabId);
        
        // Gửi URL hiện tại để xử lý với unique identifier
        await chrome.storage.sync.set({ 
            URLs: [urlToProcess],
            backgroundQueueMode: true,
            currentQueueIndex: currentUrlIndex,
            queueProcessingKey: queueIndexKey,
            timestamp: Date.now()
        });
        
        // Inject script để xử lý
        await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ["url.js"]
        });
        
        log('QUEUE', '✅ url.js injected for queue URL:', {
            url: urlToProcess,
            queueIndex: currentUrlIndex + 1,
            key: queueIndexKey
        });
        
    } catch (error) {
        log('ERROR', '❌ Error processing queue URL:', {
            error: error.message,
            url: urlToProcess,
            index: currentUrlIndex
        });
        
        // Reset flag on error
        isProcessingUrl = false;
        
        // Tab có thể đã đóng, tạm dừng queue
        await pauseQueueProcessing();
    }
}

async function processNextUrl() {
    const completedUrlIndex = currentUrlIndex; // URL vừa hoàn thành (chưa tăng index)
    
    log('QUEUE', '➡️ Moving to next URL:', {
        completedIndex: completedUrlIndex + 1,
        nextIndex: completedUrlIndex + 2,
        total: urlQueue.length,
        completed: completedUrlIndex + 1,
        remaining: urlQueue.length - (completedUrlIndex + 1)
    });
    
    // Tăng index CHÍNH XÁC sau khi URL hiện tại đã hoàn thành
    currentUrlIndex++;
    
    if (currentUrlIndex >= urlQueue.length) {
        // Hoàn thành queue
        log('QUEUE', '🎉 Background queue completed!', {
            totalProcessed: urlQueue.length,
            finalIndex: currentUrlIndex
        });
        await stopQueueProcessing();
        
        // Thông báo hoàn thành
        try {
            chrome.runtime.sendMessage({ 
                type: "QUEUE_COMPLETED",
                totalProcessed: urlQueue.length 
            });
        } catch (error) {
            log('ERROR', '❌ Error sending completion message:', error);
        }
    } else {
        // Cập nhật storage với index mới
        await chrome.storage.local.set({ 
            currentUrlIndex: currentUrlIndex 
        });
        
        // Tiếp tục URL tiếp theo với optimized delay
        if (!queuePaused && queueProcessing) {
            log('QUEUE', '⏳ Waiting 1.5 seconds before processing next URL...');
            setTimeout(async () => {
                await startQueueProcessing();
            }, 1500); // Reduced from 2000ms to 1500ms for faster processing
        } else {
            log('QUEUE', '⏸️ Queue paused or stopped, not processing next URL');
        }
    }
}

async function pauseQueueProcessing() {
    queuePaused = true;
    await chrome.storage.local.set({ queuePaused: true });
    log('QUEUE', '⏸️ Queue processing paused due to error');
}

async function stopQueueProcessing(saveForResume = true) {
    const wasActive = backgroundMode && queueProcessing;
    const processedCount = currentUrlIndex;
    const remainingUrls = urlQueue.slice(currentUrlIndex);
    
    // Save current state for potential resume
    if (saveForResume && remainingUrls.length > 0) {
        await chrome.storage.local.set({
            stoppedQueue: {
                urls: remainingUrls,
                processedCount: processedCount,
                totalOriginal: urlQueue.length,
                stopTime: Date.now(),
                queueStartTime: await chrome.storage.local.get(['queueStartTime']).then(data => data.queueStartTime)
            }
        });
        log('QUEUE', '💾 Queue state saved for resume', {
            remainingUrls: remainingUrls.length,
            processedCount: processedCount,
            totalOriginal: urlQueue.length
        });
    }
    
    // Reset current queue state
    backgroundMode = false;
    queueProcessing = false;
    queuePaused = false;
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
            wasCompleted: processedCount > 0,
            savedForResume: saveForResume && remainingUrls.length > 0
        });
    }
}

async function resumeQueueProcessing() {
    try {
        log('QUEUE', '🔄 Attempting to resume queue processing...');
        
        // Get stopped queue state
        const data = await chrome.storage.local.get(['stoppedQueue']);
        const stoppedQueue = data.stoppedQueue;
        
        if (!stoppedQueue || !stoppedQueue.urls || stoppedQueue.urls.length === 0) {
            log('ERROR', '❌ No stopped queue found to resume');
            return false;
        }
        
        log('QUEUE', '📊 Found stopped queue to resume:', {
            remainingUrls: stoppedQueue.urls.length,
            processedCount: stoppedQueue.processedCount,
            totalOriginal: stoppedQueue.totalOriginal,
            stopTime: new Date(stoppedQueue.stopTime).toLocaleString()
        });
        
        // Find GSC tab
        const gscTabs = await chrome.tabs.query({
            url: "https://search.google.com/search-console/removals*"
        });
        
        if (gscTabs.length === 0) {
            log('ERROR', '❌ No GSC tab found for resume. Please open GSC removals page first.');
            return false;
        }
        
        const targetTab = gscTabs[0];
        log('QUEUE', '🎯 Found GSC tab for resume:', targetTab.id);
        
        // Restore queue state
        urlQueue = stoppedQueue.urls;
        currentUrlIndex = 0; // Start from 0 in the remaining URLs
        targetTabId = targetTab.id;
        backgroundMode = true;
        queueProcessing = true;
        queuePaused = false;
        
        // Save resumed state to storage
        await chrome.storage.local.set({
            urlQueue: urlQueue,
            currentUrlIndex: currentUrlIndex,
            backgroundMode: true,
            queueProcessing: true,
            queuePaused: false,
            queuePauseTime: null, // Clear any previous pause time
            targetTabId: targetTabId,
            queueStartTime: stoppedQueue.queueStartTime, // Keep original start time for ETA
            resumedFromIndex: stoppedQueue.processedCount // Track where we resumed from
        });
        
        // Clear stopped queue state
        await chrome.storage.local.remove(['stoppedQueue']);
        
        log('QUEUE', '✅ Queue resumed successfully', {
            resumedUrls: urlQueue.length,
            originalProcessed: stoppedQueue.processedCount,
            totalOriginal: stoppedQueue.totalOriginal
        });
        
        // Start processing
        await startQueueProcessing();
        return true;
        
    } catch (error) {
        log('ERROR', '❌ Error resuming queue:', error);
        return false;
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