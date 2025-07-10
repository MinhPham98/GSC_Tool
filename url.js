// ========== Biến toàn cục ==========
if (typeof currentUrlIndex === 'undefined') var currentUrlIndex = 0;
if (typeof resultLinks === 'undefined') var resultLinks = [];
if (typeof isPaused === 'undefined') var isPaused = false;
if (typeof resumeRequested === 'undefined') var resumeRequested = false;
if (typeof isStopped === 'undefined') var isStopped = false;

// ========== Hàm log cải tiến ==========
function log(level, message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [CONTENT] [${level}]`;
    
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

// ========== Lắng nghe thay đổi trạng thái ==========
chrome.storage.sync.set({ isPaused: false, running: false, currentUrlIndex: null });

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

// ========== Hàm tiện ích ==========
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showCustomAlert(message) {
    let container = document.querySelector('.custom-alert-container');
    if (!container) {
        container = document.createElement('div');
        container.classList.add('custom-alert-container');
        Object.assign(container.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999',
            display: 'flex', paddingRight: '5px', flexDirection: 'column-reverse', gap: '10px'
        });
        document.body.appendChild(container);
    }
    const alertDiv = document.createElement('div');
    alertDiv.classList.add('custom-alert');
    Object.assign(alertDiv.style, {
        backgroundColor: '#fff', border: '1px solid #ccc', padding: '10px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)', borderRadius: '5px',
        maxWidth: '30vw', position: 'relative'
    });
    const textDiv = document.createElement('div');
    textDiv.textContent = message;
    textDiv.style.wordWrap = 'break-word';
    textDiv.style.margin = '1rem';
    const button = document.createElement('button');
    button.textContent = 'x';
    Object.assign(button.style, {
        background: 'transparent', border: 'none', position: 'absolute',
        top: '5px', right: '5px', cursor: 'pointer'
    });
    button.onclick = function() { alertDiv.remove(); };
    alertDiv.appendChild(textDiv);
    alertDiv.appendChild(button);
    container.appendChild(alertDiv);
    const alerts = container.querySelectorAll('.custom-alert');
    if (alerts.length > 3) alerts[0].remove();
}

async function checkPaused(index) {
    return new Promise(resolve => {
        chrome.storage.sync.get(['isPaused'], (data) => {
            if (data.isPaused) {
                chrome.storage.sync.set({ pausedIndex: index });
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

// ========== Hàm thao tác GSC ==========
async function clickNextButton(nextButton, temporaryRemoval) {
    if (!nextButton) {
        document.querySelector('.RveJvd.snByac').click();
        if (!temporaryRemoval) {
            setTimeout(() => {
                const buttonsArray = document.getElementsByClassName('kx3Hed VZhFab');
                for (let i = 0; i < buttonsArray.length; i++) {
                    if (buttonsArray[buttonsArray.length - (i+1)].textContent === 'Clear cached URL') {
                        buttonsArray[buttonsArray.length - (i+1)].click();
                        break;
                    }
                }
            }, 500);
        }
    }
}

async function urlToSubmissionBar(urlList, index, temporaryRemoval) {
    const urlBarLabelIndex = temporaryRemoval ? 0 : 1;
    const urlBarLabel = document.querySelectorAll('.Ufn6O.PPB5Hf')[urlBarLabelIndex];
    if (urlBarLabel) {
        const urlBar = urlBarLabel.childNodes[0].childNodes[1];
        if (urlBar) urlBar.value = urlList[index];
    }
}

async function submissionNextButton() {
    const nextButton = document.querySelectorAll('.RDPZE');
    for (let j = 0; j < nextButton.length; j++) {
        if (nextButton[j].childNodes[2]) {
            nextButton[j].removeAttribute('aria-disabled');
            nextButton[j].setAttribute('tabindex', 0);
            nextButton[j].childNodes[2].click();
        }
    }
}

async function submitRequest(submitButtonFound) {
    let closeButtonFound = false;
    const submitButton = document.querySelectorAll('.CwaK9 .RveJvd.snByac');
    for (let k = 0; k < submitButton.length; k++) {
        if (submitButton[k].textContent.toLowerCase() == 'submit request') {
            submitButton[k].click();
            return true;
        } else {
            closeButtonFound = submitButton[k].textContent.toLowerCase() == 'close';
            if (closeButtonFound) break;
        }
    }
}

// ========== Kết quả ==========
async function checkOutcome(urlList, index, submitButtonFound) {
    let reason = "", status = "";
    if (document.querySelectorAll('.PNenzf').length > 0) {
        reason = "Trùng lặp URL"; 
        status = "error";
    } else if (!submitButtonFound) {
        reason = "Lỗi gửi"; 
        status = "error";
    } else {
        // Check for "URL not in property" error
        const errorMessages = document.querySelectorAll('.Ekjuhf, .zFr8rd, .jfk-bubble-content-id, .jfk-bubble-closebtn-id');
        let propertyError = false;
        for (let errorEl of errorMessages) {
            const errorText = errorEl.textContent || errorEl.innerText || "";
            if (errorText.toLowerCase().includes('not in property') || 
                errorText.toLowerCase().includes('switch properties') ||
                errorText.toLowerCase().includes('currently selected property')) {
                reason = "URL không thuộc property hiện tại";
                status = "error";
                propertyError = true;
                console.log(`🔴 PACK: Property error for URL ${index + 1}: ${errorText}`);
                break;
            }
        }
        
        // Check for other common GSC errors
        if (!propertyError) {
            const allErrorElements = document.querySelectorAll('[role="alert"], .error, .warning, .jfk-bubble');
            for (let errorEl of allErrorElements) {
                const errorText = errorEl.textContent || errorEl.innerText || "";
                if (errorText.trim().length > 0 && 
                    (errorText.toLowerCase().includes('error') || 
                     errorText.toLowerCase().includes('invalid') ||
                     errorText.toLowerCase().includes('failed'))) {
                    reason = `Lỗi GSC: ${errorText.substring(0, 100)}`;
                    status = "error";
                    console.log(`🔴 PACK: GSC error for URL ${index + 1}: ${errorText}`);
                    break;
                }
            }
        }
        
        // If no errors detected, mark as success
        if (status === "") {
            status = "success";
        }
    }
    
    const resultObj = { id: index + 1, url: urlList[index], status, reason };
    resultLinks.push(resultObj);
    chrome.storage.local.set({ resultLinks }); // Lưu vào cache

    // Đóng popup nếu có lỗi
    if (status === "error") {
        const closeButton = document.querySelectorAll('.CwaK9 .RveJvd.snByac');
        for (let k = 0; k < closeButton.length; k++) {
            if ((closeButton[k].childNodes[0] && (closeButton[k].childNodes[0].textContent).toLowerCase() == 'close')) {
                closeButton[k].click();
            }
        }
    }
}

// ========== Đệ quy xử lý từng URL ==========
async function removeUrlJs(index, urlList, nextButton = false, submitButtonFound = false) {
    if (isStopped) return;
    if (index < urlList.length) {
        await clickNextButton(nextButton, temporaryRemoval);
        await delay(1000);
        await urlToSubmissionBar(urlList, index, temporaryRemoval);
        await delay(1000);
        await submissionNextButton();
        await delay(1000);
        submitButtonFound = await submitRequest(submitButtonFound);
        await delay(2000);
        await checkOutcome(urlList, index, submitButtonFound);
        await delay(2000);
        // Cập nhật trạng thái vào storage
        chrome.storage.sync.set({
            running: true,
            currentUrlIndex: index + 1,
            totalInPack: urlList.length,
            isPaused: isPaused,
            isStopped: isStopped
        });

        // Kiểm tra tạm dừng
        const paused = await checkPaused(index);
        if (!paused && !isStopped) {
            await removeUrlJs(index + 1, urlList, false);
        } else if (!isStopped) {
            while (isPaused && !resumeRequested && !isStopped) {
                await delay(500);
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
                chrome.runtime.sendMessage({ type: "PACK_DONE" });
                // KHÔNG reload ở đây!
                // Để popup quyết định chuyển pack và gửi tiếp nếu auto
            }); 
        });
    }
}

// ========== Hàm chính ==========
async function linksResubmission() {
    try {
        const { URLs, downloadCheckbox, temporaryRemoval: tempRemoval, backgroundQueueMode, currentQueueIndex } = await new Promise((resolve, reject) => {
            chrome.storage.sync.get(["URLs", "downloadCheckbox", "temporaryRemoval", "backgroundQueueMode", "currentQueueIndex"], (data) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(data);
            });
        });

        if (!URLs) {
            alert("Hey, Cho vào ít nhất 1 URL.");
            return;
        }
        temporaryRemoval = tempRemoval;

        const urlListTrimmed = URLs.map(element => element.trim()).filter(element => element.length > 2);

        // ========== BACKGROUND QUEUE MODE ==========
        if (backgroundQueueMode) {
            log('QUEUE', 'Processing URL:', {
                url: urlListTrimmed[0],
                queueIndex: currentQueueIndex,
                totalReceived: urlListTrimmed.length,
                allUrlsReceived: urlListTrimmed
            });
            
            // Validate rằng chúng ta có đúng URL cần xử lý
            if (!urlListTrimmed[0]) {
                log('ERROR', 'QUEUE ERROR: No URL to process!', {
                    URLs: URLs,
                    urlListTrimmed: urlListTrimmed,
                    currentQueueIndex: currentQueueIndex
                });
                return;
            }
            
            await processSingleUrlFromQueue(urlListTrimmed[0], currentQueueIndex);
            return;
        }

        // ========== NORMAL PACK MODE ==========
        // Kiểm tra resume hay chạy mới
        chrome.storage.sync.get(['isPaused', 'pausedIndex'], (data) => {
            if (!data.isPaused && typeof data.pausedIndex === 'number') {
                currentUrlIndex = data.pausedIndex;
                removeUrlJs(currentUrlIndex, urlListTrimmed);
                chrome.storage.sync.remove('pausedIndex');
            } else {
                currentUrlIndex = 0;
                removeUrlJs(currentUrlIndex, urlListTrimmed);
            }
        });
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// ========== Reload ==========
function reload() {
    location.reload();
}

// ========== Khởi động script ==========
if (location.pathname === "/search-console/removals") {
    const htmlLang = document.getElementsByTagName("html")[0].lang;
    // Kiểm tra nếu ngôn ngữ bắt đầu bằng "en" (en, en-US, en-GB, etc.)
    if (htmlLang && htmlLang.toLowerCase().startsWith("en")) {
        linksResubmission();
    } else {
        alert("Hey nguoi anh em: Chuyen cai GSC sang tieng Anh. Current language: " + htmlLang);
    }
} else {
    alert("Hey người anh em, bấm OK đi bạn, vì bạn đang không ở link của GSC Removal:\nhttps://search.google.com/search-console/removals");
    window.location.replace("https://search.google.com/search-console/removals");
}

// ========== BACKGROUND QUEUE PROCESSING ==========
async function processSingleUrlFromQueue(url, queueIndex) {
    const startTime = Date.now();
    // Create safe processing key using hash of URL + index
    const urlHash = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const processingKey = `processing_${queueIndex}_${urlHash}`;
    const globalLockKey = `queue_lock_${queueIndex}`;
    
    // ATOMIC LOCK: Check and set in one operation
    if (window[processingKey] || window[globalLockKey]) {
        log('WARN', `URL ${queueIndex + 1} already being processed, skipping duplicate:`, {
            url: url,
            processingKey: processingKey,
            globalLockKey: globalLockKey
        });
        return;
    }
    
    // Set BOTH locks immediately
    window[processingKey] = true;
    window[globalLockKey] = true;
    
    log('QUEUE', `Processing URL ${queueIndex + 1}:`, {
        url: url,
        startTime: new Date().toLocaleTimeString(),
        processingKey: processingKey
    });
    
    // Double check: Nếu URL này đã có trong queueResults thì có thể đã xử lý rồi
    const existingResult = await new Promise((resolve) => {
        chrome.storage.local.get(['queueResults'], (data) => {
            const queueResults = data.queueResults || [];
            const existing = queueResults.find(r => r.url === url && r.queueIndex === queueIndex + 1);
            resolve(existing);
        });
    });
    
    if (existingResult) {
        log('WARN', `URL ${queueIndex + 1} already processed (found in results), skipping:`, {
            url: url,
            existingResult: existingResult
        });
        delete window[processingKey];
        delete window[globalLockKey];
        return;
    }
    
    // Additional safety: Set a unique timestamp lock
    const timestampLock = `ts_${queueIndex}_${Date.now()}`;
    window[timestampLock] = true;
    
    // Small delay to prevent race condition
    await delay(100);
    
    try {
        // Thực hiện các bước xử lý URL với timing tối ưu
        await clickNextButton(false, temporaryRemoval);
        await delay(1500);
        
        // Điền URL vào form
        const urlBarLabelIndex = temporaryRemoval ? 0 : 1;
        const urlBarLabel = document.querySelectorAll('.Ufn6O.PPB5Hf')[urlBarLabelIndex];
        if (urlBarLabel) {
            const urlBar = urlBarLabel.childNodes[0].childNodes[1];
            if (urlBar) {
                urlBar.value = url;
                console.log(`📝 QUEUE: URL filled into form: ${url}`);
            }
        }
        
        await delay(1500);
        await submissionNextButton();
        await delay(1500);
        
        const submitButtonFound = await submitRequest(false);
        await delay(1500); // Reduced from 2000ms to 1500ms
        
        // Kiểm tra kết quả
        let reason = "", status = "";
        if (document.querySelectorAll('.PNenzf').length > 0) {
            reason = "Trùng lặp URL"; 
            status = "error";
            log('DEBUG', `URL ${queueIndex + 1} - Duplicate`);
        } else if (!submitButtonFound) {
            reason = "Lỗi gửi"; 
            status = "error";
            log('DEBUG', `URL ${queueIndex + 1} - Submit failed`);
        } else {
            // Check for "URL not in property" error
            const errorMessages = document.querySelectorAll('.Ekjuhf, .zFr8rd, .jfk-bubble-content-id, .jfk-bubble-closebtn-id');
            let propertyError = false;
            for (let errorEl of errorMessages) {
                const errorText = errorEl.textContent || errorEl.innerText || "";
                if (errorText.toLowerCase().includes('not in property') || 
                    errorText.toLowerCase().includes('switch properties') ||
                    errorText.toLowerCase().includes('currently selected property')) {
                    reason = "URL không thuộc property hiện tại";
                    status = "error";
                    propertyError = true;
                    log('DEBUG', `URL ${queueIndex + 1} - Property error: ${errorText}`);
                    break;
                }
            }
            
            // Check for other common GSC errors
            if (!propertyError) {
                const allErrorElements = document.querySelectorAll('[role="alert"], .error, .warning, .jfk-bubble');
                for (let errorEl of allErrorElements) {
                    const errorText = errorEl.textContent || errorEl.innerText || "";
                    if (errorText.trim().length > 0 && 
                        (errorText.toLowerCase().includes('error') || 
                         errorText.toLowerCase().includes('invalid') ||
                         errorText.toLowerCase().includes('failed'))) {
                        reason = `Lỗi GSC: ${errorText.substring(0, 100)}`;
                        status = "error";
                        log('DEBUG', `URL ${queueIndex + 1} - GSC error: ${errorText}`);
                        break;
                    }
                }
            }
            
            // If no errors detected, mark as success
            if (status === "") {
                status = "success";
                log('DEBUG', `URL ${queueIndex + 1} - Success`);
            }
        }
        
        // Adaptive delay: shorter for success, longer for errors
        const adaptiveDelay = status === "success" ? 1000 : 1500;
        await delay(adaptiveDelay);
        
        log('DEBUG', `About to save result for URL ${queueIndex + 1}:`, {
            url: url,
            status: status,
            reason: reason,
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
                        status, 
                        reason,
                        queueIndex: queueIndex + 1,
                        timestamp: new Date().toISOString(),
                        processingKey: processingKey,  // Debug info
                        lockKey: lockKey
                    };
                    queueResults.push(resultObj);
                    log('INFO', `NEW result saved with STT ${newId} for queueIndex ${queueIndex + 1}:`, {
                        url: url,
                        stt: newId,
                        queueIndex: queueIndex + 1,
                        status: status,
                        reason: reason
                    });
                    
                    // Check for gap warning
                    const gap = Math.abs(newId - (queueIndex + 1));
                    if (gap > 5) {
                        log('WARN', `QUEUE GAP WARNING:`, {
                            stt: newId,
                            queueIndex: queueIndex + 1,
                            gap: gap
                        });
                    }
                } else {
                    // Update existing với same queueIndex (nếu có lỗi rồi retry)
                    resultObj = queueResults[existingIndex];
                    resultObj.status = status;
                    resultObj.reason = reason;
                    resultObj.timestamp = new Date().toISOString();
                    resultObj.processingKey = processingKey;
                    resultObj.lockKey = lockKey;
                    log('INFO', `UPDATED existing result STT ${resultObj.id} for queueIndex ${queueIndex + 1}:`, {
                        url: url,
                        stt: resultObj.id,
                        queueIndex: queueIndex + 1,
                        status: status,
                        reason: reason
                    });
                }
                
                // Clear lock after save
                delete locks[lockKey];
                
                chrome.storage.local.set({ queueResults, queueProcessingLocks: locks }, () => {
                    log('DEBUG', `Sending QUEUE_URL_PROCESSED message:`, {
                        stt: resultObj.id,
                        queueIndex: queueIndex + 1,
                        url: url,
                        status: status
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
            log('WARN', `Atomic save failed for URL ${queueIndex + 1}, URL already being processed by another instance`, {
                url: url,
                queueIndex: queueIndex + 1
            });
            return;
        }
        
        // Đóng popup nếu có lỗi
        if (status === "error") {
            const closeButton = document.querySelectorAll('.CwaK9 .RveJvd.snByac');
            for (let k = 0; k < closeButton.length; k++) {
                if ((closeButton[k].childNodes[0] && (closeButton[k].childNodes[0].textContent).toLowerCase() == 'close')) {
                    closeButton[k].click();
                    await delay(1000); // Reduced from 1500ms to 1000ms for faster error handling
                    log('DEBUG', `Error popup closed for URL ${queueIndex + 1}`);
                }
            }
        }
        
        const processingTime = Date.now() - startTime;
        log('INFO', `URL ${queueIndex + 1} completed:`, {
            url: url,
            status: status,
            processingTimeMs: processingTime,
            endTime: new Date().toLocaleTimeString()
        });
        
    } catch (error) {
        log('ERROR', `Error processing URL ${queueIndex + 1}:`, {
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
                log('WARN', `Storage lock detected for error URL ${queueIndex + 1}, skipping save`, {
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
    } finally {
        // Clear ALL processing flags
        delete window[processingKey];
        delete window[globalLockKey];
        delete window[timestampLock];
        console.log(`🧹 QUEUE: Cleared ALL processing flags [${processingKey}] for queueIndex ${queueIndex + 1}: ${url}`);
    }
}
