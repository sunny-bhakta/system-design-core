# Design Notification System

## Problem Statement

Design a notification system that sends notifications to users across multiple channels (push, email, SMS).

## Requirements

### Functional Requirements
- Send notifications
- Multiple channels (push, email, SMS)
- User preferences
- Notification history
- Batching and throttling
- Template support
- Delivery tracking

### Non-Functional Requirements
- Handle millions of notifications/day
- Low latency (< 1 second)
- High reliability (99.9%)
- Scalable
- Cost-effective

## Capacity Estimation

### Storage
- **Notifications:** 100M/day * 500 bytes = 50GB/day = 18TB/year
- **User preferences:** 100M users * 1KB = 100GB
- **Templates:** 10K templates * 5KB = 50MB
- **Total:** ~18TB/year

### Bandwidth
- **Push notifications:** 50M/day * 1KB = 50GB/day
- **Email:** 30M/day * 10KB = 300GB/day
- **SMS:** 20M/day * 140 bytes = 2.8GB/day

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Notification│────▶│  Channel   │
│             │     │  Service     │     │  Services   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                    ┌───────▼──────┐
                    │  Message     │
                    │  Queue       │
                    └──────────────┘
                            │
                    ┌───────▼──────┐
                    │  Template    │
                    │  Service     │
                    └──────────────┘
```

### Notification Channels

#### Push Notifications
- **APNS:** Apple Push Notification Service
- **FCM:** Firebase Cloud Messaging
- **Web Push:** Browser push notifications

#### Email
- **SMTP:** Send via email service
- **Templates:** HTML email templates
- **Attachments:** Support file attachments

#### SMS
- **SMS Gateway:** Third-party SMS provider
- **Rate limiting:** Respect carrier limits
- **Cost optimization:** Batch when possible

### Batching and Throttling

#### Batching
- **Group notifications:** Batch similar notifications
- **Time window:** Collect notifications over time
- **Size limit:** Maximum batch size

#### Throttling
- **Per user:** Limit notifications per user
- **Per channel:** Limit per channel
- **Rate limiting:** Respect provider limits

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database

#### User Preferences
- **preferences:** Map<userId, preferencesData> - Notification preferences
- **Production:** SQL database

#### Notification Storage
- **notifications:** Map<userId, Array<notification>> - Notifications per user
- **Production:** NoSQL database (MongoDB, Cassandra)

#### Template Storage
- **templates:** Map<templateId, templateData> - Notification templates
- **Production:** SQL database or template service

#### Batch Queue
- **batchQueue:** Map<channel, Array<notification>> - Queued notifications by channel
- **Production:** Message queue (Kafka, RabbitMQ)

#### Delivery Stats
- **deliveryStats:** Map<channel, statsData> - Delivery statistics
- **Production:** Time-series database (InfluxDB)

## Process Flow

### Send Notification Process

1. **Validate User:** Check if user exists
2. **Check Preferences:** Verify channel is enabled
3. **Create Notification:** Generate unique ID, store content
4. **Store Notification:** Add to user's notification list
5. **Batch or Send:** Add to batch queue or send immediately
6. **Deliver via Channel:** Send via appropriate channel handler
7. **Track Delivery:** Update delivery statistics
8. **Return Notification:** Return created notification

### Batching Process

1. **Collect Notifications:** Group notifications by channel
2. **Batch Size Check:** Check if batch size reached
3. **Time Window Check:** Check if time window elapsed
4. **Send Batch:** Send all notifications in batch
5. **Update Stats:** Track delivery statistics

## Implementation

### Node.js Implementation

See [Node.js Code](./node/notification-system.js)

**Key features:**
- Multi-channel delivery (Push, Email, SMS)
- User preferences management
- Notification templates
- Batching for efficiency
- Throttling to prevent spam
- Delivery tracking and statistics

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Multi-channel architecture
- Batching strategies
- Throttling mechanisms
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { NotificationSystem } = require('./node/notification-system');

const notifications = new NotificationSystem();

// Send notification
await notifications.send({
  userId: 'user1',
  channel: 'push',
  title: 'New message',
  body: 'You have a new message'
});

// Set user preferences
notifications.setUserPreferences('user1', {
  push: true,
  email: false,
  sms: false
});
```

## Performance Optimization

### Queue Optimization
- **Priority queue:** Important notifications first
- **Batching:** Batch similar notifications
- **Retry logic:** Retry failed deliveries

### Channel Optimization
- **Connection pooling:** Reuse connections
- **Rate limiting:** Respect provider limits
- **Caching:** Cache templates

## Monitoring

### Key Metrics
- **Delivery rate:** Successful deliveries
- **Latency:** P50, P95, P99
- **Error rate:** Failed deliveries
- **Channel performance:** Per-channel metrics

### Alerts
- Low delivery rate
- High latency
- High error rate
- Channel failures

## Trade-offs

### Latency vs Cost
- **Lower latency:** More resources, higher cost
- **Higher latency:** Fewer resources, lower cost

### Reliability vs Cost
- **Higher reliability:** More redundancy, higher cost
- **Lower reliability:** Less redundancy, lower cost

## Further Enhancements

1. **Rich notifications:** Images, actions
2. **Scheduled notifications:** Send at specific time
3. **A/B testing:** Test notification content
4. **Analytics:** Track engagement
5. **Personalization:** Personalized content
6. **Multi-language:** Support multiple languages

