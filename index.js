// ===== Khai báo biến và lấy phần tử giao diện =====
const chunkSizeInput = document.getElementById('chunkSize');
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");

// ========== ENHANCED POPUP LOGGING ==========
let popupStartTime = Date.now();
let popupLogCounter = 0;

// Hàm log cho popup với timestamp và counter
function popupLog(level, message, ...args) {
    popupLogCounter++;
    const now = Date.now();
    const uptime = Math.round((now - popupStartTime) / 1000);
    const timestamp = new Date(now).toLocaleTimeString();
    
    const prefix = `[${timestamp}] [POPUP:${uptime}s] [${popupLogCounter}] [${level}]`;
    
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
        case 'UI':
            console.log(`🎨 ${prefix}`, message, ...args);
            break;
        default:
            console.log(`⚪ ${prefix}`, message, ...args);
    }
}

// Log khởi động popup
popupLog('INFO', '🚀 GSC Tool Popup Initialized', {
    startTime: new Date(popupStartTime).toLocaleString(),
    url: window.location.href
});

// ========== BACKGROUND QUEUE ELEMENTS ==========
const backgroundModeCheckbox = document.getElementById('backgroundModeCheckbox');
const queueStatusDiv = document.getElementById('queue-status');
const pauseQueueBtn = document.getElementById('pauseQueueBtn');
const resumeQueueBtn = document.getElementById('resumeQueueBtn');
const resumeStoppedBtn = document.getElementById('resumeStoppedBtn');
const stopQueueBtn = document.getElementById('stopQueueBtn');
const downloadQueueBtn = document.getElementById('downloadQueueBtn');
const queueProgressFill = document.getElementById('queueProgressFill');
const queueProgress = document.getElementById('queueProgress');
const queueStatus = document.getElementById('queueStatus');

// ========== INFO TABLE ELEMENTS ==========
const packInfoTable = document.querySelector('.info-table-container');
const queueInfoTable = document.querySelector('.queue-info-table-container');
const queueTotalUrls = document.querySelector('.queue-total-urls');
const queueSuccessUrls = document.querySelector('.queue-success-urls');
const queueErrorUrls = document.querySelector('.queue-error-urls');

// Đảm bảo download queue button ẩn mặc định khi load (sẽ được hiển thị khi cần)
if (downloadQueueBtn) {
    downloadQueueBtn.classList.add('hidden');
}

let temporaryRemoval = true;
let chunkSize = parseInt(document.getElementById('chunkSize')?.value || 10, 10);
let urlChunks = [];
let currentPack = 0;
let autoRun = false;
let isPaused = false;
let sentPackCount = 0;
let sentUrlCount = 0;
let isFileInput = false;

// ========== BACKGROUND QUEUE VARIABLES ==========
let backgroundQueueActive = false;
let queueUpdateInterval = null;

/**
 * Chia mảng thành các pack nhỏ theo chunkSize
 */
function splitIntoChunks(array, chunkSize) {
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}

/**
 * Thêm thông báo lỗi hoặc trạng thái vào giao diện
 */
function insertElement(type, message, parentClass) {
  const container = document.getElementsByClassName(parentClass)[0];
  const element = document.createElement(type);
  element.textContent = message;
  element.style.color = 'red';
  container.appendChild(element);
  
  popupLog('UI', 'Element inserted:', { type, message, parentClass });
}

/**
 * Đặt lại thông tin bảng và bộ nhớ cache
 */
function resetInfoTableAndCache() {
  popupLog('INFO', 'Resetting info table and cache');
  
  chrome.storage.local.set({
    totalPack: 0,
    totalUrl: 0,
    urlSuccess: 0,
    urlError: 0,
    allUrls: [],
    resultLinks: [],
    failedLinks: []
  }, () => {
    document.querySelector('.total-pack').textContent = 0;
    document.querySelector('.total-url').textContent = 0;
    document.querySelector('.url-success').textContent = 0;
    document.querySelector('.url-error').textContent = 0;
    
    popupLog('INFO', 'Info table and cache reset completed');
  });
}

/**
 * Cập nhật textarea và pack info theo currentPack
 */
function updatePackDisplay() {
  const packInfo = document.getElementById('packInfo');
  packInfo.textContent = `Pack ${urlChunks.length ? (currentPack + 1) : 0}/${urlChunks.length}`;
  document.getElementById('prevPackBtn').disabled = currentPack === 0;
  document.getElementById('nextPackBtn').disabled = currentPack === urlChunks.length - 1 || urlChunks.length === 0;
  document.getElementById('links').value = urlChunks[currentPack] ? urlChunks[currentPack].join('\n') : '';
}

/**
 * Cập nhật thống kê tổng số pack và tổng URL
 */
function updatePackStats() {
  document.querySelector('.total-pack').textContent = urlChunks.length;
  const totalUrl = urlChunks.reduce((sum, pack) => sum + pack.length, 0);
  document.querySelector('.total-url').textContent = totalUrl;
}

/**
 * Cập nhật bảng thống kê từ cache (chỉ cập nhật các trường động)
 */
function updateInfoTableFromCache() {
  chrome.storage.local.get(['urlSuccess', 'urlError'], (cache) => {
    document.querySelector('.url-success').textContent = cache.urlSuccess || 0;
    document.querySelector('.url-error').textContent = cache.urlError || 0;
  });
}

/**
 * Hiển thị thông báo hoàn thành gửi tất cả URL
 */
function notifyDoneAll() {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.textContent = "Đã gửi xong tất cả URL để xoá trên GSC!";
  messagesDiv.style.color = "#43a047";
  setTimeout(() => { messagesDiv.textContent = ""; }, 5000);
}

/**
 * Hiển thị thông báo hoàn thành pack
 */
function notifyPackDoneAuto() {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.textContent = `Đã gửi xong pack ${currentPack + 1}/${urlChunks.length}`;
  messagesDiv.style.color = "#1976d2";
  setTimeout(() => { messagesDiv.textContent = ""; }, 1500);
}

/**
 * Xử lý khi chọn file input, đọc file và chia pack
 */
function handleFileSelect(event) {
  isFileInput = true;
  resetInfoTableAndCache();
  autoRun = false;
  isPaused = false;
  currentPack = 0;
  urlChunks = [];
  sentPackCount = 0;
  sentUrlCount = 0;
  document.querySelector('.sent-pack').textContent = 0;
  document.querySelector('.sent-url').textContent = 0;
  document.getElementById('packInfo').textContent = 'Pack 0/0';
  updatePackStats();
  startBtn.disabled = false;
  pauseBtn.textContent = 'Tạm dừng';
  pauseBtn.style.background = '#ffc107';
  pauseBtn.style.color = '#333';

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(fileLoadEvent) {
    const text = fileLoadEvent.target.result;
    parseLinksFromText(text).then((links) => {
      if (links.length > 0) {
        chrome.storage.local.set({ allUrls: links });
        chunkSize = parseInt(document.getElementById('chunkSize').value, 10) || 10;
        urlChunks = splitIntoChunks(links, chunkSize).filter(pack => pack.length > 0);
        currentPack = 0;
        updatePackDisplay();
        updatePackStats();
      } else {
        document.getElementById('links').value = '';
        document.getElementById('packInfo').textContent = 'Pack 0/0';
        updatePackStats();
      }
    }).catch((error) => {
      console.error('Lỗi phân tích URL:', error);
      insertElement('p', error, "errors")
    });
  };
  reader.readAsText(file);
}

/**
 * Phân tích danh sách URL từ text, kiểm tra định dạng, lọc URL hợp lệ
 */
async function parseLinksFromText(text) {
  const errorsContainer = document.getElementsByClassName("errors")[0];
  errorsContainer.innerHTML = "";

  const lines = text.split(/\r?\n|,/);

  const urls = lines
    .map(line => line.trim())
    .map((line, idx) => ({ line, idx }))
    .filter(({ line, idx }) => {
      if (!line) return false;
      const isUrl = isValidUrlAdvanced(line);
      if (!isUrl) {
        insertElement('p', `Dòng ${idx + 1}: ${line} không phải URL hợp lệ.`, "errors");
        return false;
      }
      return true;
    })
    .map(({ line }) => line);

  if (urls.length === 0) {
    insertElement('p', 'Không có URL hợp lệ để xoá.', "errors");
  }

  return urls;
}

/**
 * Xác thực URL nâng cao (http/https, domain, path)
 */
function isValidUrlAdvanced(url) {
  const regex = /^(https?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
  try {
    new URL(url);
    return regex.test(url);
  } catch {
    return false;
  }
}

// ===== Sự kiện chính =====

/**
 * Sự kiện click nút Bắt đầu: kiểm tra dữ liệu, xác nhận số lượng lớn, chia pack nếu cần và bắt đầu gửi
 */
startBtn.addEventListener("click", async function() {
  popupLog('INFO', '🚀 Start button clicked');
  
  if (!isFileInput && urlChunks.length === 0) {
    const text = document.getElementById('links').value;
    const links = await parseLinksFromText(text);
    if (links.length > 0) {
      chunkSize = parseInt(document.getElementById('chunkSize').value, 10) || 10;
      urlChunks = splitIntoChunks(links, chunkSize).filter(pack => pack.length > 0);
      currentPack = 0;
      updatePackDisplay();
      updatePackStats && updatePackStats();
      chrome.storage.local.set({ allUrls: links });
      
      popupLog('INFO', '📦 URLs processed:', {
        totalUrls: links.length,
        chunkSize,
        totalPacks: urlChunks.length
      });
    } else {
      urlChunks = [];
      updatePackDisplay();
      updatePackStats && updatePackStats();
      alert("Không có URL hợp lệ để gửi!");
      popupLog('WARN', '⚠️ No valid URLs found');
      return;
    }
  }

  const totalUrl = urlChunks.reduce((sum, pack) => sum + pack.length, 0);
  if (totalUrl > 100) {
    const ok = confirm(`Bạn sắp gửi ${totalUrl} URL. Bạn có chắc chắn muốn tiếp tục?`);
    if (!ok) {
      popupLog('INFO', '🚫 User cancelled large URL batch');
      return;
    }
  }

  autoRun = document.getElementById('autoRunCheckbox').checked;
  popupLog('INFO', '🎯 Processing mode:', autoRun ? 'Auto-run' : 'Manual');

  if (autoRun) {
    autoRunAllPacks();
  } else {
    await clickStartBtn();
  }
});

/**
 * Sự kiện click nút Tạm dừng/Tiếp tục: đổi trạng thái, đổi màu và chữ nút
 */
pauseBtn.addEventListener('click', function() {
  isPaused = !isPaused;
  chrome.storage.sync.set({ isPaused });
  if (isPaused) {
    pauseBtn.textContent = 'Tiếp tục';
    pauseBtn.style.background = '#4caf50';
    pauseBtn.style.color = '#fff';
  } else {
    pauseBtn.textContent = 'Tạm dừng';
    pauseBtn.style.background = '#ffc107';
    pauseBtn.style.color = '#333';
  }
});

/**
 * Sự kiện click nút Kết thúc: reset toàn bộ trạng thái, giao diện, dữ liệu
 */
stopBtn.addEventListener('click', function() {
  isFileInput = false;
  autoRun = false;
  isPaused = false;
  currentPack = 0;
  urlChunks = [];
  sentPackCount = 0;
  sentUrlCount = 0;
  document.querySelector('.sent-pack').textContent = 0;
  document.querySelector('.sent-url').textContent = 0;
  startBtn.disabled = false;
  pauseBtn.textContent = 'Tạm dừng';
  pauseBtn.style.background = '#ffc107';
  pauseBtn.style.color = '#333';
  chunkSize = 10;
  chunkSizeInput.value = 10;
  document.getElementById('links').value = '';
  document.getElementById('packInfo').textContent = 'Pack 1/1';
  resetInfoTableAndCache();
  chrome.storage.sync.set({
    isPaused: false,
    isStopped: true,
    pausedIndex: null,
    running: false,
    currentUrlIndex: null,
    totalInPack: null,
    URLs: [],
    temporaryRemoval: true
  });
  document.getElementById('fileInput').value = '';
  document.getElementById('messages').textContent = '';
  document.getElementsByClassName('errors')[0].innerHTML = '';
});

// ===== Gửi pack =====

/**
 * Gửi pack hiện tại (theo currentPack)
 */
async function clickStartBtn() {
  const URLs = urlChunks[currentPack] || [];
  if (URLs.length > 0) {
    chrome.storage.sync.set({
      URLs: URLs,
      temporaryRemoval: temporaryRemoval
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["url.js"]
      });
    });
  } else {
    setTimeout(() => {
      alert("Không có gì để xoá trong pack này.")
    }, 200)
  }
}

/**
 * Gửi tự động tất cả các pack (autoRun)
 */
async function autoRunAllPacks() {
  if (!autoRun || isPaused) return;
  await clickStartBtn();
}

// ===== Lắng nghe khi pack xong để chuyển pack tiếp theo nếu auto =====

/**
 * Lắng nghe khi pack xong để chuyển pack tiếp theo nếu auto
 */
chrome.runtime.onMessage.addListener(async function(msg, sender, sendResponse) {
  if (msg.type === "PACK_DONE") {
    updateInfoTableFromCache();

    sentPackCount++;
    sentUrlCount += urlChunks[currentPack] ? urlChunks[currentPack].length : 0;
    document.querySelector('.sent-pack').textContent = sentPackCount;
    document.querySelector('.sent-url').textContent = sentUrlCount;

    if (autoRun && !isPaused && currentPack < urlChunks.length - 1) {
      notifyPackDoneAuto(); // Thêm dòng này
      currentPack++;
      updatePackDisplay();
      setTimeout(async () => {
        await clickStartBtn();
      }, 1000);
    } else {
      autoRun = false;
      startBtn.disabled = false;
      notifyDoneAll();
    }
  }

  // Xử lý các thông điệp liên quan đến background queue
  if (msg.type === "QUEUE_COMPLETED") {
    popupLog('INFO', '🎉 Queue completed message received:', {
      totalProcessed: msg.totalProcessed
    });
    
    backgroundQueueActive = false;
    updateQueueUI();
    clearInterval(queueUpdateInterval);
    updateQueueInfoFromStorage(); // Cập nhật lần cuối khi hoàn thành
    
    // Đảm bảo download queue button hiển thị
    if (downloadQueueBtn) {
        downloadQueueBtn.classList.remove('hidden');
        downloadQueueBtn.style.display = 'block';
    }
    
    // Cập nhật UI để hiển thị kết quả
    const queueInfoContainer = document.querySelector('.queue-info-table-container');
    if (queueInfoContainer) {
      queueInfoContainer.classList.remove('hidden');
    }
    
    showMessage(`🎉 Background queue hoàn thành! Đã xử lý ${msg.totalProcessed} URLs. Bạn có thể tải xuống kết quả bằng nút Download CSV.`, 'success');
  }
  
  // Listen for individual URL completion để update real-time
  if (msg.type === "QUEUE_URL_PROCESSED") {
    updateQueueInfoFromStorage();
  }
});

// ===== Sự kiện chuyển pack =====

/**
 * Chuyển pack về trước 1
 */
document.getElementById('prevPackBtn').addEventListener('click', () => {
  if (currentPack > 0) {
    currentPack--;
    updatePackDisplay();
  }
});

/**
 * Chuyển pack về sau 1
 */
document.getElementById('nextPackBtn').addEventListener('click', () => {
  if (currentPack < urlChunks.length - 1) {
    currentPack++;
    updatePackDisplay();
  }
});

/**
 * Chuyển lùi 10 pack
 */
document.getElementById('firstPackBtn').addEventListener('click', () => {
  if (currentPack > 0) {
    currentPack = Math.max(0, currentPack - 10);
    updatePackDisplay();
  }
});

/**
 * Chuyển tiến 10 pack
 */
document.getElementById('lastPackBtn').addEventListener('click', () => {
  if (currentPack < urlChunks.length - 1) {
    currentPack = Math.min(urlChunks.length - 1, currentPack + 10);
    updatePackDisplay();
  }
});

// ===== Đọc file khi chọn file mới =====
document.getElementById('fileInput').addEventListener('change', handleFileSelect, false);

// ===== Thiết lập kích thước gói mặc định từ storage =====
chrome.storage.sync.get(['chunkSize'], function(result) {
  if (result.chunkSize) {
    chunkSize = result.chunkSize;
    document.getElementById('chunkSize').value = chunkSize;
  }
});

// ===== Gán sự kiện thay đổi kích thước gói cho input number =====

/**
 * Khi thay đổi số URL mỗi pack, chia lại pack theo nguồn dữ liệu hiện tại
 */
document.getElementById('chunkSize').addEventListener('change', async function() {
  const newSize = parseInt(this.value);
  if (newSize > 0 && newSize <= 100) {
    chunkSize = newSize;
    let allUrls = [];
    if (isFileInput) {
      allUrls = (await new Promise(resolve => {
        chrome.storage.local.get(['allUrls'], result => resolve(result.allUrls || []));
      }));
    } else {
      const text = document.getElementById('links').value;
      allUrls = await parseLinksFromText(text);
    }
    urlChunks = splitIntoChunks(allUrls, chunkSize).filter(pack => pack.length > 0);
    currentPack = 0;
    updatePackDisplay();
    updatePackStats();
  }
});

// ===== COMBINED POPUP STATE RESTORATION =====

/**
 * Khôi phục trạng thái popup khi mở lại (bao gồm cả pack mode và queue mode)
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Popup loaded, checking all states...');
    
    // Debug: Check storage state including queueStartTime
    chrome.storage.local.get(null, (allData) => {
        popupLog('DEBUG', '💾 Full storage state on popup load:', allData);
        if (allData.queueStartTime) {
            const startTime = new Date(allData.queueStartTime);
            const elapsed = (Date.now() - allData.queueStartTime) / 1000;
            popupLog('INFO', '⏰ Queue timer info:', {
                startTime: startTime.toLocaleString(),
                elapsed: `${elapsed.toFixed(1)}s ago`
            });
        }
    });
    
    try {
        // 1. Kiểm tra queue status với timeout và retry
        const queueResponse = await checkQueueStatusWithRetry();
        
        console.log('📊 Queue status response:', queueResponse);
        
        // 2. Nếu có queue đang chạy ngầm, ưu tiên hiển thị queue mode
        if (queueResponse && queueResponse.backgroundMode && queueResponse.queueProcessing) {
            console.log('🔄 Restoring queue mode UI...');
            
            // Activate queue mode
            backgroundQueueActive = true;
            backgroundModeCheckbox.checked = true;
            
            // Update UI ngay lập tức
            updateQueueUI();
            
            // Start status updates
            startQueueStatusUpdates();
            
            // Update status immediately
            updateQueueStatus(queueResponse);
            
            console.log('✅ Queue mode UI restored successfully');
            
            // RETURN EARLY - không load pack mode state nữa
            return;
        }
        
        // 3. Nếu không có queue, check for stopped queue
        console.log('📦 No active queue, checking for stopped queue...');
        
        // Check for stopped queue
        chrome.runtime.sendMessage({ type: "CHECK_STOPPED_QUEUE" }, (response) => {
            if (response && response.hasStoppedQueue) {
                const stoppedQueue = response.stoppedQueue;
                popupLog('INFO', '� Found stopped queue:', {
                    remainingUrls: stoppedQueue.urls.length,
                    processedCount: stoppedQueue.processedCount,
                    stopTime: new Date(stoppedQueue.stopTime).toLocaleString()
                });
                
                // Show resume button
                resumeStoppedBtn.classList.remove('hidden');
                resumeStoppedBtn.style.display = 'inline-block';
                
                // Show notification about stopped queue
                showMessage(`📋 Tìm thấy queue đã dừng (${stoppedQueue.urls.length} URLs còn lại)`, 'info');
            } else {
                // Hide resume button if no stopped queue
                resumeStoppedBtn.classList.add('hidden');
            }
        });
        
        // Ensure queue mode is OFF
        backgroundQueueActive = false;
        updateQueueUI();
        
        // Load pack mode states
        chrome.storage.sync.get(['running', 'URLs', 'currentPack', 'currentUrlIndex', 'totalInPack', 'isPaused'], (data) => {
            if (data.running && Array.isArray(data.URLs) && data.URLs.length > 0) {
                document.getElementById('links').value = data.URLs.join('\n');
            }
            if (typeof data.currentPack === 'number' && urlChunks.length > 0) {
                currentPack = data.currentPack;
                updatePackDisplay();
            }
            if (typeof data.currentUrlIndex === 'number' && typeof data.totalInPack === 'number') {
                document.getElementById('messages').textContent =
                    `Đang gửi URL ${data.currentUrlIndex}/${data.totalInPack} trong pack ${currentPack + 1}`;
            }
            if (data.isPaused) {
                document.getElementById('messages').textContent += ' (Đã tạm dừng)';
            }
        });
        
        // Load other statistics
        loadPackModeStats();
        
    } catch (error) {
        console.error('❌ Error checking states on load:', error);
        // Fallback to pack mode
        backgroundQueueActive = false;
        updateQueueUI();
    }
});

/**
 * Kiểm tra queue status với retry mechanism
 */
async function checkQueueStatusWithRetry(maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`🔄 Checking queue status (attempt ${i + 1}/${maxRetries})`);
            
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout'));
                }, 5000);
                
                chrome.runtime.sendMessage({ type: "GET_QUEUE_STATUS" }, (response) => {
                    clearTimeout(timeout);
                    
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    
                    resolve(response);
                });
            });
            
            // Nếu thành công và có data, return ngay
            if (response) {
                console.log(`✅ Got queue status on attempt ${i + 1}:`, response);
                return response;
            }
            
            console.log(`⚠️ No queue data on attempt ${i + 1}, retrying...`);
            
        } catch (error) {
            console.log(`❌ Queue status check failed on attempt ${i + 1}:`, error.message);
            
            if (i === maxRetries - 1) {
                // Cuối cùng vẫn fail, check từ storage trực tiếp
                console.log('🔍 Fallback: checking queue status from storage...');
                return await checkQueueStatusFromStorage();
            }
        }
        
        // Wait before retry
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    return null;
}

/**
 * Fallback: kiểm tra queue status từ storage trực tiếp
 */
async function checkQueueStatusFromStorage() {
    try {
        const data = await new Promise((resolve) => {
            chrome.storage.local.get([
                'backgroundMode', 'queueProcessing', 'queuePaused', 'urlQueue', 'currentUrlIndex'
            ], resolve);
        });
        
        console.log('📁 Storage data:', data);
        
        if (data.backgroundMode && data.queueProcessing && data.urlQueue && data.urlQueue.length > 0) {
            return {
                backgroundMode: data.backgroundMode,
                queueProcessing: data.queueProcessing,
                queuePaused: data.queuePaused || false,
                currentUrlIndex: data.currentUrlIndex || 0,
                totalUrls: data.urlQueue.length,
                remainingUrls: data.urlQueue.length - (data.currentUrlIndex || 0)
            };
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error checking storage:', error);
        return null;
    }
}

// ===== Đọc config mặc định nếu có =====

/**
 * Đọc config mặc định từ file config.json nếu có
 */
let config = {
  chunkSize: 10,
  temporaryRemoval: true,
  autoRun: false
};

fetch('config.json')
  .then(response => response.json())
  .then(data => {
    config = data;
    chunkSize = config.chunkSize;
    document.getElementById('chunkSize').value = config.chunkSize;
    temporaryRemoval = config.temporaryRemoval;
    autoRun = config.autoRun;
    document.getElementById('chunkSize').value = chunkSize;
  })
  .catch(() => {
    // Nếu lỗi thì dùng mặc định
  });

// ===== Nút tải kết quả CSV =====

/**
 * Sự kiện click nút tải kết quả CSV: xuất file CSV với id, url, kết quả, lý do
 */
document.getElementById('downloadBtn').addEventListener('click', function() {
  chrome.storage.local.get(['resultLinks'], function(data) {
    const resultLinks = data.resultLinks || [];
    if (!resultLinks.length) {
      alert('Không có dữ liệu để tải!');
      return;
    }
    const header = 'id,url,kết quả,lý do\n';
    const rows = resultLinks.map((r, idx) =>
      `${idx + 1},"${r.url || ''}","${r.status || ''}","${r.reason || ''}"`
    ).join('\n');
    const csvContent = header + rows;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ket_qua.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

// ========== BACKGROUND QUEUE FUNCTIONS ==========

/**
 * Bắt đầu background queue processing
 */
async function startBackgroundQueue(urls) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('search.google.com/search-console/removals')) {
            alert('Vui lòng mở trang Google Search Console Removals trước!');
            return;
        }
        
        // Validate URLs trước khi gửi
        if (!urls || urls.length === 0) {
            alert('Không có URL nào để xử lý!');
            return;
        }
        
        popupLog('INFO', '🚀 Starting background queue with URLs:', {
            count: urls.length,
            first5: urls.slice(0, 5),
            tabId: tab.id
        });
        
        // Reset queue results trước khi bắt đầu
        await chrome.storage.local.set({ queueResults: [] });
        
        // Cập nhật queue info table với số URLs ban đầu
        popupLog('INFO', '📊 Updating queue info table with:', urls.length, 'URLs');
        updateQueueInfoTable(urls.length, 0, 0);
        
        popupLog('INFO', '📤 Sending START_BACKGROUND_QUEUE message to background...', {
            urlCount: urls.length,
            tabId: tab.id
        });
        
        // Gửi URLs đến background script
        chrome.runtime.sendMessage({
            type: "START_BACKGROUND_QUEUE",
            urls: urls,
            tabId: tab.id
        });
        
        popupLog('INFO', '🔄 Setting backgroundQueueActive = true');
        backgroundQueueActive = true;
        
        updateQueueUI();
        
        // Đợi một chút cho UI update xong
        setTimeout(() => {
            startQueueStatusUpdates();
        }, 500);
        
        // Hiển thị queue status và queue download button
        queueStatusDiv.classList.remove('hidden');
        if (downloadQueueBtn) downloadQueueBtn.classList.remove('hidden');
        
        showMessage(`✅ Background queue đã bắt đầu với ${urls.length} URLs! 
        Bạn có thể đóng popup, queue sẽ xử lý từng URL một cách tuần tự.
        Mỗi URL sẽ được xử lý hoàn toàn trước khi chuyển sang URL tiếp theo.`, 'success');
        
    } catch (error) {
        popupLog('ERROR', '❌ Error starting background queue:', error);
        showMessage('❌ Lỗi khi bắt đầu background queue: ' + error.message, 'error');
    }
}

/**
 * Cập nhật UI queue controls
 */
function updateQueueUI() {
    const bodyElement = document.body;
    
    console.log('🔄 Updating UI, backgroundQueueActive:', backgroundQueueActive);
    
    if (backgroundQueueActive) {
        // Add class để trigger CSS hiding
        bodyElement.classList.add('queue-mode-active');
        
        // Update checkbox state
        backgroundModeCheckbox.checked = true;
        // Ẩn luôn checkbox thay vì disable
        const backgroundModeRow = backgroundModeCheckbox.closest('.form-group');
        if (backgroundModeRow) backgroundModeRow.classList.add('hidden');
        
        // Hide pack mode controls
        startBtn.classList.add('hidden');
        pauseBtn.classList.add('hidden');
        stopBtn.classList.add('hidden');
        
        // Hide pack navigation
        const packNavigation = document.querySelector('.pack-navigation');
        if (packNavigation) packNavigation.classList.add('hidden');
        
        // Hide auto run checkbox section
        const autoRunRow = document.getElementById('autoRunCheckbox')?.closest('.form-group');
        if (autoRunRow) autoRunRow.classList.add('hidden');
        
        // Hide chunk size input section
        const chunkRow = chunkSizeInput?.closest('.form-group');
        if (chunkRow) chunkRow.classList.add('hidden');
        
        // Hide download CSV button thường
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.classList.add('hidden');
        
        // Show download queue button
        if (downloadQueueBtn) downloadQueueBtn.classList.remove('hidden');
        
        // Hide pack mode info table và show queue info table
        if (packInfoTable) packInfoTable.classList.add('hidden');
        if (queueInfoTable) queueInfoTable.classList.remove('hidden');
        
        // Update queue info table với dữ liệu hiện tại
        updateQueueInfoFromStorage();
        
        // Show queue UI
        queueStatusDiv.classList.remove('hidden');
        downloadQueueBtn.classList.remove('hidden');
        
        // Update textarea placeholder
        const linksTextarea = document.getElementById('links');
        if (linksTextarea) {
            linksTextarea.placeholder = '🔄 Queue Mode: Paste URLs here (one per line)\nQueue đang chạy ngầm...';
            linksTextarea.style.border = '2px solid #1976d2';
            linksTextarea.style.background = '#f3f8ff';
        }
        
        console.log('🔄 Queue mode UI activated');
        
    } else {
        // Remove class để hiện lại UI
        bodyElement.classList.remove('queue-mode-active');
        
        // Reset checkbox - NHƯNG nếu queue vừa hoàn thành, giữ download button
        backgroundModeCheckbox.checked = false;
        // Hiện lại checkbox row
        const backgroundModeRow = backgroundModeCheckbox.closest('.form-group');
        if (backgroundModeRow) backgroundModeRow.classList.remove('hidden');
        
        // Show pack mode controls
        startBtn.classList.remove('hidden');
        pauseBtn.classList.remove('hidden');
        stopBtn.classList.remove('hidden');
        
        // Show pack navigation
        const packNavigation = document.querySelector('.pack-navigation');
        if (packNavigation) packNavigation.classList.remove('hidden');
        
        // Show auto run checkbox section
        const autoRunRow = document.getElementById('autoRunCheckbox')?.closest('.form-group');
        if (autoRunRow) autoRunRow.classList.remove('hidden');
        
        // Show chunk size input section
        const chunkRow = chunkSizeInput?.closest('.form-group');
        if (chunkRow) chunkRow.classList.remove('hidden');
        
        // Show download CSV button thường
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.classList.remove('hidden');
        
        // Hide download queue button (trừ khi có queue results)
        if (downloadQueueBtn) downloadQueueBtn.classList.add('hidden');
        
        // Check for stopped queue and show resume button if needed
        chrome.runtime.sendMessage({ type: "CHECK_STOPPED_QUEUE" }, (response) => {
            if (response && response.hasStoppedQueue) {
                resumeStoppedBtn.classList.remove('hidden');
                resumeStoppedBtn.style.display = 'inline-block';
            } else {
                resumeStoppedBtn.classList.add('hidden');
            }
        });
        
        // Show pack mode info table và hide queue info table - NHƯNG kiểm tra có kết quả queue không
        chrome.storage.local.get(['queueResults'], (data) => {
            const hasQueueResults = data.queueResults && data.queueResults.length > 0;
            
            if (hasQueueResults) {
                // Giữ queue info table nếu có kết quả
                popupLog('INFO', '📊 Keeping queue results visible:', {
                    resultsCount: data.queueResults.length
                });
                if (queueInfoTable) queueInfoTable.classList.remove('hidden');
                if (packInfoTable) packInfoTable.classList.add('hidden');
                
                // Giữ download queue button visible và ẩn download button thường
                if (downloadQueueBtn) downloadQueueBtn.classList.remove('hidden');
                queueStatusDiv.classList.add('hidden'); // Ẩn status vì đã hoàn thành
                
                // Ẩn main download button khi có queue results
                const downloadBtn = document.getElementById('downloadBtn');
                if (downloadBtn) downloadBtn.classList.add('hidden');
            } else {
                // Không có kết quả queue, chuyển về pack mode bình thường
                if (packInfoTable) packInfoTable.classList.remove('hidden');
                if (queueInfoTable) queueInfoTable.classList.add('hidden');
                if (downloadQueueBtn) downloadQueueBtn.classList.add('hidden');
                queueStatusDiv.classList.add('hidden');
                
                // Hiển thị lại download button thường
                const downloadBtn = document.getElementById('downloadBtn');
                if (downloadBtn) downloadBtn.classList.remove('hidden');
            }
        });
        
        // Reset textarea
        const linksTextarea = document.getElementById('links');
        if (linksTextarea) {
            linksTextarea.placeholder = 'Dán URL vào đây (một URL mỗi dòng)';
            linksTextarea.style.border = '';
            linksTextarea.style.background = '';
        }
        
        popupLog('UI', '📦 Pack mode UI activated (with queue results check)');
    }
}

/**
 * Bắt đầu cập nhật trạng thái queue định kỳ
 */
function startQueueStatusUpdates() {
  console.log('🔄 Starting queue status updates...');
  
  if (queueUpdateInterval) {
    clearInterval(queueUpdateInterval);
  }
  
  queueUpdateInterval = setInterval(async () => {
    if (!backgroundQueueActive) {
      console.log('⏹️ Queue not active, stopping updates');
      clearInterval(queueUpdateInterval);
      return;
    }
    
    console.log('📊 Requesting queue status...');
    
    try {
      chrome.runtime.sendMessage({ type: "GET_QUEUE_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Runtime error:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response) {
          console.log('✅ Received queue status:', response);
          updateQueueStatus(response);
          // Cập nhật queue info table real-time
          updateQueueInfoFromStorage();
        } else {
          console.log('⚠️ No response from background script');
        }
      });
    } catch (error) {
      console.error('❌ Error getting queue status:', error);
    }
  }, 1000); // Cập nhật mỗi giây
}

/**
 * Cập nhật hiển thị trạng thái queue với ETA calculation từ storage
 */
function updateQueueStatus(status) {
    if (!status) {
        popupLog('WARN', '⚠️ No queue status received');
        return;
    }
    
    const { currentUrlIndex, totalUrls, queueProcessing, queuePaused, backgroundMode } = status;
    
    popupLog('UI', '📊 Updating queue status:', status);
    
    // Cập nhật progress bar
    const progressPercent = totalUrls > 0 ? (currentUrlIndex / totalUrls) * 100 : 0;
    
    if (queueProgressFill) {
        queueProgressFill.style.width = progressPercent + '%';
        popupLog('DEBUG', '✅ Progress bar updated:', queueProgressFill.style.width);
    } else {
        popupLog('ERROR', '❌ queueProgressFill element not found');
    }
    
    // Calculate ETA from storage queueStartTime (async)
    const updateProgressWithETA = async () => {
        if (queueProcessing && currentUrlIndex > 0) {
            // Get queueStartTime from storage instead of window
            try {
                const data = await new Promise((resolve) => {
                    chrome.storage.local.get(['queueStartTime'], resolve);
                });
                
                const queueStartTime = data.queueStartTime || Date.now();
                const now = Date.now();
                const elapsed = (now - queueStartTime) / 1000; // seconds
                const avgTimePerUrl = elapsed / currentUrlIndex;
                const remainingUrls = totalUrls - currentUrlIndex;
                const etaSeconds = remainingUrls * avgTimePerUrl;
                
                popupLog('DEBUG', '⏱️ ETA Calculation Debug:', {
                    queueStartTime: new Date(queueStartTime).toLocaleString(),
                    now: new Date(now).toLocaleString(),
                    elapsed: `${elapsed.toFixed(1)}s`,
                    currentUrlIndex,
                    totalUrls,
                    avgTimePerUrl: `${avgTimePerUrl.toFixed(2)}s/URL`,
                    etaSeconds: `${etaSeconds.toFixed(1)}s`
                });
                
                let etaDisplayText = '';
                if (etaSeconds > 60) {
                    const etaMinutes = Math.round(etaSeconds / 60);
                    etaDisplayText = ` - ETA: ${etaMinutes}min`;
                } else {
                    etaDisplayText = ` - ETA: ${Math.round(etaSeconds)}s`;
                }
                
                const speed = currentUrlIndex / (elapsed / 60); // URLs per minute
                if (speed > 0 && isFinite(speed)) {
                    etaDisplayText += ` (${speed.toFixed(1)} URLs/min)`;
                    popupLog('DEBUG', '📈 Speed calculation:', `${speed.toFixed(1)} URLs/min`);
                } else {
                    popupLog('WARN', '⚠️ Invalid speed calculation:', { speed, elapsed, currentUrlIndex });
                }
                
                // Update progress text with calculated ETA
                if (queueProgress) {
                    queueProgress.textContent = `${currentUrlIndex}/${totalUrls}${etaDisplayText}`;
                    popupLog('DEBUG', '✅ Progress text updated with storage ETA:', queueProgress.textContent);
                }
            } catch (error) {
                popupLog('ERROR', '❌ Failed to get queueStartTime from storage:', error);
                // Fallback to basic progress
                if (queueProgress) {
                    queueProgress.textContent = `${currentUrlIndex}/${totalUrls}`;
                }
            }
        } else {
            // Fallback for no processing or first URL
            if (queueProgress) {
                queueProgress.textContent = `${currentUrlIndex}/${totalUrls}`;
                popupLog('DEBUG', '📊 Basic progress update (no ETA):', queueProgress.textContent);
            }
        }
    };
    
    // Call the async function
    updateProgressWithETA();
    
    // Cập nhật trạng thái và controls
    if (!backgroundMode || !queueProcessing) {
        queueStatus.textContent = 'Hoàn thành';
        queueStatusDiv.className = 'queue-status queue-status--completed';
        pauseQueueBtn.classList.add('hidden');
        resumeQueueBtn.classList.add('hidden');
        stopQueueBtn.textContent = 'Đóng';
    } else if (queuePaused) {
        queueStatus.textContent = 'Đã tạm dừng';
        queueStatusDiv.className = 'queue-status queue-status--paused';
        pauseQueueBtn.classList.add('hidden');
        resumeQueueBtn.classList.remove('hidden');
    } else {
        queueStatus.textContent = 'Đang xử lý...';
        queueStatusDiv.className = 'queue-status queue-status--processing';
        pauseQueueBtn.classList.remove('hidden');
        resumeQueueBtn.classList.add('hidden');
    }
    
    // Cập nhật header text với progress
    const queueHeader = queueStatusDiv.querySelector('h4');
    if (queueHeader) {
        queueHeader.textContent = `🔄 Background Queue (${currentUrlIndex}/${totalUrls})`;
    }
}

/**
 * Tải kết quả background queue
 */
function downloadQueueResults() {
  chrome.storage.local.get(['queueResults'], function(data) {
    const queueResults = data.queueResults || [];
    if (!queueResults.length) {
      alert('Không có dữ liệu queue để tải!');
      return;
    }
    
    const header = 'STT,URL,Kết quả,Lý do,Thời gian\n';
    const rows = queueResults.map(r =>
      `${r.id},"${r.url}","${r.status}","${r.reason || ''}","${r.timestamp || ''}"`
    ).join('\n');
    const csvContent = header + rows;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue_results_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ========== BACKGROUND QUEUE EVENT LISTENERS ==========

// Background mode checkbox change
backgroundModeCheckbox.addEventListener('change', function() {
  const isChecked = this.checked;
  
  popupLog('UI', '🔄 Background mode toggled:', isChecked);
  
  // Debug: Kiểm tra sự tồn tại của các elements
  const downloadBtn = document.getElementById('downloadBtn');
  const packNavigation = document.querySelector('.pack-navigation');
  const autoRunCheckbox = document.getElementById('autoRunCheckbox');
  
  popupLog('DEBUG', '🔍 Elements check:', {
    downloadBtn: !!downloadBtn,
    downloadQueueBtn: !!downloadQueueBtn,
    packNavigation: !!packNavigation,
    packInfoTable: !!packInfoTable,
    queueInfoTable: !!queueInfoTable,
    autoRunCheckbox: !!autoRunCheckbox,
    chunkSizeInput: !!chunkSizeInput
  });
  
  if (isChecked) {
    popupLog('UI', '📥 Switching to Queue Mode...');
    
    // Ẩn các controls không cần thiết cho background mode
    if (packNavigation) {
      packNavigation.classList.add('hidden');
      popupLog('DEBUG', '✅ Pack navigation hidden');
    }
    
    if (autoRunCheckbox) {
      autoRunCheckbox.checked = false;
      // Ẩn hoàn toàn autoRun row thay vì disable
      const autoRunRow = autoRunCheckbox.closest('.form-group');
      if (autoRunRow) {
        autoRunRow.classList.add('hidden');
        popupLog('DEBUG', '✅ Auto run row hidden');
      }
    }
    
    // Ẩn hoàn toàn chunk size row thay vì disable
    if (chunkSizeInput) {
      const chunkRow = chunkSizeInput.closest('.form-group');
      if (chunkRow) {
        chunkRow.classList.add('hidden');
        popupLog('DEBUG', '✅ Chunk size row hidden');
      }
    }
    
    // Toggle info tables
    if (packInfoTable) {
      packInfoTable.classList.add('hidden');
      popupLog('DEBUG', '✅ Pack info table hidden');
    }
    if (queueInfoTable) {
      queueInfoTable.classList.remove('hidden');
      resetQueueInfoTable(); // Reset về 0 khi chuyển mode
      popupLog('DEBUG', '✅ Queue info table shown');
    }
    
    // Ẩn download button thường và hiện download queue button
    if (downloadBtn) {
      downloadBtn.classList.add('hidden');
      popupLog('DEBUG', '✅ Download button hidden');
    }
    if (downloadQueueBtn) {
      downloadQueueBtn.classList.remove('hidden');
      popupLog('DEBUG', '✅ Download queue button shown');
    }
    
    // Load ALL URLs vào textarea cho background queue mode
    loadAllUrlsToTextarea();
    
    popupLog('UI', '📥 Switched to Queue download button');
    
  } else {
    popupLog('UI', '📥 Switching to Pack Mode...');
    
    // Hiện lại controls
    if (packNavigation) {
      packNavigation.classList.remove('hidden');
      popupLog('DEBUG', '✅ Pack navigation shown');
    }
    
    // Hiện lại autoRun row
    if (autoRunCheckbox) {
      const autoRunRow = autoRunCheckbox.closest('.form-group');
      if (autoRunRow) {
        autoRunRow.classList.remove('hidden');
        popupLog('DEBUG', '✅ Auto run row shown');
      }
    }
    
    // Hiện lại chunk size row
    if (chunkSizeInput) {
      const chunkRow = chunkSizeInput.closest('.form-group');
      if (chunkRow) {
        chunkRow.classList.remove('hidden');
        popupLog('DEBUG', '✅ Chunk size row shown');
      }
    }
    
    // Toggle info tables
    if (packInfoTable) {
      packInfoTable.classList.remove('hidden');
      popupLog('DEBUG', '✅ Pack info table shown');
    }
    if (queueInfoTable) {
      queueInfoTable.classList.add('hidden');
      popupLog('DEBUG', '✅ Queue info table hidden');
    }
    
    // Hiện download button thường và ẩn download queue button
    if (downloadBtn) {
      downloadBtn.classList.remove('hidden');
      popupLog('DEBUG', '✅ Download button shown');
    }
    if (downloadQueueBtn) {
      downloadQueueBtn.classList.add('hidden');
      popupLog('DEBUG', '✅ Download queue button hidden');
    }
    
    popupLog('UI', '📥 Switched to Pack download button');
  }
});

// Queue control buttons
pauseQueueBtn.addEventListener('click', function() {
  popupLog('UI', '⏸️ Pause queue button clicked');
  chrome.runtime.sendMessage({ type: "PAUSE_BACKGROUND_QUEUE" });
  showMessage('⏸️ Background queue đã tạm dừng', 'info');
});

resumeQueueBtn.addEventListener('click', function() {
  popupLog('UI', '▶️ Resume queue button clicked');
  chrome.runtime.sendMessage({ type: "RESUME_BACKGROUND_QUEUE" });
  showMessage('▶️ Background queue đã tiếp tục', 'info');
});

stopQueueBtn.addEventListener('click', function() {
  popupLog('UI', '� Stop queue button clicked');
  if (confirm('Bạn có chắc muốn dừng background queue?')) {
    chrome.runtime.sendMessage({ type: "STOP_BACKGROUND_QUEUE" });
    backgroundQueueActive = false;
    updateQueueUI();
    clearInterval(queueUpdateInterval);
    showMessage('🛑 Background queue đã dừng', 'info');
  }
});

downloadQueueBtn.addEventListener('click', downloadQueueResults);

// Listen for queue completion
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "QUEUE_COMPLETED") {
    popupLog('INFO', '🎉 Queue completion listener triggered:', {
      totalProcessed: message.totalProcessed
    });
    
    backgroundQueueActive = false;
    updateQueueUI();
    clearInterval(queueUpdateInterval);
    updateQueueInfoFromStorage(); // Cập nhật lần cuối khi hoàn thành
    
    // Đảm bảo download queue button hiển thị
    if (downloadQueueBtn) {
        downloadQueueBtn.classList.remove('hidden');
        downloadQueueBtn.style.display = 'block';
    }
    
    // Cập nhật UI để hiển thị kết quả  
    const queueInfoContainer = document.querySelector('.queue-info-table-container');
    if (queueInfoContainer) {
      queueInfoContainer.classList.remove('hidden');
    }
    
    showMessage(`🎉 Background queue hoàn thành! Đã xử lý ${message.totalProcessed} URLs. Bạn có thể tải xuống kết quả bằng nút Download CSV.`, 'success');
  }
  
  // Listen for individual URL completion để update real-time
  if (message.type === "QUEUE_URL_PROCESSED") {
    updateQueueInfoFromStorage();
  }
});

// ========== MODIFY START BUTTON FOR BACKGROUND MODE ==========
// Cập nhật hàm start để hỗ trợ background queue
const originalStartHandler = startBtn.onclick;
startBtn.onclick = async function() {
  const urls = await getUrlsFromInput(); // Await cho trường hợp Promise
  
  if (!urls.length) {
    alert('Vui lòng nhập ít nhất 1 URL!');
    return;
  }
  
  popupLog('INFO', '🎯 Start clicked:', {
    urlCount: urls.length,
    backgroundMode: backgroundModeCheckbox.checked,
    first5: urls.slice(0, 5)
  });
  
  // Kiểm tra background mode
  if (backgroundModeCheckbox.checked) {
    await startBackgroundQueue(urls);
  } else {
    // Chạy mode thường
    if (originalStartHandler) {
      originalStartHandler.call(this);
    }
  }
};

/**
 * Lấy URLs từ input (textarea hoặc file)
 * Đối với background mode: lấy ALL URLs từ storage nếu có
 */
function getUrlsFromInput() {
  const linksTextarea = document.getElementById('links');
  const linksText = linksTextarea.value.trim();
  
  popupLog('DEBUG', '📝 Reading URLs from input:', {
    textLength: linksText.length,
    isEmpty: !linksText,
    backgroundMode: backgroundModeCheckbox.checked,
    hasUrlChunks: urlChunks.length > 0
  });
  
  // Nếu background mode và đang có urlChunks (đã chia pack), 
  // thì lấy TẤT CẢ URLs từ storage thay vì chỉ pack hiện tại
  if (backgroundModeCheckbox.checked && urlChunks.length > 0) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['allUrls'], (data) => {
        const allUrls = data.allUrls || [];
        popupLog('DEBUG', '📝 Background mode: using ALL URLs from storage:', {
          totalUrls: allUrls.length,
          first5: allUrls.slice(0, 5),
          last5: allUrls.slice(-5)
        });
        resolve(allUrls);
      });
    });
  }
  
  if (!linksText) {
    return [];
  }
  
  const urls = linksText.split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);
    
  popupLog('DEBUG', '📝 URLs parsed from textarea:', {
    totalUrls: urls.length,
    first5: urls.slice(0, 5),
    last5: urls.slice(-5)
  });
  
  return urls;
}

/**
 * Cập nhật thống kê queue info table
 */
function updateQueueInfoTable(totalUrls = 0, successUrls = 0, errorUrls = 0) {
    if (queueTotalUrls) queueTotalUrls.textContent = totalUrls;
    if (queueSuccessUrls) queueSuccessUrls.textContent = successUrls;
    if (queueErrorUrls) queueErrorUrls.textContent = errorUrls;
}

/**
 * Reset queue info table về 0
 */
function resetQueueInfoTable() {
    updateQueueInfoTable(0, 0, 0);
}

/**
 * Cập nhật queue info table từ storage và queue results
 */
function updateQueueInfoFromStorage() {
    chrome.storage.local.get(['queueResults', 'urlQueue'], (data) => {
        const queueResults = data.queueResults || [];
        const urlQueue = data.urlQueue || [];
        
        const successCount = queueResults.filter(r => r.status === 'success').length;
        const errorCount = queueResults.filter(r => r.status === 'error').length;
        
        updateQueueInfoTable(urlQueue.length, successCount, errorCount);
    });
}

/**
 * Load pack mode statistics and data
 */
function loadPackModeStats() {
    chrome.storage.local.get(['urlSuccess', 'urlError'], (data) => {
        if (data.urlSuccess) {
            document.querySelector('.url-success').textContent = data.urlSuccess;
        }
        if (data.urlError) {
            document.querySelector('.url-error').textContent = data.urlError;
        }
    });
}

/**
 * Hiển thị thông báo
 */
function showMessage(message, type = 'info') {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        messagesDiv.textContent = message;
        messagesDiv.style.color = type === 'error' ? '#f44336' : 
                                  type === 'success' ? '#4caf50' : '#1976d2';
        setTimeout(() => { 
            messagesDiv.textContent = ""; 
        }, type === 'error' ? 8000 : 5000);
        
        popupLog('UI', '💬 Message shown:', { message, type });
    }
}

/**
 * Load ALL URLs vào textarea cho background queue mode
 */
function loadAllUrlsToTextarea() {
    // Nếu có urlChunks (đã chia pack), load từ storage
    if (urlChunks.length > 0) {
        chrome.storage.local.get(['allUrls'], (data) => {
            const allUrls = data.allUrls || [];
            if (allUrls.length > 0) {
                const linksTextarea = document.getElementById('links');
                linksTextarea.value = allUrls.join('\n');
                
                popupLog('UI', '📝 Loaded ALL URLs to textarea for queue mode:', {
                    totalUrls: allUrls.length,
                    fromPacks: urlChunks.reduce((sum, pack) => sum + pack.length, 0)
                });
            }
        });
    }
    // Nếu chưa có pack nào, textarea giữ nguyên (user mới paste)
}

// ========== POPUP DEBUG OBJECT ==========
// Export cho console debugging
window.gscPopupDebug = {
    clearLogs: () => {
        console.clear();
        popupLogCounter = 0;
        popupStartTime = Date.now();
        popupLog('INFO', '🧹 Popup logs cleared manually');
    },
    getPopupState: () => ({
        backgroundQueueActive,
        currentPack,
        totalPacks: urlChunks.length,
        autoRun,
        isPaused,
        popupUptime: Math.round((Date.now() - popupStartTime) / 1000),
        logCounter: popupLogCounter
    }),
    log: popupLog,
    // Quick access functions
    checkBackgroundStatus: () => {
        chrome.runtime.sendMessage({type: 'GET_QUEUE_STATUS'}, (response) => {
            popupLog('DEBUG', '🔍 Background status check:', response);
            return response;
        });
    },
    forceUIUpdate: () => {
        popupLog('DEBUG', '🔄 Forcing UI update...');
        checkAndUpdateUI();
    }
};

// Log khi popup được loaded hoàn toàn
document.addEventListener('DOMContentLoaded', () => {
    popupLog('INFO', '✅ Popup DOM loaded completely');
});

// Hướng dẫn cho user trong console
setTimeout(() => {
    console.log('');
    console.log('🛠️  GSC Tool Debug Guide:');
    console.log('');
    console.log('📖 Để hiểu về hệ thống log và khi nào log bị reset:');
    console.log('   Xem file DEBUG_GUIDE_V2.md');
    console.log('');
    console.log('🔧 Debug Commands (chạy trong console này):');
    console.log('   gscPopupDebug.getPopupState()      - Xem trạng thái popup');
    console.log('   gscPopupDebug.checkBackgroundStatus() - Kiểm tra background');
    console.log('   gscPopupDebug.clearLogs()          - Xóa log popup');
    console.log('   gscPopupDebug.forceUIUpdate()      - Force cập nhật UI');
    console.log('');
    console.log('🔍 Để xem background logs:');
    console.log('   1. Vào chrome://extensions/');
    console.log('   2. Bật Developer mode');
    console.log('   3. Click "service worker" cho GSC Tool');
    console.log('   4. Trong background console, chạy: gscToolDebug.getQueueState()');
    console.log('');
    console.log('⚠️  Log sẽ BỊ RESET khi:');
    console.log('   • Extension reload/update');
    console.log('   • Browser restart');
    console.log('   • Service Worker terminate (Chrome quản lý)');
    console.log('   • Manual clear console');
    console.log('');
    console.log('✅ Log sẽ TIẾP TỤC khi:');
    console.log('   • Đóng/mở popup');
    console.log('   • Đóng/mở tab GSC');
    console.log('   • Chuyển tab khác');
    console.log('   • Lock/unlock máy');
    console.log('');
}, 1000);

// ===== Khôi phục trạng thái hàng đợi đã dừng =====

resumeStoppedBtn.addEventListener('click', async function() {
  popupLog('UI', '🔄 Resume stopped queue button clicked');
  
  // Check if there's a stopped queue first
  chrome.runtime.sendMessage({ type: "CHECK_STOPPED_QUEUE" }, (response) => {
    if (response && response.hasStoppedQueue) {
      const stoppedQueue = response.stoppedQueue;
      const message = `Tìm thấy queue đã dừng:\n` +
                     `- URLs còn lại: ${stoppedQueue.urls.length}\n` +
                     `- Đã xử lý: ${stoppedQueue.processedCount}/${stoppedQueue.totalOriginal}\n` +
                     `- Dừng lúc: ${new Date(stoppedQueue.stopTime).toLocaleString()}\n\n` +
                     `Bạn có muốn tiếp tục queue này?`;
      
      if (confirm(message)) {
        popupLog('INFO', '🔄 Resuming stopped queue...', stoppedQueue);
        chrome.runtime.sendMessage({ type: "RESUME_BACKGROUND_QUEUE" });
        
        // Activate queue mode UI
        backgroundQueueActive = true;
        backgroundModeCheckbox.checked = true;
        updateQueueUI();
        startQueueStatusUpdates();
        
        showMessage('🔄 Queue đã được khôi phục và tiếp tục!', 'success');
      }
    } else {
      showMessage('❌ Không tìm thấy queue đã dừng nào để khôi phục', 'error');
    }
  });
});










