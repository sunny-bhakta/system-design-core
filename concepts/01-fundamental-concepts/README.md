# Fundamental Concepts

## Table of Contents
1. [System Design Basics](#system-design-basics)
2. [Distributed Systems](#distributed-systems)
3. [Load Balancing](#load-balancing)
4. [CAP Theorem](#cap-theorem)
5. [ACID vs BASE](#acid-vs-base)
6. [Consensus Algorithms](#consensus-algorithms)

---

## Implementation Status

| Sub-Concept | Documentation | Node.js | Python |
|-------------|---------------|---------|--------|
| System Design Basics | ✅ | ⏳ | ⏳ |
| Distributed Systems | ✅ | ⏳ | ⏳ |
| Load Balancing | ✅ | ✅ | ✅ |
| CAP Theorem | ✅ | ✅ | ✅ |
| ACID vs BASE | ✅ | ✅ | ✅ |
| Consensus Algorithms | ✅ | ⏳ | ⏳ |

---

## System Design Basics

### Requirements Gathering

#### Functional Requirements
- What the system should do
- User-facing features
- Business logic
- API endpoints

#### Non-Functional Requirements
- **Scalability**: Handle growth in users, data, or traffic
- **Reliability**: System uptime and fault tolerance
- **Availability**: Percentage of time system is operational
- **Performance**: Response time, throughput, latency
- **Consistency**: Data consistency guarantees
- **Security**: Authentication, authorization, data protection
- **Maintainability**: Code quality, documentation, testing

### Capacity Estimation

#### Key Metrics
- **Traffic**: Requests per second (RPS), queries per second (QPS)
- **Storage**: Data size, growth rate, retention period
- **Bandwidth**: Data transfer per second
- **Memory**: Cache requirements, session storage

#### Calculation Examples
```
Daily Active Users (DAU): 1 million
Average requests per user per day: 10
Total requests per day: 10 million
Peak traffic (2x average): 20 million requests/day
Peak QPS: 20M / (24 * 3600) * 2 = ~463 QPS

Storage:
- Average data per user: 1 MB
- Total storage: 1M users * 1 MB = 1 TB
- With 5 years retention: 1 TB * 5 = 5 TB
- With 3x replication: 15 TB
```

### System Constraints

#### Scalability Constraints
- Database connection limits
- Network bandwidth
- CPU and memory limits
- Disk I/O capacity

#### Consistency Constraints
- Strong consistency requirements
- Eventual consistency tolerance
- Read/write patterns

#### Latency Constraints
- Real-time requirements
- User experience expectations
- Geographic distribution

### API Design

#### RESTful Principles
- **Resource-based URLs**: `/users/{id}`, `/orders/{id}`
- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH
- **Status Codes**: 200, 201, 400, 401, 404, 500
- **Versioning**: `/v1/users`, `/v2/users`
- **Pagination**: `?page=1&limit=20`
- **Filtering**: `?status=active&sort=created_at`

#### API Best Practices
- Use nouns, not verbs
- Use plural nouns for collections
- Use HTTP status codes appropriately
- Return consistent response formats
- Implement rate limiting
- Use HTTPS
- Include request/response examples

### Database Schema Design

#### Design Principles
- **Normalization**: Reduce data redundancy
- **Denormalization**: Optimize for read performance
- **Indexing**: Speed up queries
- **Partitioning**: Distribute data across tables/servers
- **Sharding**: Split data across multiple databases

#### Schema Patterns
- **One-to-One**: User → Profile
- **One-to-Many**: User → Orders
- **Many-to-Many**: Users ↔ Products (via Orders)

---

## Distributed Systems

### Definition
A distributed system is a collection of independent computers that appear to users as a single coherent system.

### Characteristics
- **Concurrency**: Multiple components execute simultaneously
- **No Global Clock**: Components operate independently
- **Independent Failures**: Components can fail independently
- **Heterogeneity**: Different hardware, OS, programming languages

### Challenges
1. **Network Issues**: Latency, bandwidth, reliability
2. **Partial Failures**: Some components fail while others work
3. **Consistency**: Maintaining data consistency across nodes
4. **Security**: Authentication, authorization across network
5. **Scalability**: Adding more nodes to handle load

### Distributed System Patterns

#### Master-Slave (Primary-Replica)
- One master handles writes
- Multiple slaves handle reads
- Master replicates data to slaves

#### Peer-to-Peer
- All nodes are equal
- No central coordinator
- Examples: BitTorrent, blockchain

#### Client-Server
- Clients request services
- Servers provide services
- Centralized architecture

---

## Load Balancing

### Definition
Distributing incoming network traffic across multiple servers to ensure no single server is overwhelmed.

### Types of Load Balancers

#### Layer 4 (Transport Layer)
- Routes based on IP and port
- Faster, less intelligent
- TCP/UDP load balancing

#### Layer 7 (Application Layer)
- Routes based on content
- More intelligent, can inspect HTTP headers
- HTTP/HTTPS load balancing

### Load Balancing Algorithms

#### 1. Round Robin
- Distributes requests sequentially
- Simple and fair
- Doesn't consider server load

#### 2. Least Connections
- Routes to server with fewest active connections
- Good for long-lived connections
- Better load distribution

#### 3. Weighted Round Robin
- Assigns weights to servers
- More powerful servers get more requests
- Configurable distribution

#### 4. IP Hash
- Routes based on client IP hash
- Same client always goes to same server
- Good for session persistence

#### 5. Least Response Time
- Routes to server with fastest response time
- Considers both connections and response time
- Best performance

### Load Balancer Features
- **Health Checks**: Monitor server health
- **SSL Termination**: Handle HTTPS
- **Session Persistence**: Sticky sessions
- **Auto-scaling**: Add/remove servers automatically

---

## CAP Theorem

### Definition
In a distributed system, you can only guarantee two out of three properties:

- **Consistency**: All nodes see the same data simultaneously
- **Availability**: System remains operational
- **Partition Tolerance**: System continues despite network failures

### CAP Trade-offs

#### CP (Consistency + Partition Tolerance)
- Sacrifices availability
- Example: Traditional databases (PostgreSQL, MySQL)
- Use case: Financial systems, critical data

#### AP (Availability + Partition Tolerance)
- Sacrifices consistency
- Example: NoSQL databases (Cassandra, DynamoDB)
- Use case: Social media, content delivery

#### CA (Consistency + Availability)
- Not possible in distributed systems
- Only works in single-node systems
- No partition tolerance

### Real-World Applications
- **CP Systems**: Banking, payment processing
- **AP Systems**: Social networks, content platforms
- **Hybrid**: Use different strategies for different data

---

## ACID vs BASE

### ACID Properties

#### Atomicity
- All operations succeed or all fail
- No partial transactions
- Example: Transfer money (debit + credit)

#### Consistency
- Database remains in valid state
- Constraints are maintained
- Example: Account balance never negative

#### Isolation
- Concurrent transactions don't interfere
- Each transaction sees consistent data
- Example: Read committed, serializable

#### Durability
- Committed transactions persist
- Survives system crashes
- Example: Write to disk

### BASE Properties

#### Basically Available
- System remains available
- May return stale data
- Degraded functionality acceptable

#### Soft State
- State may change over time
- Without additional input
- Eventual consistency

#### Eventually Consistent
- System will become consistent
- Given enough time
- No immediate consistency guarantee

### When to Use

#### ACID
- Financial transactions
- Critical data integrity
- Strong consistency required
- Examples: Banking, e-commerce payments

#### BASE
- High availability needed
- Can tolerate eventual consistency
- Large scale systems
- Examples: Social media, content platforms

---

## Consensus Algorithms

### Definition
Algorithms that allow distributed systems to agree on a single value or state, even in the presence of failures.

### Why Consensus is Needed
- **Replication**: Multiple copies of data need to agree
- **Leader Election**: Choose a single leader in a cluster
- **State Machine Replication**: Keep multiple replicas in sync
- **Distributed Transactions**: Coordinate across multiple nodes

### Raft Algorithm

#### Overview
- **Leader-based**: One leader handles all client requests
- **Majority Voting**: Decisions require majority agreement
- **Log Replication**: Leader replicates log entries to followers
- **Fault Tolerance**: Handles up to (n-1)/2 failures in n-node cluster

#### Key Components
1. **Leader**: Handles all client requests, replicates log
2. **Followers**: Receive and replicate log entries
3. **Candidate**: Temporary state during leader election

#### States
- **Follower**: Default state, receives updates from leader
- **Candidate**: Running for leader election
- **Leader**: Handles client requests, replicates log

#### Leader Election
1. Follower doesn't hear from leader (timeout)
2. Becomes candidate, increments term
3. Requests votes from other nodes
4. If majority votes, becomes leader
5. Sends heartbeat to establish authority

#### Log Replication
1. Client sends request to leader
2. Leader appends to log
3. Leader replicates to followers
4. When majority acknowledges, commit
5. Leader applies to state machine
6. Leader responds to client

#### Safety Properties
- **Election Safety**: At most one leader per term
- **Log Matching**: Logs are identical across nodes
- **Leader Completeness**: Committed entries present in future leaders

### Paxos Algorithm

#### Overview
- **Three Roles**: Proposers, Acceptors, Learners
- **Two Phases**: Prepare and Accept
- **Quorum**: Majority of acceptors
- **Complexity**: More complex than Raft

#### Phases

##### Phase 1: Prepare
1. Proposer sends prepare(n) to acceptors
2. Acceptor responds with:
   - Promise not to accept proposals < n
   - Highest accepted proposal (if any)

##### Phase 2: Accept
1. Proposer sends accept(n, v) to acceptors
2. If majority accepts, value is chosen
3. Learners learn the chosen value

#### Safety Properties
- **Validity**: Only proposed values can be chosen
- **Agreement**: Only one value can be chosen
- **Liveness**: Eventually a value is chosen

### Raft vs Paxos

| Feature | Raft | Paxos |
|---------|------|-------|
| Complexity | Simpler | More complex |
| Leader | Always has leader | No permanent leader |
| Understandability | Easier to understand | Harder to understand |
| Performance | Good | Excellent |
| Use Cases | General purpose | High-performance systems |

### Real-World Applications
- **etcd**: Uses Raft for distributed key-value store
- **Consul**: Uses Raft for service discovery
- **Chubby**: Uses Paxos for distributed lock service
- **ZooKeeper**: Uses Zab (Paxos variant) for coordination

### Byzantine Fault Tolerance
- **Definition**: Handles malicious/arbitrary failures
- **Byzantine Generals Problem**: Agreement with traitors
- **Practical Byzantine Fault Tolerance (PBFT)**: Algorithm for BFT
- **Use Cases**: Blockchain, critical systems

---

## Code Examples

See implementation examples in:
- [Node.js Examples](./node/)
- [Python Examples](./python/)

