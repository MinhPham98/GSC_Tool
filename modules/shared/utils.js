// ========== SHARED UTILITIES ==========
// Common utility functions used across all modules

// ========== Delay Function ==========
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== Enhanced Logging Function ==========
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

// ========== Custom Alert Function ==========
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

// ========== Pause Check Function ==========
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

// ========== Reload Function ==========
function reload() {
    location.reload();
}

// Export functions for use in other modules (if using ES6 modules)
// For now, these are global functions available to all scripts
window.GSCUtils = {
    delay,
    log,
    showCustomAlert,
    checkPaused,
    reload
};
