/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests to failing services
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 60 seconds
    this.monitoringWindow = options.monitoringWindow || 60000; // 60 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    this.failures = [];
    this.successes = [];
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, ...args) {
    // Check if circuit should transition
    this.checkState();
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        // Transition to HALF_OPEN
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log('Circuit breaker: OPEN -> HALF_OPEN');
      }
    }
    
    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    const now = Date.now();
    this.successes.push(now);
    this.cleanOldRecords(now);
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) {
        // Close circuit after 2 successes
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        console.log('Circuit breaker: HALF_OPEN -> CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    const now = Date.now();
    this.failures.push(now);
    this.cleanOldRecords(now);
    
    this.failureCount++;
    this.lastFailureTime = now;
    
    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN opens circuit
      this.state = 'OPEN';
      this.nextAttemptTime = now + this.resetTimeout;
      console.log('Circuit breaker: HALF_OPEN -> OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.failureCount >= this.failureThreshold) {
        // Open circuit
        this.state = 'OPEN';
        this.nextAttemptTime = now + this.resetTimeout;
        console.log('Circuit breaker: CLOSED -> OPEN');
      }
    }
  }

  /**
   * Check and update circuit state
   */
  checkState() {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      console.log('Circuit breaker: OPEN -> HALF_OPEN (timeout expired)');
    }
  }

  /**
   * Clean old failure/success records
   */
  cleanOldRecords(now) {
    const cutoff = now - this.monitoringWindow;
    this.failures = this.failures.filter(time => time > cutoff);
    this.successes = this.successes.filter(time => time > cutoff);
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    const now = Date.now();
    const windowStart = now - this.monitoringWindow;
    
    const recentFailures = this.failures.filter(time => time > windowStart).length;
    const recentSuccesses = this.successes.filter(time => time > windowStart).length;
    const total = recentFailures + recentSuccesses;
    const failureRate = total > 0 ? (recentFailures / total) * 100 : 0;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      recentFailures,
      recentSuccesses,
      failureRate: failureRate.toFixed(2) + '%',
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.failures = [];
    this.successes = [];
    console.log('Circuit breaker: RESET -> CLOSED');
  }
}

/**
 * Retry with exponential backoff
 */
class RetryWithBackoff {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.jitter = options.jitter !== false; // Enable jitter by default
  }

  async execute(fn, ...args) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * 2^attempt
    let delay = this.baseDelay * Math.pow(2, attempt);
    
    // Cap at maxDelay
    delay = Math.min(delay, this.maxDelay);
    
    // Add jitter (random variation)
    if (this.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() * 2 - 1) * jitterAmount;
    }
    
    return Math.max(0, Math.floor(delay));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Combined Circuit Breaker + Retry
 */
class ResilientService {
  constructor(options = {}) {
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.retry = new RetryWithBackoff(options.retry);
  }

  async call(fn, ...args) {
    return this.circuitBreaker.execute(
      () => this.retry.execute(fn, ...args),
      ...args
    );
  }

  getStats() {
    return this.circuitBreaker.getStats();
  }
}

// Example usage
async function demonstrateCircuitBreaker() {
  // Simulate a flaky service
  let callCount = 0;
  const flakyService = async () => {
    callCount++;
    // Fail first 7 calls, then succeed
    if (callCount <= 7) {
      throw new Error('Service unavailable');
    }
    return { data: 'Success', callCount };
  };

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 5000 // 5 seconds
  });

  console.log('=== Circuit Breaker Demonstration ===\n');

  // Make requests that will fail
  for (let i = 1; i <= 7; i++) {
    try {
      await circuitBreaker.execute(flakyService);
    } catch (error) {
      console.log(`Request ${i}: ${error.message}`);
      console.log(`State: ${circuitBreaker.getState().state}`);
    }
  }

  // Circuit should be OPEN now
  console.log('\nCircuit is OPEN, requests will be rejected immediately');
  try {
    await circuitBreaker.execute(flakyService);
  } catch (error) {
    console.log(`Request rejected: ${error.message}`);
  }

  // Wait for reset timeout
  console.log('\nWaiting for reset timeout...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  // Circuit should transition to HALF_OPEN
  console.log('\nCircuit is HALF_OPEN, testing service...');
  try {
    const result = await circuitBreaker.execute(flakyService);
    console.log(`Request succeeded:`, result);
  } catch (error) {
    console.log(`Request failed: ${error.message}`);
  }

  // Second success should close circuit
  try {
    const result = await circuitBreaker.execute(flakyService);
    console.log(`Request succeeded:`, result);
    console.log(`State: ${circuitBreaker.getState().state}`);
  } catch (error) {
    console.log(`Request failed: ${error.message}`);
  }

  console.log('\n=== Statistics ===');
  console.log(circuitBreaker.getStats());
}

// Demonstrate retry with exponential backoff
async function demonstrateRetry() {
  console.log('\n=== Retry with Exponential Backoff ===\n');

  let attempt = 0;
  const flakyService = async () => {
    attempt++;
    if (attempt < 3) {
      throw new Error(`Service error (attempt ${attempt})`);
    }
    return { data: 'Success', attempt };
  };

  const retry = new RetryWithBackoff({
    maxRetries: 3,
    baseDelay: 1000
  });

  try {
    const result = await retry.execute(flakyService);
    console.log('Final result:', result);
  } catch (error) {
    console.log('All retries exhausted:', error.message);
  }
}

if (require.main === module) {
  demonstrateCircuitBreaker()
    .then(() => demonstrateRetry())
    .catch(console.error);
}

module.exports = {
  CircuitBreaker,
  RetryWithBackoff,
  ResilientService
};

