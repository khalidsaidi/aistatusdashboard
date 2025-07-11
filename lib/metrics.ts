/**
 * COMPREHENSIVE METRICS COLLECTION SYSTEM
 *
 * Provides monitoring and alerting capabilities for all critical systems
 */

interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

interface AlertRule {
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // milliseconds
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  description: string;
}

interface Alert {
  id: string;
  rule: AlertRule;
  triggeredAt: number;
  resolvedAt?: number;
  status: 'active' | 'resolved';
  message: string;
}

/**
 * Metrics collection and alerting system
 */
export class MetricsCollector {
  private metrics = new Map<string, MetricData[]>();
  private alerts = new Map<string, Alert>();
  private alertRules: AlertRule[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private readonly maxMetricsHistory = 1000;
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
  private readonly alertCheckIntervalMs = 30 * 1000; // 30 seconds

  constructor() {
    this.setupDefaultAlertRules();
    this.startCleanup();
    this.startAlertChecking();
  }

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    type: 'counter' | 'gauge' | 'histogram' | 'timer' = 'gauge'
  ): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      tags,
      type,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only recent history
    if (metricHistory.length > this.maxMetricsHistory) {
      metricHistory.splice(0, metricHistory.length - this.maxMetricsHistory);
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const existing = this.getLatestMetric(name);
    const newValue = existing ? existing.value + value : value;
    this.recordMetric(name, newValue, tags, 'counter');
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags, 'gauge');
  }

  /**
   * Record a timer metric
   */
  recordTimer(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.recordMetric(name, durationMs, tags, 'timer');
  }

  /**
   * Get latest metric value
   */
  getLatestMetric(name: string): MetricData | null {
    const history = this.metrics.get(name);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit: number = 100): MetricData[] {
    const history = this.metrics.get(name) || [];
    return history.slice(-limit);
  }

  /**
   * Get all current metrics
   */
  getAllMetrics(): Record<string, MetricData> {
    const result: Record<string, MetricData> = {};

    for (const [name, history] of this.metrics.entries()) {
      if (history.length > 0) {
        result[name] = history[history.length - 1];
      }
    }

    return result;
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  /**
   * Setup default alert rules for critical systems
   */
  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        metric: 'memory_usage_mb',
        condition: 'greater_than',
        threshold: 512,
        duration: 60000, // 1 minute
        severity: 'warning',
        description: 'High memory usage detected',
      },
      {
        metric: 'memory_usage_mb',
        condition: 'greater_than',
        threshold: 1024,
        duration: 30000, // 30 seconds
        severity: 'critical',
        description: 'Critical memory usage detected',
      },
      {
        metric: 'active_locks',
        condition: 'greater_than',
        threshold: 1000,
        duration: 30000,
        severity: 'critical',
        description: 'Too many active locks - potential deadlock',
      },
      {
        metric: 'firebase_quota_usage_percent',
        condition: 'greater_than',
        threshold: 80,
        duration: 60000,
        severity: 'warning',
        description: 'Firebase quota usage high',
      },
      {
        metric: 'firebase_quota_usage_percent',
        condition: 'greater_than',
        threshold: 95,
        duration: 30000,
        severity: 'critical',
        description: 'Firebase quota near limit',
      },
      {
        metric: 'error_rate_percent',
        condition: 'greater_than',
        threshold: 10,
        duration: 120000, // 2 minutes
        severity: 'warning',
        description: 'High error rate detected',
      },
      {
        metric: 'error_rate_percent',
        condition: 'greater_than',
        threshold: 25,
        duration: 60000,
        severity: 'critical',
        description: 'Critical error rate detected',
      },
      {
        metric: 'average_response_time_ms',
        condition: 'greater_than',
        threshold: 5000,
        duration: 180000, // 3 minutes
        severity: 'warning',
        description: 'Slow response times detected',
      },
      {
        metric: 'emergency_mode',
        condition: 'equals',
        threshold: 1,
        duration: 0,
        severity: 'emergency',
        description: 'System in emergency mode',
      },
    ];
  }

  /**
   * Check alert rules and trigger alerts
   */
  private checkAlerts(): void {
    const now = Date.now();

    for (const rule of this.alertRules) {
      const metric = this.getLatestMetric(rule.metric);

      if (!metric) continue;

      const alertId = `${rule.metric}_${rule.condition}_${rule.threshold}`;
      const existingAlert = this.alerts.get(alertId);

      // Check if condition is met
      const conditionMet = this.evaluateCondition(metric.value, rule.condition, rule.threshold);

      if (conditionMet) {
        if (!existingAlert) {
          // Create new alert
          const alert: Alert = {
            id: alertId,
            rule,
            triggeredAt: now,
            status: 'active',
            message: `${rule.description}: ${rule.metric} is ${metric.value} (threshold: ${rule.threshold})`,
          };

          this.alerts.set(alertId, alert);
          this.triggerAlert(alert);
        }
      } else {
        if (existingAlert && existingAlert.status === 'active') {
          // Resolve alert
          existingAlert.status = 'resolved';
          existingAlert.resolvedAt = now;
          this.resolveAlert(existingAlert);
        }
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(alert: Alert): void {
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
      emergency: '💀',
    };

    console.log(
      `${severityEmoji[alert.rule.severity]} ALERT [${alert.rule.severity.toUpperCase()}]: ${alert.message}`
    );

    // Here you would integrate with external alerting systems
    // - Send to Slack/Discord webhook
    // - Send email notification
    // - Push to monitoring service
    // - Log to external system
  }

  /**
   * Resolve alert
   */
  private resolveAlert(alert: Alert): void {
    console.log(`✅ RESOLVED: ${alert.message}`);

    // Here you would notify external systems that alert is resolved
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((alert) => alert.status === 'active');
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.triggeredAt - a.triggeredAt)
      .slice(0, limit);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Start alert checking interval
   */
  private startAlertChecking(): void {
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, this.alertCheckIntervalMs);
  }

  /**
   * Cleanup old metrics and alerts
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup old metrics
    for (const [name, history] of this.metrics.entries()) {
      const filteredHistory = history.filter((metric) => now - metric.timestamp < maxAge);
      this.metrics.set(name, filteredHistory);
    }

    // Cleanup old resolved alerts
    const alertsToKeep = new Map<string, Alert>();
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.status === 'active' || (alert.resolvedAt && now - alert.resolvedAt < maxAge)) {
        alertsToKeep.set(id, alert);
      }
    }
    this.alerts = alertsToKeep;
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'critical' | 'emergency';
    activeAlerts: number;
    criticalAlerts: number;
    emergencyAlerts: number;
    totalMetrics: number;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(
      (alert) => alert.rule.severity === 'critical'
    ).length;
    const emergencyAlerts = activeAlerts.filter(
      (alert) => alert.rule.severity === 'emergency'
    ).length;

    let status: 'healthy' | 'degraded' | 'critical' | 'emergency' = 'healthy';

    if (emergencyAlerts > 0) {
      status = 'emergency';
    } else if (criticalAlerts > 0) {
      status = 'critical';
    } else if (activeAlerts.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts,
      emergencyAlerts,
      totalMetrics: this.metrics.size,
    };
  }

  /**
   * Shutdown and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    this.metrics.clear();
    this.alerts.clear();
  }
}

// Global metrics collector instance
export const globalMetricsCollector = new MetricsCollector();

// Convenience functions
export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  globalMetricsCollector.recordMetric(name, value, tags);
}

export function incrementCounter(
  name: string,
  value?: number,
  tags?: Record<string, string>
): void {
  globalMetricsCollector.incrementCounter(name, value, tags);
}

export function setGauge(name: string, value: number, tags?: Record<string, string>): void {
  globalMetricsCollector.setGauge(name, value, tags);
}

export function recordTimer(name: string, durationMs: number, tags?: Record<string, string>): void {
  globalMetricsCollector.recordTimer(name, durationMs, tags);
}

export function getHealthSummary() {
  return globalMetricsCollector.getHealthSummary();
}

export function getActiveAlerts() {
  return globalMetricsCollector.getActiveAlerts();
}
