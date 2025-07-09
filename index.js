// ===== Khai báo biến và lấy phần tử giao diện =====
const chunkSizeInput = document.getElementById('chunkSize');
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");

let temporaryRemoval = true;
let chunkSize = parseInt(document.getElementById('chunkSize')?.value || 10, 10);
let urlChunks = [];
let currentPack = 0;
let autoRun = false;
let isPaused = false;
let sentPackCount = 0;
let sentUrlCount = 0;
let isFileInput = false;

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

// ===== Debug log (có thể bỏ nếu không cần)
console.log('links:', links);
console.log('urlChunks:', urlChunks);
console.log('currentPack:', currentPack, 'URLs:', URLs);










