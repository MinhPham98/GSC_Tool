// ========== CONTENT SCRIPT CORE ==========
// Main content script that coordinates all modules

// ========== Global State Initialization ==========
chrome.storage.sync.set({ isPaused: false, running: false, currentUrlIndex: null });

// ========== Main Processing Function ==========
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
        
        // Set global temporaryRemoval variable
        window.temporaryRemoval = tempRemoval;

        const urlListTrimmed = URLs.map(element => element.trim()).filter(element => element.length > 2);

        // ========== BACKGROUND QUEUE MODE ==========
        if (backgroundQueueMode) {
            window.GSCUtils.log('QUEUE', 'Processing URL:', {
                url: urlListTrimmed[0],
                queueIndex: currentQueueIndex,
                totalReceived: urlListTrimmed.length,
                allUrlsReceived: urlListTrimmed
            });
            
            // Validate rằng chúng ta có đúng URL cần xử lý
            if (!urlListTrimmed[0]) {
                window.GSCUtils.log('ERROR', 'QUEUE ERROR: No URL to process!', {
                    URLs: URLs,
                    urlListTrimmed: urlListTrimmed,
                    currentQueueIndex: currentQueueIndex
                });
                return;
            }
            
            await window.GSCQueueProcessor.processSingleUrlFromQueue(urlListTrimmed[0], currentQueueIndex);
            return;
        }

        // ========== NORMAL PACK MODE ==========
        await window.GSCPackProcessor.startPackProcessing(urlListTrimmed);
        
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// ========== Script Initialization ==========
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

// ========== Export Main Functions ==========
window.GSCContentCore = {
    linksResubmission,
    reload: window.GSCUtils.reload
};
