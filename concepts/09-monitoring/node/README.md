# Monitoring & Observability - Node.js Examples

This directory contains Node.js implementations for comprehensive monitoring and observability.

## Files

### 1. `logging.js`
Structured logging with different log levels:
- DEBUG, INFO, WARN, ERROR, FATAL levels
- Trace ID and Span ID correlation
- Request logging middleware
- JSON output format

### 2. `metrics.js`
Metrics collection and monitoring:
- **Counters**: Incrementing metrics
- **Gauges**: Values that can go up or down
- **Histograms**: Distribution of values with percentiles
- **Timers**: Duration measurements
- Application metrics (requests, errors)
- Infrastructure metrics (CPU, memory, database)
- Prometheus export format

### 3. `distributed-tracing.js`
Distributed tracing implementation:
- Trace context propagation
- Span creation and tracking
- Parent-child span relationships
- Trace correlation across services
- Performance analysis
- HTTP middleware for automatic tracing
- Database and external service tracing

### 4. `health-checks-monitoring.js`
Comprehensive health check system:
- Health check manager
- Periodic health checks
- Database health checks
- Cache health checks
- External service health checks
- Disk space monitoring
- Memory monitoring
- Overall health aggregation

### 5. `alerting.js`
Alerting system:
- Alert rules with conditions and thresholds
- Multiple notification channels (Email, Slack, PagerDuty)
- Alert aggregation to prevent flooding
- Alert resolution tracking
- Alert history
- Severity levels (info, warning, critical)

### 6. `apm.js`
Application Performance Monitoring:
- Transaction tracing
- Performance profiling
- Error tracking
- Database query profiling
- Slow transaction detection
- Error summary and analysis
- APM dashboard data
- Throughput and error rate calculation

## Running Examples

```bash
# Run all examples
npm run all

# Run individual examples
npm run metrics
npm run tracing
npm run health
npm run alerting
npm run apm
npm run logging

# Or run directly
node metrics.js
node distributed-tracing.js
node health-checks-monitoring.js
node alerting.js
node apm.js
node logging.js
```

## Key Concepts Covered

1. **Metrics Collection**
   - Counter, Gauge, Histogram, Timer
   - Application and infrastructure metrics
   - Prometheus format export

2. **Distributed Tracing**
   - Trace and span correlation
   - Cross-service tracing
   - Performance analysis

3. **Health Checks**
   - Multiple health check types
   - Periodic monitoring
   - Health aggregation

4. **Alerting**
   - Rule-based alerting
   - Multiple notification channels
   - Alert aggregation

5. **APM**
   - Transaction tracking
   - Performance profiling
   - Error tracking and analysis

6. **Structured Logging**
   - Log levels
   - Trace correlation
   - Request logging

## Integration Example

```javascript
import { APMAgent } from './apm.js';
import { MetricsCollector } from './metrics.js';
import { Tracer } from './distributed-tracing.js';
import { HealthCheckManager } from './health-checks-monitoring.js';
import { AlertManager } from './alerting.js';

// Setup monitoring stack
const metrics = new MetricsCollector();
const tracer = new Tracer('my-service');
const apm = new APMAgent({ serviceName: 'my-service' });
const healthManager = new HealthCheckManager();
const alertManager = new AlertManager();

// Use in your application
const transaction = apm.startTransaction('user_request');
// ... your code ...
apm.endTransaction(transaction);
```

