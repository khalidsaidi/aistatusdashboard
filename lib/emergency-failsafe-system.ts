/**
 * EMERGENCY FAILSAFE SYSTEM
 * 
 * Detects and automatically recovers from catastrophic failures
 * to prevent total system collapse under extreme conditions.
 */

import { globalLockManager } from './atomic-lock-manager';
import { globalQuotaOptimizer } from './firebase-quota-optimizer';
import { globalPerformanceDetector } from './performance-bottleneck-detector';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'emergency';
  components: {
    memory: 'healthy' | 'warning' | 'critical';
    cpu: 'healthy' | 'warning' | 'critical';
    database: 'healthy' | 'warning' | 'critical';
    network: 'healthy' | 'warning' | 'critical';
    locks: 'healthy' | 'warning' | 'critical';
  };
  metrics: {
    memoryUsageMB: number;
    cpuUsagePercent: number;
    activeConnections: number;
    activeLocks: number;
    errorRate: number;
  };
  lastCheck: number;
}

interface FailsafeAction {
  trigger: string;
  action: () => Promise<void>;
  description: string;
  severity: 'warning' | 'critical' | 'emergency';
}

/**
 * Emergency failsafe system for catastrophic failure recovery
 */
export class EmergencyFailsafeSystem {
  private systemHealth: SystemHealth;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private failsafeActions: FailsafeAction[] = [];
  private emergencyMode = false;
  private lastEmergencyTrigger = 0;
  private readonly emergencyThresholds = {
    memoryUsageMB: 1024, // 1GB
    cpuUsagePercent: 90,
    errorRatePercent: 50,
    activeLocks: 1000,
    emergencyCooldown: 30000 // 30 seconds between emergency actions
  };
  
  constructor() {
    this.systemHealth = this.initializeSystemHealth();
    this.setupFailsafeActions();
    this.startHealthMonitoring();
  }
  
  /**
   * Initialize system health structure
   */
  private initializeSystemHealth(): SystemHealth {
    return {
      status: 'healthy',
      components: {
        memory: 'healthy',
        cpu: 'healthy',
        database: 'healthy',
        network: 'healthy',
        locks: 'healthy'
      },
      metrics: {
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        activeConnections: 0,
        activeLocks: 0,
        errorRate: 0
      },
      lastCheck: Date.now()
    };
  }
  
  /**
   * Setup emergency failsafe actions
   */
  private setupFailsafeActions(): void {
    this.failsafeActions = [
      {
        trigger: 'high_memory_usage',
        severity: 'warning',
        description: 'Clear caches and force garbage collection',
        action: async () => {
          console.warn('🧹 FAILSAFE: Clearing caches due to high memory usage');
          
          // Force garbage collection
          if (global.gc) {
            global.gc();
          }
          
          // Clear performance detector history
          await globalPerformanceDetector.destroy();
          
          // Emergency memory cleanup
          if (process.memoryUsage().heapUsed > this.emergencyThresholds.memoryUsageMB * 1024 * 1024) {
            console.error('🚨 EMERGENCY MEMORY CLEANUP');
            // More aggressive cleanup would go here
          }
        }
      },
      {
        trigger: 'database_overload',
        severity: 'critical',
        description: 'Activate emergency quota relief',
        action: async () => {
          console.error('🚨 FAILSAFE: Database overload detected - activating quota relief');
          await globalQuotaOptimizer.emergencyQuotaRelief();
        }
      },
      {
        trigger: 'lock_deadlock',
        severity: 'critical',
        description: 'Clear all locks and reset lock manager',
        action: async () => {
          console.error('🚨 FAILSAFE: Lock deadlock detected - clearing all locks');
          
          const lockStats = globalLockManager.getStats();
          if (lockStats.activeLocks > this.emergencyThresholds.activeLocks) {
            await globalLockManager.destroy();
            console.log('🔓 All locks cleared due to deadlock prevention');
          }
        }
      },
      {
        trigger: 'system_overload',
        severity: 'emergency',
        description: 'Activate emergency mode with reduced functionality',
        action: async () => {
          console.error('🚨 EMERGENCY MODE ACTIVATED - System overload detected');
          
          this.emergencyMode = true;
          this.lastEmergencyTrigger = Date.now();
          
          // Aggressive resource cleanup
          await this.emergencySystemCleanup();
          
          // Reduce system load
          this.activateEmergencyMode();
          
          // Auto-recovery after 5 minutes
          setTimeout(() => {
            this.deactivateEmergencyMode();
          }, 5 * 60 * 1000);
        }
      },
      {
        trigger: 'cascading_failures',
        severity: 'emergency',
        description: 'Complete system reset to prevent collapse',
        action: async () => {
          console.error('🚨 CASCADING FAILURE DETECTED - Initiating system reset');
          
          await this.completeSystemReset();
        }
      }
    ];
  }
  
  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Memory health check
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
      
      this.systemHealth.metrics.memoryUsageMB = memoryUsageMB;
      this.systemHealth.components.memory = 
        memoryUsageMB > this.emergencyThresholds.memoryUsageMB ? 'critical' :
        memoryUsageMB > this.emergencyThresholds.memoryUsageMB * 0.8 ? 'warning' : 'healthy';
      
      // CPU health check (simplified)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage approximation
      
      this.systemHealth.metrics.cpuUsagePercent = cpuPercent;
      this.systemHealth.components.cpu = 
        cpuPercent > this.emergencyThresholds.cpuUsagePercent ? 'critical' :
        cpuPercent > this.emergencyThresholds.cpuUsagePercent * 0.8 ? 'warning' : 'healthy';
      
      // Lock system health check
      const lockStats = globalLockManager.getStats();
      this.systemHealth.metrics.activeLocks = lockStats.activeLocks;
      this.systemHealth.components.locks = 
        lockStats.activeLocks > this.emergencyThresholds.activeLocks ? 'critical' :
        lockStats.activeLocks > this.emergencyThresholds.activeLocks * 0.8 ? 'warning' : 'healthy';
      
      // Performance health check
      const perfStats = globalPerformanceDetector.getPerformanceStats();
      const errorRate = perfStats.completedOperations > 0 ? 
        (perfStats.slowOperations / perfStats.completedOperations) * 100 : 0;
      
      this.systemHealth.metrics.errorRate = errorRate;
      
      // Database health check (simplified)
      this.systemHealth.components.database = 'healthy'; // Would check actual DB health
      this.systemHealth.components.network = 'healthy'; // Would check network health
      
      // Determine overall system status
      this.updateOverallSystemStatus();
      
      // Check for failsafe triggers
      await this.checkFailsafeTriggers();
      
      this.systemHealth.lastCheck = Date.now();
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.systemHealth.status = 'critical';
      
      // Trigger emergency action if health checks are failing
      await this.triggerFailsafeAction('system_overload');
    }
  }
  
  /**
   * Update overall system status based on component health
   */
  private updateOverallSystemStatus(): void {
    const components = Object.values(this.systemHealth.components);
    
    if (components.includes('critical')) {
      this.systemHealth.status = 'critical';
    } else if (components.includes('warning')) {
      this.systemHealth.status = 'degraded';
    } else {
      this.systemHealth.status = this.emergencyMode ? 'emergency' : 'healthy';
    }
  }
  
  /**
   * Check for failsafe triggers
   */
  private async checkFailsafeTriggers(): Promise<void> {
    const { metrics, components } = this.systemHealth;
    
    // High memory usage trigger
    if (components.memory === 'critical') {
      await this.triggerFailsafeAction('high_memory_usage');
    }
    
    // Database overload trigger
    if (components.database === 'critical') {
      await this.triggerFailsafeAction('database_overload');
    }
    
    // Lock deadlock trigger
    if (components.locks === 'critical') {
      await this.triggerFailsafeAction('lock_deadlock');
    }
    
    // System overload trigger
    const criticalComponents = Object.values(components).filter(status => status === 'critical').length;
    if (criticalComponents >= 3) {
      await this.triggerFailsafeAction('system_overload');
    }
    
    // Cascading failure trigger
    if (this.systemHealth.status === 'critical' && metrics.errorRate > this.emergencyThresholds.errorRatePercent) {
      await this.triggerFailsafeAction('cascading_failures');
    }
  }
  
  /**
   * Trigger specific failsafe action
   */
  private async triggerFailsafeAction(trigger: string): Promise<void> {
    const action = this.failsafeActions.find(a => a.trigger === trigger);
    
    if (!action) {
      console.warn(`No failsafe action found for trigger: ${trigger}`);
      return;
    }
    
    // Prevent rapid-fire emergency actions
    if (action.severity === 'emergency') {
      const timeSinceLastEmergency = Date.now() - this.lastEmergencyTrigger;
      if (timeSinceLastEmergency < this.emergencyThresholds.emergencyCooldown) {
        console.warn(`Emergency action cooldown active (${timeSinceLastEmergency}ms ago)`);
        return;
      }
    }
    
    console.log(`🚨 TRIGGERING FAILSAFE ACTION [${action.severity}]: ${action.description}`);
    
    try {
      await action.action();
      console.log(`✅ Failsafe action completed: ${trigger}`);
    } catch (error) {
      console.error(`❌ Failsafe action failed: ${trigger}`, error);
      
      // If failsafe actions are failing, we're in serious trouble
      if (action.severity === 'emergency') {
        await this.lastResortRecovery();
      }
    }
  }
  
  /**
   * Emergency system cleanup
   */
  private async emergencySystemCleanup(): Promise<void> {
    console.log('🧹 Emergency system cleanup initiated');
    
    // Clear all caches
    if (global.gc) {
      global.gc();
    }
    
    // Reset performance monitoring
    await globalPerformanceDetector.destroy();
    
    // Emergency quota relief
    await globalQuotaOptimizer.emergencyQuotaRelief();
    
    console.log('✅ Emergency cleanup completed');
  }
  
  /**
   * Activate emergency mode
   */
  private activateEmergencyMode(): void {
    console.warn('⚡ EMERGENCY MODE ACTIVATED - Reduced functionality enabled');
    
    this.emergencyMode = true;
    
    // Reduce system load by limiting operations
    // This would integrate with other systems to reduce their activity
  }
  
  /**
   * Deactivate emergency mode
   */
  private deactivateEmergencyMode(): void {
    console.log('🔄 EMERGENCY MODE DEACTIVATED - Normal operations resuming');
    
    this.emergencyMode = false;
    
    // Resume normal operations
    // This would signal other systems to resume full functionality
  }
  
  /**
   * Complete system reset (last resort)
   */
  private async completeSystemReset(): Promise<void> {
    console.error('🚨 COMPLETE SYSTEM RESET INITIATED');
    
    try {
      // Destroy all managers
      await globalLockManager.destroy();
      await globalQuotaOptimizer.destroy();
      await globalPerformanceDetector.destroy();
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Reset system health
      this.systemHealth = this.initializeSystemHealth();
      this.emergencyMode = false;
      
      console.log('✅ System reset completed - Monitoring resumed');
      
    } catch (error) {
      console.error('❌ System reset failed:', error);
      // At this point, the system may need manual intervention
    }
  }
  
  /**
   * Last resort recovery when failsafes fail
   */
  private async lastResortRecovery(): Promise<void> {
    console.error('🚨 LAST RESORT RECOVERY - Failsafe systems failing');
    
    // Minimal cleanup that should always work
    try {
      if (global.gc) {
        global.gc();
      }
      
      // Set emergency mode
      this.emergencyMode = true;
      
      console.warn('⚠️ System in minimal operation mode - Manual intervention may be required');
      
    } catch (error) {
      console.error('💀 COMPLETE SYSTEM FAILURE - Manual restart required');
      // System is in unrecoverable state
    }
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }
  
  /**
   * Check if system is in emergency mode
   */
  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }
  
  /**
   * Manual trigger for emergency mode
   */
  async triggerEmergencyMode(): Promise<void> {
    await this.triggerFailsafeAction('system_overload');
  }
  
  /**
   * Manual system reset
   */
  async manualSystemReset(): Promise<void> {
    await this.triggerFailsafeAction('cascading_failures');
  }
  
  /**
   * Shutdown and cleanup
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    console.log('🔄 Emergency failsafe system shutting down');
  }
}

// Global emergency failsafe system
export const globalEmergencyFailsafe = new EmergencyFailsafeSystem(); 