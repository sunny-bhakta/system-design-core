/**
 * Fault Tolerance Implementation
 * Demonstrates building fault-tolerant systems that continue operating despite failures
 */

/**
 * Fault Tolerant Service
 */
class FaultTolerantService {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.timeout = config.timeout || 5000;
    this.circuitBreaker = config.circuitBreaker;
    this.fallback = config.fallback;
    this.bulkhead = config.bulkhead;
  }

  /**
   * Execute with fault tolerance
   */
  async execute(operation, ...args) {
    // Check circuit breaker
    if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
      if (this.fallback) {
        return await this.fallback(...args);
      }
      throw new Error('Circuit breaker is open');
    }

    // Execute in bulkhead if configured
    if (this.bulkhead) {
      return await this.bulkhead.execute(async () => {
        return await this.executeWithRetry(operation, ...args);
      });
    }

    return await this.executeWithRetry(operation, ...args);
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(operation, ...args) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Execute with timeout
        const result = await Promise.race([
          operation(...args),
          this.createTimeout()
        ]);

        // Record success in circuit breaker
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
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed - use fallback
    if (this.fallback) {
      console.log('All retries failed. Using fallback.');
      return await this.fallback(...args);
    }

    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt) {
    return this.retryDelay * Math.pow(2, attempt);
  }

  /**
   * Create timeout promise
   */
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
 * Circuit Breaker
 */
class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 60000;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed'; // closed, open, half-open
    this.halfOpenSuccessThreshold = config.halfOpenSuccessThreshold || 2;
  }

  canExecute() {
    if (this.state === 'open') {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        this.successCount = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.successCount++;
    
    if (this.state === 'half-open') {
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      canExecute: this.canExecute()
    };
  }

  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Bulkhead Pattern
 * Isolates resources to prevent cascading failures
 */
class Bulkhead {
  constructor(config) {
    this.maxConcurrent = config.maxConcurrent || 5;
    this.queue = [];
    this.active = 0;
  }

  async execute(operation) {
    // Wait if at capacity
    if (this.active >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }

    this.active++;

    try {
      const result = await operation();
      return result;
    } finally {
      this.active--;
      
      // Process next in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  getStatus() {
    return {
      active: this.active,
      maxConcurrent: this.maxConcurrent,
      queued: this.queue.length
    };
  }
}

/**
 * Timeout Pattern
 */
class TimeoutWrapper {
  constructor(timeout) {
    this.timeout = timeout;
  }

  async execute(operation) {
    return await Promise.race([
      operation(),
      this.createTimeout()
    ]);
  }

  createTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), this.timeout);
    });
  }
}

/**
 * Retry with Exponential Backoff
 */
class ExponentialBackoffRetry {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.initialDelay = config.initialDelay || 1000;
    this.maxDelay = config.maxDelay || 10000;
    this.multiplier = config.multiplier || 2;
    this.jitter = config.jitter !== false;
  }

  async execute(operation) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries - 1) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  calculateDelay(attempt) {
    let delay = this.initialDelay * Math.pow(this.multiplier, attempt);
    delay = Math.min(delay, this.maxDelay);

    if (this.jitter) {
      // Add random jitter (±20%)
      const jitterAmount = delay * 0.2;
      delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }

    return Math.round(delay);
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
  }

  registerFeature(name, primary, fallback) {
    this.features.set(name, { primary, fallback });
  }

  async executeFeature(name, ...args) {
    const feature = this.features.get(name);
    if (!feature) {
      throw new Error(`Feature ${name} not registered`);
    }

    try {
      return await feature.primary(...args);
    } catch (error) {
      console.warn(`Feature ${name} failed, using fallback:`, error.message);
      
      if (feature.fallback) {
        return await feature.fallback(...args);
      }

      throw error;
    }
  }
}

/**
 * Health Check with Auto-Recovery
 */
class HealthCheckWithRecovery {
  constructor(service, config = {}) {
    this.service = service;
    this.checkInterval = config.checkInterval || 5000;
    this.recoveryAttempts = config.recoveryAttempts || 3;
    this.healthy = true;
    this.recoveryInProgress = false;
  }

  start() {
    const check = async () => {
      try {
        const isHealthy = await this.service.healthCheck();
        
        if (!isHealthy && this.healthy) {
          console.log('Service became unhealthy. Attempting recovery...');
          this.healthy = false;
          this.attemptRecovery();
        } else if (isHealthy && !this.healthy) {
          console.log('Service recovered.');
          this.healthy = true;
          this.recoveryInProgress = false;
        }
      } catch (error) {
        console.error('Health check failed:', error.message);
      }

      setTimeout(check, this.checkInterval);
    };

    check();
  }

  async attemptRecovery() {
    if (this.recoveryInProgress) return;
    
    this.recoveryInProgress = true;

    for (let attempt = 0; attempt < this.recoveryAttempts; attempt++) {
      try {
        await this.service.recover();
        const isHealthy = await this.service.healthCheck();
        
        if (isHealthy) {
          this.healthy = true;
          this.recoveryInProgress = false;
          return;
        }
      } catch (error) {
        console.warn(`Recovery attempt ${attempt + 1} failed:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.recoveryInProgress = false;
  }
}

// Example usage
async function demonstrateFaultTolerance() {
  console.log('=== Fault Tolerance ===\n');

  // Circuit Breaker
  console.log('=== Circuit Breaker ===\n');
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 5000
  });

  let failureCount = 0;
  const flakyOperation = async () => {
    failureCount++;
    if (failureCount < 5) {
      throw new Error('Temporary failure');
    }
    return { success: true };
  };

  for (let i = 0; i < 10; i++) {
    if (circuitBreaker.canExecute()) {
      try {
        await flakyOperation();
        circuitBreaker.recordSuccess();
        console.log(`Request ${i}: Success`);
      } catch (error) {
        circuitBreaker.recordFailure();
        console.log(`Request ${i}: Failed - ${circuitBreaker.getState().state}`);
      }
    } else {
      console.log(`Request ${i}: Circuit breaker open`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Fault Tolerant Service
  console.log('\n=== Fault Tolerant Service ===\n');
  const faultTolerant = new FaultTolerantService({
    maxRetries: 3,
    retryDelay: 500,
    timeout: 2000,
    circuitBreaker,
    fallback: async () => ({ result: 'fallback', source: 'cache' })
  });

  try {
    const result = await faultTolerant.execute(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { data: 'success' };
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Bulkhead
  console.log('\n=== Bulkhead Pattern ===\n');
  const bulkhead = new Bulkhead({ maxConcurrent: 3 });

  const operations = [];
  for (let i = 0; i < 10; i++) {
    operations.push(
      bulkhead.execute(async () => {
        console.log(`Operation ${i} started`);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`Operation ${i} completed`);
        return i;
      })
    );
  }

  await Promise.all(operations);
  console.log('Bulkhead status:', bulkhead.getStatus());
}

if (require.main === module) {
  demonstrateFaultTolerance();
}

module.exports = {
  FaultTolerantService,
  CircuitBreaker,
  Bulkhead,
  TimeoutWrapper,
  ExponentialBackoffRetry,
  GracefulDegradation,
  HealthCheckWithRecovery
};

