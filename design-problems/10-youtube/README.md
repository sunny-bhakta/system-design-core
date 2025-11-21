# Design YouTube

## Problem Statement

Design a video sharing platform like YouTube with video upload, streaming, comments, and recommendations.

## Requirements

### Functional Requirements
- Upload videos
- Video streaming (multiple qualities)
- Comments and likes
- Subscriptions
- Recommendations
- Search
- Playlists
- Channel management

### Non-Functional Requirements
- Handle 2B+ users
- 500 hours of video uploaded/minute
- Low latency streaming
- Global CDN
- High availability (99.9%)

## Capacity Estimation

### Storage
- **Videos:** 500 hours/min * 1GB/hour = 500GB/min = 720TB/day = 262PB/year
- **Encoded versions:** 3 qualities * 262PB = 786PB/year
- **Thumbnails:** 500 hours/min * 100KB = 50GB/min = 72TB/day
- **User data:** 2B users * 2KB = 4TB
- **Comments:** 1B comments/day * 500 bytes = 500GB/day
- **Total:** ~790PB/year

### Bandwidth
- **Upload:** 8.3 hours/sec * 1GB/hour = 8.3GB/sec
- **Streaming:** 1B views/day * 100MB = 100PB/day = 1.16TB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  CDN        │────▶│  Video      │
│             │     │  (Edge)     │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Encoding    │         │  Metadata   │         │  Search     │
            │  Pipeline    │         │  Service    │         │  Service    │
            └──────────────┘         └──────────────┘         └──────────────┘
                    │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Object Storage    │
                                    │  (S3-like)         │
                                    └────────────────────┘
```

### Video Processing Pipeline

#### Stages
1. **Upload:** Original video uploaded
2. **Validation:** Check format, size, content
3. **Transcoding:** Encode to multiple qualities
4. **Thumbnail generation:** Create thumbnails
5. **Metadata extraction:** Extract info
6. **Storage:** Store in object storage
7. **CDN distribution:** Distribute to CDN
8. **Indexing:** Index for search

### Search System

#### Components
- **Full-text search:** Elasticsearch
- **Video metadata:** Title, description, tags
- **Transcripts:** Auto-generated captions
- **Ranking:** Views, likes, recency

### Recommendations

#### Algorithm
- **Collaborative filtering:** Similar users
- **Content-based:** Similar videos
- **Hybrid:** Combine both approaches
- **Real-time:** Update based on watch history

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Channel Storage
- **channels:** Map<userId, channelData> - Channel information
- **Production:** SQL database

#### Video Storage
- **videos:** Map<videoId, videoData> - Video metadata
- **Production:** SQL database for metadata, object storage (S3) for videos

#### Comments Storage
- **comments:** Map<videoId, Array<comment>> - Comments per video
- **Production:** NoSQL database (MongoDB, Cassandra)

#### Likes Storage
- **likes:** Map<videoId, Set<userId>> - Users who liked each video
- **Production:** SQL database or Redis

#### Subscriptions
- **subscriptions:** Map<userId, Set<channelId>> - User subscriptions
- **Production:** SQL database with indexes

#### Watch History
- **watchHistory:** Map<userId, Array<videoId>> - User watch history
- **Production:** NoSQL database (MongoDB, Cassandra)

#### Recommendations
- **recommendations:** Map<userId, Array<videoId>> - Personalized recommendations
- **Production:** Redis for fast access, ML service for generation

## Process Flow

### Upload Video Process

1. **Validate Channel:** Check if user has channel
2. **Create Video Object:** Generate unique ID, store metadata
3. **Store Video:** Save to database
4. **Initialize Tracking:** Create comments and likes sets
5. **Update Channel:** Increment channel video count
6. **Queue Processing:** Add to encoding queue
7. **Process Video:** Encode, generate thumbnails, extract metadata
8. **Update Status:** Mark as published when ready

### Video Processing Pipeline

1. **Upload:** Original video uploaded to object storage
2. **Validation:** Check format, size, content
3. **Transcoding:** Encode to multiple qualities (SD, HD, FHD, 4K)
4. **Thumbnail Generation:** Create thumbnails for UI
5. **Metadata Extraction:** Extract duration, resolution, codec
6. **HLS Segmentation:** Split into segments for adaptive streaming
7. **Storage:** Store in object storage
8. **CDN Distribution:** Push to CDN edge locations
9. **Indexing:** Index for search (Elasticsearch)
10. **Status Update:** Mark as published

## Recommendations Algorithm

### Collaborative Filtering
- **User-based:** Find users with similar watch history
- **Item-based:** Find videos similar to watched videos
- **Matrix Factorization:** Decompose user-item matrix

### Content-based Filtering
- **Video Features:** Genre, tags, category, duration
- **Similarity:** Calculate similarity between videos
- **Ranking:** Rank by similarity score

### Hybrid Approach
- **Combine:** Merge collaborative and content-based results
- **Weighted:** Weight each approach based on data availability
- **Real-time:** Update based on recent watch history

## Search System

### Full-text Search
- **Elasticsearch:** Index video metadata (title, description, tags)
- **Transcripts:** Auto-generated captions for search
- **Ranking:** Views, likes, recency, relevance

### Search Process
1. **Query Processing:** Parse and tokenize search query
2. **Index Lookup:** Search Elasticsearch index
3. **Ranking:** Score and rank results
4. **Filtering:** Apply filters (category, duration, etc.)
5. **Return Results:** Return top N results

## Performance Considerations

### Time Complexity
- **Upload Video:** O(1) for metadata, O(n) for encoding where n = qualities
- **Get Stream:** O(1) for lookup
- **Search:** O(log n) with Elasticsearch where n = indexed videos
- **Get Recommendations:** O(v) where v = videos (inefficient, would use ML)

### Space Complexity
- **Video Storage:** O(v * q) where v = videos, q = qualities
- **Watch History:** O(u * h) where u = users, h = history per user

### Latency Targets
- **Stream Start:** < 2 seconds
- **Search:** < 200ms
- **Recommendations:** < 500ms

## Implementation

### Node.js Implementation

See [Node.js Code](./node/youtube.js)

**Key features:**
- Video upload and processing pipeline
- Multi-quality video streaming
- Comments and likes system
- Subscriptions management
- Personalized recommendations
- Search functionality
- Watch history tracking

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Video processing pipeline
- Recommendations algorithms
- Search system
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { YouTubeService } = require('./node/youtube');

const youtube = new YouTubeService();

// Upload video
const video = await youtube.uploadVideo('user1', 'title', 'description', 'video.mp4');

// Stream video
const stream = await youtube.getVideoStream(video.id, 'HD');

// Comment
await youtube.addComment('user2', video.id, 'Great video!');

// Subscribe
await youtube.subscribe('user2', 'user1');

// Get recommendations
const recommendations = await youtube.getRecommendations('user2');
```

## Performance Optimization

### Streaming Optimization
- **CDN caching:** Cache at edge locations
- **Adaptive bitrate:** Adjust based on bandwidth
- **Prefetching:** Prefetch next segments
- **Compression:** Compress video segments

### Search Optimization
- **Indexing:** Fast full-text search
- **Caching:** Cache search results
- **Ranking:** Optimize ranking algorithm

## Monitoring

### Key Metrics
- **Upload success rate:** Video upload success
- **Streaming latency:** P50, P95, P99
- **Search latency:** Search response time
- **Recommendation accuracy:** Click-through rate

### Alerts
- High upload failure rate
- Slow streaming
- Slow search
- Low recommendation accuracy

## Trade-offs

### Quality vs Bandwidth
- **Higher quality:** Better experience, more bandwidth
- **Lower quality:** Less bandwidth, worse experience
- **Adaptive:** Best of both, more complex

### Storage vs Cost
- **More storage tiers:** Better performance, higher cost
- **Fewer tiers:** Lower cost, slower access

## Further Enhancements

1. **Live streaming:** Real-time video streaming
2. **Shorts:** Short-form video content
3. **Premium:** Ad-free experience
4. **Community features:** Community posts
5. **Analytics:** Creator analytics
6. **Monetization:** Ad revenue sharing

