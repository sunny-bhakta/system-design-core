/**
 * High Availability Implementation
 * Demonstrates building highly available systems with redundancy and failover
 */

/**
 * High Availability Service
 */
class HighAvailabilityService {
  constructor(config) {
    this.primary = config.primary;
    this.secondaries = config.secondaries || [];
    this.failoverTimeout = config.failoverTimeout || 5000;
    this.healthCheckInterval = config.healthCheckInterval || 10000;
    this.currentActive = this.primary;
    this.failoverInProgress = false;
    this.healthChecks = new Map();
    
    this.startHealthChecks();
  }

  /**
   * Start health checks for all instances
   */
  startHealthChecks() {
    // Check primary
    this.checkHealth(this.primary, 'primary');
    
    // Check secondaries
    this.secondaries.forEach((secondary, index) => {
      this.checkHealth(secondary, `secondary-${index}`);
    });

    // Periodic health checks
    setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  /**
   * Perform health checks
   */
  async performHealthChecks() {
    // Check primary
    const primaryHealthy = await this.checkHealth(this.primary, 'primary');
    
    if (!primaryHealthy && this.currentActive === this.primary) {
      await this.initiateFailover();
    }

    // Check secondaries
    for (let i = 0; i < this.secondaries.length; i++) {
      await this.checkHealth(this.secondaries[i], `secondary-${index}`);
    }
  }

  /**
   * Check health of instance
   */
  async checkHealth(instance, name) {
    try {
      const healthy = await instance.healthCheck();
      this.healthChecks.set(name, {
        healthy,
        lastCheck: Date.now(),
        instance
      });
      return healthy;
    } catch (error) {
      this.healthChecks.set(name, {
        healthy: false,
        lastCheck: Date.now(),
        error: error.message,
        instance
      });
      return false;
    }
  }

  /**
   * Initiate failover
   */
  async initiateFailover() {
    if (this.failoverInProgress) {
      return;
    }

    this.failoverInProgress = true;
    console.log('Initiating failover...');

    // Find healthy secondary
    const healthySecondary = this.secondaries.find((secondary, index) => {
      const health = this.healthChecks.get(`secondary-${index}`);
      return health && health.healthy;
    });

    if (healthySecondary) {
      this.currentActive = healthySecondary;
      console.log('Failover completed. Using secondary instance.');
      
      // Attempt to recover primary in background
      this.recoverPrimary();
    } else {
      console.error('No healthy secondary available for failover!');
    }

    this.failoverInProgress = false;
  }

  /**
   * Recover primary
   */
  async recoverPrimary() {
    // Wait before attempting recovery
    await new Promise(resolve => setTimeout(resolve, this.failoverTimeout));

    const primaryHealthy = await this.checkHealth(this.primary, 'primary');
    
    if (primaryHealthy && this.currentActive !== this.primary) {
      console.log('Primary recovered. Switching back to primary.');
      this.currentActive = this.primary;
    }
  }

  /**
   * Execute operation with automatic failover
   */
  async execute(operation, ...args) {
    let lastError = null;
    const instances = [this.currentActive, ...this.secondaries];

    for (const instance of instances) {
      try {
        const result = await instance.execute(operation, ...args);
        
        // If we used a secondary and primary is now healthy, switch back
        if (instance !== this.primary && this.currentActive === instance) {
          const primaryHealthy = await this.checkHealth(this.primary, 'primary');
          if (primaryHealthy) {
            this.currentActive = this.primary;
          }
        }
        
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`Operation failed on ${instance.name}:`, error.message);
        
        // Mark instance as unhealthy
        const instanceName = instance === this.primary ? 'primary' : 
          `secondary-${this.secondaries.indexOf(instance)}`;
        this.healthChecks.set(instanceName, {
          healthy: false,
          lastCheck: Date.now(),
          error: error.message,
          instance
        });
        
        continue; // Try next instance
      }
    }

    throw new Error(`All instances failed. Last error: ${lastError?.message}`);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      currentActive: this.currentActive.name,
      failoverInProgress: this.failoverInProgress,
      health: Array.from(this.healthChecks.entries()).map(([name, health]) => ({
        name,
        healthy: health.healthy,
        lastCheck: new Date(health.lastCheck).toISOString(),
        error: health.error
      }))
    };
  }
}

/**
 * Service Instance
 */
class ServiceInstance {
  constructor(name, config = {}) {
    this.name = name;
    this.failureRate = config.failureRate || 0.1; // 10% failure rate
    this.responseTime = config.responseTime || 100;
    this.healthy = true;
  }

  async healthCheck() {
    // Simulate health check
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Randomly fail based on failure rate
    if (Math.random() < this.failureRate) {
      this.healthy = false;
      return false;
    }
    
    this.healthy = true;
    return true;
  }

  async execute(operation, ...args) {
    if (!this.healthy) {
      throw new Error(`${this.name} is unhealthy`);
    }

    // Simulate operation
    await new Promise(resolve => setTimeout(resolve, this.responseTime));
    
    // Randomly fail
    if (Math.random() < this.failureRate) {
      throw new Error(`Operation failed on ${this.name}`);
    }

    return {
      instance: this.name,
      operation,
      result: 'success',
      args
    };
  }
}

/**
 * Load Balanced Service
 * Distributes load across multiple instances
 */
class LoadBalancedService {
  constructor(instances, algorithm = 'round-robin') {
    this.instances = instances;
    this.algorithm = algorithm;
    this.currentIndex = 0;
    this.instanceStats = new Map();
    
    instances.forEach(instance => {
      this.instanceStats.set(instance.name, {
        requests: 0,
        errors: 0,
        totalResponseTime: 0
      });
    });
  }

  /**
   * Select instance based on algorithm
   */
  selectInstance() {
    const healthyInstances = this.instances.filter(inst => inst.healthy);
    
    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }

    switch (this.algorithm) {
      case 'round-robin':
        const instance = healthyInstances[this.currentIndex % healthyInstances.length];
        this.currentIndex++;
        return instance;
      
      case 'least-connections':
        return healthyInstances.reduce((least, current) => {
          const leastStats = this.instanceStats.get(least.name);
          const currentStats = this.instanceStats.get(current.name);
          return leastStats.requests < currentStats.requests ? least : current;
        });
      
      case 'random':
        return healthyInstances[Math.floor(Math.random() * healthyInstances.length)];
      
      default:
        return healthyInstances[0];
    }
  }

  /**
   * Execute with load balancing
   */
  async execute(operation, ...args) {
    const instance = this.selectInstance();
    const stats = this.instanceStats.get(instance.name);
    const startTime = Date.now();

    try {
      stats.requests++;
      const result = await instance.execute(operation, ...args);
      stats.totalResponseTime += Date.now() - startTime;
      return result;
    } catch (error) {
      stats.errors++;
      throw error;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return Array.from(this.instanceStats.entries()).map(([name, stats]) => ({
      name,
      requests: stats.requests,
      errors: stats.errors,
      avgResponseTime: stats.requests > 0 
        ? Math.round(stats.totalResponseTime / stats.requests) 
        : 0,
      errorRate: stats.requests > 0 
        ? ((stats.errors / stats.requests) * 100).toFixed(2) + '%'
        : '0%'
    }));
  }
}

/**
 * Active-Passive Configuration
 */
class ActivePassiveHA {
  constructor(primary, standby) {
    this.primary = primary;
    this.standby = standby;
    this.active = primary;
    this.monitoring = false;
  }

  /**
   * Start monitoring
   */
  startMonitoring(interval = 5000) {
    this.monitoring = true;
    
    const check = async () => {
      if (!this.monitoring) return;
      
      const primaryHealthy = await this.primary.healthCheck();
      
      if (!primaryHealthy && this.active === this.primary) {
        console.log('Primary failed. Activating standby.');
        this.active = this.standby;
      } else if (primaryHealthy && this.active === this.standby) {
        console.log('Primary recovered. Switching back to primary.');
        this.active = this.primary;
      }
      
      setTimeout(check, interval);
    };
    
    check();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.monitoring = false;
  }

  /**
   * Execute operation
   */
  async execute(operation, ...args) {
    return await this.active.execute(operation, ...args);
  }

  getStatus() {
    return {
      active: this.active.name,
      primaryHealthy: this.primary.healthy,
      standbyHealthy: this.standby.healthy
    };
  }
}

/**
 * Active-Active Configuration
 */
class ActiveActiveHA {
  constructor(instances) {
    this.instances = instances;
    this.loadBalancer = new LoadBalancedService(instances, 'round-robin');
  }

  /**
   * Execute operation
   */
  async execute(operation, ...args) {
    return await this.loadBalancer.execute(operation, ...args);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      instances: this.instances.map(inst => ({
        name: inst.name,
        healthy: inst.healthy
      })),
      stats: this.loadBalancer.getStats()
    };
  }
}

// Example usage
async function demonstrateHighAvailability() {
  console.log('=== High Availability ===\n');

  // Create service instances
  const primary = new ServiceInstance('primary', { failureRate: 0.05, responseTime: 50 });
  const secondary1 = new ServiceInstance('secondary-1', { failureRate: 0.1, responseTime: 60 });
  const secondary2 = new ServiceInstance('secondary-2', { failureRate: 0.1, responseTime: 70 });

  // High Availability Service
  console.log('=== High Availability Service ===\n');
  const haService = new HighAvailabilityService({
    primary,
    secondaries: [secondary1, secondary2],
    failoverTimeout: 3000,
    healthCheckInterval: 5000
  });

  // Execute operations
  for (let i = 0; i < 5; i++) {
    try {
      const result = await haService.execute('getData', { id: i });
      console.log(`Operation ${i}:`, result);
    } catch (error) {
      console.error(`Operation ${i} failed:`, error.message);
    }
  }

  console.log('\nHA Status:', haService.getStatus());

  // Active-Passive
  console.log('\n=== Active-Passive Configuration ===\n');
  const activePassive = new ActivePassiveHA(primary, secondary1);
  activePassive.startMonitoring(2000);

  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('Active-Passive Status:', activePassive.getStatus());

  // Active-Active
  console.log('\n=== Active-Active Configuration ===\n');
  const activeActive = new ActiveActiveHA([primary, secondary1, secondary2]);

  for (let i = 0; i < 10; i++) {
    try {
      await activeActive.execute('process', { data: i });
    } catch (error) {
      console.error(`Request ${i} failed:`, error.message);
    }
  }

  console.log('Active-Active Stats:', activeActive.getStatus());
}

if (require.main === module) {
  demonstrateHighAvailability();
}

module.exports = {
  HighAvailabilityService,
  ServiceInstance,
  LoadBalancedService,
  ActivePassiveHA,
  ActiveActiveHA
};

