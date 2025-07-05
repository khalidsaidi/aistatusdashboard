"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIncidentStats = exports.getIncidents = exports.getIncident = exports.updateIncident = exports.checkIncidentResolution = exports.createIncidentFromStatusChange = void 0;
const logger_1 = require("./logger");
// In-memory storage for demo - in production, use database
const incidents = new Map();
let incidentCounter = 1;
/**
 * Create new incident from status change
 */
function createIncidentFromStatusChange(current, previous) {
    // Only create incidents for significant status changes
    if (!previous || !shouldCreateIncident(current.status, previous.status)) {
        return null;
    }
    const severity = determineSeverity(current.status, previous.status);
    const title = generateIncidentTitle(current, previous);
    const description = generateIncidentDescription(current, previous);
    const incident = {
        id: `INC-${String(incidentCounter++).padStart(4, '0')}`,
        provider: current.id,
        title,
        description,
        status: 'investigating',
        severity,
        startTime: current.lastChecked,
        affectedServices: [current.id],
        updates: [{
                id: generateId(),
                timestamp: current.lastChecked,
                status: 'investigating',
                message: `Incident detected: ${current.name} status changed from ${previous.status} to ${current.status}`,
                author: 'System'
            }],
        createdAt: current.lastChecked,
        updatedAt: current.lastChecked
    };
    incidents.set(incident.id, incident);
    (0, logger_1.log)('info', 'Incident created', {
        incidentId: incident.id,
        provider: current.id,
        severity: incident.severity,
        statusChange: `${previous.status} → ${current.status}`
    });
    return incident;
}
exports.createIncidentFromStatusChange = createIncidentFromStatusChange;
/**
 * Auto-resolve incident when provider returns to operational
 */
function checkIncidentResolution(current, previous) {
    if (!previous || current.status !== 'operational') {
        return;
    }
    // Find active incidents for this provider
    const activeIncidents = Array.from(incidents.values()).filter(incident => incident.provider === current.id &&
        incident.status !== 'resolved');
    for (const incident of activeIncidents) {
        updateIncident(incident.id, {
            status: 'resolved',
            endTime: current.lastChecked,
            duration: Math.round((new Date(current.lastChecked).getTime() - new Date(incident.startTime).getTime()) / (1000 * 60)),
            resolution: `Service restored to operational status`
        }, 'System', `${current.name} has returned to operational status. Incident resolved.`);
    }
}
exports.checkIncidentResolution = checkIncidentResolution;
/**
 * Add update to existing incident
 */
function updateIncident(incidentId, updates, author = 'System', message) {
    const incident = incidents.get(incidentId);
    if (!incident)
        return false;
    // Add update to history
    const update = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        status: updates.status || incident.status,
        message,
        author
    };
    incident.updates.push(update);
    incident.updatedAt = update.timestamp;
    // Apply updates to incident
    Object.assign(incident, updates);
    (0, logger_1.log)('info', 'Incident updated', {
        incidentId,
        status: incident.status,
        author,
        message
    });
    return true;
}
exports.updateIncident = updateIncident;
/**
 * Get incident by ID
 */
function getIncident(id) {
    return incidents.get(id) || null;
}
exports.getIncident = getIncident;
/**
 * Get all incidents with filtering
 */
function getIncidents(filters) {
    let filtered = Array.from(incidents.values());
    if (filters === null || filters === void 0 ? void 0 : filters.provider) {
        filtered = filtered.filter(inc => inc.provider === filters.provider);
    }
    if (filters === null || filters === void 0 ? void 0 : filters.status) {
        filtered = filtered.filter(inc => inc.status === filters.status);
    }
    if (filters === null || filters === void 0 ? void 0 : filters.severity) {
        filtered = filtered.filter(inc => inc.severity === filters.severity);
    }
    // Sort by start time (newest first)
    filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const total = filtered.length;
    if ((filters === null || filters === void 0 ? void 0 : filters.limit) !== undefined) {
        const offset = filters.offset || 0;
        filtered = filtered.slice(offset, offset + filters.limit);
    }
    return { incidents: filtered, total };
}
exports.getIncidents = getIncidents;
/**
 * Get incident statistics
 */
function getIncidentStats(timeRangeHours = 24) {
    const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();
    const recentIncidents = Array.from(incidents.values()).filter(inc => inc.startTime >= since);
    const byProvider = {};
    const bySeverity = {};
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    for (const incident of recentIncidents) {
        byProvider[incident.provider] = (byProvider[incident.provider] || 0) + 1;
        bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
        if (incident.status === 'resolved' && incident.duration) {
            totalResolutionTime += incident.duration;
            resolvedCount++;
        }
    }
    return {
        total: recentIncidents.length,
        active: recentIncidents.filter(inc => inc.status !== 'resolved').length,
        resolved: recentIncidents.filter(inc => inc.status === 'resolved').length,
        byProvider,
        bySeverity,
        averageResolutionTime: resolvedCount > 0 ? Math.round(totalResolutionTime / resolvedCount) : 0
    };
}
exports.getIncidentStats = getIncidentStats;
/**
 * Determine if status change should create an incident
 */
function shouldCreateIncident(currentStatus, previousStatus) {
    // Create incident for operational -> down/degraded
    if (previousStatus === 'operational' && (currentStatus === 'down' || currentStatus === 'degraded')) {
        return true;
    }
    // Create incident for degraded -> down
    if (previousStatus === 'degraded' && currentStatus === 'down') {
        return true;
    }
    return false;
}
/**
 * Determine incident severity
 */
function determineSeverity(currentStatus, previousStatus) {
    if (currentStatus === 'down') {
        return previousStatus === 'operational' ? 'critical' : 'high';
    }
    if (currentStatus === 'degraded') {
        return previousStatus === 'operational' ? 'medium' : 'low';
    }
    return 'low';
}
/**
 * Generate incident title
 */
function generateIncidentTitle(current, previous) {
    if (current.status === 'down') {
        return `${current.name} Service Outage`;
    }
    if (current.status === 'degraded') {
        return `${current.name} Performance Degradation`;
    }
    return `${current.name} Service Issue`;
}
/**
 * Generate incident description
 */
function generateIncidentDescription(current, previous) {
    const time = new Date(current.lastChecked).toLocaleString();
    return `At ${time}, ${current.name} status changed from ${previous.status} to ${current.status}. ` +
        `Response time: ${current.responseTime}ms. We are investigating this issue and will provide updates as they become available.`;
}
/**
 * Generate unique ID
 */
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
//# sourceMappingURL=incident-tracking.js.map