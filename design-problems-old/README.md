# System Design Problems

This directory contains detailed documentation and implementations for classic system design problems.

## Implementation Status

| Problem | Documentation | Node.js | Python |
|---------|---------------|---------|--------|
| URL Shortener | ✅ | ✅ | ⏳ |
| Distributed Cache | ✅ | ✅ | ⏳ |
| Rate Limiter | ✅ | ✅ | ⏳ |
| Design Twitter/X | ✅ | ✅ | ⏳ |
| Design Instagram | ✅ | ✅ | ⏳ |
| Design Facebook News Feed | ✅ | ✅ | ⏳ |
| Design WhatsApp | ✅ | ✅ | ⏳ |
| Design Netflix | ✅ | ✅ | ⏳ |
| Design Uber | ✅ | ✅ | ⏳ |
| Design YouTube | ✅ | ✅ | ⏳ |
| Design Search Engine | ✅ | ✅ | ⏳ |
| Design Chat System | ✅ | ✅ | ⏳ |
| Design Notification System | ✅ | ✅ | ⏳ |
| Design Payment System | ✅ | ✅ | ⏳ |
| Design File Storage System | ✅ | ✅ | ⏳ |

## Table of Contents

1. [URL Shortener](#url-shortener)
2. [Distributed Cache](#distributed-cache)
3. [Rate Limiter](#rate-limiter)
4. [Design Twitter/X](#design-twitterx)
5. [Design Instagram](#design-instagram)
6. [Design Facebook News Feed](#design-facebook-news-feed)
7. [Design WhatsApp](#design-whatsapp)
8. [Design Netflix](#design-netflix)
9. [Design Uber](#design-uber)
10. [Design YouTube](#design-youtube)
11. [Design Search Engine](#design-search-engine)
12. [Design Chat System](#design-chat-system)
13. [Design Notification System](#design-notification-system)
14. [Design Payment System](#design-payment-system)
15. [Design File Storage System](#design-file-storage-system)

---

## URL Shortener

### Problem Statement
Design a URL shortening service like TinyURL or bit.ly that converts long URLs into short, shareable links.

### Requirements
- **Functional Requirements:**
  - Shorten long URLs
  - Redirect short URLs to original URLs
  - Custom short URLs (optional)
  - URL expiration (optional)
  - Analytics tracking

- **Non-Functional Requirements:**
  - High availability
  - Low latency
  - Scalable to billions of URLs
  - 99.9% uptime

### Capacity Estimation
- **Traffic:** 100M URLs/day = ~1,160 URLs/second
- **Storage:** 100M URLs * 500 bytes = 50GB/year
- **Bandwidth:** 100M reads/day * 500 bytes = 50GB/day

### System Design
- **API Design:** POST /api/v1/shorten, GET /{shortCode}
- **Database:** SQL for metadata, NoSQL for caching
- **Encoding:** Base62 encoding for short URLs
- **Caching:** Redis for hot URLs
- **Load Balancing:** Round-robin across servers

### Implementation
See [Node.js Implementation](./node/url-shortener.js)

---

## Distributed Cache

### Problem Statement
Design a distributed caching system like Redis or Memcached that provides fast data access across multiple servers.

### Requirements
- **Functional Requirements:**
  - Get/Set operations
  - TTL (Time-To-Live) support
  - Cache eviction policies (LRU, LFU)
  - Distributed across multiple nodes
  - High availability

- **Non-Functional Requirements:**
  - Sub-millisecond latency
  - High throughput
  - Fault tolerance
  - Consistent hashing for distribution

### System Design
- **Architecture:** Distributed hash table
- **Consistent Hashing:** For node distribution
- **Replication:** Master-slave for availability
- **Eviction:** LRU/LFU policies
- **Persistence:** Optional disk persistence

### Implementation
See [Node.js Implementation](./node/distributed-cache.js)

---

## Rate Limiter

### Problem Statement
Design a rate limiting system that restricts the number of requests a user can make within a time window.

### Requirements
- **Functional Requirements:**
  - Limit requests per user/IP
  - Multiple rate limit algorithms
  - Different limits for different endpoints
  - Distributed rate limiting

- **Non-Functional Requirements:**
  - Low latency
  - High throughput
  - Accurate rate limiting

### Algorithms
- **Token Bucket:** Allow bursts
- **Leaky Bucket:** Smooth rate
- **Fixed Window:** Simple time window
- **Sliding Window:** More accurate

### Implementation
See [Node.js Implementation](./node/rate-limiter.js)

---

## Design Twitter/X

### Problem Statement
Design a social media platform like Twitter/X that allows users to post tweets, follow users, and view timelines.

### Requirements
- **Functional Requirements:**
  - Post tweets (280 characters)
  - Follow/unfollow users
  - View user timeline
  - View home timeline (feed)
  - Like, retweet, reply
  - Search tweets
  - Trending topics

- **Non-Functional Requirements:**
  - Handle 500M users
  - 200M tweets/day
  - Low latency feed generation
  - High availability

### System Design
- **Timeline Generation:** Push vs Pull model
- **Database:** User data (SQL), Tweets (NoSQL)
- **Caching:** Redis for timelines
- **Search:** Elasticsearch for full-text search
- **Media Storage:** CDN for images/videos

### Implementation
See [Node.js Implementation](./node/twitter.js)

---

## Design Instagram

### Problem Statement
Design a photo-sharing social network like Instagram with features for posting photos, following users, and viewing feeds.

### Requirements
- **Functional Requirements:**
  - Upload photos/videos
  - Follow/unfollow users
  - View feed (photos from followed users)
  - Like and comment
  - Stories (24-hour content)
  - Explore page
  - Direct messaging

- **Non-Functional Requirements:**
  - Handle 1B+ users
  - 500M photos/day
  - Fast image serving
  - Real-time updates

### System Design
- **Media Storage:** Object storage (S3-like)
- **CDN:** For image delivery
- **Feed Generation:** Hybrid push-pull
- **Database:** User data, metadata
- **Caching:** Redis for feeds

### Implementation
See [Node.js Implementation](./node/instagram.js)

---

## Design Facebook News Feed

### Problem Statement
Design a news feed system that shows personalized content to users based on their connections and interests.

### Requirements
- **Functional Requirements:**
  - Generate personalized feed
  - Rank posts by relevance
  - Real-time updates
  - Support multiple post types
  - Filter and sort options

- **Non-Functional Requirements:**
  - Handle 2B+ users
  - 500M posts/day
  - Sub-second feed generation
  - High availability

### System Design
- **Feed Generation:** Pre-computed + real-time
- **Ranking Algorithm:** ML-based relevance scoring
- **Caching:** Multi-layer caching
- **Database:** Graph database for connections
- **Real-time:** WebSocket for live updates

### Implementation
See [Node.js Implementation](./node/facebook-newsfeed.js)

---

## Design WhatsApp

### Problem Statement
Design a messaging application like WhatsApp that supports one-on-one and group messaging with real-time delivery.

### Requirements
- **Functional Requirements:**
  - Send/receive messages
  - One-on-one chats
  - Group chats
  - Media sharing
  - Message status (sent, delivered, read)
  - End-to-end encryption

- **Non-Functional Requirements:**
  - Handle 2B+ users
  - 100B messages/day
  - Real-time delivery
  - High availability

### System Design
- **Messaging:** WebSocket for real-time
- **Message Storage:** Distributed storage
- **Presence:** Online/offline status
- **Media:** Separate storage for media
- **Encryption:** End-to-end encryption

### Implementation
See [Node.js Implementation](./node/whatsapp.js)

---

## Design Netflix

### Problem Statement
Design a video streaming platform like Netflix that serves video content to millions of users worldwide.

### Requirements
- **Functional Requirements:**
  - Video upload and encoding
  - Video streaming
  - User profiles
  - Recommendations
  - Search and browse
  - Watch history

- **Non-Functional Requirements:**
  - Handle 200M+ users
  - Support multiple video qualities
  - Low buffering
  - Global CDN

### System Design
- **Video Storage:** Object storage
- **CDN:** Global content delivery
- **Encoding:** Multiple quality levels
- **Streaming:** Adaptive bitrate streaming
- **Recommendations:** ML-based

### Implementation
See [Node.js Implementation](./node/netflix.js)

---

## Design Uber

### Problem Statement
Design a ride-sharing service like Uber that matches drivers with riders in real-time.

### Requirements
- **Functional Requirements:**
  - Request ride
  - Match driver with rider
  - Real-time location tracking
  - Payment processing
  - Rating system
  - Trip history

- **Non-Functional Requirements:**
  - Handle millions of concurrent users
  - Real-time matching (< 5 seconds)
  - High availability
  - Global scale

### System Design
- **Matching:** Geospatial indexing
- **Real-time:** WebSocket for location updates
- **Database:** User data, trip data
- **Payment:** Payment gateway integration
- **Notifications:** Push notifications

### Implementation
See [Node.js Implementation](./node/uber.js)

---

## Design YouTube

### Problem Statement
Design a video sharing platform like YouTube with video upload, streaming, comments, and recommendations.

### Requirements
- **Functional Requirements:**
  - Upload videos
  - Video streaming
  - Comments and likes
  - Subscriptions
  - Recommendations
  - Search

- **Non-Functional Requirements:**
  - Handle 2B+ users
  - 500 hours of video uploaded/minute
  - Low latency streaming
  - Global CDN

### System Design
- **Video Processing:** Encoding pipeline
- **Storage:** Object storage + CDN
- **Streaming:** Adaptive bitrate
- **Search:** Full-text search
- **Recommendations:** ML algorithms

### Implementation
See [Node.js Implementation](./node/youtube.js)

---

## Design Search Engine

### Problem Statement
Design a web search engine like Google that indexes billions of web pages and returns relevant results.

### Requirements
- **Functional Requirements:**
  - Web crawling
  - Indexing
  - Ranking algorithm
  - Search query processing
  - Result pagination

- **Non-Functional Requirements:**
  - Index billions of pages
  - Sub-second search results
  - High availability
  - Handle millions of queries/second

### System Design
- **Crawler:** Distributed web crawler
- **Indexer:** Inverted index
- **Ranking:** PageRank + ML
- **Storage:** Distributed storage
- **Caching:** Query result caching

### Implementation
See [Node.js Implementation](./node/search-engine.js)

---

## Design Chat System

### Problem Statement
Design a real-time chat system that supports one-on-one and group messaging with message persistence.

### Requirements
- **Functional Requirements:**
  - Send/receive messages
  - One-on-one chats
  - Group chats
  - Message history
  - Online/offline status
  - Typing indicators

- **Non-Functional Requirements:**
  - Real-time delivery
  - Handle millions of concurrent users
  - Message persistence
  - High availability

### System Design
- **Messaging:** WebSocket for real-time
- **Message Queue:** For reliable delivery
- **Storage:** Message persistence
- **Presence:** Online status tracking
- **Load Balancing:** For WebSocket connections

### Implementation
See [Node.js Implementation](./node/chat-system.js)

---

## Design Notification System

### Problem Statement
Design a notification system that sends notifications to users across multiple channels (push, email, SMS).

### Requirements
- **Functional Requirements:**
  - Send notifications
  - Multiple channels (push, email, SMS)
  - User preferences
  - Notification history
  - Batching and throttling

- **Non-Functional Requirements:**
  - Handle millions of notifications/day
  - Low latency
  - High reliability
  - Scalable

### System Design
- **Notification Service:** Core service
- **Channels:** Push, Email, SMS services
- **Queue:** Message queue for async processing
- **Preferences:** User notification settings
- **Templates:** Notification templates

### Implementation
See [Node.js Implementation](./node/notification-system.js)

---

## Design Payment System

### Problem Statement
Design a payment processing system that handles transactions, supports multiple payment methods, and ensures security.

### Requirements
- **Functional Requirements:**
  - Process payments
  - Multiple payment methods (card, wallet, bank)
  - Payment gateway integration
  - Transaction history
  - Refunds
  - Fraud detection

- **Non-Functional Requirements:**
  - High security
  - ACID transactions
  - Low latency
  - High availability
  - Compliance (PCI-DSS)

### System Design
- **Payment Gateway:** External gateway integration
- **Transaction Processing:** Idempotent operations
- **Database:** ACID-compliant storage
- **Security:** Encryption, tokenization
- **Fraud Detection:** ML-based detection

### Implementation
See [Node.js Implementation](./node/payment-system.js)

---

## Design File Storage System

### Problem Statement
Design a cloud file storage system like Dropbox or Google Drive that allows users to store and sync files.

### Requirements
- **Functional Requirements:**
  - Upload/download files
  - File versioning
  - File sharing
  - Sync across devices
  - Search files
  - Folder structure

- **Non-Functional Requirements:**
  - Handle petabytes of data
  - Fast upload/download
  - High availability
  - Data durability
  - Scalable

### System Design
- **Storage:** Object storage (S3-like)
- **Metadata:** Database for file metadata
- **Sync:** Conflict resolution
- **CDN:** For file delivery
- **Versioning:** File version management

### Implementation
See [Node.js Implementation](./node/file-storage.js)

---

## Code Examples

See implementation examples in:
- [Node.js Examples](./node/)
- [Python Examples](./python/)

