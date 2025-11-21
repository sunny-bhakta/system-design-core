# Design Facebook News Feed

## Problem Statement

Design a news feed system that shows personalized content to users based on their connections and interests.

## Requirements

### Functional Requirements
- Generate personalized feed
- Rank posts by relevance
- Real-time updates
- Support multiple post types (text, photo, video, link)
- Filter and sort options
- Hide/unfollow content

### Non-Functional Requirements
- Handle 2B+ users
- 500M posts/day = ~5,800 posts/second
- Sub-second feed generation (< 1 second)
- High availability (99.9%)
- Real-time updates

## Capacity Estimation

### Storage
- **Posts:** 500M/day * 1KB = 500GB/day = 182TB/year
- **User data:** 2B users * 2KB = 4TB
- **Friendships:** 2B users * 200 friends * 8 bytes = 3.2TB
- **Engagement:** 10B interactions/day * 100 bytes = 1TB/day = 365TB/year
- **Total:** ~550TB/year

### Bandwidth
- **Read:** 23K reads/sec * 50KB = 1.15GB/sec
- **Write:** 5.8K writes/sec * 1KB = 5.8MB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  Feed       │
│             │     │  Balancer    │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Ranking     │         │  Cache       │         │  ML Service  │
            │  Service     │         │  (Redis)     │         │  (Relevance) │
            └──────────────┘         └──────────────┘         └──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │  Database    │
            │  (Graph DB)  │
            └──────────────┘
```

### Feed Generation Strategy

#### Pre-computation + Real-time
- **Pre-compute:** Generate feeds offline
- **Real-time:** Merge new posts on-the-fly
- **Caching:** Cache pre-computed feeds

#### Ranking Algorithm

**Relevance Score Components:**
1. **Recency (30%):** Newer posts get higher score
2. **Engagement (40%):** Likes, comments, shares
3. **Friend closeness (20%):** Interaction history
4. **Interest matching (10%):** Content relevance

**Formula:**
```
score = (recency * 0.3) + (engagement * 0.4) + (closeness * 0.2) + (interest * 0.1)
```

### Database Schema

#### Posts Table
```sql
CREATE TABLE posts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content TEXT,
  type VARCHAR(20), -- text, photo, video, link
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  score FLOAT DEFAULT 0,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_score (score)
);
```

#### Friends Table
```sql
CREATE TABLE friends (
  user_id1 BIGINT NOT NULL,
  user_id2 BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id1, user_id2),
  INDEX idx_user1 (user_id1),
  INDEX idx_user2 (user_id2)
);
```

#### Engagement Table
```sql
CREATE TABLE engagement (
  post_id BIGINT NOT NULL,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  clicks INT DEFAULT 0,
  time_spent INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id)
);
```

### Caching Strategy

- **Feed cache:** Redis (5 minutes TTL)
- **User interests:** Redis (1 hour TTL)
- **Friend lists:** Redis (30 minutes TTL)
- **Post scores:** Redis (1 minute TTL)

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Post Storage
- **posts:** Map<postId, postData> - All posts with metadata
- **Production:** SQL database for metadata, object storage for media

#### Friend Relationships
- **friends:** Map<userId, Set<friendId>> - Bidirectional friend relationships
- **Production:** Graph database (Neo4j) or SQL with indexes

#### Feed Cache
- **feedCache:** Map<userId, Array<postId>> - Pre-computed feeds
- **Production:** Redis for fast feed access with TTL

#### Engagement Metrics
- **engagement:** Map<postId, engagementData> - Engagement per post
- **Production:** SQL database or Redis for counters

#### User Interests
- **userInterests:** Map<userId, Set<interest>> - User interests for personalization
- **Production:** SQL database or ML feature store

## Process Flow

### Generate Feed Process

1. **Check Cache:** If cached feed exists and has enough posts, return cached
2. **Get User Context:** Retrieve friends and interests
3. **Collect Candidates:** Get posts from friends
4. **Calculate Scores:** Calculate relevance score for each post
5. **Sort by Score:** Sort posts by relevance (highest first)
6. **Cache Feed:** Store computed feed in cache
7. **Return Top N:** Return top N posts

### Calculate Relevance Score Process

1. **Recency Score (30%):** Calculate based on post age (decay over 7 days)
2. **Engagement Score (40%):** Weighted sum of likes, comments, shares
3. **Friend Closeness (20%):** Based on interaction history
4. **Interest Matching (10%):** Content relevance to user interests
5. **Combine Scores:** Weighted sum of all components
6. **Return Score:** Return final relevance score (0 to 1)

### Create Post Process

1. **Create Post Object:** Generate unique ID, store metadata
2. **Store Post:** Save to database
3. **Initialize Engagement:** Create engagement tracking entry
4. **Invalidate Caches:** Invalidate friends' feed caches
5. **Return Post:** Return created post object

## Ranking Algorithm Details

### Score Components

#### Recency (30%)
- **Formula:** max(0, 1 - age / 7_days)
- **Decay:** Posts older than 7 days get 0 recency score
- **Purpose:** Prioritize fresh content

#### Engagement (40%)
- **Weights:** likes=1, comments=2, shares=3
- **Formula:** (likes * 1 + comments * 2 + shares * 3) / 100
- **Purpose:** Prioritize popular content

#### Friend Closeness (20%)
- **Simplified:** Constant 0.2 for all friends
- **Production:** Based on interaction history, messages, mutual friends
- **Purpose:** Prioritize content from closer friends

#### Interest Matching (10%)
- **Simplified:** Constant 0.1
- **Production:** ML-based content analysis, NLP, topic modeling
- **Purpose:** Prioritize relevant content

### Final Score Formula
```
score = (recency * 0.3) + (engagement * 0.4) + (closeness * 0.2) + (interest * 0.1)
```

## Performance Considerations

### Time Complexity
- **Generate Feed:** O(p) where p = total posts (inefficient)
- **Production:** O(f * n) where f = friends, n = posts per friend (with indexing)
- **Calculate Score:** O(1) per post
- **Sort:** O(p log p) where p = candidate posts

### Space Complexity
- **Feed Storage:** O(u * n) where u = users, n = posts per feed
- **Engagement:** O(p) where p = posts

### Latency Targets
- **Feed Generation:** < 1 second
- **Cache Hit:** < 100ms
- **Real-time Updates:** < 500ms

## Feed Generation Strategy

### Pre-computation + Real-time
- **Pre-compute:** Generate feeds offline (background jobs)
- **Real-time:** Merge new posts on-the-fly
- **Caching:** Cache pre-computed feeds in Redis
- **Invalidation:** Invalidate cache on new posts, engagement changes

### Optimization Strategies
- **Indexing:** Index posts by user_id and created_at
- **Pre-filtering:** Only get recent posts (last 7 days)
- **Batch Processing:** Process multiple users together
- **ML Ranking:** Use pre-trained ML models for faster scoring

## Implementation

### Node.js Implementation

See [Node.js Code](./node/facebook-newsfeed.js)

**Key features:**
- Personalized feed generation with relevance ranking
- Multiple post types (text, photo, video, link)
- Engagement tracking (likes, comments, shares)
- Real-time feed updates
- Feed filtering and sorting
- Feed caching for performance

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Ranking algorithm details
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { NewsFeedService } = require('./node/facebook-newsfeed');

const newsFeed = new NewsFeedService();

// Create user with interests
const user = newsFeed.createUser('user1', 'Alice', ['tech', 'travel']);

// Add friend
newsFeed.addFriend('user1', 'user2');

// Create post
const post = await newsFeed.createPost('user2', 'Great game today!', 'text');

// Generate feed
const feed = await newsFeed.generateFeed('user1');

// Like post
newsFeed.likePost('user1', post.id);
```

## Performance Optimization

### Feed Pre-computation
- **Background jobs:** Compute feeds asynchronously
- **Incremental updates:** Update feeds incrementally
- **Batch processing:** Process multiple users together

### Ranking Optimization
- **Caching scores:** Cache relevance scores
- **Lazy computation:** Compute on-demand for less active users
- **ML models:** Pre-trained models for faster scoring

### Database Optimization
- **Graph database:** For friend relationships
- **Read replicas:** Distribute read load
- **Partitioning:** Partition by user_id

## Monitoring

### Key Metrics
- **Feed generation latency:** P50, P95, P99
- **Cache hit rate:** Feed cache effectiveness
- **Engagement rate:** User interactions
- **Relevance score distribution:** Score quality

### Alerts
- High feed generation latency
- Low cache hit rate
- Low engagement rate
- Ranking model drift

## Trade-offs

### Accuracy vs Performance
- **More accurate ranking:** Slower, more complex
- **Faster ranking:** Less accurate, simpler

### Pre-compute vs Real-time
- **Pre-compute:** Faster reads, stale data
- **Real-time:** Fresh data, slower reads
- **Hybrid:** Best of both, more complex

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

## Further Enhancements

1. **ML-based ranking:** Advanced ML models
2. **A/B testing:** Test different ranking algorithms
3. **Personalization:** User-specific ranking
4. **Content moderation:** Filter inappropriate content
5. **Ad insertion:** Sponsored posts
6. **Video feed:** Video-first feed

