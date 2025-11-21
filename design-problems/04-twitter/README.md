# Design Twitter/X

## Problem Statement

Design a social media platform like Twitter/X that allows users to post tweets, follow users, and view timelines.

## Requirements

### Functional Requirements
- Post tweets (280 characters)
- Follow/unfollow users
- View user timeline (user's own tweets)
- View home timeline (feed from followed users)
- Like, retweet, reply to tweets
- Search tweets
- Trending topics
- User profiles

### Non-Functional Requirements
- Handle 500M users
- 200M tweets/day = ~2,300 tweets/second
- Low latency feed generation (< 200ms)
- High availability (99.9%)
- Real-time updates

## Capacity Estimation

### Storage
- **Tweets:** 200M/day * 500 bytes = 100GB/day = 36TB/year
- **User data:** 500M users * 1KB = 500GB
- **Follows:** 500M users * 200 follows * 8 bytes = 800GB
- **Total:** ~37TB/year

### Bandwidth
- **Read:** 23K reads/sec * 10KB = 230MB/sec
- **Write:** 2.3K writes/sec * 500 bytes = 1.15MB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  App        │
│             │     │  Balancer    │     │  Servers    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Timeline    │         │  Search      │         │  Media       │
            │  Service     │         │  Service     │         │  Storage     │
            └──────────────┘         └──────────────┘         └──────────────┘
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Database         │
                                    │  (SQL + NoSQL)    │
                                    └───────────────────┘
```

### Timeline Generation

#### Push Model (Fan-out on Write)
- When user posts tweet, push to all followers' timelines
- **Pros:** Fast reads, real-time
- **Cons:** Slow writes for users with many followers
- **Use for:** Users with < 1M followers

#### Pull Model (Fan-out on Read)
- When user requests timeline, fetch from followed users
- **Pros:** Fast writes
- **Cons:** Slow reads, not real-time
- **Use for:** Users with > 1M followers

#### Hybrid Model
- Push for regular users
- Pull for celebrities
- Best of both worlds

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100),
  bio TEXT,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  tweets_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tweets Table
```sql
CREATE TABLE tweets (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content VARCHAR(280),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  likes_count INT DEFAULT 0,
  retweets_count INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

#### Follows Table
```sql
CREATE TABLE follows (
  follower_id BIGINT NOT NULL,
  followee_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id),
  INDEX idx_follower (follower_id),
  INDEX idx_followee (followee_id)
);
```

### Caching Strategy

- **User timelines:** Cache in Redis (1 hour TTL)
- **Home timelines:** Cache in Redis (5 minutes TTL)
- **User profiles:** Cache in Redis (1 hour TTL)
- **Trending topics:** Cache in Redis (1 minute TTL)

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Tweet Storage
- **tweets:** Map<tweetId, tweetData> - All tweets
- **Production:** SQL database for tweets, NoSQL for timeline

#### Follow Relationships
- **follows:** Map<userId, Set<followeeId>> - Who each user follows
- **followers:** Map<userId, Set<followerId>> - Who follows each user
- **Production:** SQL database with indexes on both columns

#### Timeline Storage (Push Model)
- **timelines:** Map<userId, Array<tweetId>> - Pre-computed home timelines
- **Production:** Redis or Cassandra for fast timeline access

#### User Tweets
- **userTweets:** Map<userId, Array<tweetId>> - User's own tweets
- **Production:** SQL database with user_id index

#### Social Interactions
- **likes:** Map<tweetId, Set<userId>> - Users who liked each tweet
- **retweets:** Map<tweetId, Set<userId>> - Users who retweeted each tweet
- **Production:** SQL database or Redis for counters

## Process Flow

### Post Tweet Process (Push Model)

1. **Validate Tweet:** Check content length (280 characters), format
2. **Create Tweet Object:** Generate unique ID, store metadata
3. **Store Tweet:** Save to database
4. **Initialize Tracking:** Create like/retweet sets
5. **Add to User Tweets:** Add to user's own tweet list
6. **Fan-out to Followers:** Push to all followers' timelines
7. **Return Tweet:** Return created tweet object

### Follow User Process

1. **Validate:** Cannot follow yourself
2. **Update Relationships:** Add to follower's "following" and followee's "followers"
3. **Backfill Timeline:** Add followee's recent tweets (last 100) to follower's timeline
4. **Sort Timeline:** Sort by timestamp, maintain size limit
5. **Return Status:** Return follow relationship status

### Get Home Timeline Process

1. **Get Pre-computed Timeline:** Retrieve tweet IDs from pre-computed timeline
2. **Fetch Tweet Objects:** Map IDs to actual tweet objects
3. **Filter Deleted:** Remove any deleted tweets
4. **Sort by Timestamp:** Sort by creation time (newest first)
5. **Limit Results:** Return only requested number of tweets
6. **Return Timeline:** Return array of tweet objects

## Algorithm Details

### Push Model (Fan-out on Write)

#### Process
```
When user posts tweet:
1. Store tweet in database
2. For each follower:
   - Add tweet ID to follower's timeline
   - Maintain timeline size limit (e.g., 1000 tweets)
```

#### Performance
- **Write Complexity:** O(f) where f = number of followers
- **Read Complexity:** O(n) where n = limit (typically 20)
- **For Celebrities:** Use async queue or Pull model

#### Optimization
- **Async Queue:** Use message queue (Kafka, RabbitMQ) for fan-out
- **Background Workers:** Process fan-out jobs asynchronously
- **Batch Updates:** Batch timeline updates for efficiency

### Pull Model (Fan-out on Read)

#### Process
```
When user requests timeline:
1. Get list of followed users
2. Fetch recent tweets from each followed user
3. Merge and sort by timestamp
4. Return top N tweets
```

#### Performance
- **Write Complexity:** O(1) - just store tweet
- **Read Complexity:** O(f * n) where f = followed users, n = tweets per user

#### Use Case
- Users with > 1M followers (celebrities)
- Reduces write load significantly

### Hybrid Model

#### Strategy
- **Push Model:** For users with < 1M followers
- **Pull Model:** For users with > 1M followers
- **Best of Both:** Fast reads for regular users, fast writes for celebrities

## Performance Considerations

### Time Complexity
- **Post Tweet (Push):** O(f) where f = number of followers
- **Post Tweet (Pull):** O(1) - just store tweet
- **Get Timeline (Push):** O(n) where n = limit (typically 20)
- **Get Timeline (Pull):** O(f * n) where f = followed users, n = tweets per user
- **Follow User:** O(1) for relationship + O(n) for timeline backfill

### Space Complexity
- **Timeline Storage:** O(u * t) where u = users, t = tweets per timeline
- **Follow Relationships:** O(u * f) where u = users, f = average follows

### Latency Targets
- **Timeline Generation:** < 200ms
- **Tweet Posting:** < 500ms (including fan-out)
- **Follow/Unfollow:** < 100ms

## Implementation

### Node.js Implementation

See [Node.js Code](./node/twitter.js)

**Key features:**
- Post tweets with validation
- Follow/unfollow users with relationship management
- Timeline generation using Push model (fan-out on write)
- Like and retweet functionality
- Search tweets (simple text search)
- Trending topics based on hashtags
- User timeline (user's own tweets)

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Timeline generation strategies (Push/Pull/Hybrid)
- Data structures
- Process flows
- Performance optimizations
- Production considerations
- Fan-out algorithms

### Usage Example

```javascript
const { TwitterService } = require('./node/twitter');

const twitter = new TwitterService();

// Create users
const user1 = twitter.createUser('user1', 'alice', 'Alice');
const user2 = twitter.createUser('user2', 'bob', 'Bob');

// Follow
await twitter.follow('user1', 'user2');

// Post tweet
const tweet = await twitter.postTweet('user2', 'Hello world!');

// Get timeline
const timeline = twitter.getHomeTimeline('user1');
```

## Performance Optimization

### Timeline Pre-computation
- Pre-compute timelines for active users
- Update incrementally on new tweets
- Reduce read latency

### Read Replicas
- Multiple read replicas for database
- Distribute read load
- Improve availability

### CDN
- Serve media (images, videos) via CDN
- Reduce server load
- Lower latency

## Monitoring

### Key Metrics
- **Timeline generation latency:** P50, P95, P99
- **Tweet creation rate:** Tweets per second
- **Cache hit rate:** Timeline cache hits
- **Database query latency:** Read/write latencies

### Alerts
- High timeline generation latency
- Low cache hit rate
- Database connection failures
- High error rate

## Trade-offs

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

### Push vs Pull
- **Push:** Fast reads, slow writes
- **Pull:** Fast writes, slow reads
- **Hybrid:** Best of both, more complex

## Further Enhancements

1. **Real-time updates:** WebSocket for live feed
2. **Recommendations:** ML-based tweet recommendations
3. **Media support:** Images, videos, GIFs
4. **Threads:** Tweet conversations
5. **Spaces:** Audio conversations
6. **Analytics:** User engagement metrics

