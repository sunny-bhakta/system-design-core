/**
 * Rate Limiter Implementation
 * Demonstrates different rate limiting algorithms
 */

/**
 * Token Bucket Rate Limiter
 */
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity; // Maximum tokens
    this.refillRate = refillRate; // Tokens per second
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  tryConsume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { allowed: true, remaining: this.tokens };
    }
    
    return { allowed: false, remaining: this.tokens };
  }

  /**
   * Refill tokens based on time elapsed
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getTokens() {
    this.refill();
    return this.tokens;
  }
}

/**
 * Leaky Bucket Rate Limiter
 */
class LeakyBucket {
  constructor(capacity, leakRate) {
    this.capacity = capacity; // Maximum requests
    this.leakRate = leakRate; // Requests per second
    this.queue = [];
    this.lastLeak = Date.now();
  }

  /**
   * Try to add request
   */
  tryAdd() {
    this.leak();
    
    if (this.queue.length < this.capacity) {
      this.queue.push(Date.now());
      return { allowed: true, queueSize: this.queue.length };
    }
    
    return { allowed: false, queueSize: this.queue.length };
  }

  /**
   * Leak requests based on time elapsed
   */
  leak() {
    const now = Date.now();
    const elapsed = (now - this.lastLeak) / 1000; // Convert to seconds
    const requestsToRemove = Math.floor(elapsed * this.leakRate);
    
    // Remove oldest requests
    for (let i = 0; i < requestsToRemove && this.queue.length > 0; i++) {
      this.queue.shift();
    }
    
    this.lastLeak = now;
  }

  /**
   * Get current queue size
   */
  getQueueSize() {
    this.leak();
    return this.queue.length;
  }
}

/**
 * Fixed Window Rate Limiter
 */
class FixedWindow {
  constructor(maxRequests, windowSize) {
    this.maxRequests = maxRequests;
    this.windowSize = windowSize; // in milliseconds
    this.windows = new Map(); // window start time -> count
  }

  /**
   * Get current window start time
   */
  getCurrentWindow() {
    const now = Date.now();
    return Math.floor(now / this.windowSize) * this.windowSize;
  }

  /**
   * Try to make request
   */
  tryRequest() {
    const window = this.getCurrentWindow();
    
    // Clean old windows
    this.cleanup();
    
    // Get or create window
    const count = this.windows.get(window) || 0;
    
    if (count < this.maxRequests) {
      this.windows.set(window, count + 1);
      return { allowed: true, remaining: this.maxRequests - count - 1 };
    }
    
    return { allowed: false, remaining: 0 };
  }

  /**
   * Cleanup old windows
   */
  cleanup() {
    const currentWindow = this.getCurrentWindow();
    for (const [window] of this.windows) {
      if (window < currentWindow - this.windowSize) {
        this.windows.delete(window);
      }
    }
  }

  /**
   * Get current count
   */
  getCount() {
    this.cleanup();
    const window = this.getCurrentWindow();
    return this.windows.get(window) || 0;
  }
}

/**
 * Sliding Window Rate Limiter
 */
class SlidingWindow {
  constructor(maxRequests, windowSize) {
    this.maxRequests = maxRequests;
    this.windowSize = windowSize; // in milliseconds
    this.requests = []; // Timestamps of requests
  }

  /**
   * Try to make request
   */
  tryRequest() {
    const now = Date.now();
    
    // Remove requests outside window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowSize
    );
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return { allowed: true, remaining: this.maxRequests - this.requests.length };
    }
    
    // Calculate time until next request allowed
    const oldestRequest = this.requests[0];
    const waitTime = this.windowSize - (now - oldestRequest);
    
    return { 
      allowed: false, 
      remaining: 0,
      retryAfter: Math.ceil(waitTime / 1000) // in seconds
    };
  }

  /**
   * Get current count
   */
  getCount() {
    const now = Date.now();
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowSize
    );
    return this.requests.length;
  }
}

// Example usage
function demonstrateRateLimiters() {
  console.log('=== Rate Limiting Demonstration ===\n');

  // Token Bucket
  console.log('1. Token Bucket (Capacity: 10, Refill: 2/sec)');
  const tokenBucket = new TokenBucket(10, 2);
  for (let i = 0; i < 12; i++) {
    const result = tokenBucket.tryConsume();
    console.log(`Request ${i + 1}: ${result.allowed ? 'Allowed' : 'Denied'} (Tokens: ${result.remaining.toFixed(2)})`);
  }

  // Leaky Bucket
  console.log('\n2. Leaky Bucket (Capacity: 5, Leak: 2/sec)');
  const leakyBucket = new LeakyBucket(5, 2);
  for (let i = 0; i < 7; i++) {
    const result = leakyBucket.tryAdd();
    console.log(`Request ${i + 1}: ${result.allowed ? 'Allowed' : 'Denied'} (Queue: ${result.queueSize})`);
  }

  // Fixed Window
  console.log('\n3. Fixed Window (Max: 5, Window: 1000ms)');
  const fixedWindow = new FixedWindow(5, 1000);
  for (let i = 0; i < 7; i++) {
    const result = fixedWindow.tryRequest();
    console.log(`Request ${i + 1}: ${result.allowed ? 'Allowed' : 'Denied'} (Remaining: ${result.remaining})`);
  }

  // Sliding Window
  console.log('\n4. Sliding Window (Max: 5, Window: 1000ms)');
  const slidingWindow = new SlidingWindow(5, 1000);
  for (let i = 0; i < 7; i++) {
    const result = slidingWindow.tryRequest();
    console.log(`Request ${i + 1}: ${result.allowed ? 'Allowed' : 'Denied'} (Remaining: ${result.remaining})`);
    if (!result.allowed && result.retryAfter) {
      console.log(`  Retry after: ${result.retryAfter}s`);
    }
  }
}

if (require.main === module) {
  demonstrateRateLimiters();
}

module.exports = {
  TokenBucket,
  LeakyBucket,
  FixedWindow,
  SlidingWindow
};

