// ===== Khai báo biến và lấy phần tử giao diện =====
const chunkSizeInput = document.getElementById('chunkSize');
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");

// ========== BACKGROUND QUEUE ELEMENTS ==========
const backgroundModeCheckbox = document.getElementById('backgroundModeCheckbox');
const queueStatusDiv = document.getElementById('queue-status');
const pauseQueueBtn = document.getElementById('pauseQueueBtn');
const resumeQueueBtn = document.getElementById('resumeQueueBtn');
const stopQueueBtn = document.getElementById('stopQueueBtn');
const downloadQueueBtn = document.getElementById('downloadQueueBtn');
const queueProgressFill = document.getElementById('queueProgressFill');
const queueProgress = document.getElementById('queueProgress');
const queueStatus = document.getElementById('queueStatus');

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
}

/**
 * Đặt lại thông tin bảng và bộ nhớ cache
 */
function resetInfoTableAndCache() {
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
    } else {
      urlChunks = [];
      updatePackDisplay();
      updatePackStats && updatePackStats();
      alert("Không có URL hợp lệ để gửi!");
      return;
    }
  }

  const totalUrl = urlChunks.reduce((sum, pack) => sum + pack.length, 0);
  if (totalUrl > 100) {
    const ok = confirm(`Bạn sắp gửi ${totalUrl} URL. Bạn có chắc chắn muốn tiếp tục?`);
    if (!ok) return;
  }

  autoRun = document.getElementById('autoRunCheckbox').checked;

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
    backgroundQueueActive = false;
    updateQueueUI();
    clearInterval(queueUpdateInterval);
    showMessage(`🎉 Background queue hoàn thành! Đã xử lý ${msg.totalProcessed} URLs.`, 'success');
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

// ===== Khi mở lại popup, đồng bộ trạng thái =====

/**
 * Khi mở lại popup, đồng bộ trạng thái với storage
 */
document.addEventListener('DOMContentLoaded', function() {
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
});

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
        
        // Reset queue results trước khi bắt đầu
        await chrome.storage.local.set({ queueResults: [] });
        
        // Gửi URLs đến background script
        chrome.runtime.sendMessage({
            type: "START_BACKGROUND_QUEUE",
            urls: urls,
            tabId: tab.id
        });
        
        backgroundQueueActive = true;
        updateQueueUI();
        startQueueStatusUpdates();
        
        // Hiển thị queue status và ẩn UI thường
        queueStatusDiv.style.display = 'block';
        downloadQueueBtn.style.display = 'inline-block';
        
        showMessage(`✅ Background queue đã bắt đầu với ${urls.length} URLs! 
        Bạn có thể đóng popup, queue sẽ xử lý từng URL một cách tuần tự.
        Mỗi URL sẽ được xử lý hoàn toàn trước khi chuyển sang URL tiếp theo.`, 'success');
        
    } catch (error) {
        console.error('Error starting background queue:', error);
        showMessage('❌ Lỗi khi bắt đầu background queue: ' + error.message, 'error');
    }
}

/**
 * Cập nhật UI queue controls
 */
function updateQueueUI() {
    const bodyElement = document.body;
    
    if (backgroundQueueActive) {
        // Add class để trigger CSS hiding
        bodyElement.classList.add('queue-mode-active');
        
        // Ẩn tất cả pack mode controls
        backgroundModeCheckbox.disabled = true;
        startBtn.disabled = true;
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        
        // Ẩn pack navigation
        const packNavigation = document.querySelector('.pack-navigation');
        if (packNavigation) packNavigation.style.display = 'none';
        
        // Ẩn auto run checkbox
        const autoRunCheckbox = document.getElementById('autoRunCheckbox');
        if (autoRunCheckbox) {
            autoRunCheckbox.disabled = true;
            autoRunCheckbox.parentElement.style.display = 'none';
        }
        
        // Ẩn chunk size input
        if (chunkSizeInput) {
            chunkSizeInput.disabled = true;
            chunkSizeInput.parentElement.style.display = 'none';
        }
        
        // Ẩn download CSV button thường
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.style.display = 'none';
        
        // Ẩn info table pack mode
        const infoTable = document.querySelector('.info-table-container');
        if (infoTable) infoTable.style.display = 'none';
        
        console.log('🔄 Queue mode UI activated');
        
    } else {
        // Remove class để hiện lại UI
        bodyElement.classList.remove('queue-mode-active');
        
        // Hiện lại tất cả pack mode controls
        backgroundModeCheckbox.disabled = false;
        startBtn.disabled = false;
        pauseBtn.style.display = 'inline-block';
        stopBtn.style.display = 'inline-block';
        
        // Hiện pack navigation
        const packNavigation = document.querySelector('.pack-navigation');
        if (packNavigation) packNavigation.style.display = 'flex';
        
        // Hiện auto run checkbox
        const autoRunCheckbox = document.getElementById('autoRunCheckbox');
        if (autoRunCheckbox) {
            autoRunCheckbox.disabled = false;
            autoRunCheckbox.parentElement.style.display = 'flex';
        }
        
        // Hiện chunk size input
        if (chunkSizeInput) {
            chunkSizeInput.disabled = false;
            chunkSizeInput.parentElement.style.display = 'flex';
        }
        
        // Hiện download CSV button thường
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
        
        // Hiện info table pack mode
        const infoTable = document.querySelector('.info-table-container');
        if (infoTable) infoTable.style.display = 'block';
        
        // Ẩn queue UI
        queueStatusDiv.style.display = 'none';
        downloadQueueBtn.style.display = 'none';
        
        console.log('📦 Pack mode UI activated');
    }
}

/**
 * Bắt đầu cập nhật trạng thái queue định kỳ
 */
function startQueueStatusUpdates() {
  if (queueUpdateInterval) {
    clearInterval(queueUpdateInterval);
  }
  
  queueUpdateInterval = setInterval(async () => {
    if (!backgroundQueueActive) {
      clearInterval(queueUpdateInterval);
      return;
    }
    
    try {
      chrome.runtime.sendMessage({ type: "GET_QUEUE_STATUS" }, (response) => {
        if (response) {
          updateQueueStatus(response);
        }
      });
    } catch (error) {
      console.error('Error getting queue status:', error);
    }
  }, 1000); // Cập nhật mỗi giây
}

/**
 * Cập nhật hiển thị trạng thái queue
 */
function updateQueueStatus(status) {
  const { currentUrlIndex, totalUrls, queueProcessing, queuePaused } = status;
  
  // Cập nhật progress bar
  const progressPercent = totalUrls > 0 ? (currentUrlIndex / totalUrls) * 100 : 0;
  queueProgressFill.style.width = progressPercent + '%';
  
  // Cập nhật text
  queueProgress.textContent = `${currentUrlIndex}/${totalUrls}`;
  
  // Cập nhật trạng thái
  if (!queueProcessing) {
    queueStatus.textContent = 'Hoàn thành';
    queueStatusDiv.className = 'queue-status queue-status--completed';
  } else if (queuePaused) {
    queueStatus.textContent = 'Đã tạm dừng';
    queueStatusDiv.className = 'queue-status queue-status--paused';
    pauseQueueBtn.style.display = 'none';
    resumeQueueBtn.style.display = 'inline-block';
  } else {
    queueStatus.textContent = 'Đang xử lý...';
    queueStatusDiv.className = 'queue-status queue-status--processing';
    pauseQueueBtn.style.display = 'inline-block';
    resumeQueueBtn.style.display = 'none';
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
  
  if (isChecked) {
    // Ẩn các controls không cần thiết cho background mode
    document.querySelector('.pack-navigation').style.display = 'none';
    document.getElementById('autoRunCheckbox').checked = false;
    document.getElementById('autoRunCheckbox').disabled = true;
    chunkSizeInput.disabled = true;
  } else {
    // Hiện lại controls
    document.querySelector('.pack-navigation').style.display = 'flex';
    document.getElementById('autoRunCheckbox').disabled = false;
    chunkSizeInput.disabled = false;
  }
});

// Queue control buttons
pauseQueueBtn.addEventListener('click', function() {
  chrome.runtime.sendMessage({ type: "PAUSE_BACKGROUND_QUEUE" });
  showMessage('⏸️ Background queue đã tạm dừng', 'info');
});

resumeQueueBtn.addEventListener('click', function() {
  chrome.runtime.sendMessage({ type: "RESUME_BACKGROUND_QUEUE" });
  showMessage('▶️ Background queue đã tiếp tục', 'info');
});

stopQueueBtn.addEventListener('click', function() {
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
    backgroundQueueActive = false;
    updateQueueUI();
    clearInterval(queueUpdateInterval);
    showMessage(`🎉 Background queue hoàn thành! Đã xử lý ${message.totalProcessed} URLs.`, 'success');
  }
});

// ========== MODIFY START BUTTON FOR BACKGROUND MODE ==========
// Cập nhật hàm start để hỗ trợ background queue
const originalStartHandler = startBtn.onclick;
startBtn.onclick = async function() {
  const urls = getUrlsFromInput();
  
  if (!urls.length) {
    alert('Vui lòng nhập ít nhất 1 URL!');
    return;
  }
  
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
 */
function getUrlsFromInput() {
  const linksTextarea = document.getElementById('links');
  const linksText = linksTextarea.value.trim();
  
  if (!linksText) {
    return [];
  }
  
  return linksText.split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);
}

// Khôi phục trạng thái queue khi mở popup
document.addEventListener('DOMContentLoaded', async function() {
  try {
    chrome.runtime.sendMessage({ type: "GET_QUEUE_STATUS" }, (response) => {
      if (response && response.backgroundMode && response.queueProcessing) {
        backgroundQueueActive = true;
        updateQueueUI();
        startQueueStatusUpdates();
        queueStatusDiv.style.display = 'block';
        downloadQueueBtn.style.display = 'inline-block';
        updateQueueStatus(response);
      }
    });
  } catch (error) {
    console.error('Error checking queue status on load:', error);
  }
});

// ...existing code...










