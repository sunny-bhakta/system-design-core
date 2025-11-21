# Design WhatsApp

## Problem Statement

Design a messaging application like WhatsApp that supports one-on-one and group messaging with real-time delivery.

## Requirements

### Functional Requirements
- Send/receive messages
- One-on-one chats
- Group chats (up to 256 members)
- Media sharing (images, videos, audio, documents)
- Message status (sent, delivered, read)
- Online/offline status
- Message history
- End-to-end encryption

### Non-Functional Requirements
- Handle 2B+ users
- 100B messages/day = ~1.16M messages/second
- Real-time delivery (< 100ms)
- High availability (99.9%)
- Message persistence

## Capacity Estimation

### Storage
- **Messages:** 100B/day * 100 bytes = 10TB/day = 3.65PB/year
- **Media:** 1B media/day * 1MB = 1PB/day = 365PB/year
- **User data:** 2B users * 1KB = 2TB
- **Total:** ~370PB/year

### Bandwidth
- **Message delivery:** 1.16M msgs/sec * 100 bytes = 116MB/sec
- **Media delivery:** 11.6K media/sec * 1MB = 11.6GB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  Message     │
│             │     │  Balancer    │     │  Service     │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  WebSocket   │         │  Message     │         │  Media       │
            │  Server      │         │  Queue       │         │  Storage     │
            └──────────────┘         └──────────────┘         └──────────────┘
                    │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Database         │
                                    │  (NoSQL)          │
                                    └───────────────────┘
```

### Messaging Architecture

#### WebSocket Connection
- **Persistent connection:** Real-time bidirectional communication
- **Connection pooling:** Manage millions of connections
- **Load balancing:** Distribute connections across servers

#### Message Flow
1. **Send:** Client → Message Service → Queue
2. **Delivery:** Queue → WebSocket Server → Recipient
3. **Persistence:** Message Service → Database
4. **Status updates:** Recipient → Message Service → Sender

### Database Schema

#### Messages Table
```sql
CREATE TABLE messages (
  id BIGINT PRIMARY KEY,
  chat_id VARCHAR(100) NOT NULL,
  sender_id BIGINT NOT NULL,
  recipient_id BIGINT,
  group_id BIGINT,
  text TEXT,
  type VARCHAR(20), -- text, image, video, audio, document
  media_url VARCHAR(500),
  status VARCHAR(20), -- sent, delivered, read
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  INDEX idx_chat_id (chat_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_recipient_id (recipient_id),
  INDEX idx_created_at (created_at)
);
```

#### Groups Table
```sql
CREATE TABLE groups (
  id BIGINT PRIMARY KEY,
  name VARCHAR(100),
  creator_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  member_count INT DEFAULT 0
);
```

#### Group Members Table
```sql
CREATE TABLE group_members (
  group_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(20), -- admin, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id)
);
```

### Message Queue

#### Purpose
- **Reliability:** Ensure message delivery
- **Offline handling:** Queue for offline users
- **Rate limiting:** Control message rate
- **Retry logic:** Retry failed deliveries

#### Queue Strategy
- **Per-user queue:** Separate queue per user
- **Priority:** Urgent messages first
- **TTL:** Expire old messages

### Presence System

#### Online Status
- **WebSocket connection:** Track active connections
- **Heartbeat:** Periodic ping to detect disconnection
- **Last seen:** Track last activity time

#### Implementation
- **Redis:** Store presence data
- **Pub/Sub:** Notify status changes
- **TTL:** Auto-expire stale status

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Chat Storage
- **chats:** Map<chatId, Array<message>> - Chat messages
- **Key Format:** One-on-one: "userId1_userId2" (sorted), Group: groupId
- **Production:** NoSQL database (MongoDB, Cassandra) for messages

#### Group Storage
- **groups:** Map<groupId, groupData> - Group information
- **Production:** SQL database for groups

#### Presence Storage
- **presence:** Map<userId, presenceData> - Online/offline status
- **Production:** Redis for fast presence lookups

#### Message Queue
- **messageQueue:** Map<userId, Array<message>> - Pending messages for offline users
- **Production:** Message queue (Kafka, RabbitMQ) for offline delivery

## Process Flow

### Send Message Process

1. **Get Chat ID:** Generate chat ID from user IDs (sorted for consistency)
2. **Create Message:** Generate unique ID, store metadata
3. **Store Message:** Add to chat history
4. **Check Recipient Status:** Check if recipient is online
5. **Deliver or Queue:**
   - If online: Deliver immediately via WebSocket, update status to "delivered"
   - If offline: Queue message for later delivery
6. **Return Message:** Return created message object

### Message Status Flow

```
sent → delivered → read
```

- **sent:** Message created and stored
- **delivered:** Message delivered to recipient's device
- **read:** Recipient has read the message

### Real-time Delivery Process

1. **Check Presence:** Check if recipient is online
2. **WebSocket Delivery:** Send message via WebSocket connection
3. **Update Status:** Mark as "delivered", set deliveredAt timestamp
4. **Notify Sender:** Send delivery confirmation to sender

### Offline Delivery Process

1. **Queue Message:** Add message to recipient's queue
2. **User Comes Online:** When recipient connects
3. **Deliver Queued Messages:** Send all queued messages
4. **Update Status:** Mark messages as "delivered"
5. **Clear Queue:** Remove messages from queue

## Messaging Architecture

### WebSocket Connection
- **Persistent Connection:** Real-time bidirectional communication
- **Connection Management:** Track active connections per user
- **Load Balancing:** Distribute connections across servers
- **Connection Pooling:** Reuse connections efficiently

### Message Queue
- **Purpose:** Store messages for offline users
- **Technology:** Kafka, RabbitMQ, or Redis
- **Delivery:** Deliver when user comes online
- **TTL:** Expire old messages after certain period

### Message Persistence
- **Storage:** NoSQL database (MongoDB, Cassandra)
- **Sharding:** Shard by chat_id for scalability
- **Indexing:** Index on chat_id, created_at, sender_id
- **Retention:** Keep messages for configurable period

## Group Messaging

### Group Structure
- **Members:** Set of user IDs (up to 256 members)
- **Admins:** Set of admin user IDs
- **Creator:** User who created the group
- **Permissions:** Admins can add/remove members

### Group Message Flow
1. **Validate Membership:** Check if sender is group member
2. **Create Message:** Generate message with groupId
3. **Store Message:** Add to group chat
4. **Fan-out Delivery:** Deliver to all online members
5. **Queue for Offline:** Queue for offline members
6. **Track Reads:** Track which members have read message

## Performance Considerations

### Time Complexity
- **Send Message:** O(1) for storage, O(1) for delivery check
- **Get Messages:** O(n) where n = messages in chat
- **Group Message:** O(m) where m = number of members
- **Mark as Read:** O(n) where n = messages in chat

### Space Complexity
- **Message Storage:** O(m) where m = total messages
- **Presence:** O(u) where u = users
- **Message Queue:** O(u * q) where u = users, q = queued messages per user

### Latency Targets
- **Real-time Delivery:** < 100ms (via WebSocket)
- **Offline Delivery:** < 500ms (when user comes online)
- **Message Retrieval:** < 200ms

## Implementation

### Node.js Implementation

See [Node.js Code](./node/whatsapp.js)

**Key features:**
- One-on-one messaging with real-time delivery
- Group messaging (up to 256 members)
- Message status tracking (sent, delivered, read)
- Online/offline presence management
- Offline message queuing
- Media message support

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Messaging architecture
- Data structures
- Process flows
- Real-time delivery mechanisms
- Offline delivery strategies
- Production considerations

### Usage Example

```javascript
const { WhatsAppService } = require('./node/whatsapp');

const whatsapp = new WhatsAppService();

// Create users
const user1 = whatsapp.createUser('user1', '+1234567890', 'Alice');
const user2 = whatsapp.createUser('user2', '+0987654321', 'Bob');

// Set online status
whatsapp.setOnlineStatus('user1', true);

// Send message
const message = await whatsapp.sendMessage('user1', 'user2', 'Hello!');

// Create group
const group = whatsapp.createGroup('user1', 'Friends', ['user2', 'user3']);

// Send group message
await whatsapp.sendGroupMessage('user1', group.id, 'Hello everyone!');
```

## Performance Optimization

### Connection Management
- **Connection pooling:** Reuse WebSocket connections
- **Load balancing:** Distribute connections
- **Connection limits:** Per-server connection limits

### Message Delivery
- **Batching:** Batch multiple messages
- **Compression:** Compress message payload
- **Caching:** Cache recent messages

### Database Optimization
- **Sharding:** Shard by chat_id
- **Read replicas:** Distribute read load
- **Indexing:** Optimize query performance

## Monitoring

### Key Metrics
- **Message delivery latency:** P50, P95, P99
- **Connection count:** Active WebSocket connections
- **Queue depth:** Messages in queue
- **Delivery success rate:** Successful deliveries

### Alerts
- High message delivery latency
- High queue depth
- Low delivery success rate
- Connection failures

## Trade-offs

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

### Real-time vs Reliability
- **Real-time:** Fast delivery, may lose messages
- **Reliable:** Guaranteed delivery, may be delayed

### Storage vs Cost
- **More storage:** Better performance, higher cost
- **Less storage:** Lower cost, slower access

## Further Enhancements

1. **End-to-end encryption:** Secure messaging
2. **Voice/video calls:** Real-time communication
3. **Status updates:** 24-hour status stories
4. **Payment integration:** Send/receive money
5. **Business features:** Business accounts
6. **Multi-device:** Sync across devices

