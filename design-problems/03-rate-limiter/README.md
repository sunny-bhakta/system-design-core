# Rate Limiter

## Problem Statement

Design a rate limiting system that restricts the number of requests a user can make within a time window.

## Requirements

### Functional Requirements
- Limit requests per user/IP address
- Support multiple rate limit algorithms
- Different limits for different endpoints
- Distributed rate limiting across servers
- Return rate limit information in headers

### Non-Functional Requirements
- Low latency (< 1ms overhead)
- High throughput (millions of requests/second)
- Accurate rate limiting
- Memory efficient

## Capacity Estimation

### Traffic Estimates
- **Total requests:** 1M requests/second
- **Unique users/IPs:** 100K active users
- **Rate limit checks:** 1M checks/second
- **Storage:** 100K users * 100 bytes = 10MB

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Rate        │────▶│  Backend   │
│             │     │  Limiter     │     │  Service   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Redis/      │
                    │  Cache       │
                    └──────────────┘
```

### Rate Limiting Algorithms

#### 1. Token Bucket
- **Concept:** Tokens added at fixed rate, requests consume tokens
- **Pros:** Allows bursts, smooth rate
- **Cons:** More complex
- **Use case:** API rate limiting

#### 2. Leaky Bucket
- **Concept:** Requests added to bucket, processed at fixed rate
- **Pros:** Smooth output rate
- **Cons:** No bursts allowed
- **Use case:** Traffic shaping

#### 3. Fixed Window
- **Concept:** Count requests in fixed time window
- **Pros:** Simple, memory efficient
- **Cons:** Burst at window boundary
- **Use case:** Simple rate limiting

#### 4. Sliding Window
- **Concept:** Count requests in sliding time window
- **Pros:** More accurate, no boundary bursts
- **Cons:** More memory, complex
- **Use case:** Accurate rate limiting

### API Design

#### Check Rate Limit
```
GET /api/v1/resource
Headers:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1640995200

Response:
  200 OK (if allowed)
  429 Too Many Requests (if exceeded)
  {
    "error": "Rate limit exceeded",
    "retryAfter": 60
  }
```

### Distributed Rate Limiting

#### Redis-based
- Use Redis INCR with TTL
- Atomic operations
- Shared state across servers
- Example:
  ```
  INCR user:123:requests
  EXPIRE user:123:requests 60
  ```

#### Consistent Hashing
- Route same user to same server
- Local rate limiting
- No shared state needed
- Lower latency

## Data Structures

### Token Bucket Data Structures
- **tokens:** Current token count (global bucket)
- **lastRefill:** Last refill timestamp (global)
- **requests:** Map<identifier, {tokens, lastRefill}> - Per-identifier buckets

### Sliding Window Data Structures
- **requests:** Map<identifier, Array<timestamp>> - Request timestamps per identifier
- Stores all request timestamps within the window

### Fixed Window Data Structures
- **windows:** Map<"identifier:windowNumber", count> - Request count per window
- Key format: "identifier:windowNumber" (e.g., "user123:12345")

## Process Flow

### Token Bucket Process

1. **Calculate Elapsed Time:** Time since last refill
2. **Refill Global Bucket:** Add tokens based on elapsed time and refill rate
3. **Cap at Capacity:** Ensure bucket doesn't exceed capacity
4. **Get/Create Per-Identifier Bucket:** Initialize if new identifier
5. **Refill Per-Identifier Bucket:** Add tokens based on elapsed time
6. **Check Tokens:** If identifier has tokens, consume one and allow
7. **Deny if Empty:** Otherwise, deny request

### Sliding Window Process

1. **Get/Create Request History:** Array of timestamps for identifier
2. **Calculate Window Start:** Current time - window size
3. **Filter Old Requests:** Remove timestamps outside window
4. **Check Limit:** If valid requests < maxRequests, allow and record
5. **Deny if Exceeded:** Otherwise, deny request

### Fixed Window Process

1. **Calculate Current Window:** Floor(current time / window size)
2. **Create Window Key:** "identifier:windowNumber"
3. **Get/Create Counter:** Initialize if new window
4. **Check Limit:** If count < maxRequests, increment and allow
5. **Deny if Exceeded:** Otherwise, deny request

## Algorithm Details

### Token Bucket Algorithm

#### Refill Formula
```
new_tokens = min(capacity, current_tokens + elapsed_time * refill_rate)
```

#### Characteristics
- **Burst Allowance:** Can use all tokens at once if available
- **Smooth Rate:** Tokens refill continuously
- **Memory Efficient:** Only stores per-identifier state

#### Example
- Capacity: 100 tokens, Refill Rate: 10 tokens/sec
- Can handle 100 requests immediately (burst)
- Then 10 requests per second (sustained rate)

### Sliding Window Algorithm

#### Window Calculation
```
window_start = current_time - window_size
valid_requests = requests.filter(timestamp > window_start)
```

#### Characteristics
- **Precise:** No burst allowance
- **Smooth Distribution:** Requests spread evenly
- **Memory Usage:** Stores all timestamps in window

#### Example
- Window Size: 60000ms (1 minute), Max Requests: 100
- Allows 100 requests in any 1-minute sliding window
- Window continuously slides forward

### Fixed Window Algorithm

#### Window Calculation
```
window_number = floor(current_time / window_size)
window_key = "identifier:window_number"
```

#### Characteristics
- **Simple:** Just increment counter
- **Memory Efficient:** Only stores counter per window
- **Burst at Boundary:** All requests can occur at window start

#### Example
- Window Size: 60000ms (1 minute), Max Requests: 100
- Window 0: 0-59999ms, Window 1: 60000-119999ms
- Each window allows up to 100 requests

## Performance Considerations

### Time Complexity
- **Token Bucket:** O(1) per request
- **Sliding Window:** O(n) where n = requests in window
- **Fixed Window:** O(1) per request

### Space Complexity
- **Token Bucket:** O(n) where n = number of identifiers
- **Sliding Window:** O(n * m) where n = identifiers, m = requests per window
- **Fixed Window:** O(n * w) where n = identifiers, w = active windows

### Latency Targets
- **Rate Limit Check:** < 1ms overhead
- **Redis Lookup:** < 5ms (distributed)
- **Total Impact:** < 10ms per request

## Distributed Rate Limiting

### Redis-Based Implementation

#### Redis Commands
```redis
# Increment counter with TTL
INCR user:123:requests
EXPIRE user:123:requests 60

# Or use INCR with TTL in one command
INCR user:123:requests
EXPIRE user:123:requests 60
```

#### Benefits
- **Shared State:** Consistent across all servers
- **Atomic Operations:** No race conditions
- **TTL Support:** Automatic expiration
- **High Performance:** Sub-millisecond latency

### Synchronization Strategy
- **Centralized:** All servers check same Redis instance
- **Sharding:** Distribute by identifier hash
- **Replication:** Redis cluster for high availability

## Implementation

### Node.js Implementation

See [Node.js Code](./node/rate-limiter-design.js)

**Key features:**
- Token Bucket algorithm with per-identifier buckets
- Sliding Window algorithm with timestamp tracking
- Fixed Window algorithm with window-based counting
- Distributed support with Redis simulation
- Express middleware integration
- Multiple algorithm support

**Code includes comprehensive comments covering:**
- System design concepts
- Algorithm explanations
- Data structures
- Process flows
- Performance considerations
- Distributed implementation
- Production considerations

### Usage Example

```javascript
const { TokenBucketRateLimiter } = require('./node/rate-limiter-design');

const limiter = new TokenBucketRateLimiter({
  capacity: 100,
  refillRate: 10 // 10 tokens per second
});

const result = limiter.isAllowed('user123');
if (result.allowed) {
  // Process request
} else {
  // Rate limit exceeded
}
```

## Performance Optimization

### Caching
- Cache rate limit state in memory
- Periodic sync with Redis
- Reduce Redis calls

### Batching
- Batch Redis operations
- Reduce network round trips
- Improve throughput

### Pre-computation
- Pre-compute token refills
- Reduce calculation overhead
- Faster checks

## Monitoring

### Key Metrics
- **Rate limit hits:** Number of blocked requests
- **Rate limit misses:** Number of allowed requests
- **Latency:** P50, P95, P99 latencies
- **Error rate:** Failed rate limit checks

### Alerts
- High rate limit hit rate
- High latency
- Redis connection failures
- Memory usage

## Trade-offs

### Accuracy vs Performance
- **More accurate:** Sliding window, higher memory
- **Less accurate:** Fixed window, lower memory

### Centralized vs Distributed
- **Centralized (Redis):** Accurate, higher latency
- **Distributed (local):** Lower latency, less accurate

### Memory vs CPU
- **More memory:** Cache more state, faster
- **Less memory:** Recalculate, slower

## Further Enhancements

1. **Dynamic limits:** Adjust based on user tier
2. **Whitelisting:** Bypass for trusted users
3. **Rate limit headers:** Standard HTTP headers
4. **Quotas:** Daily/monthly limits
5. **Rate limit sharing:** Share limits across endpoints
6. **Adaptive limits:** Adjust based on system load

