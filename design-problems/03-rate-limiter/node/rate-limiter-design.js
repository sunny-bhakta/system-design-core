/**
 * Rate Limiter Design
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * Comprehensive rate limiting system with multiple algorithms and distributed support.
 * 
 * PURPOSE:
 * - Prevent API abuse and DDoS attacks
 * - Ensure fair resource usage
 * - Protect backend services from overload
 * - Enforce usage quotas
 * 
 * ALGORITHMS IMPLEMENTED:
 * 1. Token Bucket: Allows bursts, smooth rate limiting
 * 2. Sliding Window: Precise rate limiting, no burst allowance
 * 3. Fixed Window: Simple, efficient, allows bursts at window boundaries
 * 
 * DISTRIBUTED SUPPORT:
 * - Redis-based distributed rate limiting
 * - Synchronization across multiple servers
 * - Consistent rate limiting in microservices
 * 
 * USE CASES:
 * - API rate limiting
 * - User request throttling
 * - DDoS protection
 * - Resource quota enforcement
 */

/**
 * Token Bucket Rate Limiter
 * 
 * TOKEN BUCKET ALGORITHM:
 * =======================
 * Maintains a bucket of tokens that refill at a constant rate.
 * Each request consumes one token. If bucket is empty, request is denied.
 * 
 * CHARACTERISTICS:
 * - Allows bursts: Can use all tokens at once if available
 * - Smooth rate: Tokens refill continuously
 * - Memory efficient: Only stores per-identifier state
 * 
 * PARAMETERS:
 * - capacity: Maximum tokens in bucket (burst size)
 * - refillRate: Tokens added per second (sustained rate)
 * 
 * EXAMPLE:
 * - capacity: 100, refillRate: 10 tokens/sec
 * - Can handle 100 requests immediately (burst)
 * - Then 10 requests per second (sustained)
 * 
 * PERFORMANCE:
 * - Time Complexity: O(1) per request
 * - Space Complexity: O(n) where n = number of identifiers
 */
class TokenBucketRateLimiter {
  /**
   * Constructor
   * 
   * @param {Object} config - Configuration
   * @param {number} config.capacity - Maximum tokens (default: 100)
   * @param {number} config.refillRate - Tokens per second (default: 10)
   * 
   * DATA STRUCTURES:
   * - tokens: Current token count (global bucket)
   * - lastRefill: Last refill timestamp (global)
   * - requests: Map<identifier, {tokens, lastRefill}> - Per-identifier buckets
   */
  constructor(config) {
    this.capacity = config.capacity || 100; // Max tokens (burst size)
    this.refillRate = config.refillRate || 10; // Tokens per second (sustained rate)
    this.tokens = this.capacity; // Current token count (starts full)
    this.lastRefill = Date.now(); // Last refill timestamp
    this.requests = new Map(); // Per user/IP buckets
  }

  /**
   * Check if request is allowed
   * 
   * TOKEN BUCKET PROCESS:
   * =====================
   * 1. Calculate time elapsed since last refill
   * 2. Refill tokens based on elapsed time and refill rate
   * 3. Cap tokens at capacity (bucket can't overflow)
   * 4. Check per-identifier bucket (create if doesn't exist)
   * 5. Refill per-identifier bucket
   * 6. If identifier has tokens, consume one and allow
   * 7. Otherwise, deny request
   * 
   * REFILL CALCULATION:
   * - tokens = min(capacity, current_tokens + elapsed_time * refill_rate)
   * - Ensures bucket never exceeds capacity
   * - Continuous refill (not discrete)
   * 
   * PER-IDENTIFIER BUCKETS:
   * - Each user/IP has its own bucket
   * - Prevents one user from affecting others
   * - Allows per-user rate limiting
   * 
   * @param {string} identifier - User ID, IP address, or other identifier
   * @returns {Object} {allowed: boolean, remaining: number}
   */
  isAllowed(identifier) {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds

    /**
     * STEP 1: REFILL GLOBAL BUCKET
     * ============================
     * Refill tokens based on elapsed time.
     * Formula: new_tokens = min(capacity, current_tokens + elapsed * refill_rate)
     */
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (elapsed * this.refillRate)
    );
    this.lastRefill = now;

    /**
     * STEP 2: GET/CREATE PER-IDENTIFIER BUCKET
     * =========================================
     * Each identifier (user/IP) has its own bucket.
     * Initialize with full capacity if new.
     */
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, {
        tokens: this.capacity,
        lastRefill: now
      });
    }

    /**
     * STEP 3: REFILL PER-IDENTIFIER BUCKET
     * ====================================
     * Refill this identifier's bucket based on elapsed time.
     */
    const userBucket = this.requests.get(identifier);
    const userElapsed = (now - userBucket.lastRefill) / 1000;
    userBucket.tokens = Math.min(
      this.capacity,
      userBucket.tokens + (userElapsed * this.refillRate)
    );
    userBucket.lastRefill = now;

    /**
     * STEP 4: CHECK AND CONSUME TOKEN
     * ===============================
     * If bucket has at least 1 token, consume it and allow request.
     * Otherwise, deny request.
     */
    if (userBucket.tokens >= 1) {
      userBucket.tokens--;
      return { allowed: true, remaining: userBucket.tokens };
    }

    return { allowed: false, remaining: 0 };
  }

  /**
   * Reset for identifier
   */
  reset(identifier) {
    this.requests.delete(identifier);
  }
}

/**
 * Sliding Window Rate Limiter
 * 
 * SLIDING WINDOW ALGORITHM:
 * =========================
 * Tracks requests in a sliding time window. Only requests within the window count.
 * 
 * CHARACTERISTICS:
 * - Precise rate limiting: No burst allowance
 * - Smooth distribution: Requests spread evenly over window
 * - Memory usage: Stores all request timestamps in window
 * 
 * PARAMETERS:
 * - windowSize: Size of time window in milliseconds
 * - maxRequests: Maximum requests allowed in window
 * 
 * EXAMPLE:
 * - windowSize: 60000ms (1 minute), maxRequests: 100
 * - Allows 100 requests in any 1-minute window
 * - Window slides continuously (not fixed)
 * 
 * TRADE-OFFS:
 * - More accurate than fixed window
 * - Higher memory usage (stores timestamps)
 * - More computation (filter old requests)
 * 
 * PERFORMANCE:
 * - Time Complexity: O(n) where n = requests in window
 * - Space Complexity: O(n) where n = requests in window
 */
class SlidingWindowRateLimiter {
  /**
   * Constructor
   * 
   * @param {Object} config - Configuration
   * @param {number} config.windowSize - Window size in milliseconds (default: 60000 = 1 minute)
   * @param {number} config.maxRequests - Max requests in window (default: 100)
   * 
   * DATA STRUCTURES:
   * - requests: Map<identifier, Array<timestamp>> - Request timestamps per identifier
   */
  constructor(config) {
    this.windowSize = config.windowSize || 60000; // 1 minute
    this.maxRequests = config.maxRequests || 100;
    this.requests = new Map(); // identifier -> array of timestamps
  }

  /**
   * Check if request is allowed
   * 
   * SLIDING WINDOW PROCESS:
   * =======================
   * 1. Get or create request history for identifier
   * 2. Calculate window start time (now - windowSize)
   * 3. Filter out requests outside window (older than windowStart)
   * 4. If remaining requests < maxRequests, allow and add timestamp
   * 5. Otherwise, deny request
   * 
   * WINDOW SLIDING:
   * - Window continuously slides forward in time
   * - Old requests automatically expire
   * - No fixed boundaries (unlike fixed window)
   * 
   * MEMORY MANAGEMENT:
   * - Old timestamps are removed on each check
   * - In production: Use Redis with sorted sets for efficiency
   * - TTL-based cleanup for expired entries
   * 
   * @param {string} identifier - User ID, IP address, or other identifier
   * @returns {Object} {allowed: boolean, remaining: number}
   */
  isAllowed(identifier) {
    const now = Date.now();
    
    /**
     * STEP 1: GET/CREATE REQUEST HISTORY
     * ==================================
     * Each identifier has its own array of request timestamps.
     */
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const userRequests = this.requests.get(identifier);
    
    /**
     * STEP 2: FILTER OLD REQUESTS
     * ============================
     * Remove requests outside the sliding window.
     * Window start = current time - window size.
     * Only keep timestamps within the window.
     */
    const windowStart = now - this.windowSize;
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(identifier, validRequests);

    /**
     * STEP 3: CHECK LIMIT AND RECORD REQUEST
     * =======================================
     * If valid requests < maxRequests, allow and record timestamp.
     * Otherwise, deny request.
     */
    if (validRequests.length < this.maxRequests) {
      validRequests.push(now);
      return { allowed: true, remaining: this.maxRequests - validRequests.length };
    }

    return { allowed: false, remaining: 0 };
  }
}

/**
 * Fixed Window Rate Limiter
 * 
 * FIXED WINDOW ALGORITHM:
 * =======================
 * Divides time into fixed windows. Each window has a request limit.
 * 
 * CHARACTERISTICS:
 * - Simple and efficient: Just increment counter
 * - Memory efficient: Only stores counter per window
 * - Allows bursts: All requests can occur at window start
 * 
 * PARAMETERS:
 * - windowSize: Size of time window in milliseconds
 * - maxRequests: Maximum requests allowed per window
 * 
 * EXAMPLE:
 * - windowSize: 60000ms (1 minute), maxRequests: 100
 * - Window 0: 0-59999ms, Window 1: 60000-119999ms, etc.
 * - Each window allows up to 100 requests
 * 
 * TRADE-OFFS:
 * - Simple implementation
 * - Allows bursts at window boundaries
 * - Less accurate than sliding window
 * 
 * PERFORMANCE:
 * - Time Complexity: O(1) per request
 * - Space Complexity: O(n) where n = active windows
 */
class FixedWindowRateLimiter {
  /**
   * Constructor
   * 
   * @param {Object} config - Configuration
   * @param {number} config.windowSize - Window size in milliseconds (default: 60000)
   * @param {number} config.maxRequests - Max requests per window (default: 100)
   * 
   * DATA STRUCTURES:
   * - windows: Map<"identifier:windowNumber", count> - Request count per window
   */
  constructor(config) {
    this.windowSize = config.windowSize || 60000; // 1 minute
    this.maxRequests = config.maxRequests || 100;
    this.windows = new Map(); // "identifier:window" -> count
  }

  /**
   * Get current window number
   * 
   * WINDOW CALCULATION:
   * ===================
   * Divides current time by window size to get window number.
   * Example: If windowSize = 60000ms (1 minute):
   * - 0-59999ms → Window 0
   * - 60000-119999ms → Window 1
   * - 120000-179999ms → Window 2
   * 
   * @returns {number} Current window number
   */
  getCurrentWindow() {
    return Math.floor(Date.now() / this.windowSize);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier) {
    const currentWindow = this.getCurrentWindow();
    const key = `${identifier}:${currentWindow}`;

    if (!this.windows.has(key)) {
      this.windows.set(key, 0);
    }

    const count = this.windows.get(key);

    if (count < this.maxRequests) {
      this.windows.set(key, count + 1);
      return { allowed: true, remaining: this.maxRequests - count - 1 };
    }

    return { allowed: false, remaining: 0 };
  }
}

/**
 * Distributed Rate Limiter
 */
class DistributedRateLimiter {
  constructor(config = {}) {
    this.algorithm = config.algorithm || 'sliding-window';
    this.limiters = new Map();
    this.redis = config.redis || null; // Simulated Redis
    this.syncInterval = config.syncInterval || 1000;
  }

  /**
   * Create limiter for algorithm
   */
  getLimiter(algorithm) {
    if (!this.limiters.has(algorithm)) {
      switch (algorithm) {
        case 'token-bucket':
          this.limiters.set(algorithm, new TokenBucketRateLimiter({
            capacity: 100,
            refillRate: 10
          }));
          break;
        case 'sliding-window':
          this.limiters.set(algorithm, new SlidingWindowRateLimiter({
            windowSize: 60000,
            maxRequests: 100
          }));
          break;
        case 'fixed-window':
          this.limiters.set(algorithm, new FixedWindowRateLimiter({
            windowSize: 60000,
            maxRequests: 100
          }));
          break;
        default:
          throw new Error(`Unknown algorithm: ${algorithm}`);
      }
    }
    return this.limiters.get(algorithm);
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(identifier, algorithm = null) {
    const algo = algorithm || this.algorithm;
    const limiter = this.getLimiter(algo);

    // In distributed setup, would check Redis
    if (this.redis) {
      return await this.checkDistributed(identifier, algo);
    }

    return limiter.isAllowed(identifier);
  }

  /**
   * Check distributed (simulated)
   */
  async checkDistributed(identifier, algorithm) {
    // Simulate Redis check
    const key = `ratelimit:${algorithm}:${identifier}`;
    // In real implementation, would use Redis INCR with TTL
    return { allowed: true, remaining: 50 };
  }
}

/**
 * Rate Limiter Middleware
 */
class RateLimiterMiddleware {
  constructor(rateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Express-style middleware
   */
  middleware(options = {}) {
    return async (req, res, next) => {
      const identifier = this.getIdentifier(req, options);
      const algorithm = options.algorithm || 'sliding-window';

      const result = await this.rateLimiter.isAllowed(identifier, algorithm);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: this.calculateRetryAfter(algorithm)
        });
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', options.maxRequests || 100);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', this.getResetTime(algorithm));

      next();
    };
  }

  getIdentifier(req, options) {
    if (options.keyGenerator) {
      return options.keyGenerator(req);
    }
    return req.ip || req.user?.id || 'anonymous';
  }

  calculateRetryAfter(algorithm) {
    // Simplified - would calculate based on window
    return 60; // seconds
  }

  getResetTime(algorithm) {
    return Math.floor(Date.now() / 1000) + 60;
  }
}

// Example usage
async function demonstrateRateLimiter() {
  console.log('=== Rate Limiter Design ===\n');

  // Token Bucket
  console.log('=== Token Bucket ===\n');
  const tokenBucket = new TokenBucketRateLimiter({
    capacity: 10,
    refillRate: 2 // 2 tokens per second
  });

  for (let i = 0; i < 15; i++) {
    const result = tokenBucket.isAllowed('user1');
    console.log(`Request ${i + 1}:`, result.allowed ? 'Allowed' : 'Blocked', `(Remaining: ${result.remaining})`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Sliding Window
  console.log('\n=== Sliding Window ===\n');
  const slidingWindow = new SlidingWindowRateLimiter({
    windowSize: 5000, // 5 seconds
    maxRequests: 5
  });

  for (let i = 0; i < 10; i++) {
    const result = slidingWindow.isAllowed('user2');
    console.log(`Request ${i + 1}:`, result.allowed ? 'Allowed' : 'Blocked');
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Distributed Rate Limiter
  console.log('\n=== Distributed Rate Limiter ===\n');
  const distributed = new DistributedRateLimiter({
    algorithm: 'sliding-window'
  });

  const result1 = await distributed.isAllowed('user3', 'token-bucket');
  const result2 = await distributed.isAllowed('user3', 'sliding-window');
  console.log('Token Bucket Result:', result1);
  console.log('Sliding Window Result:', result2);
}

if (require.main === module) {
  demonstrateRateLimiter();
}

module.exports = {
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter,
  FixedWindowRateLimiter,
  DistributedRateLimiter,
  RateLimiterMiddleware
};

