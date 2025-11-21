/**
 * Rate Limiter Design
 * Comprehensive rate limiting system with multiple algorithms and distributed support
 */

/**
 * Token Bucket Rate Limiter
 */
class TokenBucketRateLimiter {
  constructor(config) {
    this.capacity = config.capacity || 100; // Max tokens
    this.refillRate = config.refillRate || 10; // Tokens per second
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.requests = new Map(); // Per user/IP
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier) {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds

    // Refill tokens
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (elapsed * this.refillRate)
    );
    this.lastRefill = now;

    // Check per-identifier bucket
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, {
        tokens: this.capacity,
        lastRefill: now
      });
    }

    const userBucket = this.requests.get(identifier);
    const userElapsed = (now - userBucket.lastRefill) / 1000;
    userBucket.tokens = Math.min(
      this.capacity,
      userBucket.tokens + (userElapsed * this.refillRate)
    );
    userBucket.lastRefill = now;

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
 */
class SlidingWindowRateLimiter {
  constructor(config) {
    this.windowSize = config.windowSize || 60000; // 1 minute
    this.maxRequests = config.maxRequests || 100;
    this.requests = new Map();
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier) {
    const now = Date.now();
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const userRequests = this.requests.get(identifier);
    
    // Remove old requests outside window
    const windowStart = now - this.windowSize;
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    this.requests.set(identifier, validRequests);

    if (validRequests.length < this.maxRequests) {
      validRequests.push(now);
      return { allowed: true, remaining: this.maxRequests - validRequests.length };
    }

    return { allowed: false, remaining: 0 };
  }
}

/**
 * Fixed Window Rate Limiter
 */
class FixedWindowRateLimiter {
  constructor(config) {
    this.windowSize = config.windowSize || 60000; // 1 minute
    this.maxRequests = config.maxRequests || 100;
    this.windows = new Map();
  }

  /**
   * Get current window
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

