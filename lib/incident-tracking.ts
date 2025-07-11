import { StatusResult } from './types';
import { log } from './logger';

export interface Incident {
  id: string;
  provider: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  startTime: string;
  endTime?: string;
  duration?: number; // in minutes
  affectedServices: string[];
  updates: IncidentUpdate[];
  rootCause?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentUpdate {
  id: string;
  timestamp: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  message: string;
  author: string;
}

// In-memory storage for demo - in production, use database
const incidents = new Map<string, Incident>();
let incidentCounter = 1;

/**
 * Create new incident from status change
 */
export function createIncidentFromStatusChange(
  current: StatusResult,
  previous: StatusResult | null
): Incident | null {
  // Only create incidents for significant status changes
  if (!previous || !shouldCreateIncident(current.status, previous.status)) {
    return null;
  }

  const severity = determineSeverity(current.status, previous.status);
  const title = generateIncidentTitle(current, previous);
  const description = generateIncidentDescription(current, previous);

  const incident: Incident = {
    id: `INC-${String(incidentCounter++).padStart(4, '0')}`,
    provider: current.id,
    title,
    description,
    status: 'investigating',
    severity,
    startTime: current.lastChecked,
    affectedServices: [current.id],
    updates: [
      {
        id: generateId(),
        timestamp: current.lastChecked,
        status: 'investigating',
        message: `Incident detected: ${current.name} status changed from ${previous.status} to ${current.status}`,
        author: 'System',
      },
    ],
    createdAt: current.lastChecked,
    updatedAt: current.lastChecked,
  };

  incidents.set(incident.id, incident);

  log('info', 'Incident created', {
    incidentId: incident.id,
    provider: current.id,
    severity: incident.severity,
    statusChange: `${previous.status} → ${current.status}`,
  });

  return incident;
}

/**
 * Auto-resolve incident when provider returns to operational
 */
export function checkIncidentResolution(
  current: StatusResult,
  previous: StatusResult | null
): void {
  if (!previous || current.status !== 'operational') {
    return;
  }

  // Find active incidents for this provider
  const activeIncidents = Array.from(incidents.values()).filter(
    (incident) => incident.provider === current.id && incident.status !== 'resolved'
  );

  for (const incident of activeIncidents) {
    updateIncident(
      incident.id,
      {
        status: 'resolved',
        endTime: current.lastChecked,
        duration: Math.round(
          (new Date(current.lastChecked).getTime() - new Date(incident.startTime).getTime()) /
            (1000 * 60)
        ),
        resolution: `Service restored to operational status`,
      },
      'System',
      `${current.name} has returned to operational status. Incident resolved.`
    );
  }
}

/**
 * Add update to existing incident
 */
export function updateIncident(
  incidentId: string,
  updates: Partial<Pick<Incident, 'status' | 'endTime' | 'duration' | 'rootCause' | 'resolution'>>,
  author: string = 'System',
  message: string
): boolean {
  const incident = incidents.get(incidentId);
  if (!incident) return false;

  // Add update to history
  const update: IncidentUpdate = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: updates.status || incident.status,
    message,
    author,
  };

  incident.updates.push(update);
  incident.updatedAt = update.timestamp;

  // Apply updates to incident
  Object.assign(incident, updates);

  log('info', 'Incident updated', {
    incidentId,
    status: incident.status,
    author,
    message,
  });

  return true;
}

/**
 * Get incident by ID
 */
export function getIncident(id: string): Incident | null {
  return incidents.get(id) || null;
}

/**
 * Get all incidents with filtering
 */
export function getIncidents(filters?: {
  provider?: string;
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): { incidents: Incident[]; total: number } {
  let filtered = Array.from(incidents.values());

  if (filters?.provider) {
    filtered = filtered.filter((inc) => inc.provider === filters.provider);
  }

  if (filters?.status) {
    filtered = filtered.filter((inc) => inc.status === filters.status);
  }

  if (filters?.severity) {
    filtered = filtered.filter((inc) => inc.severity === filters.severity);
  }

  // Sort by start time (newest first)
  filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const total = filtered.length;

  if (filters?.limit !== undefined) {
    const offset = filters.offset || 0;
    filtered = filtered.slice(offset, offset + filters.limit);
  }

  return { incidents: filtered, total };
}

/**
 * Get incident statistics
 */
export function getIncidentStats(timeRangeHours: number = 24): {
  total: number;
  active: number;
  resolved: number;
  byProvider: Record<string, number>;
  bySeverity: Record<string, number>;
  averageResolutionTime: number;
} {
  const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();
  const recentIncidents = Array.from(incidents.values()).filter((inc) => inc.startTime >= since);

  const byProvider: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
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
    active: recentIncidents.filter((inc) => inc.status !== 'resolved').length,
    resolved: recentIncidents.filter((inc) => inc.status === 'resolved').length,
    byProvider,
    bySeverity,
    averageResolutionTime: resolvedCount > 0 ? Math.round(totalResolutionTime / resolvedCount) : 0,
  };
}

/**
 * Determine if status change should create an incident
 */
function shouldCreateIncident(currentStatus: string, previousStatus: string): boolean {
  // Create incident for operational -> down/degraded
  if (
    previousStatus === 'operational' &&
    (currentStatus === 'down' || currentStatus === 'degraded')
  ) {
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
function determineSeverity(
  currentStatus: string,
  previousStatus: string
): 'low' | 'medium' | 'high' | 'critical' {
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
function generateIncidentTitle(current: StatusResult, previous: StatusResult): string {
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
function generateIncidentDescription(current: StatusResult, previous: StatusResult): string {
  const time = new Date(current.lastChecked).toLocaleString();

  return (
    `At ${time}, ${current.name} status changed from ${previous.status} to ${current.status}. ` +
    `Response time: ${current.responseTime}ms. We are investigating this issue and will provide updates as they become available.`
  );
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
