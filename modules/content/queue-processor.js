// ========== QUEUE PROCESSOR MODULE ==========
// Handles background queue processing for single URLs

// ========== Queue Processing Functions ==========

async function processSingleUrlFromQueue(url, queueIndex) {
    // 🕐 Start timing cho queue URL
    window.timing.start(url, queueIndex, 'queue');
    
    const startTime = Date.now();
    
    // Create safe processing key using hash of URL + index
    const urlHash = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const processingKey = `processing_${queueIndex}_${urlHash}`;
    const globalLockKey = `queue_lock_${queueIndex}`;
    
    // ATOMIC LOCK: Check and set in one operation
    if (window[processingKey] || window[globalLockKey]) {
        window.GSCUtils.log('WARN', `URL ${queueIndex + 1} already being processed, skipping duplicate:`, {
            url: url,
            processingKey: processingKey,
            globalLockKey: globalLockKey
        });
        window.timing.end('skipped', 'Already being processed');
        return;
    }
    
    // Set BOTH locks immediately
    window[processingKey] = true;
    window[globalLockKey] = true;
    
    window.GSCUtils.log('QUEUE', `Processing URL ${queueIndex + 1}:`, {
        url: url,
        startTime: new Date().toLocaleTimeString(),
        processingKey: processingKey
    });
    
    // Double check: Nếu URL này đã có trong queueResults thì có thể đã xử lý rồi
    const existingResult = await checkExistingResult(url, queueIndex);
    
    if (existingResult) {
        window.GSCUtils.log('WARN', `URL ${queueIndex + 1} already processed (found in results), skipping:`, {
            url: url,
            existingResult: existingResult
        });
        delete window[processingKey];
        delete window[globalLockKey];
        window.timing.end('skipped', 'Already in results');
        return;
    }
    
    // Additional safety: Set a unique timestamp lock
    const timestampLock = `ts_${queueIndex}_${Date.now()}`;
    window[timestampLock] = true;
    
    // Small delay to prevent race condition
    await window.GSCUtils.delay(100);
    
    try {
        const result = await processQueueUrl(url, queueIndex);
        await saveQueueResult(url, queueIndex, result, processingKey);
        
        // Handle error popup
        if (result.status === "error") {
            await window.GSCOperations.closeErrorPopup();
            await window.GSCUtils.delay(1500);
            window.GSCUtils.log('DEBUG', `Error popup closed for URL ${queueIndex + 1}`);
        }
        
        const processingTime = Date.now() - startTime;
        window.GSCUtils.log('INFO', `URL ${queueIndex + 1} completed:`, {
            url: url,
            status: result.status,
            processingTimeMs: processingTime,
            endTime: new Date().toLocaleTimeString()
        });
        
    } catch (error) {
        await handleQueueError(error, url, queueIndex, processingKey);
    } finally {
        // Clear ALL processing flags
        delete window[processingKey];
        delete window[globalLockKey];
        delete window[timestampLock];
        console.log(`🧹 QUEUE: Cleared ALL processing flags [${processingKey}] for queueIndex ${queueIndex + 1}: ${url}`);
    }
}

async function processQueueUrl(url, queueIndex) {
    // 🕐 Timing steps cho queue processing
    window.timing.step('QUEUE_CLICK_NEXT_BUTTON');
    await window.GSCOperations.clickNextButton(false, temporaryRemoval);
    await window.GSCUtils.delay(1500);
    
    window.timing.step('QUEUE_FILL_URL_FORM');
    await window.GSCOperations.fillSingleUrl(url, temporaryRemoval);
    await window.GSCUtils.delay(1500);
    
    window.timing.step('QUEUE_CLICK_SUBMISSION_NEXT');
    await window.GSCOperations.submissionNextButton();
    await window.GSCUtils.delay(1500);
    
    window.timing.step('QUEUE_SUBMIT_REQUEST');
    const submitButtonFound = await window.GSCOperations.submitRequest(false);
    await window.GSCUtils.delay(1500);
    
    window.timing.step('QUEUE_CHECK_OUTCOME');
    const result = await window.GSCOperations.checkSingleUrlOutcome(url, queueIndex, submitButtonFound);
    
    // 🕐 End timing với kết quả
    window.timing.end(result.status, result.reason);
    
    // Adaptive delay: shorter for success, longer for errors
    const adaptiveDelay = result.status === "success" ? 1000 : 1500;
    await window.GSCUtils.delay(adaptiveDelay);
    
    return result;
}

async function checkExistingResult(url, queueIndex) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['queueResults'], (data) => {
            const queueResults = data.queueResults || [];
            const existing = queueResults.find(r => r.url === url && r.queueIndex === queueIndex + 1);
            resolve(existing);
        });
    });
}

async function saveQueueResult(url, queueIndex, result, processingKey) {
    window.GSCUtils.log('DEBUG', `About to save result for URL ${queueIndex + 1}:`, {
        url: url,
        status: result.status,
        reason: result.reason,
        queueIndex: queueIndex + 1
    });
    
    // Lưu kết quả với ULTIMATE ATOMIC duplicate prevention
    const atomicSave = await new Promise((resolve) => {
        chrome.storage.local.get(['queueResults', 'queueProcessingLocks'], (data) => {
            const queueResults = data.queueResults || [];
            const locks = data.queueProcessingLocks || {};
            
            // Check processing lock trong storage
            const lockKey = `${queueIndex}_${url}`;
            if (locks[lockKey]) {
                console.warn(`⚠️ QUEUE: Storage lock detected for URL ${queueIndex + 1}, skipping save`);
                resolve(false);
                return;
            }
            
            // Set storage lock
            locks[lockKey] = { timestamp: Date.now(), processingKey };
            
            // Triple check cho duplicate: URL + queueIndex combination
            const existingIndex = queueResults.findIndex(r => 
                r.url === url && r.queueIndex === queueIndex + 1
            );
            
            let resultObj;
            if (existingIndex === -1) {
                // Tính toán STT dựa trên length hiện tại (đảm bảo tuần tự)
                const newId = queueResults.length + 1;
                resultObj = { 
                    id: newId, 
                    url, 
                    status: result.status, 
                    reason: result.reason,
                    queueIndex: queueIndex + 1,
                    timestamp: new Date().toISOString(),
                    processingKey: processingKey,  // Debug info
                    lockKey: lockKey
                };
                queueResults.push(resultObj);
                window.GSCUtils.log('INFO', `NEW result saved with STT ${newId} for queueIndex ${queueIndex + 1}:`, {
                    url: url,
                    stt: newId,
                    queueIndex: queueIndex + 1,
                    status: result.status,
                    reason: result.reason
                });
                
                // Check for gap warning
                const gap = Math.abs(newId - (queueIndex + 1));
                if (gap > 5) {
                    window.GSCUtils.log('WARN', `QUEUE GAP WARNING:`, {
                        stt: newId,
                        queueIndex: queueIndex + 1,
                        gap: gap
                    });
                }
            } else {
                // Update existing với same queueIndex (nếu có lỗi rồi retry)
                resultObj = queueResults[existingIndex];
                resultObj.status = result.status;
                resultObj.reason = result.reason;
                resultObj.timestamp = new Date().toISOString();
                resultObj.processingKey = processingKey;
                resultObj.lockKey = lockKey;
                window.GSCUtils.log('INFO', `UPDATED existing result STT ${resultObj.id} for queueIndex ${queueIndex + 1}:`, {
                    url: url,
                    stt: resultObj.id,
                    queueIndex: queueIndex + 1,
                    status: result.status,
                    reason: result.reason
                });
            }
            
            // Clear lock after save
            delete locks[lockKey];
            
            chrome.storage.local.set({ queueResults, queueProcessingLocks: locks }, () => {
                window.GSCUtils.log('DEBUG', `Sending QUEUE_URL_PROCESSED message:`, {
                    stt: resultObj.id,
                    queueIndex: queueIndex + 1,
                    url: url,
                    status: result.status
                });
                chrome.runtime.sendMessage({ 
                    type: "QUEUE_URL_PROCESSED",
                    result: resultObj
                });
                resolve(true);
            });
        });
    });
    
    if (!atomicSave) {
        window.GSCUtils.log('WARN', `Atomic save failed for URL ${queueIndex + 1}, URL already being processed by another instance`, {
            url: url,
            queueIndex: queueIndex + 1
        });
    }
}

async function handleQueueError(error, url, queueIndex, processingKey) {
    // 🕐 End timing với error
    window.timing.end('error', `Processing error: ${error.message}`);
    
    window.GSCUtils.log('ERROR', `Error processing URL ${queueIndex + 1}:`, {
        url: url,
        error: error.message,
        stack: error.stack
    });
    
    chrome.storage.local.get(['queueResults', 'queueProcessingLocks'], (data) => {
        const queueResults = data.queueResults || [];
        const locks = data.queueProcessingLocks || {};
        
        // Check processing lock trong storage
        const lockKey = `${queueIndex}_${url}`;
        if (locks[lockKey]) {
            window.GSCUtils.log('WARN', `Storage lock detected for error URL ${queueIndex + 1}, skipping save`, {
                url: url,
                lockKey: lockKey
            });
            return;
        }
        
        // Set storage lock
        locks[lockKey] = { timestamp: Date.now(), processingKey };
        
        // Triple check cho duplicate: URL + queueIndex combination
        const existingIndex = queueResults.findIndex(r => 
            r.url === url && r.queueIndex === queueIndex + 1
        );
        
        let errorResult;
        if (existingIndex === -1) {
            const newId = queueResults.length + 1;
            errorResult = {
                id: newId, 
                url, 
                status: "error",
                reason: "Processing error: " + error.message,
                queueIndex: queueIndex + 1,
                timestamp: new Date().toISOString(),
                processingKey: processingKey,  // Debug info
                lockKey: lockKey
            };
            queueResults.push(errorResult);
            console.log(`💾 QUEUE: NEW error result saved with STT ${newId} for queueIndex ${queueIndex + 1}`);
        } else {
            errorResult = queueResults[existingIndex];
            errorResult.status = "error";
            errorResult.reason = "Processing error: " + error.message;
            errorResult.timestamp = new Date().toISOString();
            errorResult.processingKey = processingKey;
            errorResult.lockKey = lockKey;
            console.log(`🔄 QUEUE: UPDATED error result STT ${errorResult.id} for queueIndex ${queueIndex + 1}`);
        }
        
        // Clear lock after save
        delete locks[lockKey];
        
        chrome.storage.local.set({ queueResults, queueProcessingLocks: locks }, () => {
            chrome.runtime.sendMessage({ 
                type: "QUEUE_URL_PROCESSED",
                result: errorResult
            });
        });
    });
}

// ========== Export Functions ==========
window.GSCQueueProcessor = {
    processSingleUrlFromQueue,
    processQueueUrl,
    checkExistingResult,
    saveQueueResult,
    handleQueueError
};
