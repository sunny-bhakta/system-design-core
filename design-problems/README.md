# System Design Problems

This directory contains detailed documentation and implementations for classic system design problems, organized by topic with numbered folders.

## Implementation Status

| Problem | Documentation | Node.js | Python |
|---------|---------------|---------|--------|
| [01. URL Shortener](#01-url-shortener) | ✅ | ✅ | ⏳ |
| [02. Distributed Cache](#02-distributed-cache) | ✅ | ✅ | ⏳ |
| [03. Rate Limiter](#03-rate-limiter) | ✅ | ✅ | ⏳ |
| [04. Design Twitter/X](#04-design-twitterx) | ✅ | ✅ | ⏳ |
| [05. Design Instagram](#05-design-instagram) | ✅ | ✅ | ⏳ |
| [06. Design Facebook News Feed](#06-design-facebook-news-feed) | ✅ | ✅ | ⏳ |
| [07. Design WhatsApp](#07-design-whatsapp) | ✅ | ✅ | ⏳ |
| [08. Design Netflix](#08-design-netflix) | ✅ | ✅ | ⏳ |
| [09. Design Uber](#09-design-uber) | ✅ | ✅ | ⏳ |
| [10. Design YouTube](#10-design-youtube) | ✅ | ✅ | ⏳ |
| [11. Design Search Engine](#11-design-search-engine) | ✅ | ✅ | ⏳ |
| [12. Design Chat System](#12-design-chat-system) | ✅ | ✅ | ⏳ |
| [13. Design Notification System](#13-design-notification-system) | ✅ | ✅ | ⏳ |
| [14. Design Payment System](#14-design-payment-system) | ✅ | ✅ | ⏳ |
| [15. Design File Storage System](#15-design-file-storage-system) | ✅ | ✅ | ⏳ |

## Table of Contents

1. [URL Shortener](#01-url-shortener)
2. [Distributed Cache](#02-distributed-cache)
3. [Rate Limiter](#03-rate-limiter)
4. [Design Twitter/X](#04-design-twitterx)
5. [Design Instagram](#05-design-instagram)
6. [Design Facebook News Feed](#06-design-facebook-news-feed)
7. [Design WhatsApp](#07-design-whatsapp)
8. [Design Netflix](#08-design-netflix)
9. [Design Uber](#09-design-uber)
10. [Design YouTube](#10-design-youtube)
11. [Design Search Engine](#11-design-search-engine)
12. [Design Chat System](#12-design-chat-system)
13. [Design Notification System](#13-design-notification-system)
14. [Design Payment System](#14-design-payment-system)
15. [Design File Storage System](#15-design-file-storage-system)

---

## 01. URL Shortener

Design a URL shortening service like TinyURL or bit.ly.

**Key Concepts:** Base62 encoding, caching, analytics, sharding

- [Documentation](./01-url-shortener/README.md)
- [Node.js Code](./01-url-shortener/node/url-shortener.js)

---

## 02. Distributed Cache

Design a distributed caching system like Redis or Memcached.

**Key Concepts:** Consistent hashing, eviction policies, replication, TTL

- [Documentation](./02-distributed-cache/README.md)
- [Node.js Code](./02-distributed-cache/node/distributed-cache.js)

---

## 03. Rate Limiter

Design a rate limiting system with multiple algorithms.

**Key Concepts:** Token bucket, sliding window, fixed window, distributed rate limiting

- [Documentation](./03-rate-limiter/README.md)
- [Node.js Code](./03-rate-limiter/node/rate-limiter-design.js)

---

## 04. Design Twitter/X

Design a social media platform with tweets, follows, and timelines.

**Key Concepts:** Timeline generation (push/pull), caching, search, trending topics

- [Documentation](./04-twitter/README.md)
- [Node.js Code](./04-twitter/node/twitter.js)

---

## 05. Design Instagram

Design a photo-sharing social network with feeds, stories, and direct messaging.

**Key Concepts:** Media storage, CDN, feed generation, stories (24-hour content)

- [Documentation](./05-instagram/README.md)
- [Node.js Code](./05-instagram/node/instagram.js)

---

## 06. Design Facebook News Feed

Design a news feed system with personalized content and ranking.

**Key Concepts:** Feed ranking, ML-based relevance, pre-computation, real-time updates

- [Documentation](./06-facebook-newsfeed/README.md)
- [Node.js Code](./06-facebook-newsfeed/node/facebook-newsfeed.js)

---

## 07. Design WhatsApp

Design a messaging application with one-on-one and group messaging.

**Key Concepts:** Real-time messaging, message persistence, presence, end-to-end encryption

- [Documentation](./07-whatsapp/README.md)
- [Node.js Code](./07-whatsapp/node/whatsapp.js)

---

## 08. Design Netflix

Design a video streaming platform with global content delivery.

**Key Concepts:** Video encoding, CDN, adaptive bitrate streaming, recommendations

- [Documentation](./08-netflix/README.md)
- [Node.js Code](./08-netflix/node/netflix.js)

---

## 09. Design Uber

Design a ride-sharing service with real-time matching.

**Key Concepts:** Geospatial indexing, real-time location tracking, matching algorithm

- [Documentation](./09-uber/README.md)
- [Node.js Code](./09-uber/node/uber.js)

---

## 10. Design YouTube

Design a video sharing platform with upload, streaming, and recommendations.

**Key Concepts:** Video processing pipeline, CDN, search, recommendations

- [Documentation](./10-youtube/README.md)
- [Node.js Code](./10-youtube/node/youtube.js)

---

## 11. Design Search Engine

Design a web search engine that indexes billions of pages.

**Key Concepts:** Web crawling, inverted index, ranking algorithm, distributed search

- [Documentation](./11-search-engine/README.md)
- [Node.js Code](./11-search-engine/node/search-engine.js)

---

## 12. Design Chat System

Design a real-time chat system with one-on-one and group messaging.

**Key Concepts:** WebSocket, message queuing, presence, message history

- [Documentation](./12-chat-system/README.md)
- [Node.js Code](./12-chat-system/node/chat-system.js)

---

## 13. Design Notification System

Design a notification system across multiple channels.

**Key Concepts:** Multi-channel delivery, queuing, batching, user preferences

- [Documentation](./13-notification-system/README.md)
- [Node.js Code](./13-notification-system/node/notification-system.js)

---

## 14. Design Payment System

Design a payment processing system with multiple payment methods.

**Key Concepts:** Payment gateways, transaction processing, fraud detection, idempotency

- [Documentation](./14-payment-system/README.md)
- [Node.js Code](./14-payment-system/node/payment-system.js)

---

## 15. Design File Storage System

Design a cloud file storage system like Dropbox or Google Drive.

**Key Concepts:** Object storage, file versioning, sync, conflict resolution

- [Documentation](./15-file-storage/README.md)
- [Node.js Code](./15-file-storage/node/file-storage.js)

---

## How to Use

Each design problem folder contains:
- **README.md:** Detailed documentation with requirements, system design, and trade-offs
- **node/:** Node.js implementation with example code
- **python/:** Python implementation (coming soon)

### Running Examples

```bash
# Navigate to a specific problem
cd design-problems/01-url-shortener

# Run Node.js example
cd node
npm install
npm start
```

## Contributing

When adding new design problems:
1. Create numbered folder: `XX-problem-name`
2. Add README.md with detailed documentation
3. Implement Node.js code in `node/` folder
4. Implement Python code in `python/` folder
5. Update this README.md with status

