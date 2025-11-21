/**
 * Design for Failure
 * Demonstrates building resilient systems that handle failures gracefully
 */

/**
 * Resilient Service with Failure Handling
 */
class ResilientService {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 5000;
    this.circuitBreaker = options.circuitBreaker;
    this.fallback = options.fallback;
  }

  /**
   * Execute with retry and timeout
   */
  async execute(operation, ...args) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
          throw new Error('Circuit breaker is open');
        }

        // Execute with timeout
        const result = await Promise.race([
          operation(...args),
          this.createTimeout()
        ]);

        // Success - reset circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordSuccess();
        }

        return result;
      } catch (error) {
        lastError = error;
        
        // Record failure in circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure();
        }

        // Don't retry on last attempt
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }

    // All retries failed - use fallback
    if (this.fallback) {
      console.log('Using fallback function');
      return this.fallback(...args);
    }

    throw lastError;
  }

  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), this.timeout);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Graceful Degradation
 */
class GracefulDegradation {
  constructor() {
    this.features = new Map();
    this.fallbackFeatures = new Map();
  }

  /**
   * Register feature with fallback
   */
  registerFeature(name, feature, fallback) {
    this.features.set(name, feature);
    this.fallbackFeatures.set(name, fallback);
  }

  /**
   * Execute feature with fallback
   */
  async executeFeature(name, ...args) {
    try {
      const feature = this.features.get(name);
      if (!feature) {
        throw new Error(`Feature ${name} not found`);
      }

      return await feature(...args);
    } catch (error) {
      console.warn(`Feature ${name} failed, using fallback:`, error.message);
      
      const fallback = this.fallbackFeatures.get(name);
      if (fallback) {
        return await fallback(...args);
      }

      throw error;
    }
  }
}

/**
 * Health Check System
 */
class HealthCheckSystem {
  constructor() {
    this.checks = new Map();
    this.status = 'healthy';
  }

  /**
   * Register health check
   */
  registerCheck(name, checkFunction, interval = 30000) {
    this.checks.set(name, {
      function: checkFunction,
      interval,
      lastCheck: null,
      status: 'unknown'
    });

    // Start periodic checks
    this.startCheck(name, interval);
  }

  startCheck(name, interval) {
    const check = async () => {
      try {
        const checkFunction = this.checks.get(name).function;
        const result = await checkFunction();
        
        this.checks.get(name).status = result ? 'healthy' : 'unhealthy';
        this.checks.get(name).lastCheck = Date.now();
        
        this.updateOverallStatus();
      } catch (error) {
        this.checks.get(name).status = 'unhealthy';
        this.checks.get(name).lastCheck = Date.now();
        this.updateOverallStatus();
      }

      setTimeout(check, interval);
    };

    check();
  }

  updateOverallStatus() {
    const allChecks = Array.from(this.checks.values());
    const unhealthyCount = allChecks.filter(c => c.status === 'unhealthy').length;
    
    if (unhealthyCount === 0) {
      this.status = 'healthy';
    } else if (unhealthyCount < allChecks.length) {
      this.status = 'degraded';
    } else {
      this.status = 'unhealthy';
    }
  }

  getStatus() {
    return {
      overall: this.status,
      checks: Array.from(this.checks.entries()).map(([name, check]) => ({
        name,
        status: check.status,
        lastCheck: check.lastCheck ? new Date(check.lastCheck).toISOString() : null
      }))
    };
  }
}

/**
 * Bulkhead Pattern
 * Isolate resources to prevent cascading failures
 */
class Bulkhead {
  constructor(config) {
    this.pools = new Map();
    this.maxPools = config.maxPools || 10;
    this.poolSize = config.poolSize || 5;
  }

  /**
   * Create isolated pool
   */
  createPool(name, size) {
    if (this.pools.size >= this.maxPools) {
      throw new Error('Maximum pools reached');
    }

    this.pools.set(name, {
      size,
      active: 0,
      queue: []
    });
  }

  /**
   * Execute in isolated pool
   */
  async executeInPool(poolName, operation) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    // Wait if pool is full
    if (pool.active >= pool.size) {
      await new Promise(resolve => {
        pool.queue.push(resolve);
      });
    }

    pool.active++;

    try {
      const result = await operation();
      return result;
    } finally {
      pool.active--;
      
      // Process next in queue
      if (pool.queue.length > 0) {
        const next = pool.queue.shift();
        next();
      }
    }
  }

  getPoolStatus() {
    return Array.from(this.pools.entries()).map(([name, pool]) => ({
      name,
      size: pool.size,
      active: pool.active,
      queued: pool.queue.length
    }));
  }
}

/**
 * Timeout and Circuit Breaker
 */
class SimpleCircuitBreaker {
  constructor(config) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 60000;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed'; // closed, open, half-open
  }

  canExecute() {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      canExecute: this.canExecute()
    };
  }
}

// Example usage
async function demonstrateDesignForFailure() {
  console.log('=== Resilient Service ===\n');
  
  const circuitBreaker = new SimpleCircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 5000
  });

  const resilientService = new ResilientService({
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 3000,
    circuitBreaker,
    fallback: () => {
      console.log('Fallback: Returning cached data');
      return { data: 'cached', source: 'fallback' };
    }
  });

  // Simulate flaky operation
  let attemptCount = 0;
  const flakyOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Temporary failure');
    }
    return { data: 'success', attempt: attemptCount };
  };

  try {
    const result = await resilientService.execute(flakyOperation);
    console.log('Result:', result);
  } catch (error) {
    console.log('All attempts failed, using fallback');
  }

  console.log('\n=== Graceful Degradation ===\n');
  
  const degradation = new GracefulDegradation();
  
  degradation.registerFeature(
    'database',
    async () => {
      throw new Error('Database unavailable');
    },
    async () => {
      return { data: 'from cache', source: 'cache' };
    }
  );

  const result = await degradation.executeFeature('database');
  console.log('Feature result:', result);

  console.log('\n=== Health Check System ===\n');
  
  const healthCheck = new HealthCheckSystem();
  
  healthCheck.registerCheck('database', async () => {
    // Simulate database check
    return Math.random() > 0.3; // 70% success rate
  }, 2000);

  healthCheck.registerCheck('cache', async () => {
    // Simulate cache check
    return Math.random() > 0.2; // 80% success rate
  }, 2000);

  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('Health status:', healthCheck.getStatus());

  console.log('\n=== Bulkhead Pattern ===\n');
  
  const bulkhead = new Bulkhead({ maxPools: 5, poolSize: 3 });
  bulkhead.createPool('database', 2);
  bulkhead.createPool('cache', 3);

  // Execute operations in isolated pools
  const operations = [];
  for (let i = 0; i < 5; i++) {
    operations.push(
      bulkhead.executeInPool('database', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return `DB operation ${i}`;
      })
    );
  }

  await Promise.all(operations);
  console.log('Pool status:', bulkhead.getPoolStatus());
}

if (require.main === module) {
  demonstrateDesignForFailure();
}

module.exports = {
  ResilientService,
  GracefulDegradation,
  HealthCheckSystem,
  Bulkhead,
  SimpleCircuitBreaker
};

