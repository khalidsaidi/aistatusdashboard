#!/usr/bin/env node

/**
 * CRITICAL DEPLOYMENT SAFETY CHECK
 * 
 * This script validates that critical architectural issues are resolved
 * before allowing any production deployment.
 */

const fs = require('fs');
const path = require('path');

// Critical issues that must be resolved
const CRITICAL_ISSUES = [
  {
    id: 'concurrency-controls',
    name: 'Thread-safe concurrency controls',
    check: checkConcurrencyControls,
    severity: 'CATASTROPHIC'
  },
  {
    id: 'missing-api-endpoints',
    name: 'Missing critical API endpoints',
    check: checkMissingEndpoints,
    severity: 'CATASTROPHIC'
  },
  {
    id: 'firebase-config',
    name: 'Firebase configuration issues',
    check: checkFirebaseConfig,
    severity: 'CRITICAL'
  },
  {
    id: 'memory-leaks',
    name: 'Memory leak prevention',
    check: checkMemoryLeaks,
    severity: 'CATASTROPHIC'
  },
  {
    id: 'security-vulnerabilities',
    name: 'Security vulnerabilities',
    check: checkSecurityVulnerabilities,
    severity: 'CRITICAL'
  },
  {
    id: 'error-boundaries',
    name: 'Error boundaries and fallbacks',
    check: checkErrorBoundaries,
    severity: 'CRITICAL'
  },
  {
    id: 'monitoring-alerting',
    name: 'Monitoring and alerting',
    check: checkMonitoringAlerting,
    severity: 'CRITICAL'
  },
  {
    id: 'atomic-lock-manager',
    name: 'Atomic lock manager implementation',
    check: checkAtomicLockManager,
    severity: 'CATASTROPHIC'
  },
  {
    id: 'firebase-quota-optimizer',
    name: 'Firebase quota optimizer',
    check: checkFirebaseQuotaOptimizer,
    severity: 'CATASTROPHIC'
  },
  {
    id: 'performance-bottleneck-detector',
    name: 'Performance bottleneck detector',
    check: checkPerformanceBottleneckDetector,
    severity: 'CATASTROPHIC'
  },
  {
    id: 'emergency-failsafe-system',
    name: 'Emergency failsafe system',
    check: checkEmergencyFailsafeSystem,
    severity: 'CATASTROPHIC'
  }
];

// Safety check results
const results = {
  passed: 0,
  failed: 0,
  issues: []
};

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'info': '📋',
    'success': '✅',
    'warn': '⚠️',
    'error': '❌',
    'critical': '🚨'
  }[level] || '📋';
  
  console.log(`${prefix} ${message}`);
}

function checkConcurrencyControls() {
  const issues = [];
  
  // Check for AtomicLockManager integration
  const threadSafeFiles = [
    'lib/thread-safe-cache.ts',
    'lib/thread-safe-rate-limiter.ts',
    'lib/thread-safe-circuit-breaker.ts'
  ];
  
  threadSafeFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (!content.includes('globalLockManager')) {
        issues.push(`${file}: Not using AtomicLockManager for thread safety`);
      }
      
      if (content.includes('this.withLock') || content.includes('withGlobalLock')) {
        issues.push(`${file}: Still using unsafe lock mechanisms`);
      }
    } else {
      issues.push(`Missing critical file: ${file}`);
    }
  });
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkMissingEndpoints() {
  const issues = [];
  
  // Critical endpoints that must exist
  const requiredEndpoints = [
    'app/api/health/route.ts',
    'app/api/providers/route.ts',
    'app/api/incidents/route.ts',
    'app/api/notifications/route.ts'
  ];
  
  requiredEndpoints.forEach(endpoint => {
    const filePath = path.join(__dirname, '..', endpoint);
    if (!fs.existsSync(filePath)) {
      issues.push(`Missing critical endpoint: ${endpoint}`);
    }
  });
  
  // Check for GET method support in endpoints
  const endpointsToCheck = [
    { file: 'app/api/incidents/route.ts', method: 'GET' },
    { file: 'app/api/notifications/route.ts', method: 'GET' }
  ];
  
  endpointsToCheck.forEach(({ file, method }) => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes(`export async function ${method}`)) {
        issues.push(`${file}: Missing ${method} method handler`);
      }
    }
  });
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkFirebaseConfig() {
  const issues = [];
  
  // Check for hardcoded project IDs
  const configFiles = [
    'lib/config.ts',
    'next.config.js',
    'lib/firebase.ts'
  ];
  
  configFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('ai-status-dashboard-dev') && !content.includes('process.env')) {
        issues.push(`${file}: Hardcoded dev project ID`);
      }
      
      if (content.includes('us-central1') && !content.includes('FIREBASE_FUNCTIONS_REGION')) {
        issues.push(`${file}: Hardcoded Firebase region`);
      }
    }
  });
  
  // Check environment validation - ensure Firebase project ID is not optional
  const envConfigPath = path.join(__dirname, '../lib/config.ts');
  if (fs.existsSync(envConfigPath)) {
    const content = fs.readFileSync(envConfigPath, 'utf8');
    
    // Check specifically for optional Firebase project ID fields (not including DEFAULT_ fields)
    if (content.match(/(?<!DEFAULT_)FIREBASE_PROJECT_ID:\s*z\.string\(\)\.optional\(\)/) || 
        content.includes('NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional()')) {
      issues.push('Firebase project ID should be required in production');
    }
    
    // Check for proper environment variable usage in hardcoded values
    const hasProperEnvUsage = content.includes('process.env.FIREBASE_PROJECT_ID') || 
                             content.includes('process.env.DEFAULT_FIREBASE_DEV_PROJECT_ID');
    
    if (!hasProperEnvUsage && content.includes('ai-status-dashboard-dev')) {
      // Only flag if hardcoded without any environment variable fallback
      const hardcodedMatches = content.match(/['"]ai-status-dashboard-dev['"]/g);
      const envMatches = content.match(/process\.env\./g);
      
      if (hardcodedMatches && (!envMatches || envMatches.length === 0)) {
        issues.push('Hardcoded Firebase project ID without environment variable fallback');
      }
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkMemoryLeaks() {
  const issues = [];
  
  // Check for proper cleanup in scaling manager
  const scalingFile = path.join(__dirname, '../lib/horizontal-scaling-manager.ts');
  if (fs.existsSync(scalingFile)) {
    const content = fs.readFileSync(scalingFile, 'utf8');
    
    if (!content.includes('clearInterval') || !content.includes('removeAllListeners')) {
      issues.push('Horizontal scaling manager lacks proper cleanup');
    }
    
    if (content.includes('new Array') && !content.includes('cleanup')) {
      issues.push('Array allocations without cleanup detected');
    }
  }
  
  // Check circuit breaker cleanup
  const fetcherFile = path.join(__dirname, '../lib/enterprise-status-fetcher.ts');
  if (fs.existsSync(fetcherFile)) {
    const content = fs.readFileSync(fetcherFile, 'utf8');
    
    if (content.includes('circuitBreakers.set') && !content.includes('circuitBreakers.delete')) {
      issues.push('Circuit breaker map grows without cleanup');
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkSecurityVulnerabilities() {
  const issues = [];
  
  // Check for timing attack vulnerabilities
  const securityFile = path.join(__dirname, '../lib/security-middleware.ts');
  if (fs.existsSync(securityFile)) {
    const content = fs.readFileSync(securityFile, 'utf8');
    
    if (content.includes('!==') && content.includes('apiKey') && !content.includes('crypto.timingSafeEqual')) {
      issues.push('API key comparison vulnerable to timing attacks');
    }
  }
  
  // Check for hardcoded credentials
  const serviceWorkerPath = path.join(__dirname, '../public/firebase-messaging-sw.js');
  if (fs.existsSync(serviceWorkerPath)) {
    const content = fs.readFileSync(serviceWorkerPath, 'utf8');
    
    if (content.match(/AIza[0-9A-Za-z-_]{35}/)) {
      issues.push('Service worker contains hardcoded API key');
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkErrorBoundaries() {
  const issues = [];
  
  // Check for React error boundaries
  const errorBoundaryPath = path.join(__dirname, '../components/ErrorBoundary.tsx');
  if (!fs.existsSync(errorBoundaryPath)) {
    issues.push('Missing React error boundary component');
  }
  
  // Check for API error handling
  const apiFiles = fs.readdirSync(path.join(__dirname, '../app/api'), { recursive: true })
    .filter(file => file.toString().endsWith('.ts'));
  
  apiFiles.forEach(file => {
    const filePath = path.join(__dirname, '../app/api', file.toString());
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes('try') || !content.includes('catch')) {
      issues.push(`${file}: Missing error handling`);
    }
  });
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkMonitoringAlerting() {
  const issues = [];
  
  // Check for health check endpoint
  const healthPath = path.join(__dirname, '../app/api/health/route.ts');
  if (!fs.existsSync(healthPath)) {
    issues.push('Missing health check endpoint');
  }
  
  // Check for metrics collection
  const metricsFiles = [
    'lib/metrics.ts',
    'lib/monitoring.ts'
  ];
  
  const hasMetrics = metricsFiles.some(file => 
    fs.existsSync(path.join(__dirname, '..', file))
  );
  
  if (!hasMetrics) {
    issues.push('Missing metrics collection system');
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkAtomicLockManager() {
  const issues = [];
  
  const lockManagerFile = path.join(__dirname, '../lib/atomic-lock-manager.ts');
  if (!fs.existsSync(lockManagerFile)) {
    issues.push('AtomicLockManager file missing');
  } else {
    const content = fs.readFileSync(lockManagerFile, 'utf8');
    
    if (!content.includes('class AtomicLockManager')) {
      issues.push('AtomicLockManager class not found');
    }
    
    if (!content.includes('acquireLock') || !content.includes('releaseLock')) {
      issues.push('AtomicLockManager missing critical methods');
    }
    
    if (!content.includes('globalLockManager')) {
      issues.push('Global lock manager instance not exported');
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkFirebaseQuotaOptimizer() {
  const issues = [];
  
  const optimizerFile = path.join(__dirname, '../lib/firebase-quota-optimizer.ts');
  if (!fs.existsSync(optimizerFile)) {
    issues.push('FirebaseQuotaOptimizer file missing');
  } else {
    const content = fs.readFileSync(optimizerFile, 'utf8');
    
    if (!content.includes('class FirebaseQuotaOptimizer')) {
      issues.push('FirebaseQuotaOptimizer class not found');
    }
    
    if (!content.includes('bulkWriteStatusResults')) {
      issues.push('Bulk write optimization missing');
    }
    
    if (!content.includes('calculateOptimalDocumentCount')) {
      issues.push('Document size optimization missing');
    }
    
    if (!content.includes('globalQuotaOptimizer')) {
      issues.push('Global quota optimizer instance not exported');
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkPerformanceBottleneckDetector() {
  const issues = [];
  
  const detectorFile = path.join(__dirname, '../lib/performance-bottleneck-detector.ts');
  if (!fs.existsSync(detectorFile)) {
    issues.push('PerformanceBottleneckDetector file missing');
  } else {
    const content = fs.readFileSync(detectorFile, 'utf8');
    
    if (!content.includes('class PerformanceBottleneckDetector')) {
      issues.push('PerformanceBottleneckDetector class not found');
    }
    
    if (!content.includes('startOperation') || !content.includes('endOperation')) {
      issues.push('Performance monitoring methods missing');
    }
    
    if (!content.includes('checkOperationTimeout')) {
      issues.push('Timeout detection missing');
    }
    
    if (!content.includes('globalPerformanceDetector')) {
      issues.push('Global performance detector instance not exported');
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

function checkEmergencyFailsafeSystem() {
  const issues = [];
  
  const failsafeFile = path.join(__dirname, '../lib/emergency-failsafe-system.ts');
  if (!fs.existsSync(failsafeFile)) {
    issues.push('EmergencyFailsafeSystem file missing');
  } else {
    const content = fs.readFileSync(failsafeFile, 'utf8');
    
    if (!content.includes('class EmergencyFailsafeSystem')) {
      issues.push('EmergencyFailsafeSystem class not found');
    }
    
    if (!content.includes('performHealthCheck')) {
      issues.push('Health monitoring missing');
    }
    
    if (!content.includes('triggerFailsafeAction')) {
      issues.push('Failsafe action system missing');
    }
    
    if (!content.includes('globalEmergencyFailsafe')) {
      issues.push('Global emergency failsafe instance not exported');
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

async function runSafetyCheck() {
  log('🚨 STARTING CRITICAL DEPLOYMENT SAFETY CHECK', 'critical');
  log('This check validates that catastrophic issues have been resolved', 'info');
  
  
  
  
  
  for (const issue of CRITICAL_ISSUES) {
    log(`Checking: ${issue.name}`, 'info');
    
    try {
      const result = issue.check();
      
      if (result.passed) {
        log(`✅ PASSED: ${issue.name}`, 'success');
        results.passed++;
      } else {
        log(`❌ FAILED: ${issue.name} (${issue.severity})`, 'error');
        results.failed++;
        
        result.issues.forEach(issueDetail => {
          log(`   - ${issueDetail}`, 'error');
        });
        
        results.issues.push({
          id: issue.id,
          name: issue.name,
          severity: issue.severity,
          details: result.issues
        });
      }
    } catch (error) {
      log(`❌ ERROR checking ${issue.name}: ${error.message}`, 'error');
      results.failed++;
      
      results.issues.push({
        id: issue.id,
        name: issue.name,
        severity: 'CRITICAL',
        details: [`Check failed: ${error.message}`]
      });
    }
    
    
  }
  
  // Generate final report
  
  
  
  
  
  
  
  const successRate = (results.passed / (results.passed + results.failed)) * 100;
  
  
  // Determine deployment safety
  const catastrophicIssues = results.issues.filter(issue => issue.severity === 'CATASTROPHIC').length;
  const criticalIssues = results.issues.filter(issue => issue.severity === 'CRITICAL').length;
  
  
  
  if (catastrophicIssues > 0) {
    log(`🚨 DEPLOYMENT BLOCKED: ${catastrophicIssues} CATASTROPHIC issues found`, 'critical');
    log('These issues would cause immediate production failures', 'critical');
    
    results.issues
      .filter(issue => issue.severity === 'CATASTROPHIC')
      .forEach(issue => {
        log(`   ${issue.name}:`, 'critical');
        issue.details.forEach(detail => {
          log(`   - ${detail}`, 'critical');
        });
      });
    
    process.exit(1);
  } else if (criticalIssues > 0) {
    log(`⚠️ DEPLOYMENT RISKY: ${criticalIssues} CRITICAL issues found`, 'warn');
    log('Production deployment not recommended', 'warn');
    process.exit(1);
  } else {
    log('✅ DEPLOYMENT SAFE: All critical issues resolved', 'success');
    log('System ready for production deployment', 'success');
    process.exit(0);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'critical');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection: ${reason}`, 'critical');
  process.exit(1);
});

// Run the safety check
runSafetyCheck().catch(error => {
  log(`Safety check failed: ${error.message}`, 'critical');
  process.exit(1);
}); 