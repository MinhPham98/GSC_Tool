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

// Lắng nghe lệnh từ popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    console.log('BG received:', msg);
    
    // ========== BACKGROUND QUEUE PROCESSING ==========
    if (msg.type === "START_BACKGROUND_QUEUE") {
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
            targetTabId: targetTabId
        });
        
        console.log('Started background queue processing:', urlQueue.length, 'URLs');
        await startQueueProcessing();
    }
    
    if (msg.type === "PAUSE_BACKGROUND_QUEUE") {
        queuePaused = true;
        await chrome.storage.local.set({ queuePaused: true });
        console.log('Background queue paused');
    }
    
    if (msg.type === "RESUME_BACKGROUND_QUEUE") {
        queuePaused = false;
        await chrome.storage.local.set({ queuePaused: false });
        console.log('Background queue resumed');
        await startQueueProcessing();
    }
    
    if (msg.type === "STOP_BACKGROUND_QUEUE") {
        await stopQueueProcessing();
    }
    
    if (msg.type === "GET_QUEUE_STATUS") {
        sendResponse({
            backgroundMode,
            queueProcessing,
            queuePaused,
            currentUrlIndex,
            totalUrls: urlQueue.length,
            remainingUrls: urlQueue.length - currentUrlIndex
        });
        return true;
    }
    
    // ========== ORIGINAL PACK PROCESSING ==========
    if (msg.type === "START_AUTO_RUN") {
        urlChunks = msg.urlChunks;
        currentPack = 0;
        autoRun = true;
        isPaused = false;
        tabId = msg.tabId;
        await sendPack();
    }
    if (msg.type === "PAUSE_AUTO_RUN") {
        isPaused = true;
    }
    if (msg.type === "RESUME_AUTO_RUN") {
        isPaused = false;
        await sendPack();
    }
    if (msg.type === "STOP_AUTO_RUN") {
        autoRun = false;
        isPaused = false;
        currentPack = 0;
        urlChunks = [];
    }
});

// Hàm gửi pack hiện tại
async function sendPack() {
    console.log('sendPack', {currentPack, tabId, urlChunks});
    if (!autoRun || isPaused || currentPack >= urlChunks.length) return;
    await chrome.storage.sync.set({ URLs: urlChunks[currentPack] });
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["url.js"]
        });
        console.log('Injected url.js thành công');
    } catch (e) {
        console.error('Inject url.js lỗi:', e);
    }
}

// Nhận thông báo từ url.js khi pack xong
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
    }
    
    // ========== BACKGROUND QUEUE RESPONSE ==========
    if (msg.type === "QUEUE_URL_PROCESSED") {
        console.log('Queue URL processed, moving to next...');
        processNextUrl();
    }
});

// ========== BACKGROUND QUEUE FUNCTIONS ==========
async function startQueueProcessing() {
    if (!backgroundMode || !queueProcessing || queuePaused || currentUrlIndex >= urlQueue.length) {
        return;
    }
    
    console.log('Processing URL:', currentUrlIndex + 1, '/', urlQueue.length);
    
    try {
        // Kiểm tra tab còn tồn tại
        await chrome.tabs.get(targetTabId);
        
        // Gửi URL hiện tại để xử lý
        await chrome.storage.sync.set({ 
            URLs: [urlQueue[currentUrlIndex]],
            backgroundQueueMode: true,
            currentQueueIndex: currentUrlIndex
        });
        
        // Inject script để xử lý
        await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ["url.js"]
        });
        
        console.log('Injected url.js for queue URL:', urlQueue[currentUrlIndex]);
        
    } catch (error) {
        console.error('Error processing queue URL:', error);
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
    
    if (currentUrlIndex >= urlQueue.length) {
        // Hoàn thành queue
        console.log('Background queue completed!');
        await stopQueueProcessing();
        
        // Thông báo hoàn thành
        chrome.runtime.sendMessage({ 
            type: "QUEUE_COMPLETED",
            totalProcessed: urlQueue.length 
        });
    } else {
        // Tiếp tục URL tiếp theo - KHÔNG CÓ DELAY, CHỜ MESSAGE RESPONSE
        console.log('Moving to next URL in queue...');
        if (!queuePaused && queueProcessing) {
            await startQueueProcessing();
        }
    }
}

async function pauseQueueProcessing() {
    queuePaused = true;
    await chrome.storage.local.set({ queuePaused: true });
    console.log('Queue processing paused');
}

async function stopQueueProcessing() {
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
    
    console.log('Background queue stopped');
}

// Khôi phục queue khi service worker restart
chrome.runtime.onStartup.addListener(async () => {
    const data = await chrome.storage.local.get([
        'urlQueue', 'currentUrlIndex', 'backgroundMode', 'queueProcessing', 'targetTabId'
    ]);
    
    if (data.backgroundMode && data.queueProcessing && data.urlQueue) {
        urlQueue = data.urlQueue;
        currentUrlIndex = data.currentUrlIndex || 0;
        backgroundMode = true;
        queueProcessing = true;
        targetTabId = data.targetTabId;
        
        console.log('Restored background queue:', urlQueue.length, 'URLs, index:', currentUrlIndex);
    }
});