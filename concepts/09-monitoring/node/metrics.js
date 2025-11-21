/**
 * Metrics Collection and Monitoring
 * Demonstrates application, infrastructure, and business metrics
 */

/**
 * Metrics Collector
 */
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
  }

  /**
   * Counter - Incrementing metric
   */
  increment(name, value = 1, labels = {}) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.recordMetric('counter', name, labels, current + value);
  }

  /**
   * Gauge - Value that can go up or down
   */
  setGauge(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    
    this.recordMetric('gauge', name, labels, value);
  }

  /**
   * Histogram - Distribution of values
   */
  recordHistogram(name, value, labels = {}) {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    const histogram = this.histograms.get(key);
    histogram.push(value);
    
    // Keep only last 1000 values
    if (histogram.length > 1000) {
      histogram.shift();
    }
    
    this.recordMetric('histogram', name, labels, this.getHistogramStats(histogram));
  }

  /**
   * Timer - Measure duration
   */
  startTimer(name, labels = {}) {
    const startTime = Date.now();
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.recordHistogram(`${name}_duration`, duration, labels);
        return duration;
      }
    };
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(values) {
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sum / count,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  /**
   * Record metric
   */
  recordMetric(type, name, labels, value) {
    const metric = {
      type,
      name,
      labels,
      value,
      timestamp: Date.now()
    };
    
    this.metrics.set(`${name}_${Date.now()}`, metric);
  }

  /**
   * Get key for metric
   */
  getKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Array.from(this.histograms.entries()).map(([key, values]) => ({
        key,
        stats: this.getHistogramStats(values)
      })),
      recent: Array.from(this.metrics.values()).slice(-100)
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

/**
 * Application Metrics
 */
class ApplicationMetrics {
  constructor(collector) {
    this.collector = collector;
    this.requestMetrics = {
      total: 0,
      success: 0,
      errors: 0,
      byEndpoint: new Map(),
      byMethod: new Map()
    };
  }

  /**
   * Record HTTP request
   */
  recordRequest(method, endpoint, statusCode, duration) {
    this.requestMetrics.total++;
    
    if (statusCode >= 200 && statusCode < 300) {
      this.requestMetrics.success++;
    } else {
      this.requestMetrics.errors++;
    }

    // Counter by endpoint
    this.collector.increment('http_requests_total', 1, {
      method,
      endpoint,
      status: statusCode
    });

    // Histogram for duration
    this.collector.recordHistogram('http_request_duration_ms', duration, {
      method,
      endpoint
    });

    // Track by endpoint
    const endpointKey = `${method} ${endpoint}`;
    const endpointCount = this.requestMetrics.byEndpoint.get(endpointKey) || 0;
    this.requestMetrics.byEndpoint.set(endpointKey, endpointCount + 1);

    // Track by method
    const methodCount = this.requestMetrics.byMethod.get(method) || 0;
    this.requestMetrics.byMethod.set(method, methodCount + 1);
  }

  /**
   * Record error
   */
  recordError(error, context = {}) {
    this.collector.increment('application_errors_total', 1, {
      type: error.constructor.name,
      ...context
    });
  }

  /**
   * Record business metric
   */
  recordBusinessMetric(name, value, labels = {}) {
    this.collector.setGauge(`business_${name}`, value, labels);
  }

  /**
   * Get request statistics
   */
  getRequestStats() {
    return {
      total: this.requestMetrics.total,
      success: this.requestMetrics.success,
      errors: this.requestMetrics.errors,
      successRate: this.requestMetrics.total > 0 
        ? (this.requestMetrics.success / this.requestMetrics.total * 100).toFixed(2) + '%'
        : '0%',
      byEndpoint: Object.fromEntries(this.requestMetrics.byEndpoint),
      byMethod: Object.fromEntries(this.requestMetrics.byMethod)
    };
  }
}

/**
 * Infrastructure Metrics
 */
class InfrastructureMetrics {
  constructor(collector) {
    this.collector = collector;
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage();
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.collector.setGauge('memory_heap_used_bytes', memUsage.heapUsed);
    this.collector.setGauge('memory_heap_total_bytes', memUsage.heapTotal);
    this.collector.setGauge('memory_rss_bytes', memUsage.rss);
    this.collector.setGauge('memory_external_bytes', memUsage.external);

    // CPU metrics
    this.collector.setGauge('cpu_user_seconds', cpuUsage.user / 1000000);
    this.collector.setGauge('cpu_system_seconds', cpuUsage.system / 1000000);

    // Uptime
    this.collector.setGauge('process_uptime_seconds', uptime);

    // Process metrics
    this.collector.setGauge('process_pid', process.pid);
  }

  /**
   * Collect database metrics
   */
  recordDatabaseQuery(query, duration, success) {
    this.collector.increment('database_queries_total', 1, {
      query_type: query,
      status: success ? 'success' : 'error'
    });

    this.collector.recordHistogram('database_query_duration_ms', duration, {
      query_type: query
    });
  }

  /**
   * Collect cache metrics
   */
  recordCacheOperation(operation, hit) {
    this.collector.increment('cache_operations_total', 1, {
      operation,
      result: hit ? 'hit' : 'miss'
    });
  }
}

/**
 * Metrics Exporter
 */
class MetricsExporter {
  constructor(collector) {
    this.collector = collector;
  }

  /**
   * Export in Prometheus format
   */
  exportPrometheus() {
    const metrics = this.collector.getMetrics();
    let output = '';

    // Counters
    for (const [key, value] of Object.entries(metrics.counters)) {
      output += `# TYPE ${this.getName(key)} counter\n`;
      output += `${key} ${value}\n`;
    }

    // Gauges
    for (const [key, value] of Object.entries(metrics.gauges)) {
      output += `# TYPE ${this.getName(key)} gauge\n`;
      output += `${key} ${value}\n`;
    }

    // Histograms
    for (const histogram of metrics.histograms) {
      const name = this.getName(histogram.key);
      output += `# TYPE ${name} histogram\n`;
      if (histogram.stats) {
        output += `${histogram.key}_count ${histogram.stats.count}\n`;
        output += `${histogram.key}_sum ${histogram.stats.sum}\n`;
        output += `${histogram.key}_mean ${histogram.stats.mean}\n`;
        output += `${histogram.key}_p95 ${histogram.stats.p95}\n`;
        output += `${histogram.key}_p99 ${histogram.stats.p99}\n`;
      }
    }

    return output;
  }

  /**
   * Export in JSON format
   */
  exportJSON() {
    return JSON.stringify(this.collector.getMetrics(), null, 2);
  }

  getName(key) {
    return key.split('{')[0];
  }
}

// Example usage
function demonstrateMetrics() {
  console.log('=== Metrics Collection ===\n');

  const collector = new MetricsCollector();
  const appMetrics = new ApplicationMetrics(collector);
  const infraMetrics = new InfrastructureMetrics(collector);

  // Record some requests
  appMetrics.recordRequest('GET', '/api/users', 200, 45);
  appMetrics.recordRequest('GET', '/api/users', 200, 52);
  appMetrics.recordRequest('POST', '/api/users', 201, 120);
  appMetrics.recordRequest('GET', '/api/products', 200, 38);
  appMetrics.recordRequest('GET', '/api/users', 404, 25);
  appMetrics.recordRequest('GET', '/api/orders', 500, 200);

  // Record errors
  appMetrics.recordError(new Error('Database connection failed'), {
    endpoint: '/api/users'
  });

  // Record business metrics
  appMetrics.recordBusinessMetric('active_users', 1250);
  appMetrics.recordBusinessMetric('revenue', 50000, { currency: 'USD' });

  // Collect system metrics
  infraMetrics.collectSystemMetrics();

  // Record database queries
  infraMetrics.recordDatabaseQuery('SELECT', 25, true);
  infraMetrics.recordDatabaseQuery('INSERT', 45, true);
  infraMetrics.recordDatabaseQuery('SELECT', 150, false);

  // Record cache operations
  infraMetrics.recordCacheOperation('get', true);
  infraMetrics.recordCacheOperation('get', false);
  infraMetrics.recordCacheOperation('set', true);

  console.log('Request Stats:', appMetrics.getRequestStats());
  console.log('\nAll Metrics:', collector.getMetrics());

  console.log('\n=== Prometheus Export ===\n');
  const exporter = new MetricsExporter(collector);
  console.log(exporter.exportPrometheus());
}

if (require.main === module) {
  demonstrateMetrics();
}

module.exports = {
  MetricsCollector,
  ApplicationMetrics,
  InfrastructureMetrics,
  MetricsExporter
};

