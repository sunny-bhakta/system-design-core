# Reliability & Availability Concepts

## Implementation Status

| Sub-Concept | Documentation | Node.js | Python |
|-------------|---------------|---------|--------|
| High Availability | ✅ | ✅ | ⏳ |
| Fault Tolerance | ✅ | ✅ | ⏳ |
| Circuit Breaker | ✅ | ✅ | ✅ |
| Retry Mechanisms | ✅ | ✅ | ✅ |
| Disaster Recovery | ✅ | ✅ | ⏳ |
| Health Checks | ✅ | ✅ | ✅ |

## Table of Contents
1. [High Availability](#high-availability)
2. [Fault Tolerance](#fault-tolerance)
3. [Disaster Recovery](#disaster-recovery)
4. [Circuit Breaker Pattern](#circuit-breaker-pattern)
5. [Retry Mechanisms](#retry-mechanisms)

---

## High Availability

### Definition
System remains operational and accessible for a high percentage of time, typically 99.9% (three nines) or higher.

### Availability Levels
- **99% (Two Nines)**: ~87.6 hours downtime/year
- **99.9% (Three Nines)**: ~8.76 hours downtime/year
- **99.99% (Four Nines)**: ~52.56 minutes downtime/year
- **99.999% (Five Nines)**: ~5.26 minutes downtime/year

### Redundancy
- **Active-Passive**: One active, one standby
- **Active-Active**: Multiple active instances
- **N+1 Redundancy**: N required + 1 backup
- **2N Redundancy**: Full duplication

### Failover Mechanisms
- **Automatic Failover**: System detects and switches automatically
- **Manual Failover**: Admin-triggered switch
- **Failover Time**: Time to detect and switch
- **Data Loss**: Risk during failover

### Health Checks
- **Liveness Probe**: Is the service running?
- **Readiness Probe**: Is the service ready to serve?
- **Startup Probe**: Has the service started?
- **Health Check Endpoints**: `/health`, `/ready`, `/live`

---

## Fault Tolerance

### Definition
System continues operating properly in the event of failure of some components.

### Graceful Degradation
- **Definition**: System reduces functionality instead of failing completely
- **Examples**: 
  - Show cached data when database is down
  - Disable non-essential features
  - Reduce quality (lower resolution images)

### Retry Mechanisms
- **Simple Retry**: Fixed number of attempts
- **Exponential Backoff**: Increasing delay between retries
- **Jitter**: Random variation to prevent thundering herd
- **Circuit Breaker**: Stop retrying after threshold

### Timeout Handling
- **Connection Timeout**: Time to establish connection
- **Read Timeout**: Time to read response
- **Write Timeout**: Time to write request
- **Request Timeout**: Total request time

### Bulkhead Pattern
- **Definition**: Isolate resources to prevent cascading failures
- **Thread Pool Isolation**: Separate thread pools per service
- **Connection Pool Isolation**: Separate connection pools
- **Resource Limits**: CPU, memory limits per service

### Idempotency
- **Definition**: Operation can be applied multiple times without changing result
- **Idempotent Operations**: GET, PUT, DELETE
- **Non-Idempotent**: POST (usually)
- **Idempotency Keys**: Unique keys to prevent duplicate processing

---

## Disaster Recovery

### Backup Strategies
- **Full Backup**: Complete copy of all data
- **Incremental Backup**: Only changed data since last backup
- **Differential Backup**: Changed data since last full backup
- **Snapshot**: Point-in-time copy

### Replication Across Regions
- **Synchronous Replication**: Real-time replication
- **Asynchronous Replication**: Near-real-time replication
- **Multi-Region Deployment**: Deploy in multiple geographic regions
- **Cross-Region Failover**: Automatic failover to another region

### Data Center Redundancy
- **Primary Data Center**: Main operational center
- **Secondary Data Center**: Backup/standby center
- **Active-Active**: Both centers active
- **Active-Passive**: One active, one standby

### Recovery Objectives
- **RPO (Recovery Point Objective)**: Maximum acceptable data loss
- **RTO (Recovery Time Objective)**: Maximum acceptable downtime
- **Backup Frequency**: How often to backup
- **Retention Policy**: How long to keep backups

---

## Circuit Breaker Pattern

### Definition
Prevents cascading failures by stopping requests to a failing service.

### States
1. **Closed**: Normal operation, requests pass through
2. **Open**: Service failing, requests rejected immediately
3. **Half-Open**: Testing if service recovered

### Configuration
- **Failure Threshold**: Number of failures to open circuit
- **Timeout**: How long to stay open
- **Success Threshold**: Successes needed to close circuit
- **Monitoring**: Track success/failure rates

### Benefits
- **Prevents Cascading Failures**: Stops overwhelming failing service
- **Fast Failure**: Immediate response instead of timeout
- **Automatic Recovery**: Tests service health periodically

---

## Retry Mechanisms

### Exponential Backoff
```
retry_delay = base_delay * (2 ^ attempt_number)
```

### Example
- Attempt 1: 1 second
- Attempt 2: 2 seconds
- Attempt 3: 4 seconds
- Attempt 4: 8 seconds

### Jitter
Add random variation to prevent synchronized retries:
```
retry_delay = base_delay * (2 ^ attempt_number) + random(0, jitter)
```

### Retry Policies
- **Max Retries**: Maximum number of attempts
- **Max Delay**: Cap on retry delay
- **Retryable Errors**: Which errors to retry
- **Non-Retryable Errors**: Which errors not to retry

### Retry Strategies

#### Fixed Retry
- **Delay**: Constant delay between retries
- **Example**: 1 second between each retry
- **Pros**: Simple, predictable
- **Cons**: May not be optimal

#### Exponential Backoff
- **Delay**: Increases exponentially
- **Formula**: delay = base * 2^attempt
- **Example**: 1s, 2s, 4s, 8s, 16s
- **Pros**: Reduces load on failing service
- **Cons**: Longer total retry time

#### Exponential Backoff with Jitter
- **Delay**: Exponential + random variation
- **Formula**: delay = base * 2^attempt + random(0, jitter)
- **Example**: 1s±0.1s, 2s±0.2s, 4s±0.4s
- **Pros**: Prevents thundering herd
- **Cons**: Slightly more complex

#### Linear Backoff
- **Delay**: Increases linearly
- **Formula**: delay = base * attempt
- **Example**: 1s, 2s, 3s, 4s, 5s
- **Pros**: Moderate increase
- **Cons**: May retry too quickly

### Retryable vs Non-Retryable Errors

#### Retryable Errors
- **Transient Failures**: Temporary issues
- **Network Errors**: Connection timeouts
- **5xx Errors**: Server errors
- **Rate Limiting**: 429 Too Many Requests (with backoff)

#### Non-Retryable Errors
- **4xx Errors**: Client errors (except 429)
- **Authentication Errors**: 401 Unauthorized
- **Authorization Errors**: 403 Forbidden
- **Validation Errors**: 400 Bad Request

---

## Code Examples

See implementation examples in:
- [Node.js Examples](./node/)
- [Python Examples](./python/)

