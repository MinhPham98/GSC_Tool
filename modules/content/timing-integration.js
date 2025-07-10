// ========== TIMING ANALYZER INTEGRATION ==========
// Timing tracker for URL processing with comprehensive analysis

// ========== Main Timing Tracker ==========
window.urlTimingTracker = {
    sessions: new Map(),
    currentSession: null,
    firstStartTime: null,
    
    startSession(url, index, mode = 'pack') {
        const sessionId = `${mode}_${index}_${Date.now()}`;
        const session = {
            sessionId,
            url,
            index,
            mode,
            startTime: Date.now(),
            steps: []
        };
        
        // Track first start time for total duration
        if (!this.firstStartTime) {
            this.firstStartTime = session.startTime;
        }
        
        this.sessions.set(sessionId, session);
        this.currentSession = session;
        
        console.log(`⏱️ [URL_START] ${sessionId} - ${url} (Index: ${index})`);
        this.logStep('URL_START', { url, index, mode });
        return sessionId;
    },
    
    logStep(stepName, data = {}) {
        if (!this.currentSession) return;
        
        const now = Date.now();
        const step = {
            name: stepName,
            timestamp: now,
            sessionTime: now - this.currentSession.startTime,
            data
        };
        
        this.currentSession.steps.push(step);
        console.log(`⏱️ [${stepName}] +${step.sessionTime}ms - ${this.currentSession.url}`);
    },
    
    endSession(status = 'success', reason = '') {
        if (!this.currentSession) return;
        
        const endTime = Date.now();
        const totalTime = endTime - this.currentSession.startTime;
        
        this.currentSession.status = status;
        this.currentSession.reason = reason;
        this.currentSession.endTime = endTime;
        this.currentSession.totalTime = totalTime;
        
        console.log(`⏱️ [URL_END] ${this.currentSession.sessionId} - ${status} (${totalTime}ms) - ${reason}`);
        this.logStep('URL_END', { status, reason, totalTime });
        
        // Log summary of steps
        console.log(`📊 URL Processing Summary:`, {
            url: this.currentSession.url,
            index: this.currentSession.index,
            totalTime: `${totalTime}ms`,
            status,
            reason,
            steps: this.currentSession.steps.map(s => `${s.name}:${s.sessionTime}ms`).join(' → ')
        });
        
        this.currentSession = null;
    },
    
    getLastUrlTiming() {
        const completed = Array.from(this.sessions.values()).filter(s => s.status);
        return completed[completed.length - 1];
    },
    
    analyzeAll() {
        const completed = Array.from(this.sessions.values()).filter(s => s.status);
        if (completed.length === 0) return null;
        
        const avgTime = completed.reduce((sum, s) => sum + s.totalTime, 0) / completed.length;
        const successRate = completed.filter(s => s.status === 'success').length / completed.length;
        
        console.log(`📊 Timing Analysis: ${completed.length} URLs, Avg: ${avgTime.toFixed(0)}ms, Success: ${(successRate * 100).toFixed(1)}%`);
        return { avgTime, successRate, total: completed.length };
    },
    
    reset() {
        this.sessions.clear();
        this.currentSession = null;
        this.firstStartTime = null;
        console.log('🔄 Timing tracker reset');
    }
};

// ========== Shortcut Functions ==========
window.timing = {
    start: (url, index, mode) => window.urlTimingTracker.startSession(url, index, mode),
    step: (stepName, data) => window.urlTimingTracker.logStep(stepName, data),
    end: (status, reason) => window.urlTimingTracker.endSession(status, reason),
    analyze: () => window.urlTimingTracker.analyzeAll(),
    reset: () => window.urlTimingTracker.reset()
};

// Make available globally
window.GSCTiming = window.timing;
