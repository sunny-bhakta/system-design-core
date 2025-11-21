# Design Netflix

## Problem Statement

Design a video streaming platform like Netflix that serves video content to millions of users worldwide.

## Requirements

### Functional Requirements
- Video upload and encoding
- Video streaming (multiple qualities)
- User profiles and accounts
- Recommendations
- Search and browse
- Watch history
- Playlists
- Subtitles

### Non-Functional Requirements
- Handle 200M+ users
- Support multiple video qualities (SD, HD, 4K)
- Low buffering (< 2 seconds)
- Global CDN
- High availability (99.9%)

## Capacity Estimation

### Storage
- **Videos:** 10K titles * 100GB average = 1PB
- **Encoded versions:** 3 qualities * 1PB = 3PB
- **User data:** 200M users * 5KB = 1TB
- **Watch history:** 200M users * 100 videos * 1KB = 20TB
- **Total:** ~3PB

### Bandwidth
- **Streaming:** 50M concurrent * 5Mbps = 250Tbps
- **Upload:** 100 uploads/day * 100GB = 10TB/day

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  CDN        │────▶│  Video      │
│             │     │  (Edge)     │     │  Server     │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Encoding    │         │  Metadata   │         │  Recommen-  │
            │  Pipeline    │         │  Service    │         │  dation     │
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

#### Encoding Stages
1. **Upload:** Original video uploaded
2. **Validation:** Check format, size
3. **Transcoding:** Encode to multiple qualities
4. **Thumbnail generation:** Create thumbnails
5. **Metadata extraction:** Extract info
6. **Storage:** Store in object storage
7. **CDN distribution:** Distribute to CDN

#### Video Qualities
- **SD:** 480p, ~1Mbps
- **HD:** 720p, ~3Mbps
- **Full HD:** 1080p, ~5Mbps
- **4K:** 2160p, ~15Mbps

### Adaptive Bitrate Streaming

#### HLS (HTTP Live Streaming)
- **Segments:** Video split into small chunks
- **Manifest:** M3U8 file with segment URLs
- **Quality switching:** Client adapts based on bandwidth
- **Benefits:** Smooth playback, bandwidth efficient

### CDN Strategy

#### Edge Locations
- **Global distribution:** Servers worldwide
- **Caching:** Cache popular content
- **Load balancing:** Route to nearest edge
- **Failover:** Automatic failover

#### Caching Strategy
- **Hot content:** Cache at all edges
- **Warm content:** Cache at regional edges
- **Cold content:** Origin only

### Database Schema

#### Videos Table
```sql
CREATE TABLE videos (
  id BIGINT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  duration INT, -- seconds
  release_date DATE,
  genre VARCHAR(50),
  rating DECIMAL(3,1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_genre (genre),
  INDEX idx_rating (rating)
);
```

#### Video Files Table
```sql
CREATE TABLE video_files (
  id BIGINT PRIMARY KEY,
  video_id BIGINT NOT NULL,
  quality VARCHAR(20), -- SD, HD, FHD, 4K
  file_url VARCHAR(500),
  file_size BIGINT,
  bitrate INT,
  INDEX idx_video_id (video_id)
);
```

#### Watch History Table
```sql
CREATE TABLE watch_history (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  video_id BIGINT NOT NULL,
  watched_duration INT, -- seconds
  completed BOOLEAN DEFAULT FALSE,
  watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_video_id (video_id)
);
```

## Data Structures

### In-Memory Storage (Production: Database)

#### Video Metadata Storage
- **videos:** Map<videoId, videoData> - Video information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Video Files Storage
- **videoFiles:** Map<videoId, Map<quality, fileData>> - Encoded video files
- **Production:** Object storage (S3) for files, database for metadata

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database

#### Watch History
- **watchHistory:** Map<userId, Array<watchRecord>> - Watch history per user
- **Production:** NoSQL database (MongoDB, Cassandra)

#### Recommendations
- **recommendations:** Map<userId, Array<videoId>> - Personalized recommendations
- **Production:** Redis for fast access, ML service for generation

#### Encoding Queue
- **encodingQueue:** Array<encodingJob> - Video encoding jobs
- **Production:** Message queue (Kafka, RabbitMQ) or job queue (AWS SQS)

## Process Flow

### Upload Video Process

1. **Create Video Object:** Generate unique ID, store metadata
2. **Store Video:** Save to database
3. **Initialize Files:** Create empty file map for qualities
4. **Queue Encoding:** Add to encoding queue
5. **Process Encoding:** Encode to multiple qualities
6. **Update Status:** Mark as ready when encoding complete
7. **Return Video:** Return created video object

### Video Encoding Process

1. **Validate Video:** Check format, size
2. **Update Status:** Mark as encoding
3. **Encode Qualities:** Transcode to SD, HD, FHD, 4K
4. **Generate Files:** Create file entries for each quality
5. **Store Files:** Save to object storage
6. **Create HLS Manifest:** Generate M3U8 manifest file
7. **Update Status:** Mark as ready
8. **Distribute to CDN:** Push to CDN edge locations

### Get Video Stream Process

1. **Validate Video:** Check if exists and ready
2. **Get Requested Quality:** Retrieve file for requested quality
3. **Quality Fallback:** If not available, use highest available
4. **Record Watch Start:** Track watch history (if user provided)
5. **Return Stream Info:** Return stream URL, manifest URL, bitrate

### Recommendation Process

1. **Analyze Watch History:** Get user's completed videos
2. **Extract Genres:** Count watched genres
3. **Find Similar Videos:** Match videos by genre
4. **Calculate Scores:** Score = genre_count * video_rating
5. **Sort and Limit:** Sort by score, return top N
6. **Cache Recommendations:** Store for fast access

## Video Encoding Details

### Encoding Pipeline

1. **Upload:** Original video uploaded to object storage
2. **Validation:** Check format, size, duration
3. **Transcoding:** Encode to multiple qualities (SD, HD, FHD, 4K)
4. **Thumbnail Generation:** Create thumbnails for UI
5. **Metadata Extraction:** Extract duration, resolution, codec
6. **HLS Segmentation:** Split into small segments (10 seconds)
7. **Manifest Creation:** Generate M3U8 manifest file
8. **Storage:** Store in object storage
9. **CDN Distribution:** Push to CDN edge locations

### Video Qualities

#### SD (Standard Definition)
- **Resolution:** 480p
- **Bitrate:** ~1Mbps
- **Use Case:** Low bandwidth, mobile devices

#### HD (High Definition)
- **Resolution:** 720p
- **Bitrate:** ~3Mbps
- **Use Case:** Standard streaming, tablets

#### FHD (Full High Definition)
- **Resolution:** 1080p
- **Bitrate:** ~5Mbps
- **Use Case:** Desktop, high-quality streaming

#### 4K (Ultra High Definition)
- **Resolution:** 2160p
- **Bitrate:** ~15Mbps
- **Use Case:** Large screens, premium experience

## Adaptive Bitrate Streaming

### HLS (HTTP Live Streaming)

#### Process
1. **Segmentation:** Video split into small segments (10 seconds)
2. **Manifest:** M3U8 file contains segment URLs for all qualities
3. **Client Selection:** Client selects quality based on bandwidth
4. **Quality Switching:** Client switches quality during playback
5. **Smooth Playback:** Ensures continuous playback without buffering

#### Benefits
- **Bandwidth Efficient:** Only download needed quality
- **Smooth Playback:** Automatic quality adjustment
- **Better UX:** No buffering interruptions

### Quality Selection Algorithm
1. **Measure Bandwidth:** Monitor download speed
2. **Select Quality:** Choose highest quality that fits bandwidth
3. **Monitor Performance:** Track buffer level, download speed
4. **Adjust Quality:** Switch up or down based on conditions

## CDN Strategy

### Edge Locations
- **Global Distribution:** Servers worldwide
- **Caching:** Cache popular content at edge
- **Load Balancing:** Route to nearest edge
- **Failover:** Automatic failover to backup edge

### Caching Strategy
- **Hot Content:** Cache at all edges (popular videos)
- **Warm Content:** Cache at regional edges (moderate popularity)
- **Cold Content:** Origin only (rarely accessed)

### Content Distribution
- **Push Model:** Pre-push popular content to edges
- **Pull Model:** Cache on-demand when requested
- **Hybrid:** Push hot content, pull warm/cold content

## Performance Considerations

### Time Complexity
- **Upload Video:** O(1) for metadata, O(n) for encoding where n = qualities
- **Get Stream:** O(1) for file lookup
- **Record History:** O(1) for storage
- **Get Recommendations:** O(v) where v = total videos (inefficient)

### Space Complexity
- **Video Storage:** O(v * q) where v = videos, q = qualities
- **Watch History:** O(u * h) where u = users, h = history per user

### Latency Targets
- **Stream Start:** < 2 seconds (buffering)
- **Quality Switch:** < 1 second
- **CDN Response:** < 100ms

## Implementation

### Node.js Implementation

See [Node.js Code](./node/netflix.js)

**Key features:**
- Video upload and encoding to multiple qualities
- Adaptive bitrate streaming (HLS)
- Watch history tracking
- Personalized recommendations based on watch history
- Search and browse functionality
- Trending videos

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Video encoding pipeline
- Adaptive bitrate streaming
- CDN strategy
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { NetflixService } = require('./node/netflix');

const netflix = new NetflixService();

// Upload video
const video = await netflix.uploadVideo('title', 'description', 'video.mp4');

// Stream video
const stream = await netflix.getVideoStream(video.id, 'HD');

// Record watch history
await netflix.recordWatchHistory('user1', video.id, 1200);

// Get recommendations
const recommendations = await netflix.getRecommendations('user1');
```

## Performance Optimization

### Streaming Optimization
- **CDN caching:** Cache at edge locations
- **Compression:** Compress video segments
- **Prefetching:** Prefetch next segments
- **Quality adaptation:** Adjust based on bandwidth

### Database Optimization
- **Read replicas:** Distribute read load
- **Caching:** Cache metadata
- **Partitioning:** Partition by genre/date

## Monitoring

### Key Metrics
- **Streaming latency:** P50, P95, P99
- **CDN hit rate:** Cache effectiveness
- **Buffering rate:** Playback interruptions
- **Encoding time:** Video processing time

### Alerts
- High streaming latency
- Low CDN hit rate
- High buffering rate
- Encoding failures

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
2. **Interactive content:** Choose-your-own-adventure
3. **Social features:** Share and discuss
4. **Offline downloads:** Download for offline viewing
5. **Multiple languages:** Multi-language support
6. **VR support:** Virtual reality content

