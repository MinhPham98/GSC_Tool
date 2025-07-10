// ========== GSC OPERATIONS MODULE ==========
// Functions for interacting with Google Search Console interface

// ========== DOM Interaction Functions ==========

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

async function fillSingleUrl(url, temporaryRemoval) {
    const urlBarLabelIndex = temporaryRemoval ? 0 : 1;
    const urlBarLabel = document.querySelectorAll('.Ufn6O.PPB5Hf')[urlBarLabelIndex];
    if (urlBarLabel) {
        const urlBar = urlBarLabel.childNodes[0].childNodes[1];
        if (urlBar) {
            urlBar.value = url;
            console.log(`📝 URL filled into form: ${url}`);
        }
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
    return false;
}

// ========== Result Checking Functions ==========

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
                console.log(`🔴 Property error for URL ${index + 1}: ${errorText}`);
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
                    console.log(`🔴 GSC error for URL ${index + 1}: ${errorText}`);
                    break;
                }
            }
        }
        
        // If no errors detected, mark as success
        if (status === "") {
            status = "success";
        }
    }
    
    return { status, reason };
}

async function checkSingleUrlOutcome(url, queueIndex, submitButtonFound) {
    let reason = "", status = "";
    
    if (document.querySelectorAll('.PNenzf').length > 0) {
        reason = "Trùng lặp URL"; 
        status = "error";
        if (window.GSCUtils) window.GSCUtils.log('DEBUG', `URL ${queueIndex + 1} - Duplicate`);
    } else if (!submitButtonFound) {
        reason = "Lỗi gửi"; 
        status = "error";
        if (window.GSCUtils) window.GSCUtils.log('DEBUG', `URL ${queueIndex + 1} - Submit failed`);
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
                if (window.GSCUtils) window.GSCUtils.log('DEBUG', `URL ${queueIndex + 1} - Property error: ${errorText}`);
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
                    if (window.GSCUtils) window.GSCUtils.log('DEBUG', `URL ${queueIndex + 1} - GSC error: ${errorText}`);
                    break;
                }
            }
        }
        
        // If no errors detected, mark as success
        if (status === "") {
            status = "success";
            if (window.GSCUtils) window.GSCUtils.log('DEBUG', `URL ${queueIndex + 1} - Success`);
        }
    }
    
    return { status, reason };
}

// ========== Error Popup Handling ==========

async function closeErrorPopup() {
    const closeButton = document.querySelectorAll('.CwaK9 .RveJvd.snByac');
    for (let k = 0; k < closeButton.length; k++) {
        if ((closeButton[k].childNodes[0] && (closeButton[k].childNodes[0].textContent).toLowerCase() == 'close')) {
            closeButton[k].click();
            return true;
        }
    }
    return false;
}

// ========== Export Functions ==========
window.GSCOperations = {
    clickNextButton,
    urlToSubmissionBar,
    fillSingleUrl,
    submissionNextButton,
    submitRequest,
    checkOutcome,
    checkSingleUrlOutcome,
    closeErrorPopup
};
