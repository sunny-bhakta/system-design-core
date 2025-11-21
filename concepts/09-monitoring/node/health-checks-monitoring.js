/**
 * Health Checks for Monitoring
 * Demonstrates comprehensive health check system for monitoring
 */

/**
 * Health Check
 */
class HealthCheck {
  constructor(name, checkFunction, options = {}) {
    this.name = name;
    this.checkFunction = checkFunction;
    this.interval = options.interval || 30000; // 30 seconds
    this.timeout = options.timeout || 5000; // 5 seconds
    this.retries = options.retries || 2;
    this.critical = options.critical || false;
    
    this.status = 'unknown';
    this.lastCheck = null;
    this.lastSuccess = null;
    this.lastFailure = null;
    this.consecutiveFailures = 0;
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
  }

  /**
   * Execute health check
   */
  async execute() {
    const startTime = Date.now();
    let result = null;

    try {
      // Execute with timeout
      result = await Promise.race([
        this.checkFunction(),
        this.createTimeout()
      ]);

      this.status = result ? 'healthy' : 'unhealthy';
      this.lastCheck = Date.now();

      if (result) {
        this.lastSuccess = Date.now();
        this.consecutiveFailures = 0;
      } else {
        this.lastFailure = Date.now();
        this.consecutiveFailures++;
      }

      this.recordHistory({
        timestamp: Date.now(),
        status: this.status,
        duration: Date.now() - startTime,
        result
      });

      return {
        name: this.name,
        status: this.status,
        duration: Date.now() - startTime,
        result,
        lastCheck: this.lastCheck
      };
    } catch (error) {
      this.status = 'unhealthy';
      this.lastCheck = Date.now();
      this.lastFailure = Date.now();
      this.consecutiveFailures++;

      this.recordHistory({
        timestamp: Date.now(),
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error.message
      });

      return {
        name: this.name,
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error.message,
        lastCheck: this.lastCheck
      };
    }
  }

  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), this.timeout);
    });
  }

  recordHistory(entry) {
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getStatus() {
    return {
      name: this.name,
      status: this.status,
      lastCheck: this.lastCheck ? new Date(this.lastCheck).toISOString() : null,
      lastSuccess: this.lastSuccess ? new Date(this.lastSuccess).toISOString() : null,
      lastFailure: this.lastFailure ? new Date(this.lastFailure).toISOString() : null,
      consecutiveFailures: this.consecutiveFailures,
      critical: this.critical
    };
  }
}

/**
 * Health Check Manager
 */
class HealthCheckManager {
  constructor() {
    this.checks = new Map();
    this.intervals = new Map();
    this.overallStatus = 'unknown';
  }

  /**
   * Register health check
   */
  register(check) {
    this.checks.set(check.name, check);
    
    // Start periodic checking
    this.startPeriodicCheck(check);
  }

  /**
   * Start periodic check
   */
  startPeriodicCheck(check) {
    const interval = setInterval(async () => {
      await check.execute();
      this.updateOverallStatus();
    }, check.interval);

    // Initial check
    check.execute().then(() => this.updateOverallStatus());

    this.intervals.set(check.name, interval);
  }

  /**
   * Unregister health check
   */
  unregister(name) {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    this.checks.delete(name);
    this.updateOverallStatus();
  }

  /**
   * Update overall status
   */
  updateOverallStatus() {
    const allChecks = Array.from(this.checks.values());
    
    if (allChecks.length === 0) {
      this.overallStatus = 'unknown';
      return;
    }

    const criticalChecks = allChecks.filter(c => c.critical);
    const unhealthyCritical = criticalChecks.filter(c => c.status === 'unhealthy');
    
    if (unhealthyCritical.length > 0) {
      this.overallStatus = 'unhealthy';
      return;
    }

    const unhealthyCount = allChecks.filter(c => c.status === 'unhealthy').length;
    
    if (unhealthyCount === 0) {
      this.overallStatus = 'healthy';
    } else if (unhealthyCount < allChecks.length) {
      this.overallStatus = 'degraded';
    } else {
      this.overallStatus = 'unhealthy';
    }
  }

  /**
   * Run all checks
   */
  async runAllChecks() {
    const results = await Promise.all(
      Array.from(this.checks.values()).map(check => check.execute())
    );
    
    this.updateOverallStatus();
    return results;
  }

  /**
   * Get overall health
   */
  getOverallHealth() {
    const checks = Array.from(this.checks.values()).map(c => c.getStatus());
    
    return {
      status: this.overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        total: checks.length,
        healthy: checks.filter(c => c.status === 'healthy').length,
        unhealthy: checks.filter(c => c.status === 'unhealthy').length,
        degraded: checks.filter(c => c.status === 'degraded').length
      }
    };
  }

  /**
   * Get check by name
   */
  getCheck(name) {
    return this.checks.get(name);
  }
}

/**
 * Database Health Check
 */
class DatabaseHealthCheck extends HealthCheck {
  constructor(database, options = {}) {
    super('database', async () => {
      // Simulate database ping
      await new Promise(resolve => setTimeout(resolve, 10));
      return Math.random() > 0.1; // 90% success rate
    }, { ...options, critical: true });
    
    this.database = database;
  }
}

/**
 * Cache Health Check
 */
class CacheHealthCheck extends HealthCheck {
  constructor(cache, options = {}) {
    super('cache', async () => {
      // Simulate cache ping
      await new Promise(resolve => setTimeout(resolve, 5));
      return Math.random() > 0.05; // 95% success rate
    }, { ...options, critical: false });
    
    this.cache = cache;
  }
}

/**
 * External Service Health Check
 */
class ExternalServiceHealthCheck extends HealthCheck {
  constructor(serviceName, serviceUrl, options = {}) {
    super(`external.${serviceName}`, async () => {
      // Simulate HTTP health check
      await new Promise(resolve => setTimeout(resolve, 20));
      return Math.random() > 0.15; // 85% success rate
    }, { ...options, critical: false });
    
    this.serviceName = serviceName;
    this.serviceUrl = serviceUrl;
  }
}

/**
 * Disk Space Health Check
 */
class DiskSpaceHealthCheck extends HealthCheck {
  constructor(path, thresholdPercent = 90, options = {}) {
    super('disk_space', async () => {
      // Simulate disk space check
      const usedPercent = 70 + Math.random() * 20; // 70-90%
      return usedPercent < thresholdPercent;
    }, { ...options, critical: true });
    
    this.path = path;
    this.thresholdPercent = thresholdPercent;
  }
}

/**
 * Memory Health Check
 */
class MemoryHealthCheck extends HealthCheck {
  constructor(thresholdMB = 1024, options = {}) {
    super('memory', async () => {
      const memUsage = process.memoryUsage();
      const availableMB = (memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024;
      return availableMB > thresholdMB;
    }, { ...options, critical: false });
    
    this.thresholdMB = thresholdMB;
  }
}

// Example usage
async function demonstrateHealthChecks() {
  console.log('=== Health Checks for Monitoring ===\n');

  const manager = new HealthCheckManager();

  // Register various health checks
  manager.register(new DatabaseHealthCheck(null, { interval: 10000 }));
  manager.register(new CacheHealthCheck(null, { interval: 15000 }));
  manager.register(new ExternalServiceHealthCheck('payment-service', 'http://payment:3000', {
    interval: 20000
  }));
  manager.register(new DiskSpaceHealthCheck('/', 85, { interval: 30000 }));
  manager.register(new MemoryHealthCheck(512, { interval: 10000 }));

  // Wait for initial checks
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get overall health
  const health = manager.getOverallHealth();
  console.log('Overall Health:', JSON.stringify(health, null, 2));

  // Run all checks manually
  console.log('\n=== Running All Checks ===\n');
  const results = await manager.runAllChecks();
  results.forEach(result => {
    console.log(`${result.name}: ${result.status} (${result.duration}ms)`);
  });

  // Get individual check status
  console.log('\n=== Individual Check Status ===\n');
  const dbCheck = manager.getCheck('database');
  if (dbCheck) {
    console.log('Database Check:', dbCheck.getStatus());
  }
}

if (require.main === module) {
  demonstrateHealthChecks();
}

module.exports = {
  HealthCheck,
  HealthCheckManager,
  DatabaseHealthCheck,
  CacheHealthCheck,
  ExternalServiceHealthCheck,
  DiskSpaceHealthCheck,
  MemoryHealthCheck
};

