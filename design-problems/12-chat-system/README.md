# Design Chat System

## Problem Statement

Design a real-time chat system that supports one-on-one and group messaging with message persistence.

## Requirements

### Functional Requirements
- Send/receive messages
- One-on-one chats
- Group chats
- Message history
- Online/offline status
- Typing indicators
- Message reactions
- File sharing

### Non-Functional Requirements
- Real-time delivery (< 100ms)
- Handle millions of concurrent users
- Message persistence
- High availability (99.9%)
- Scalable

## Capacity Estimation

### Storage
- **Messages:** 1B messages/day * 100 bytes = 100GB/day = 36TB/year
- **User data:** 100M users * 2KB = 200GB
- **Chat metadata:** 10M chats * 1KB = 10GB
- **Total:** ~36TB/year

### Bandwidth
- **Message delivery:** 11.6K msgs/sec * 100 bytes = 1.16MB/sec
- **Presence updates:** 1M updates/sec * 50 bytes = 50MB/sec

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  WebSocket   │────▶│  Message    │
│             │     │  Server      │     │  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
            ┌───────▼──────┐         ┌───────▼──────┐         ┌───────▼──────┐
            │  Message     │         │  Presence    │         │  Storage     │
            │  Queue       │         │  Service     │         │  Service     │
            └──────────────┘         └──────────────┘         └──────────────┘
```

### Messaging Architecture

#### WebSocket Connection
- **Persistent connection:** Real-time bidirectional
- **Connection pooling:** Manage millions of connections
- **Load balancing:** Distribute connections

#### Message Flow
1. **Send:** Client → WebSocket → Message Service
2. **Store:** Message Service → Database
3. **Deliver:** Message Service → WebSocket → Recipient
4. **Acknowledge:** Recipient → Message Service → Sender

### Database Schema

#### Messages Table
```sql
CREATE TABLE messages (
  id BIGINT PRIMARY KEY,
  chat_id VARCHAR(100) NOT NULL,
  sender_id BIGINT NOT NULL,
  text TEXT,
  type VARCHAR(20), -- text, image, file
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_id (chat_id),
  INDEX idx_created_at (created_at)
);
```

#### Chats Table
```sql
CREATE TABLE chats (
  id VARCHAR(100) PRIMARY KEY,
  type VARCHAR(20), -- one_on_one, group
  members TEXT, -- JSON array of user IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Data Structures

### In-Memory Storage (Production: Database)

#### User Storage
- **users:** Map<userId, userData> - User information
- **Production:** SQL database (PostgreSQL, MySQL)

#### Chat Storage
- **chats:** Map<chatId, chatData> - Chat information (one-on-one and group)
- **Production:** SQL database

#### Message Storage
- **messages:** Map<chatId, Array<message>> - Messages per chat
- **Production:** NoSQL database (MongoDB, Cassandra)

#### Presence Storage
- **presence:** Map<userId, presenceData> - Online/offline status
- **Production:** Redis for fast presence lookups

#### Typing Indicators
- **typing:** Map<chatId, Set<userId>> - Users currently typing
- **Production:** Redis with TTL

## Process Flow

### Send Message Process

1. **Get Chat ID:** Generate chat ID from user IDs
2. **Create Chat:** Create chat if doesn't exist
3. **Create Message:** Generate unique ID, store content
4. **Store Message:** Add to chat's message list
5. **Update Chat Timestamp:** Update last message time
6. **Deliver via WebSocket:** Send to recipient if online
7. **Queue if Offline:** Queue for offline delivery
8. **Return Message:** Return created message

### Real-time Delivery

1. **Check Presence:** Check if recipient is online
2. **WebSocket Delivery:** Send via WebSocket connection
3. **Update Status:** Mark as delivered
4. **Notify Sender:** Send delivery confirmation

## Implementation

### Node.js Implementation

See [Node.js Code](./node/chat-system.js)

**Key features:**
- One-on-one messaging with real-time delivery
- Group messaging
- Message persistence
- Online/offline presence management
- Typing indicators
- Message history

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Messaging architecture
- WebSocket delivery
- Data structures
- Process flows
- Performance optimizations
- Production considerations

### Usage Example

```javascript
const { ChatSystem } = require('./node/chat-system');

const chat = new ChatSystem();

// Create users
const user1 = chat.createUser('user1', 'Alice');
const user2 = chat.createUser('user2', 'Bob');

// Send message
await chat.sendMessage('user1', 'user2', 'Hello!');

// Get messages
const messages = chat.getMessages('user1', 'user2');

// Create group
const group = chat.createGroup('user1', 'Friends', ['user2', 'user3']);
```

## Performance Optimization

### Connection Management
- **Connection pooling:** Reuse connections
- **Load balancing:** Distribute connections
- **Heartbeat:** Keep connections alive

### Message Delivery
- **Batching:** Batch multiple messages
- **Compression:** Compress message payload
- **Caching:** Cache recent messages

## Monitoring

### Key Metrics
- **Message delivery latency:** P50, P95, P99
- **Connection count:** Active WebSocket connections
- **Message throughput:** Messages per second
- **Error rate:** Failed deliveries

### Alerts
- High message delivery latency
- Connection failures
- High error rate
- Low message throughput

## Trade-offs

### Real-time vs Reliability
- **Real-time:** Fast delivery, may lose messages
- **Reliable:** Guaranteed delivery, may be delayed

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

## Further Enhancements

1. **End-to-end encryption:** Secure messaging
2. **Voice/video calls:** Real-time communication
3. **Message reactions:** Emoji reactions
4. **Message editing:** Edit sent messages
5. **Message deletion:** Delete messages
6. **Read receipts:** Message read status

