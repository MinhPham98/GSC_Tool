/**
 * GSC Tool - Timing Analyzer
 * Phân tích thời gian giữa các sự kiện để optimize performance
 * Author: APPNET
 * Version: 1.0.0
 */

class GSCTimingAnalyzer {
    constructor() {
        this.events = [];
        this.sessions = new Map();
        this.startTime = Date.now();
        this.isRecording = false;
        
        // Thresholds for performance analysis
        this.thresholds = {
            urlProcessing: 3000,    // 3s per URL
            packProcessing: 30000,  // 30s per pack
            queueDelay: 1000,       // 1s between URLs
            uiResponse: 100,        // 100ms UI response
            backgroundTask: 5000    // 5s background tasks
        };
        
        console.log('🕒 GSC Timing Analyzer initialized');
    }
    
    /**
     * Bắt đầu ghi nhận timing
     */
    startRecording() {
        this.isRecording = true;
        this.events = [];
        this.startTime = Date.now();
        this.logEvent('RECORDING_STARTED', 'Timing analysis started');
        console.log('🔴 Timing recording started');
    }
    
    /**
     * Dừng ghi nhận timing
     */
    stopRecording() {
        this.isRecording = false;
        this.logEvent('RECORDING_STOPPED', 'Timing analysis stopped');
        console.log('⏹️ Timing recording stopped');
        return this.generateReport();
    }
    
    /**
     * Ghi nhận một sự kiện
     */
    logEvent(type, description, data = {}) {
        if (!this.isRecording) return;
        
        const now = Date.now();
        const event = {
            type,
            description,
            timestamp: now,
            relativeTime: now - this.startTime,
            data: { ...data }
        };
        
        this.events.push(event);
        console.log(`⏱️ [${event.relativeTime}ms] ${type}: ${description}`, data);
    }
    
    /**
     * Bắt đầu một session (ví dụ: pack processing, queue processing)
     */
    startSession(sessionId, type, description, data = {}) {
        const session = {
            id: sessionId,
            type,
            description,
            startTime: Date.now(),
            data: { ...data }
        };
        
        this.sessions.set(sessionId, session);
        this.logEvent(`SESSION_START_${type}`, `Started ${description}`, { sessionId, ...data });
    }
    
    /**
     * Kết thúc một session và tính duration
     */
    endSession(sessionId, result = 'completed', data = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`⚠️ Session ${sessionId} not found`);
            return null;
        }
        
        const endTime = Date.now();
        const duration = endTime - session.startTime;
        
        session.endTime = endTime;
        session.duration = duration;
        session.result = result;
        session.endData = { ...data };
        
        this.logEvent(`SESSION_END_${session.type}`, `Ended ${session.description}`, {
            sessionId,
            duration,
            result,
            ...data
        });
        
        // Check performance thresholds
        this.checkThreshold(session.type, duration);
        
        return session;
    }
    
    /**
     * Kiểm tra threshold performance
     */
    checkThreshold(type, duration) {
        const thresholdMap = {
            'URL_PROCESSING': this.thresholds.urlProcessing,
            'PACK_PROCESSING': this.thresholds.packProcessing,
            'QUEUE_DELAY': this.thresholds.queueDelay,
            'UI_RESPONSE': this.thresholds.uiResponse,
            'BACKGROUND_TASK': this.thresholds.backgroundTask
        };
        
        const threshold = thresholdMap[type];
        if (threshold && duration > threshold) {
            console.warn(`🚨 Performance threshold exceeded for ${type}: ${duration}ms > ${threshold}ms`);
            this.logEvent('THRESHOLD_EXCEEDED', `${type} took ${duration}ms (threshold: ${threshold}ms)`, {
                type,
                duration,
                threshold,
                exceedBy: duration - threshold
            });
        }
    }
    
    /**
     * Tính thời gian giữa hai sự kiện
     */
    getTimeBetweenEvents(fromType, toType, fromIndex = 0, toIndex = 0) {
        const fromEvents = this.events.filter(e => e.type === fromType);
        const toEvents = this.events.filter(e => e.type === toType);
        
        if (fromEvents.length <= fromIndex || toEvents.length <= toIndex) {
            return null;
        }
        
        const fromEvent = fromEvents[fromIndex];
        const toEvent = toEvents[toIndex];
        
        return {
            duration: toEvent.timestamp - fromEvent.timestamp,
            fromEvent,
            toEvent
        };
    }
    
    /**
     * Phân tích pack processing performance
     */
    analyzePackPerformance() {
        const packSessions = Array.from(this.sessions.values())
            .filter(s => s.type === 'PACK_PROCESSING');
            
        if (packSessions.length === 0) return null;
        
        const stats = {
            totalPacks: packSessions.length,
            completedPacks: packSessions.filter(s => s.result === 'completed').length,
            errorPacks: packSessions.filter(s => s.result === 'error').length,
            avgDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            totalDuration: 0
        };
        
        const durations = packSessions
            .filter(s => s.duration)
            .map(s => s.duration);
            
        if (durations.length > 0) {
            stats.totalDuration = durations.reduce((sum, d) => sum + d, 0);
            stats.avgDuration = stats.totalDuration / durations.length;
            stats.minDuration = Math.min(...durations);
            stats.maxDuration = Math.max(...durations);
        }
        
        return stats;
    }
    
    /**
     * Phân tích queue processing performance
     */
    analyzeQueuePerformance() {
        const urlSessions = Array.from(this.sessions.values())
            .filter(s => s.type === 'URL_PROCESSING');
            
        if (urlSessions.length === 0) return null;
        
        const stats = {
            totalUrls: urlSessions.length,
            completedUrls: urlSessions.filter(s => s.result === 'success').length,
            errorUrls: urlSessions.filter(s => s.result === 'error').length,
            avgDuration: 0,
            urlsPerMinute: 0,
            totalDuration: 0
        };
        
        const durations = urlSessions
            .filter(s => s.duration)
            .map(s => s.duration);
            
        if (durations.length > 0) {
            stats.totalDuration = durations.reduce((sum, d) => sum + d, 0);
            stats.avgDuration = stats.totalDuration / durations.length;
            stats.urlsPerMinute = (stats.completedUrls / (stats.totalDuration / 1000)) * 60;
        }
        
        return stats;
    }
    
    /**
     * Tạo báo cáo tổng hợp
     */
    generateReport() {
        const report = {
            summary: {
                recordingDuration: Date.now() - this.startTime,
                totalEvents: this.events.length,
                totalSessions: this.sessions.size,
                timestamp: new Date().toISOString()
            },
            packPerformance: this.analyzePackPerformance(),
            queuePerformance: this.analyzeQueuePerformance(),
            events: this.events,
            sessions: Array.from(this.sessions.values()),
            thresholdViolations: this.events.filter(e => e.type === 'THRESHOLD_EXCEEDED')
        };
        
        console.log('📊 Timing Analysis Report:', report);
        return report;
    }
    
    /**
     * Export báo cáo ra CSV
     */
    exportToCSV() {
        const events = this.events.map(e => ({
            timestamp: new Date(e.timestamp).toISOString(),
            relativeTime: e.relativeTime,
            type: e.type,
            description: e.description,
            data: JSON.stringify(e.data)
        }));
        
        const csvHeader = 'Timestamp,Relative Time (ms),Type,Description,Data\n';
        const csvRows = events.map(e => 
            `"${e.timestamp}",${e.relativeTime},"${e.type}","${e.description}","${e.data}"`
        ).join('\n');
        
        return csvHeader + csvRows;
    }
    
    /**
     * Tải xuống báo cáo
     */
    downloadReport(format = 'json') {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        
        if (format === 'csv') {
            const csvContent = this.exportToCSV();
            this.downloadFile(csvContent, `gsc-timing-report-${timestamp}.csv`, 'text/csv');
        } else {
            const report = this.generateReport();
            const jsonContent = JSON.stringify(report, null, 2);
            this.downloadFile(jsonContent, `gsc-timing-report-${timestamp}.json`, 'application/json');
        }
    }
    
    /**
     * Helper function to download file
     */
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Global instance
window.gscTiming = new GSCTimingAnalyzer();

// Helper functions for easy use
window.timingStart = () => window.gscTiming.startRecording();
window.timingStop = () => window.gscTiming.stopRecording();
window.timingEvent = (type, desc, data) => window.gscTiming.logEvent(type, desc, data);
window.timingSessionStart = (id, type, desc, data) => window.gscTiming.startSession(id, type, desc, data);
window.timingSessionEnd = (id, result, data) => window.gscTiming.endSession(id, result, data);
window.timingReport = () => window.gscTiming.generateReport();
window.timingDownload = (format) => window.gscTiming.downloadReport(format);

console.log('🕒 GSC Timing Analyzer loaded. Use:');
console.log('  timingStart() - Start recording');
console.log('  timingStop() - Stop and get report');
console.log('  timingEvent(type, desc, data) - Log event');
console.log('  timingSessionStart(id, type, desc, data) - Start session');
console.log('  timingSessionEnd(id, result, data) - End session');
console.log('  timingReport() - Get current report');
console.log('  timingDownload("json"|"csv") - Download report');
