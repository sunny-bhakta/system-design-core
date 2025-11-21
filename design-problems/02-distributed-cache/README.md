# Distributed Cache (Redis, Memcached)

## Problem Statement

Design a distributed caching system like Redis or Memcached that provides fast data access across multiple servers.

## Requirements

### Functional Requirements
- Get/Set operations for key-value pairs
- TTL (Time-To-Live) support
- Cache eviction policies (LRU, LFU, FIFO)
- Distributed across multiple nodes
- High availability and fault tolerance
- Support for different data types (strings, lists, sets, hashes)

### Non-Functional Requirements
- Sub-millisecond latency
- High throughput (millions of operations/second)
- Fault tolerance (node failures)
- Consistent hashing for distribution
- Optional persistence to disk

## Capacity Estimation

### Memory Requirements
- **Cache size:** 100GB per node
- **Number of nodes:** 10 nodes
- **Total capacity:** 1TB
- **Key size:** 50 bytes average
- **Value size:** 1KB average
- **Total keys:** ~1 billion keys

### Traffic Estimates
- **Read operations:** 100K ops/sec per node = 1M ops/sec total
- **Write operations:** 10K ops/sec per node = 100K ops/sec total
- **Cache hit rate:** 80% (20% cache misses)

## System Design

### High-Level Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Load        │────▶│  Cache      │
│             │     │  Balancer    │     │  Node 1     │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
            ┌───────▼──────┐        ┌───────▼──────┐        ┌───────▼──────┐
            │  Cache       │        │  Cache       │        │  Cache       │
            │  Node 2      │        │  Node 3      │        │  Node N      │
            └──────────────┘        └──────────────┘        └──────────────┘
                    │                        │                        │
                    └────────────────────────┼────────────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Consistent     │
                                    │  Hashing Ring   │
                                    └─────────────────┘
```

### Consistent Hashing

- **Virtual nodes:** 3 replicas per physical node
- **Hash function:** MD5 or SHA-1
- **Ring size:** 2^32 positions
- **Benefits:**
  - Minimal data movement on node addition/removal
  - Even distribution of keys
  - Fault tolerance

### Data Structures

#### String
```
SET key value [EX seconds] [PX milliseconds]
GET key
```

#### Hash
```
HSET key field value
HGET key field
HGETALL key
```

#### List
```
LPUSH key value
RPUSH key value
LRANGE key start stop
```

#### Set
```
SADD key member
SMEMBERS key
SISMEMBER key member
```

### Eviction Policies

#### LRU (Least Recently Used)
- Evict least recently accessed items
- Track access order
- Good for temporal locality

#### LFU (Least Frequently Used)
- Evict least frequently accessed items
- Track access frequency
- Good for long-term patterns

#### FIFO (First In First Out)
- Evict oldest items
- Simple queue-based
- No access tracking needed

#### TTL-based
- Evict expired items
- Automatic cleanup
- Memory efficient

### Replication Strategy

#### Master-Slave Replication
- One master, multiple slaves
- Async replication
- Read from slaves, write to master
- Failover to slave on master failure

#### Multi-Master Replication
- Multiple masters
- Conflict resolution needed
- Higher complexity
- Better write availability

### Persistence

#### RDB (Redis Database)
- Point-in-time snapshots
- Compressed binary format
- Configurable intervals
- Fast recovery

#### AOF (Append Only File)
- Log every write operation
- More durable
- Slower recovery
- Larger file size

## Data Structures

### Cache Node Data Structures

#### Main Storage
- **data:** Map<key, value> - Main cache storage (O(1) get/set)
- **ttl:** Map<key, timestamp> - TTL expiration timestamps
- **accessOrder:** Array<key> - For LRU eviction (oldest first)
- **accessCount:** Map<key, count> - For LFU eviction (access frequency)
- **stats:** Object - Hit/miss/set/eviction statistics

### Consistent Hashing Data Structures
- **ring:** Map<hash, node> - Maps hash positions to nodes
- **sortedKeys:** Array<hash> - Sorted hash positions for efficient lookup
- **nodes:** Array<CacheNode> - Physical cache nodes

## Process Flow

### Get Operation Process

1. **Hash Key:** Convert key to hash position on ring
2. **Find Primary Node:** Use consistent hashing to find node
3. **Check TTL:** If key has TTL and expired, delete and return null
4. **Get from Primary:** Retrieve value from primary node
5. **Read Repair (if miss):** If not found and replication enabled, check replicas
6. **Update Primary:** If found in replica, update primary (read repair)
7. **Return Value:** Return cached value or null

### Set Operation Process

1. **Find Primary Node:** Use consistent hashing to find node
2. **Check Capacity:** If cache full and key is new, evict a key
3. **Store Value:** Store key-value pair in primary node
4. **Update Access Tracking:** Update eviction policy tracking
5. **Set TTL:** If TTL provided, store expiration timestamp
6. **Replicate:** If replication enabled, update replica nodes
7. **Return Success:** Return true

### Eviction Process

1. **Check Policy:** Determine eviction policy (LRU, LFU, FIFO)
2. **Select Key:**
   - **LRU:** First key in accessOrder (least recently used)
   - **LFU:** Key with minimum access count
   - **FIFO:** First key in data Map
3. **Delete Key:** Remove key from data, TTL, and access tracking
4. **Update Stats:** Increment eviction counter

## Consistent Hashing Algorithm

### Hash Ring Structure
- **Ring Size:** 2^32 positions (0 to 4,294,967,295)
- **Virtual Nodes:** Each physical node has multiple virtual nodes on ring
- **Default Replicas:** 3 virtual nodes per physical node

### Node Selection Algorithm
1. **Hash Key:** Convert key to hash position (0 to 2^32-1)
2. **Find First Node Clockwise:** Search sorted hash positions for first node with hash >= key hash
3. **Wrap Around:** If key hash > all node hashes, wrap to first node

### Benefits
- **Minimal Data Movement:** Only keys near removed node need to move
- **Even Distribution:** Virtual nodes ensure balanced load
- **Fault Tolerance:** Handles node failures gracefully
- **Deterministic:** Same key always maps to same node

### Performance
- **Current:** O(n) linear search (n = number of virtual nodes)
- **Optimized:** O(log n) with binary search on sortedKeys

## Replication Strategy

### Read Repair
- **Process:** If primary node miss, check replica nodes
- **Auto-Update:** If found in replica, update primary node
- **Benefits:** Ensures consistency, handles stale data

### Write Replication
- **Process:** Write to primary node, then replicate to replica nodes
- **Replication Factor:** Number of copies (default: 2)
- **Consistency:** Eventual consistency (async replication)

### Replica Selection
- **Algorithm:** Select next nodes clockwise on hash ring
- **Avoid Duplicates:** Ensure different physical nodes
- **Fault Tolerance:** If replica fails, use next available

## Performance Considerations

### Time Complexity
- **Get:** O(1) average case (Map lookup)
- **Set:** O(1) average case (Map insert)
- **Evict:** O(n) for LFU, O(1) for LRU/FIFO
- **Node Selection:** O(n) linear, O(log n) with binary search

### Space Complexity
- **Per Node:** O(n) where n = number of keys
- **Total:** O(n * replicationFactor) with replication

### Latency Targets
- **Cache Hit:** < 1ms (sub-millisecond)
- **Cache Miss:** < 10ms (including backend fetch)
- **Replication:** Async (non-blocking)

## Implementation

### Node.js Implementation

See [Node.js Code](./node/distributed-cache.js)

**Key features:**
- Consistent hashing with virtual nodes
- Multiple eviction policies (LRU, LFU, FIFO)
- TTL support with automatic expiration
- Replication with read repair
- Statistics tracking (hits, misses, evictions)
- Dynamic node management

**Code includes comprehensive comments covering:**
- System design concepts
- Capacity estimation
- Algorithm explanations
- Data structures
- Process flows
- Performance optimizations
- Replication strategies
- Production considerations

### Usage Example

```javascript
const { DistributedCache } = require('./node/distributed-cache');

const cache = new DistributedCache({ replicas: 3, replicationFactor: 2 });

// Add nodes
cache.addNode('node1', { maxSize: 100, evictionPolicy: 'LRU' });
cache.addNode('node2', { maxSize: 100, evictionPolicy: 'LRU' });
cache.addNode('node3', { maxSize: 100, evictionPolicy: 'LRU' });

// Set value
await cache.set('key1', 'value1', 5000); // 5 second TTL

// Get value
const value = await cache.get('key1');

// Get statistics
const stats = cache.getStats();
```

## Performance Optimization

### Memory Management
- **Memory limits:** Set max memory per node
- **Eviction:** Automatic eviction when limit reached
- **Compression:** Compress large values
- **Memory pools:** Reuse memory allocations

### Network Optimization
- **Connection pooling:** Reuse connections
- **Pipelining:** Batch multiple commands
- **Compression:** Compress network traffic
- **Keep-alive:** Maintain persistent connections

### Caching Strategies
- **Write-through:** Write to cache and database
- **Write-back:** Write to cache, async to database
- **Cache-aside:** Application manages cache
- **Read-through:** Cache loads from database on miss

## Monitoring

### Key Metrics
- **Hit rate:** Cache hits / total requests
- **Miss rate:** Cache misses / total requests
- **Latency:** P50, P95, P99 latencies
- **Throughput:** Operations per second
- **Memory usage:** Current vs max memory
- **Evictions:** Number of evicted keys

### Alerts
- Low hit rate (< 80%)
- High latency (> 10ms)
- Memory usage (> 90%)
- Node failures
- Replication lag

## Trade-offs

### Consistency vs Availability
- **Strong consistency:** Slower, more complex
- **Eventual consistency:** Faster, simpler

### Memory vs Performance
- **More memory:** Higher hit rate, better performance
- **Less memory:** More evictions, lower hit rate

### Persistence vs Performance
- **Persistent:** Slower writes, data durability
- **In-memory only:** Faster, data loss on crash

## Further Enhancements

1. **Pub/Sub:** Publish-subscribe messaging
2. **Transactions:** Multi-key atomic operations
3. **Lua Scripting:** Server-side script execution
4. **Clustering:** Automatic sharding and failover
5. **Security:** Authentication and encryption
6. **Monitoring:** Real-time metrics and dashboards

