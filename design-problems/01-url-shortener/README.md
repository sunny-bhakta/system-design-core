# URL Shortener (TinyURL, bit.ly)

## Problem Statement

Design a URL shortening service like TinyURL or bit.ly that converts long URLs into short, shareable links.

## Requirements

### Functional Requirements
- Shorten long URLs into short codes
- Redirect short URLs to original URLs
- Support custom short URLs (optional)
- URL expiration (optional)
- Analytics tracking (clicks, referrers, countries, devices)
- User accounts to manage their URLs

### Non-Functional Requirements
- High availability (99.9% uptime)
- Low latency (< 100ms for redirect)
- Scalable to billions of URLs
- Durable (URLs should persist)
- Secure (prevent abuse, malicious URLs)

## Capacity Estimation

### Traffic Estimates
- **Write requests:** 100M URLs/day = ~1,160 URLs/second
- **Read requests:** 100:1 read/write ratio = 100M * 100 = 10B reads/day = ~116K reads/second
- **Peak traffic:** 2x average = ~232K reads/second

### Storage Estimates
- **URL storage:** 100M URLs * 500 bytes = 50GB/year
- **Analytics:** 10B clicks * 100 bytes = 1TB/year
- **Total:** ~1.05TB/year

### Bandwidth Estimates
- **Write:** 1,160 URLs/sec * 500 bytes = 580KB/sec
- **Read:** 116K reads/sec * 500 bytes = 58MB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  App        │
│             │     │  Balancer    │     │  Servers    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │  Cache (Redis)   │
                                    │  Hot URLs (20%)  │
                                    └─────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │  Database        │
                                    │  (SQL/NoSQL)    │
                                    │  Sharded        │
                                    └─────────────────┘
```

### API Design

#### Shorten URL
```
POST /api/v1/shorten
Request:
{
  "longURL": "https://www.example.com/very/long/url",
  "userId": "user123", (optional)
  "customCode": "mycode", (optional)
  "expiresIn": 86400000 (optional, milliseconds)
  "expiresAt": "2024-12-31T23:59:59Z" (optional, ISO date string)
}

Response:
{
  "shortURL": "https://short.ly/abc123",
  "code": "abc123",
  "longURL": "https://www.example.com/very/long/url",
  "expiresAt": "2024-12-31T23:59:59Z" (null if no expiration),
  "isCustom": false
}
```

**Custom Code Rules:**
- Must be 3-20 characters long
- Can only contain alphanumeric characters and hyphens
- Cannot use reserved codes (api, admin, www, mail, etc.)
- Must be unique

**Expiration Options:**
- `expiresIn`: Time to live in milliseconds (e.g., 86400000 for 1 day)
- `expiresAt`: Specific expiration date/time (ISO 8601 format)
- If neither provided, URL is permanent

#### Expand URL
```
GET /{shortCode}
Response: 301 Redirect to original URL
```

#### Get Analytics
```
GET /api/v1/analytics/{code}
Response:
{
  "code": "abc123",
  "longURL": "https://www.example.com/very/long/url",
  "totalClicks": 1234,
  "createdAt": "2024-01-01T00:00:00Z",
  "referrers": {
    "twitter": 500,
    "facebook": 300,
    "direct": 434
  },
  "countries": {
    "US": 800,
    "UK": 200,
    "IN": 234
  },
  "devices": {
    "mobile": 700,
    "desktop": 534
  }
}
```

#### Set Expiration
```
PUT /api/v1/urls/{code}/expiration
Request:
{
  "expiresIn": 7200000 (optional, milliseconds)
  "expiresAt": "2024-12-31T23:59:59Z" (optional)
}

Response:
{
  "code": "abc123",
  "expiresAt": "2024-12-31T23:59:59Z",
  "isCustom": false
}
```

#### Remove Expiration
```
DELETE /api/v1/urls/{code}/expiration
Response:
{
  "code": "abc123",
  "expiresAt": null
}
```

#### Get Expiration Info
```
GET /api/v1/urls/{code}/expiration
Response:
{
  "code": "abc123",
  "expiresAt": "2024-12-31T23:59:59Z",
  "isExpired": false,
  "timeRemaining": 604800000,
  "timeRemainingFormatted": "7 day(s)",
  "isCustom": false
}
```

### Database Schema

#### URLs Table
```sql
CREATE TABLE urls (
  id BIGINT PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  click_count BIGINT DEFAULT 0,
  is_custom BOOLEAN DEFAULT FALSE,
  INDEX idx_code (code),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_created_at (created_at)
);
```

**Indexing Strategy:**
- `code`: Primary lookup (most frequent)
- `user_id`: For user's URLs query
- `expires_at`: For cleanup jobs
- `created_at`: For sorting user URLs

#### Analytics Table
```sql
CREATE TABLE analytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(10) NOT NULL,
  click_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  referrer VARCHAR(255),
  country VARCHAR(2),
  device VARCHAR(20),
  ip_address VARCHAR(45),
  INDEX idx_code_time (code, click_time),
  INDEX idx_code (code)
);
```

**Storage Optimization:**
- Time-series database for click events
- Pre-aggregated stats for fast access
- Archive old data (> 1 year)

### Encoding Algorithm

#### Base62 Encoding

**Character Set:** `0-9`, `a-z`, `A-Z` (62 characters)

**Algorithm:**
1. Take numeric ID
2. Repeatedly divide by 62
3. Use remainder as index into character set
4. Build code from right to left

**Example:**
- ID: 1000
- 1000 % 62 = 32 → 'W'
- 16 % 62 = 16 → 'g'
- Result: 'gW'

**Capacity:**
- 6 characters: 62^6 = 56.8 billion URLs
- 7 characters: 62^7 = 3.5 trillion URLs
- 8 characters: 62^8 = 218 trillion URLs

**Trade-off:**
- **Shorter (6 chars):** Better UX, limited capacity
- **Longer (8 chars):** More capacity, worse UX

#### ID Generation Strategies

1. **Auto-increment:**
   - Simple but requires coordination
   - Database sequence or atomic counter
   - Risk of bottleneck at scale

2. **UUID:**
   - Unique but longer codes
   - Not suitable for short URLs
   - Good for distributed systems

3. **Distributed ID (Recommended):**
   - Snowflake ID or similar
   - Combines timestamp + machine ID + sequence
   - No coordination needed
   - Example: Twitter Snowflake

4. **Hash-based:**
   - MD5/SHA256 of long URL
   - Risk of collisions
   - Requires collision handling

### Caching Strategy

#### 80/20 Rule
- **Top 20% of URLs** receive **80% of traffic**
- Cache these hot URLs for fast access

#### Cache Implementation
- **Storage:** Redis or Memcached
- **Cache size:** ~20% of daily reads = 2B URLs/day * 20% = 400M URLs
- **Storage:** 400M * 500 bytes = 200GB cache
- **TTL:** 1 hour for frequently accessed URLs
- **Eviction:** LRU (Least Recently Used)

#### Cache Strategy
1. **On read:** Check cache first, then database
2. **On write:** Invalidate cache (or update)
3. **Warm-up:** Pre-load popular URLs
4. **CDN:** Cache redirects at edge locations

### Load Balancing

#### Strategies
- **DNS-based:** Route to nearest datacenter
- **Application-level:** Round-robin, least connections
- **Geographic:** Route based on user location

#### Load Balancer Features
- Health checks
- Session persistence (if needed)
- SSL termination
- Rate limiting

### Scaling Considerations

#### 1. Database Sharding

**Sharding Strategy:**
- **By user_id:** All user's URLs on same shard
- **By hash of code:** Even distribution
- **Consistent hashing:** Minimal data movement

**Shard Key Selection:**
- **user_id:** Better for user queries, uneven distribution
- **hash(code):** Even distribution, harder user queries
- **Hybrid:** Shard by user_id, replicate popular URLs

#### 2. Read Replicas

**Architecture:**
- **Master:** Handles all writes
- **Replicas:** Handle reads (multiple)
- **Replication:** Async or sync

**Benefits:**
- Distribute read load
- Improve availability
- Geographic distribution

#### 3. CDN

**Purpose:**
- Cache redirects at edge locations
- Reduce latency for global users
- Offload server traffic

**Implementation:**
- Cache 301 redirects
- TTL: 1 hour (or based on expiration)
- Invalidate on URL update

#### 4. Rate Limiting

**Purpose:**
- Prevent abuse
- Protect against DDoS
- Fair resource usage

**Strategies:**
- Per-user limits
- Per-IP limits
- Token bucket algorithm
- Sliding window

## Custom Short URLs

### Features
- **Custom codes:** Users can specify their own short codes
- **Validation:** Custom codes must meet requirements:
  - 3-20 characters long
  - Alphanumeric characters and hyphens only
  - Cannot use reserved codes (api, admin, www, mail, etc.)
- **Uniqueness:** Custom codes must be unique across all URLs
- **Reuse:** Expired custom URLs can be reused

### Validation Rules

#### Length Validation
- **Minimum:** 3 characters (prevents collisions, ensures memorability)
- **Maximum:** 20 characters (maintains URL shortening purpose)
- **Trade-off:** Shorter = more collisions, longer = defeats purpose

#### Character Validation
- **Allowed:** Alphanumeric (a-z, A-Z, 0-9) and hyphens (-)
- **Regex:** `/^[a-zA-Z0-9-]+$/`
- **Why:** URL-safe characters, no encoding needed

#### Reserved Codes
- **System routes:** api, admin, www, mail, ftp
- **Common paths:** about, help, terms, privacy
- **Security:** Prevents conflicts with system functionality

### Use Cases
- Branded short links (e.g., `short.ly/mybrand`)
- Memorable links for marketing campaigns
- User-friendly URLs for specific content
- SEO-friendly short links

### Storage Strategy
- **Separate storage:** Custom URLs stored separately for faster lookup
- **Benefits:** 
  - Faster lookup (no need to check both databases)
  - Easier validation and management
  - Can apply different rules (e.g., premium feature)

## URL Expiration

### Features
- **Time-based expiration:** Set expiration using `expiresIn` (milliseconds)
  - Example: `expiresIn: 86400000` (1 day)
- **Date-based expiration:** Set specific expiration date using `expiresAt` (ISO 8601)
  - Example: `expiresAt: "2024-12-31T23:59:59Z"`
- **Automatic cleanup:** Expired URLs are automatically removed on access
- **Expiration info:** Check expiration status and time remaining
- **Flexible management:** Set, update, or remove expiration after creation
- **Works with custom URLs:** Both regular and custom URLs support expiration

### Expiration Methods

#### Time-to-Live (TTL)
- **Format:** Milliseconds
- **Example:** `expiresIn: 3600000` (1 hour)
- **Use case:** Relative time (e.g., "expires in 1 hour")

#### Expiration Date
- **Format:** ISO 8601 date string
- **Example:** `expiresAt: "2024-12-31T23:59:59Z"`
- **Use case:** Absolute time (e.g., "campaign ends Dec 31")

### Expiration Behavior
- **On access:** Expired URLs return error when accessed
- **Automatic deletion:** Expired URLs are deleted from database
- **Analytics preserved:** Expired URLs can optionally preserve analytics
- **Reuse:** Expired custom codes can be reused

### Cleanup Strategy

#### On-Demand Cleanup
- **Trigger:** When URL is accessed
- **Process:** Check expiration, delete if expired
- **Benefit:** Immediate cleanup, no background jobs

#### Background Cleanup
- **Trigger:** Scheduled job (e.g., hourly)
- **Process:** Query expired URLs, batch delete
- **Benefit:** Efficient, reduces database size

#### Database Optimization
- **Index on expires_at:** Fast query for expired URLs
- **Partition by date:** Easy cleanup of old partitions
- **TTL indexes:** Automatic expiration (MongoDB, Redis)

### Use Cases
- Temporary promotional links
- Time-limited access to content
- Campaign URLs with end dates
- Security-sensitive links that should expire
- Event-specific links

## Analytics

### Metrics Collected

#### Click Metrics
- **Total clicks:** Aggregate count
- **Click timestamps:** Time-series data
- **Click rate:** Clicks per time period

#### Referrer Tracking
- **Source:** Where click came from (twitter, facebook, direct)
- **Use case:** Marketing attribution
- **Storage:** Map<referrer, count>

#### Geographic Tracking
- **Country:** Country code (US, UK, IN, etc.)
- **Use case:** CDN optimization, marketing
- **Storage:** Map<country, count>

#### Device Tracking
- **Device type:** Mobile, desktop, tablet
- **Use case:** UX optimization
- **Storage:** Map<device, count>

### Analytics Architecture

#### Storage Strategy
- **Time-series database:** For click events (InfluxDB, TimescaleDB)
- **Aggregated stats:** Pre-computed for fast access
- **Retention:** Keep detailed data for 1 year, aggregate older

#### Processing
- **Real-time:** Track clicks as they happen
- **Batch:** Aggregate analytics in background
- **Streaming:** Use message queue for high throughput

#### Storage Calculation
- **Click events:** 10B clicks/day * 100 bytes = 1TB/day
- **Aggregated stats:** Much smaller (pre-computed)
- **Retention:** Archive old data, keep recent

## Data Structures

### In-Memory Storage (Production: Database)

#### URL Database
- **Type:** Map<code, urlData>
- **Purpose:** Stores auto-generated short URLs
- **Data Structure:**
  ```javascript
  {
    longURL: string,
    userId: string|null,
    createdAt: number (timestamp),
    expiresAt: number|null (timestamp),
    clickCount: number
  }
  ```

#### Custom URLs Database
- **Type:** Map<code, urlData>
- **Purpose:** Stores custom short URLs (separate for performance)
- **Benefits:**
  - Faster lookup (no need to check both databases)
  - Easier validation and management
  - Can apply different rules (e.g., premium feature)

#### Analytics Database
- **Type:** Map<code, analyticsData>
- **Purpose:** Stores click analytics per URL
- **Data Structure:**
  ```javascript
  {
    clicks: number,
    referrers: Map<referrer, count>,
    countries: Map<countryCode, count>,
    devices: Map<deviceType, count>,
    timestamps: Array<timestamp>
  }
  ```
- **Production:** Would use time-series database or separate analytics DB

#### User Database
- **Type:** Map<userId, userData>
- **Purpose:** Stores user information (for future features)

### Production Storage Considerations
- **SQL/NoSQL database** for persistence
- **Redis cache** for hot URLs (top 20%)
- **Separate analytics database** for click tracking
- **Time-series database** for click events (InfluxDB, TimescaleDB)

## Process Flow

### Shorten URL Process

1. **URL Validation**
   - Validate URL format
   - Check for malicious URLs (production)
   - Verify protocol (http/https only)
   - Check URL length limits

2. **Expiration Calculation**
   - If `expiresAt` provided: Convert to timestamp, validate future date
   - If `expiresIn` provided: Calculate `Date.now() + expiresIn`
   - If neither: URL is permanent (expirationTimestamp = null)

3. **Custom Code Handling** (if provided)
   - Validate custom code format (length, characters, reserved codes)
   - Check uniqueness (including expired URLs)
   - Allow reuse of expired custom codes
   - Store in separate Map for performance

4. **Auto-Generated Code** (if no custom code)
   - Generate ID (timestamp + random, or distributed ID in production)
   - Encode to Base62
   - Check for collision (retry if exists)
   - Store in urlDatabase

5. **Initialize Analytics**
   - Create analytics entry with empty metrics
   - Initialize Maps for referrers, countries, devices
   - Initialize timestamps array

6. **Return Result**
   - Short URL, code, long URL, expiration info, isCustom flag

### Expand URL Process

1. **Check Custom URLs First**
   - Faster lookup (separate Map)
   - In production: Check cache (Redis) first

2. **Check Regular URLs**
   - Fallback if not in custom URLs

3. **Expiration Validation**
   - Check if URL has expired
   - If expired: Delete and return error
   - Automatic cleanup on access

4. **Record Click Analytics**
   - Increment click count
   - Update referrer, country, device metrics
   - Store timestamp (for time-series analysis)
   - In production: Async/non-blocking

5. **Return Long URL**
   - Return original URL for redirect

## Collision Handling

### Auto-Generated Codes
- **Probability:** Extremely low (62^6 = 56.8 billion possible codes)
- **Detection:** Check if code exists in urlDatabase or customUrls
- **Resolution:** Retry with new ID (recursive call)
- **Production:** Database unique constraint would handle this

### Custom Codes
- **Detection:** Check if code exists (both databases)
- **Resolution:** Reject if exists (user must choose different)
- **Exception:** Allow reuse if existing URL is expired
- **Production:** Database unique constraint with validation

## Performance Considerations

### Time Complexity
- **generateShortCode:** O(log_62(n)) - Very efficient, typically 6-8 iterations
- **shortenURL:** O(1) for custom code lookup, O(1) for storage
- **expandURL:** O(1) for lookup (Map operations)
- **cleanupExpiredURLs:** O(n) where n = number of URLs
  - Production: O(log n) with indexed query

### Latency Targets
- **Redirect:** < 100ms (including cache lookup)
- **Shorten:** < 200ms (including database write)
- **Analytics:** < 50ms (async, non-blocking)

### Optimization Strategies
- **Lookup order:** Custom URLs checked first (separate Map, faster)
- **Cache-first:** Check cache before database
- **Async analytics:** Don't block redirect for analytics
- **Batch operations:** Batch analytics writes for efficiency
- **Connection pooling:** Reuse database connections

## Distributed URL Shortener

### Sharding Strategy

#### Consistent Hashing
- **Purpose:** Distribute URLs evenly across shards
- **Benefits:**
  - Minimal data movement on shard addition/removal
  - Even distribution
  - Deterministic (same code → same shard)

#### Sharding Algorithm
1. Hash the code
2. Modulo by number of shards
3. Route to corresponding shard

#### Hash Function
- **Simple hash:** Used in implementation
- **Production:** Would use more robust hash (MD5, SHA-256)
- **Virtual nodes:** For better distribution in production

#### Shard Selection
- **By code hash:** Even distribution
- **By user_id:** Better for user queries, uneven distribution
- **Hybrid:** Shard by user_id, replicate popular URLs

### Distributed Architecture
```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Load Balancer  │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────┐
│  DistributedURLShortener     │
│  (Router/Coordinator)        │
└──────┬───────────────────────┘
       │
       ├──────────┬──────────┬──────────┐
       ▼          ▼          ▼          ▼
   ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
   │Shard1│  │Shard2│  │Shard3│  │Shard4│
   └──────┘  └──────┘  └──────┘  └──────┘
```

### Use Cases
- When single server can't handle load
- Need to distribute across multiple databases
- Geographic distribution
- Scaling to billions of URLs

## User URL Management

### Get User URLs

#### Functionality
- Returns all URLs created by a specific user
- Includes both regular and custom URLs
- Includes expiration status
- Sorted by creation date (newest first)

#### Data Returned
```javascript
{
  code: string,
  shortURL: string,
  longURL: string,
  clicks: number,
  createdAt: ISO string,
  expiresAt: ISO string|null,
  isExpired: boolean,
  isCustom: boolean
}
```

#### Production Considerations
- **Database query:** Use indexed query with user_id
- **Pagination:** For large result sets
- **Filtering:** Filter by expiration, custom, etc.
- **Sorting:** Multiple sorting options

## URL Deletion

### Delete URL Functionality
- Permanently deletes a short URL and its analytics
- Checks both regular and custom URL databases
- Deletes analytics (or optionally preserves for historical data)

### Production Considerations
- **Soft delete:** Mark as deleted, keep for recovery
- **Preserve analytics:** Keep analytics for historical data
- **Authorization:** Require user authentication/authorization
- **Audit trail:** Log deletions for compliance

## Analytics Processing

### Click Recording Process

#### Metrics Updated
1. **Total clicks:** Increment counter
2. **Timestamps:** Store click timestamp (for time-series analysis)
3. **Referrers:** Update referrer count
4. **Countries:** Update country count
5. **Devices:** Update device count

#### Storage Optimization
- **In-memory:** Keep only last 100 timestamps
- **Production:** Use time-series database
- **Aggregation:** Pre-compute daily/weekly/monthly stats
- **Retention:** Archive old data, keep recent

### Analytics Architecture

#### Real-Time Processing
- Track clicks as they happen
- Update counters immediately
- Store timestamps for analysis

#### Batch Processing
- Aggregate analytics in background
- Pre-compute statistics
- Update aggregated tables

#### Streaming Processing
- Use message queue for high throughput
- Process clicks asynchronously
- Batch writes for efficiency

#### Time-Series Analysis
- Store click timestamps
- Analyze click patterns over time
- Identify peak usage times
- Detect anomalies

## Background Jobs

### Cleanup Expired URLs

#### On-Demand Cleanup
- **Trigger:** When URL is accessed
- **Process:** Check expiration, delete if expired
- **Benefit:** Immediate cleanup, no background jobs

#### Scheduled Cleanup
- **Trigger:** Scheduled job (e.g., hourly)
- **Process:** Query expired URLs, batch delete
- **Benefit:** Efficient, reduces database size
- **Implementation:** Cron job or task scheduler

#### Database Optimization
- **Index on expires_at:** Fast query for expired URLs
- **Partition by date:** Easy cleanup of old partitions
- **TTL indexes:** Automatic expiration (MongoDB, Redis)

### Analytics Processing Jobs
- **Aggregation:** Pre-compute daily/weekly/monthly stats
- **Archival:** Move old data to cold storage
- **Reporting:** Generate analytics reports

## Implementation

### Node.js Implementation

See [Node.js Code](./node/url-shortener.js)

**Key features:**
- Base62 encoding for short codes
- Custom short URL support with validation
- URL expiration (time-based and date-based)
- Analytics tracking
- Distributed support with sharding
- User URL management
- URL deletion
- Expiration management

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Algorithm explanations
- Data structures
- Process flows
- Performance optimizations
- Scaling strategies
- Production considerations
- Collision handling
- Background jobs

### Usage Example

```javascript
const { URLShortener } = require('./node/url-shortener');

const shortener = new URLShortener({ baseUrl: 'https://short.ly' });

// Shorten URL (auto-generated code)
const result1 = await shortener.shortenURL('https://www.example.com/very/long/url');
console.log(result1.shortURL); // https://short.ly/abc123

// Shorten URL with custom code
const result2 = await shortener.shortenURL(
  'https://www.github.com',
  'user123',
  'github' // custom code
);
console.log(result2.shortURL); // https://short.ly/github

// Shorten URL with expiration (1 hour)
const result3 = await shortener.shortenURL(
  'https://www.example.com/temporary',
  'user123',
  null,
  60 * 60 * 1000 // expires in 1 hour
);
console.log(result3.expiresAt); // ISO date string

// Custom URL with expiration date
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
const result4 = await shortener.shortenURL(
  'https://www.example.com/event',
  'user123',
  'event2024', // custom code
  null,
  futureDate // expiration date
);

// Expand URL
const longURL = await shortener.expandURL('abc123');
console.log(longURL); // https://www.example.com/very/long/url

// Get expiration info
const expInfo = shortener.getExpirationInfo('event2024');
console.log(expInfo);
// {
//   code: 'event2024',
//   expiresAt: '2024-12-31T23:59:59Z',
//   isExpired: false,
//   timeRemaining: 604800000,
//   timeRemainingFormatted: '7 day(s)',
//   isCustom: true
// }

// Set expiration after creation
shortener.setExpiration('abc123', 2 * 60 * 60 * 1000); // 2 hours

// Remove expiration (make permanent)
shortener.removeExpiration('abc123');

// Get analytics
const analytics = shortener.getAnalytics('abc123');
console.log(analytics);

// Cleanup expired URLs
const cleanup = shortener.cleanupExpiredURLs();
console.log(cleanup); // { cleaned: 5, timestamp: '...' }
```

## Performance Optimization

### Caching
- **Hot URLs:** Cache top 20% of URLs (80/20 rule)
- **Cache TTL:** 1 hour for frequently accessed URLs
- **Cache size:** 400M URLs * 500 bytes = 200GB
- **CDN:** Cache redirects at edge locations

### Database Optimization
- **Indexing:** Index on code, user_id, expires_at
- **Read replicas:** Distribute read load
- **Sharding:** Partition by user_id or hash of code
- **Connection pooling:** Reuse database connections

### Query Optimization
- **Lookup order:** Custom URLs first (separate storage)
- **Cache-first:** Check cache before database
- **Batch operations:** Batch analytics writes

### Latency Targets
- **Redirect:** < 100ms (including cache lookup)
- **Shorten:** < 200ms (including database write)
- **Analytics:** < 50ms (async, non-blocking)

## Monitoring

### Key Metrics

#### Traffic Metrics
- **Requests per second:** Read and write QPS
- **Cache hit rate:** Percentage of cache hits
- **Error rate:** Failed requests percentage

#### Performance Metrics
- **Latency:** P50, P95, P99 latencies
- **Throughput:** Requests processed per second
- **Database query time:** Query execution time

#### Business Metrics
- **URLs created:** Daily/weekly/monthly
- **Clicks:** Total clicks per day
- **Active users:** Users creating URLs
- **Custom URL usage:** Percentage using custom codes

### Alerts
- **High latency:** P95 > 200ms
- **Low cache hit rate:** < 70%
- **High error rate:** > 1%
- **Database connection failures**
- **Storage capacity warnings**

## Trade-offs

### Short Code Length
- **Shorter (6 chars):** Better UX, limited capacity (56.8B URLs)
- **Longer (8 chars):** More capacity (218T URLs), worse UX

### Custom Codes vs Auto-generated
- **Custom codes:** Better UX, memorable, but requires validation
- **Auto-generated:** Unlimited, no conflicts, but less memorable

### Expiration Strategy
- **Time-based:** Simple, but requires calculation
- **Date-based:** More intuitive, but requires date parsing
- **No expiration:** Permanent URLs, but may accumulate over time

### Caching Strategy
- **Cache all:** High memory usage (impractical at scale)
- **Cache hot URLs:** Lower memory, may miss some requests (recommended)

### Database Choice
- **SQL:** ACID compliance, complex queries, better for analytics
- **NoSQL:** Better scalability, eventual consistency, faster writes

### Consistency vs Availability
- **Strong consistency:** Slower, more complex (SQL)
- **Eventual consistency:** Faster, simpler (NoSQL)

## Security Considerations

### URL Validation
- **Format validation:** Ensure proper URL format
- **Malicious URL detection:** Check against blacklists
- **Protocol restrictions:** Only allow http/https
- **Length limits:** Prevent abuse

### Custom Code Security
- **Reserved codes:** Prevent system route conflicts
- **Character validation:** Prevent injection attacks
- **Rate limiting:** Prevent code exhaustion attacks

### Access Control
- **User authentication:** Verify user identity
- **Authorization:** Check URL ownership
- **Rate limiting:** Prevent abuse per user/IP

### Data Protection
- **Encryption:** Encrypt sensitive data at rest
- **HTTPS:** Encrypt data in transit
- **Tokenization:** Don't store sensitive URLs in plain text

## URL Validation

### Validation Process
- **Format validation:** Ensure proper URL format using URL constructor
- **Protocol check:** Only allow http/https (production)
- **Length limits:** Prevent abuse with URL length restrictions (production)
- **Malicious URL detection:** Check against blacklists (production)
- **Domain validation:** Verify domain exists and is accessible (production)

### Production Considerations
- **Real-time scanning:** Check URLs against malware/phishing databases
- **Rate limiting:** Prevent bulk malicious URL submission
- **User reporting:** Allow users to report malicious URLs
- **Automated review:** AI/ML-based malicious URL detection

## Time Remaining Formatting

### Format Time Remaining
- **Purpose:** Convert milliseconds to human-readable format
- **Formats:**
  - Days: "X day(s)"
  - Hours: "X hour(s)"
  - Minutes: "X minute(s)"
  - Seconds: "X second(s)"
- **Edge case:** Returns "Expired" if time <= 0

### Use Cases
- Display expiration info to users
- Show time remaining in UI
- Generate expiration notifications

## Additional API Endpoints

### Delete URL
```
DELETE /api/v1/urls/{code}
Response:
{
  "success": true,
  "code": "abc123"
}
```

### Get User URLs
```
GET /api/v1/users/{userId}/urls?page=1&limit=20
Response:
{
  "urls": [
    {
      "code": "abc123",
      "shortURL": "https://short.ly/abc123",
      "longURL": "https://www.example.com/...",
      "clicks": 100,
      "createdAt": "2024-01-01T00:00:00Z",
      "expiresAt": null,
      "isExpired": false,
      "isCustom": false
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

## Code Examples

### Distributed URL Shortener Usage

```javascript
const { URLShortener, DistributedURLShortener } = require('./node/url-shortener');

// Create shard instances
const shard1 = new URLShortener({ baseUrl: 'https://short.ly' });
const shard2 = new URLShortener({ baseUrl: 'https://short.ly' });
const shard3 = new URLShortener({ baseUrl: 'https://short.ly' });

// Create distributed shortener
const distributed = new DistributedURLShortener({
  baseUrl: 'https://short.ly',
  shards: [shard1, shard2, shard3]
});

// Shorten URL (automatically routed to appropriate shard)
const result = await distributed.shortenURL('https://www.example.com');
console.log(result.shortURL);

// Expand URL (automatically routed to appropriate shard)
const longURL = await distributed.expandURL(result.code);
console.log(longURL);
```

### Analytics Recording with Metadata

```javascript
// Record click with full metadata
shortener.recordClick('abc123', {
  referrer: 'twitter',
  country: 'US',
  device: 'mobile'
});

// Get analytics
const analytics = shortener.getAnalytics('abc123');
console.log(analytics);
// {
//   code: 'abc123',
//   longURL: '...',
//   totalClicks: 1,
//   createdAt: '2024-01-01T00:00:00Z',
//   referrers: { twitter: 1 },
//   countries: { US: 1 },
//   devices: { mobile: 1 },
//   clickHistory: [1234567890]
// }
```

### Expiration Management

```javascript
// Set expiration using TTL
shortener.setExpiration('abc123', 2 * 60 * 60 * 1000); // 2 hours

// Set expiration using date
const futureDate = new Date('2024-12-31T23:59:59Z');
shortener.setExpiration('abc123', null, futureDate);

// Get expiration info
const info = shortener.getExpirationInfo('abc123');
console.log(info);
// {
//   code: 'abc123',
//   expiresAt: '2024-12-31T23:59:59Z',
//   isExpired: false,
//   timeRemaining: 604800000,
//   timeRemainingFormatted: '7 day(s)',
//   isCustom: false
// }

// Remove expiration (make permanent)
shortener.removeExpiration('abc123');
```

## Production Deployment Considerations

### Database Setup
- **Primary database:** SQL (PostgreSQL) or NoSQL (MongoDB) for URL storage
- **Cache layer:** Redis for hot URLs (top 20%)
- **Analytics database:** Time-series database (InfluxDB, TimescaleDB)
- **Read replicas:** Multiple read replicas for scaling reads
- **Sharding:** Horizontal sharding for scale

### Caching Strategy
- **Cache layer:** Redis cluster
- **Cache size:** 200GB (400M URLs * 500 bytes)
- **TTL:** 1 hour for frequently accessed URLs
- **Eviction:** LRU (Least Recently Used)
- **Warm-up:** Pre-load popular URLs on startup

### Message Queue
- **Purpose:** Async analytics processing
- **Technology:** RabbitMQ, Kafka, or AWS SQS
- **Benefits:** 
  - Non-blocking click recording
  - Batch processing
  - High throughput

### Monitoring & Observability
- **Metrics:** Prometheus + Grafana
- **Logging:** ELK stack (Elasticsearch, Logstash, Kibana)
- **Tracing:** Distributed tracing (Jaeger, Zipkin)
- **Alerting:** PagerDuty or similar

### Security
- **HTTPS:** SSL/TLS for all communications
- **Rate limiting:** Per-user and per-IP limits
- **Authentication:** JWT tokens for API access
- **Authorization:** RBAC for user permissions
- **Input validation:** Sanitize all inputs
- **Malicious URL detection:** Real-time scanning

## Further Enhancements

1. **Security:**
   - URL validation (prevent malicious URLs)
   - Rate limiting per user/IP
   - CAPTCHA for anonymous users
   - Password protection for URLs
   - Malicious URL detection
   - IP geolocation for security

2. **Features:**
   - QR code generation
   - Bulk URL shortening
   - URL preview/metadata
   - Scheduled expiration notifications
   - Expiration reminders
   - URL editing (update long URL)
   - URL aliases (multiple codes for same URL)

3. **Analytics:**
   - Real-time analytics dashboard
   - Geographic heat maps
   - Click patterns over time
   - Expiration tracking and reports
   - A/B testing for custom codes
   - Export analytics data

4. **Performance:**
   - Pre-generate short codes
   - Async analytics processing
   - CDN for static assets
   - Background cleanup jobs for expired URLs
   - Scheduled expiration checks
   - Connection pooling
   - Database query optimization

5. **Scalability:**
   - Horizontal scaling with sharding
   - Read replicas for read scaling
   - Message queue for async processing
   - Distributed caching
   - Geographic distribution
   - Auto-scaling based on load

6. **Reliability:**
   - Database replication
   - Backup and disaster recovery
   - Health checks and monitoring
   - Circuit breakers
   - Retry mechanisms
