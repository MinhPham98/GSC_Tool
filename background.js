let urlChunks = [];
let currentPack = 0;
let autoRun = false;
let isPaused = false;
let tabId = null;

// Lắng nghe lệnh từ popup
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    console.log('BG received:', msg);
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
});