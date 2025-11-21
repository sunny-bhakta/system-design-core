# Reliability & Availability - Node.js Examples

This directory contains Node.js implementations for building reliable and highly available systems.

## Files

### 1. `high-availability.js`
High Availability implementation:
- **HighAvailabilityService**: Primary-secondary failover
- **ServiceInstance**: Simulated service instances
- **LoadBalancedService**: Load balancing across instances
- **ActivePassiveHA**: Active-passive configuration
- **ActiveActiveHA**: Active-active configuration
- Health checks and automatic failover
- Recovery mechanisms

### 2. `fault-tolerance.js`
Fault Tolerance patterns:
- **FaultTolerantService**: Retry with exponential backoff
- **CircuitBreaker**: Circuit breaker pattern
- **Bulkhead**: Resource isolation
- **TimeoutWrapper**: Timeout handling
- **ExponentialBackoffRetry**: Retry with backoff
- **GracefulDegradation**: Feature fallbacks
- **HealthCheckWithRecovery**: Auto-recovery

### 3. `disaster-recovery.js`
Disaster Recovery implementation:
- **BackupManager**: Backup creation and restoration
- **ReplicationManager**: Data replication across locations
- **RPOManager**: Recovery Point Objective tracking
- **RTOManager**: Recovery Time Objective tracking
- **DisasterRecoveryPlan**: Complete DR plan
- Automatic backup scheduling
- Failover procedures

### 4. `circuit-breaker.js`
Circuit Breaker pattern (already implemented)

### 5. `health-checks.js`
Health Checks (already implemented)

## Running Examples

```bash
# Run all examples
npm run all

# Run individual examples
npm run high-availability
npm run fault-tolerance
npm run disaster-recovery
npm run circuit-breaker
npm run health-checks

# Or run directly
node high-availability.js
node fault-tolerance.js
node disaster-recovery.js
```

## Key Concepts Covered

1. **High Availability**
   - Primary-secondary failover
   - Active-passive and active-active configurations
   - Health monitoring
   - Automatic recovery

2. **Fault Tolerance**
   - Retry mechanisms
   - Circuit breaker pattern
   - Bulkhead isolation
   - Graceful degradation

3. **Disaster Recovery**
   - Backup and restore
   - Data replication
   - RPO and RTO management
   - Recovery procedures

4. **Health Checks**
   - Periodic health monitoring
   - Multiple check types
   - Health aggregation

5. **Circuit Breaker**
   - Failure detection
   - Automatic circuit opening/closing
   - Half-open state

## Integration Example

```javascript
import { HighAvailabilityService } from './high-availability.js';
import { FaultTolerantService } from './fault-tolerance.js';
import { CircuitBreaker } from './fault-tolerance.js';

// Setup HA service
const haService = new HighAvailabilityService({
  primary: primaryInstance,
  secondaries: [secondary1, secondary2]
});

// Setup fault tolerance
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
});

const faultTolerant = new FaultTolerantService({
  maxRetries: 3,
  circuitBreaker,
  fallback: async () => ({ data: 'fallback' })
});

// Use in your application
const result = await faultTolerant.execute(async () => {
  return await haService.execute('getData', { id: 1 });
});
```

