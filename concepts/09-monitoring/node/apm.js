/**
 * Application Performance Monitoring (APM)
 * Demonstrates transaction tracing, performance profiling, and error tracking
 */

/**
 * APM Agent
 */
class APMAgent {
  constructor(config = {}) {
    this.serviceName = config.serviceName || 'app';
    this.environment = config.environment || 'production';
    this.transactions = [];
    this.errors = [];
    this.performanceData = {
      requests: [],
      databaseQueries: [],
      externalCalls: []
    };
    this.maxTransactions = config.maxTransactions || 1000;
  }

  /**
   * Start transaction
   */
  startTransaction(name, type = 'request') {
    const transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'started',
      spans: [],
      tags: {},
      user: null,
      errors: []
    };

    return transaction;
  }

  /**
   * End transaction
   */
  endTransaction(transaction, status = 'success') {
    transaction.endTime = Date.now();
    transaction.duration = transaction.endTime - transaction.startTime;
    transaction.status = status;

    // Store transaction
    this.transactions.push(transaction);
    if (this.transactions.length > this.maxTransactions) {
      this.transactions.shift();
    }

    // Record performance data
    this.recordPerformance(transaction);

    return transaction;
  }

  /**
   * Add span to transaction
   */
  addSpan(transaction, name, type, startTime, endTime, tags = {}) {
    const span = {
      name,
      type,
      startTime,
      endTime,
      duration: endTime - startTime,
      tags
    };

    transaction.spans.push(span);
    return span;
  }

  /**
   * Record error
   */
  recordError(transaction, error, context = {}) {
    const errorData = {
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      transactionId: transaction.id,
      message: error.message,
      type: error.constructor.name,
      stack: error.stack,
      timestamp: Date.now(),
      context
    };

    transaction.errors.push(errorData);
    this.errors.push(errorData);

    return errorData;
  }

  /**
   * Record performance data
   */
  recordPerformance(transaction) {
    // Record request performance
    if (transaction.type === 'request') {
      this.performanceData.requests.push({
        name: transaction.name,
        duration: transaction.duration,
        status: transaction.status,
        timestamp: transaction.startTime
      });
    }

    // Extract database query spans
    const dbSpans = transaction.spans.filter(s => s.type === 'db');
    dbSpans.forEach(span => {
      this.performanceData.databaseQueries.push({
        name: span.name,
        duration: span.duration,
        timestamp: transaction.startTime
      });
    });

    // Extract external call spans
    const externalSpans = transaction.spans.filter(s => s.type === 'external');
    externalSpans.forEach(span => {
      this.performanceData.externalCalls.push({
        name: span.name,
        duration: span.duration,
        timestamp: transaction.startTime
      });
    });
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const requests = this.performanceData.requests;
    const dbQueries = this.performanceData.databaseQueries;
    const externalCalls = this.performanceData.externalCalls;

    return {
      requests: this.calculateStats(requests.map(r => r.duration)),
      databaseQueries: this.calculateStats(dbQueries.map(q => q.duration)),
      externalCalls: this.calculateStats(externalCalls.map(c => c.duration)),
      errorRate: this.calculateErrorRate(),
      throughput: this.calculateThroughput()
    };
  }

  /**
   * Calculate statistics
   */
  calculateStats(values) {
    if (values.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      avg: Math.round(sum / count),
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const recentTransactions = this.transactions.slice(-100);
    if (recentTransactions.length === 0) return 0;

    const errors = recentTransactions.filter(t => t.status === 'error').length;
    return (errors / recentTransactions.length * 100).toFixed(2) + '%';
  }

  /**
   * Calculate throughput
   */
  calculateThroughput() {
    const recentTransactions = this.transactions.slice(-100);
    if (recentTransactions.length === 0) return { perSecond: 0, perMinute: 0 };

    const timeSpan = Date.now() - (recentTransactions[0]?.startTime || Date.now());
    const seconds = timeSpan / 1000;
    const minutes = seconds / 60;

    return {
      perSecond: (recentTransactions.length / seconds).toFixed(2),
      perMinute: (recentTransactions.length / minutes).toFixed(2)
    };
  }

  /**
   * Get slow transactions
   */
  getSlowTransactions(threshold = 1000, limit = 10) {
    return this.transactions
      .filter(t => t.duration && t.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        name: t.name,
        duration: t.duration,
        status: t.status,
        errorCount: t.errors.length
      }));
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const errorCounts = {};
    
    this.errors.forEach(error => {
      const key = `${error.type}:${error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .map(([key, count]) => {
        const [type, message] = key.split(':');
        return { type, message, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get transaction breakdown
   */
  getTransactionBreakdown(transactionId) {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (!transaction) return null;

    const totalDuration = transaction.duration;
    const spanDurations = transaction.spans.reduce((sum, span) => sum + span.duration, 0);
    const overhead = totalDuration - spanDurations;

    return {
      transaction: {
        id: transaction.id,
        name: transaction.name,
        totalDuration
      },
      spans: transaction.spans.map(span => ({
        name: span.name,
        type: span.type,
        duration: span.duration,
        percentage: ((span.duration / totalDuration) * 100).toFixed(2) + '%'
      })),
      overhead: {
        duration: overhead,
        percentage: ((overhead / totalDuration) * 100).toFixed(2) + '%'
      },
      errors: transaction.errors
    };
  }
}

/**
 * Performance Profiler
 */
class PerformanceProfiler {
  constructor(apmAgent) {
    this.apmAgent = apmAgent;
  }

  /**
   * Profile function execution
   */
  async profile(name, fn, tags = {}) {
    const startTime = Date.now();
    let error = null;

    try {
      const result = await fn();
      const endTime = Date.now();
      
      // Record as span if in transaction context
      if (this.currentTransaction) {
        this.apmAgent.addSpan(
          this.currentTransaction,
          name,
          'function',
          startTime,
          endTime,
          { ...tags, status: 'success' }
        );
      }

      return result;
    } catch (err) {
      error = err;
      const endTime = Date.now();
      
      if (this.currentTransaction) {
        this.apmAgent.addSpan(
          this.currentTransaction,
          name,
          'function',
          startTime,
          endTime,
          { ...tags, status: 'error', error: err.message }
        );
        this.apmAgent.recordError(this.currentTransaction, err, tags);
      }

      throw err;
    }
  }

  /**
   * Set current transaction context
   */
  setTransaction(transaction) {
    this.currentTransaction = transaction;
  }
}

/**
 * Database Query Profiler
 */
class DatabaseProfiler {
  constructor(apmAgent) {
    this.apmAgent = apmAgent;
  }

  /**
   * Profile database query
   */
  async profileQuery(query, queryFn, tags = {}) {
    const startTime = Date.now();

    try {
      const result = await queryFn();
      const endTime = Date.now();

      if (this.currentTransaction) {
        this.apmAgent.addSpan(
          this.currentTransaction,
          query,
          'db',
          startTime,
          endTime,
          { ...tags, status: 'success' }
        );
      }

      return result;
    } catch (error) {
      const endTime = Date.now();

      if (this.currentTransaction) {
        this.apmAgent.addSpan(
          this.currentTransaction,
          query,
          'db',
          startTime,
          endTime,
          { ...tags, status: 'error' }
        );
        this.apmAgent.recordError(this.currentTransaction, error, { query });
      }

      throw error;
    }
  }

  setTransaction(transaction) {
    this.currentTransaction = transaction;
  }
}

/**
 * APM Dashboard Data
 */
class APMDashboard {
  constructor(apmAgent) {
    this.apmAgent = apmAgent;
  }

  /**
   * Get dashboard data
   */
  getDashboard() {
    const metrics = this.apmAgent.getPerformanceMetrics();
    const recentTransactions = this.apmAgent.transactions.slice(-20);
    const slowTransactions = this.apmAgent.getSlowTransactions();
    const errorSummary = this.apmAgent.getErrorSummary();

    return {
      overview: {
        serviceName: this.apmAgent.serviceName,
        environment: this.apmAgent.environment,
        totalTransactions: this.apmAgent.transactions.length,
        activeErrors: this.apmAgent.errors.filter(e => 
          Date.now() - e.timestamp < 3600000
        ).length,
        errorRate: metrics.errorRate,
        throughput: metrics.throughput
      },
      performance: {
        requests: metrics.requests,
        databaseQueries: metrics.databaseQueries,
        externalCalls: metrics.externalCalls
      },
      slowTransactions,
      errorSummary,
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        name: t.name,
        duration: t.duration,
        status: t.status,
        errorCount: t.errors.length
      }))
    };
  }
}

// Example usage
async function demonstrateAPM() {
  console.log('=== Application Performance Monitoring ===\n');

  const apmAgent = new APMAgent({
    serviceName: 'api-service',
    environment: 'production'
  });

  const profiler = new PerformanceProfiler(apmAgent);
  const dbProfiler = new DatabaseProfiler(apmAgent);

  // Simulate transactions
  for (let i = 0; i < 5; i++) {
    const transaction = apmAgent.startTransaction(`GET /api/users/${i}`, 'request');
    profiler.setTransaction(transaction);
    dbProfiler.setTransaction(transaction);

    // Simulate database query
    await dbProfiler.profileQuery('SELECT * FROM users', async () => {
      await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
    });

    // Simulate external call
    await profiler.profile('external.payment-service', async () => {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    }, { service: 'payment-service' });

    // Simulate error in some transactions
    if (i === 2) {
      try {
        await profiler.profile('error-operation', async () => {
          throw new Error('Simulated error');
        });
      } catch (error) {
        // Error already recorded
      }
    }

    apmAgent.endTransaction(transaction, i === 2 ? 'error' : 'success');
  }

  // Get performance metrics
  console.log('Performance Metrics:');
  console.log(JSON.stringify(apmAgent.getPerformanceMetrics(), null, 2));

  console.log('\nSlow Transactions:');
  console.log(apmAgent.getSlowTransactions(50));

  console.log('\nError Summary:');
  console.log(apmAgent.getErrorSummary());

  console.log('\nTransaction Breakdown:');
  const breakdown = apmAgent.getTransactionBreakdown(apmAgent.transactions[0].id);
  console.log(JSON.stringify(breakdown, null, 2));

  console.log('\n=== APM Dashboard ===\n');
  const dashboard = new APMDashboard(apmAgent);
  console.log(JSON.stringify(dashboard.getDashboard(), null, 2));
}

if (require.main === module) {
  demonstrateAPM();
}

module.exports = {
  APMAgent,
  PerformanceProfiler,
  DatabaseProfiler,
  APMDashboard
};

