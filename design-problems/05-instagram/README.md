# Design Instagram

## Problem Statement

Design a photo-sharing social network like Instagram with features for posting photos, following users, and viewing feeds.

## Requirements

### Functional Requirements
- Upload photos/videos
- Follow/unfollow users
- View feed (photos from followed users)
- Like and comment on posts
- Stories (24-hour content)
- Explore page (discover posts)
- Direct messaging
- User profiles

### Non-Functional Requirements
- Handle 1B+ users
- 500M photos/day = ~5,800 photos/second
- Fast image serving (< 200ms)
- Real-time updates
- High availability (99.9%)

## Capacity Estimation

### Storage
- **Photos:** 500M/day * 200KB = 100TB/day = 36PB/year
- **Metadata:** 500M/day * 1KB = 500GB/day = 182TB/year
- **User data:** 1B users * 2KB = 2TB
- **Total:** ~36PB/year

### Bandwidth
- **Upload:** 5.8K uploads/sec * 200KB = 1.16GB/sec
- **Download:** 23K reads/sec * 200KB = 4.6GB/sec

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
            │  Media      │         │  Feed        │         │  Search     │
            │  Storage    │         │  Service     │         │  Service    │
            │  (S3-like)  │         └──────────────┘         └──────────────┘
            └─────────────┘
                    │
            ┌───────▼──────┐
            │  CDN         │
            │  (CloudFront)│
            └──────────────┘
```

### Media Storage

#### Object Storage
- **Primary storage:** S3-like object storage
- **CDN:** CloudFront for global delivery
- **Image processing:** Thumbnails, resizing
- **Video processing:** Transcoding, multiple qualities

#### Storage Strategy
- **Hot storage:** Recent photos (last 30 days)
- **Cold storage:** Older photos (archive)
- **CDN caching:** Popular content cached at edge

### Feed Generation

#### Hybrid Push-Pull Model
- **Push for regular users:** Pre-compute feeds
- **Pull for celebrities:** On-demand generation
- **Caching:** Redis for feed caching

#### Feed Algorithm
1. Get posts from followed users
2. Rank by engagement (likes, comments)
3. Apply time decay
4. Personalize based on user interests

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  bio TEXT,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Posts Table
```sql
CREATE TABLE posts (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  caption TEXT,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

#### Stories Table
```sql
CREATE TABLE stories (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  views_count INT DEFAULT 0,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

### Caching Strategy

- **Feed cache:** Redis (5 minutes TTL)
- **User profiles:** Redis (1 hour TTL)
- **Popular posts:** CDN cache (24 hours)
- **Stories:** Redis (1 hour TTL)

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Post Storage
- **posts:** Map<postId, postData> - All posts with metadata
- **Production:** SQL database for metadata, object storage (S3) for images

#### Story Storage
- **stories:** Map<storyId, storyData> - Stories (24-hour content)
- **Production:** SQL database with TTL, object storage for media

#### Follow Relationships
- **follows:** Map<userId, Set<followeeId>> - Follow relationships
- **Production:** SQL database with indexes

#### Feed Cache (Push Model)
- **feedCache:** Map<userId, Array<postId>> - Pre-computed feeds
- **Production:** Redis for fast feed access

#### Social Interactions
- **likes:** Map<postId, Set<userId>> - Users who liked each post
- **comments:** Map<postId, Array<comment>> - Comments on each post
- **Production:** SQL database or Redis for counters

#### Direct Messaging
- **directMessages:** Map<conversationId, Array<message>> - Direct messages
- **Production:** SQL database or NoSQL for messages

## Process Flow

### Upload Post Process (Push Model)

1. **Create Post Object:** Generate unique ID, store metadata
2. **Store Post:** Save to database (metadata) and object storage (image)
3. **Initialize Tracking:** Create like/comment sets
4. **Update User Stats:** Increment user's post count
5. **Fan-out to Followers:** Push to all followers' feeds
6. **Return Post:** Return created post object

### Get Feed Process

1. **Get Pre-computed Feed:** Retrieve post IDs from feed cache
2. **Fetch Post Objects:** Map IDs to actual post objects
3. **Rank Posts:** Sort by engagement, time decay, personalization
4. **Filter Deleted:** Remove any deleted posts
5. **Limit Results:** Return only requested number of posts
6. **Return Feed:** Return array of post objects

## Media Storage

### Object Storage Strategy
- **Primary Storage:** S3-like object storage
- **CDN:** CloudFront for global delivery
- **Image Processing:** Thumbnails, resizing, multiple sizes
- **Video Processing:** Transcoding, multiple qualities

### Storage Tiers
- **Hot Storage:** Recent photos (last 30 days)
- **Cold Storage:** Older photos (archive)
- **CDN Caching:** Popular content cached at edge

## Feed Generation

### Hybrid Push-Pull Model
- **Push Model:** For regular users (< 1M followers)
  - Pre-compute feeds
  - Fast reads
  - Slow writes for celebrities
- **Pull Model:** For celebrities (> 1M followers)
  - On-demand generation
  - Fast writes
  - Slower reads

### Feed Ranking Algorithm
1. **Get Posts:** From followed users
2. **Rank by Engagement:** Likes, comments, shares
3. **Apply Time Decay:** Recent posts ranked higher
4. **Personalize:** Based on user interests, past interactions
5. **Return Top N:** Return ranked posts

## Performance Considerations

### Time Complexity
- **Upload Post (Push):** O(f) where f = number of followers
- **Upload Post (Pull):** O(1) - just store post
- **Get Feed (Push):** O(n) where n = limit (typically 20)
- **Get Feed (Pull):** O(f * n) where f = followed users, n = posts per user

### Space Complexity
- **Feed Storage:** O(u * p) where u = users, p = posts per feed
- **Media Storage:** O(p * s) where p = posts, s = average size

### Latency Targets
- **Feed Generation:** < 200ms
- **Post Upload:** < 500ms (including fan-out)
- **Image Serving:** < 200ms (via CDN)

## Implementation

### Node.js Implementation

See [Node.js Code](./node/instagram.js)

**Key features:**
- Upload posts with images
- Follow/unfollow users
- Feed generation using Push model
- Stories (24-hour content)
- Direct messaging
- Explore page

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Media storage strategies
- Feed generation (Push/Pull/Hybrid)
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { InstagramService } = require('./node/instagram');

const instagram = new InstagramService();

// Create user
const user = instagram.createUser('user1', 'alice', 'alice@example.com');

// Upload post
const post = await instagram.uploadPost('user1', 'https://example.com/image.jpg', 'Beautiful sunset!');

// Get feed
const feed = instagram.getFeed('user1');

// Create story
const story = instagram.createStory('user1', 'https://example.com/story.jpg');
```

## Performance Optimization

### Image Optimization
- **Compression:** Reduce file size
- **Multiple sizes:** Thumbnails, medium, full
- **Lazy loading:** Load images on demand
- **Progressive loading:** Show low-res first

### CDN Strategy
- **Geographic distribution:** Edge locations worldwide
- **Cache headers:** Appropriate TTLs
- **Invalidation:** Clear cache on updates

### Database Optimization
- **Read replicas:** Distribute read load
- **Sharding:** Shard by user_id
- **Indexing:** Optimize query performance

## Monitoring

### Key Metrics
- **Upload success rate:** Photo upload success
- **Feed generation latency:** P50, P95, P99
- **CDN hit rate:** Cache effectiveness
- **Storage usage:** Current vs capacity

### Alerts
- High upload failure rate
- Slow feed generation
- Low CDN hit rate
- Storage capacity warnings

## Trade-offs

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

### Storage vs Cost
- **More storage tiers:** Better performance, higher cost
- **Fewer tiers:** Lower cost, slower access

### Push vs Pull
- **Push:** Fast reads, slow writes
- **Pull:** Fast writes, slow reads
- **Hybrid:** Best of both, more complex

## Further Enhancements

1. **Video support:** Video uploads and playback
2. **IGTV:** Long-form video content
3. **Reels:** Short video content
4. **Shopping:** Product tags and checkout
5. **Live streaming:** Real-time video streaming
6. **AR filters:** Augmented reality effects

