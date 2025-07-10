// ========== PACK PROCESSOR MODULE ==========
// Handles pack mode processing for multiple URLs

// ========== Global Variables ==========
if (typeof currentUrlIndex === 'undefined') var currentUrlIndex = 0;
if (typeof resultLinks === 'undefined') var resultLinks = [];
if (typeof isPaused === 'undefined') var isPaused = false;
if (typeof resumeRequested === 'undefined') var resumeRequested = false;
if (typeof isStopped === 'undefined') var isStopped = false;

// ========== Pack Processing Functions ==========

async function processPackResult(urlList, index, submitButtonFound) {
    const result = await window.GSCOperations.checkOutcome(urlList, index, submitButtonFound);
    
    const resultObj = { 
        id: index + 1, 
        url: urlList[index], 
        status: result.status, 
        reason: result.reason 
    };
    
    resultLinks.push(resultObj);
    chrome.storage.local.set({ resultLinks }); // Lưu vào cache

    // Đóng popup nếu có lỗi
    if (result.status === "error") {
        await window.GSCOperations.closeErrorPopup();
    }
    
    return result;
}

async function removeUrlJs(index, urlList, nextButton = false, submitButtonFound = false) {
    if (isStopped) return;
    
    if (index < urlList.length) {
        // 🕐 Start timing cho URL này
        window.timing.start(urlList[index], index, 'pack');
        
        window.timing.step('CLICK_NEXT_BUTTON');
        await window.GSCOperations.clickNextButton(nextButton, temporaryRemoval);
        await window.GSCUtils.delay(1000);
        
        window.timing.step('FILL_URL_FORM');
        await window.GSCOperations.urlToSubmissionBar(urlList, index, temporaryRemoval);
        await window.GSCUtils.delay(1000);
        
        window.timing.step('CLICK_SUBMISSION_NEXT');
        await window.GSCOperations.submissionNextButton();
        await window.GSCUtils.delay(1000);
        
        window.timing.step('SUBMIT_REQUEST');
        submitButtonFound = await window.GSCOperations.submitRequest(submitButtonFound);
        await window.GSCUtils.delay(2000);
        
        window.timing.step('CHECK_OUTCOME');
        const result = await processPackResult(urlList, index, submitButtonFound);
        await window.GSCUtils.delay(2000);
        
        // 🕐 End timing với kết quả từ resultLinks
        const lastResult = resultLinks[resultLinks.length - 1];
        if (lastResult) {
            window.timing.end(lastResult.status, lastResult.reason);
        } else {
            window.timing.end('unknown', 'No result found');
        }
        
        // Cập nhật trạng thái vào storage
        chrome.storage.sync.set({
            running: true,
            currentUrlIndex: index + 1,
            totalInPack: urlList.length,
            isPaused: isPaused,
            isStopped: isStopped
        });

        // Kiểm tra tạm dừng
        const paused = await window.GSCUtils.checkPaused(index);
        if (!paused && !isStopped) {
            await removeUrlJs(index + 1, urlList, false);
        } else if (!isStopped) {
            while (isPaused && !resumeRequested && !isStopped) {
                await window.GSCUtils.delay(500);
            }
            if (resumeRequested && !isStopped) {
                resumeRequested = false;
                await removeUrlJs(index, urlList, false);
            }
        }
    } else {
        // Khi xong pack, reset trạng thái
        chrome.storage.sync.set({
            running: false,
            currentUrlIndex: null,
            totalInPack: null,
            isPaused: false
        });
        
        // Xử lý khi xong pack
        chrome.storage.local.get(['urlSuccess', 'urlError'], (cache) => {
            const successCount = resultLinks.filter(r => r.status === "success").length;
            const errorCount = resultLinks.filter(r => r.status === "error").length;
            
            chrome.storage.local.set({
                urlSuccess: (cache.urlSuccess || 0) + successCount,
                urlError: (cache.urlError || 0) + errorCount
            }, () => {
                // 🕐 Analyze timing khi pack hoàn thành
                const analysis = window.timing.analyze();
                if (analysis) {
                    console.log(`📊 PACK COMPLETED - Timing Analysis:`, {
                        totalUrls: urlList.length,
                        avgProcessingTime: `${analysis.avgTime.toFixed(0)}ms`,
                        successRate: `${(analysis.successRate * 100).toFixed(1)}%`,
                        totalTime: `${((Date.now() - window.urlTimingTracker.firstStartTime) / 1000).toFixed(1)}s`
                    });
                }
                
                chrome.runtime.sendMessage({ type: "PACK_DONE" });
                // KHÔNG reload ở đây!
                // Để popup quyết định chuyển pack và gửi tiếp nếu auto
            }); 
        });
    }
}

async function startPackProcessing(urlList) {
    // Kiểm tra resume hay chạy mới
    chrome.storage.sync.get(['isPaused', 'pausedIndex'], (data) => {
        if (!data.isPaused && typeof data.pausedIndex === 'number') {
            currentUrlIndex = data.pausedIndex;
            removeUrlJs(currentUrlIndex, urlList);
            chrome.storage.sync.remove('pausedIndex');
        } else {
            currentUrlIndex = 0;
            removeUrlJs(currentUrlIndex, urlList);
        }
    });
}

// ========== State Management ==========

// Lắng nghe thay đổi trạng thái
chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'sync') {
        if (changes.isPaused) {
            isPaused = changes.isPaused.newValue;
            if (!isPaused) resumeRequested = true;
        }
        if (changes.isStopped) {
            isStopped = changes.isStopped.newValue;
        }
    }
});

// ========== Export Functions ==========
window.GSCPackProcessor = {
    removeUrlJs,
    startPackProcessing,
    processPackResult,
    // Export variables for external access
    get currentUrlIndex() { return currentUrlIndex; },
    get resultLinks() { return resultLinks; },
    get isPaused() { return isPaused; },
    get isStopped() { return isStopped; },
    set currentUrlIndex(value) { currentUrlIndex = value; },
    set isPaused(value) { isPaused = value; },
    set isStopped(value) { isStopped = value; }
};
