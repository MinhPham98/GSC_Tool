// ========== Biến toàn cục ==========
if (typeof currentUrlIndex === 'undefined') var currentUrlIndex = 0;
if (typeof resultLinks === 'undefined') var resultLinks = [];
if (typeof isPaused === 'undefined') var isPaused = false;
if (typeof resumeRequested === 'undefined') var resumeRequested = false;
if (typeof isStopped === 'undefined') var isStopped = false;

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
        reason = "Trùng lặp URL"; status = "error";
    } else if (!submitButtonFound) {
        reason = "Lỗi gửi"; status = "error";
    } else {
        status = "success";
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
        const { URLs, downloadCheckbox, temporaryRemoval: tempRemoval } = await new Promise((resolve, reject) => {
            chrome.storage.sync.get(["URLs", "downloadCheckbox", "temporaryRemoval"], (data) => {
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

