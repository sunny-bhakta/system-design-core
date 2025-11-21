/**
 * Resource Optimization
 * Demonstrates techniques to efficiently use system resources
 */

/**
 * Resource Monitor
 */
class ResourceMonitor {
  constructor() {
    this.metrics = {
      memory: [],
      cpu: [],
      connections: []
    };
    this.thresholds = {
      memory: 0.8, // 80%
      cpu: 0.8,
      connections: 0.9
    };
  }

  /**
   * Monitor resources
   */
  startMonitoring(interval = 5000) {
    const monitor = () => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.memory.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        usage: memUsage.heapUsed / memUsage.heapTotal
      });

      this.metrics.cpu.push({
        timestamp: Date.now(),
        user: cpuUsage.user,
        system: cpuUsage.system
      });

      // Keep only last 100 measurements
      if (this.metrics.memory.length > 100) {
        this.metrics.memory.shift();
        this.metrics.cpu.shift();
      }

      setTimeout(monitor, interval);
    };

    monitor();
  }

  /**
   * Check if resource usage is high
   */
  checkResourceUsage() {
    const latest = this.metrics.memory[this.metrics.memory.length - 1];
    if (!latest) return { status: 'unknown' };

    const alerts = [];

    if (latest.usage > this.thresholds.memory) {
      alerts.push({
        resource: 'memory',
        usage: (latest.usage * 100).toFixed(2) + '%',
        threshold: (this.thresholds.memory * 100) + '%',
        status: 'high'
      });
    }

    return {
      status: alerts.length > 0 ? 'warning' : 'ok',
      alerts,
      current: {
        memory: (latest.usage * 100).toFixed(2) + '%'
      }
    };
  }

  /**
   * Get resource statistics
   */
  getStats() {
    const memory = this.metrics.memory;
    if (memory.length === 0) return null;

    const usageValues = memory.map(m => m.usage);
    return {
      memory: {
        avg: (usageValues.reduce((a, b) => a + b, 0) / usageValues.length * 100).toFixed(2) + '%',
        min: (Math.min(...usageValues) * 100).toFixed(2) + '%',
        max: (Math.max(...usageValues) * 100).toFixed(2) + '%',
        current: (memory[memory.length - 1].usage * 100).toFixed(2) + '%'
      }
    };
  }
}

/**
 * Connection Pool Manager
 */
class ConnectionPoolManager {
  constructor(config) {
    this.pools = new Map();
    this.maxTotalConnections = config.maxTotalConnections || 100;
    this.totalConnections = 0;
  }

  /**
   * Create or get pool
   */
  getPool(name, config) {
    if (!this.pools.has(name)) {
      const pool = {
        name,
        minSize: config.minSize || 2,
        maxSize: config.maxSize || 10,
        currentSize: 0,
        active: 0,
        idle: 0
      };
      this.pools.set(name, pool);
    }
    return this.pools.get(name);
  }

  /**
   * Allocate connection
   */
  allocate(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    if (this.totalConnections >= this.maxTotalConnections) {
      throw new Error('Maximum total connections reached');
    }

    if (pool.currentSize < pool.maxSize) {
      pool.currentSize++;
      this.totalConnections++;
    }

    pool.active++;
    pool.idle = Math.max(0, pool.currentSize - pool.active);

    return { pool: poolName, allocated: true };
  }

  /**
   * Release connection
   */
  release(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    pool.active = Math.max(0, pool.active - 1);
    pool.idle = pool.currentSize - pool.active;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalConnections: this.totalConnections,
      maxTotalConnections: this.maxTotalConnections,
      pools: Array.from(this.pools.values()).map(pool => ({
        name: pool.name,
        currentSize: pool.currentSize,
        active: pool.active,
        idle: pool.idle,
        utilization: pool.currentSize > 0 
          ? ((pool.active / pool.currentSize) * 100).toFixed(2) + '%'
          : '0%'
      }))
    };
  }
}

/**
 * Memory Manager
 */
class MemoryManager {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000;
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get with memory management
   */
  get(key) {
    const item = this.cache.get(key);
    if (item) {
      this.hitCount++;
      item.lastAccessed = Date.now();
      return item.value;
    }
    this.missCount++;
    return null;
  }

  /**
   * Set with automatic eviction
   */
  set(key, value, ttl = 3600000) {
    // Evict if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      ttl,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });
  }

  /**
   * Evict least recently used
   */
  evictLRU() {
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < lruTime) {
        lruTime = item.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Clean expired items
   */
  cleanExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.createdAt > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 
        ? ((this.hitCount / total) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

/**
 * CPU Throttling
 */
class CPUThrottler {
  constructor(config = {}) {
    this.maxConcurrent = config.maxConcurrent || 10;
    this.active = 0;
    this.queue = [];
  }

  /**
   * Execute with CPU throttling
   */
  async execute(operation) {
    if (this.active >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }

    this.active++;

    try {
      return await operation();
    } finally {
      this.active--;
      
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  getStats() {
    return {
      active: this.active,
      maxConcurrent: this.maxConcurrent,
      queued: this.queue.length,
      utilization: ((this.active / this.maxConcurrent) * 100).toFixed(2) + '%'
    };
  }
}

/**
 * Resource Optimizer
 */
class ResourceOptimizer {
  constructor() {
    this.resourceMonitor = new ResourceMonitor();
    this.connectionPoolManager = new ConnectionPoolManager({ maxTotalConnections: 100 });
    this.memoryManager = new MemoryManager();
    this.cpuThrottler = new CPUThrottler({ maxConcurrent: 10 });
  }

  /**
   * Initialize monitoring
   */
  startMonitoring() {
    this.resourceMonitor.startMonitoring(5000);
    
    // Clean expired cache items periodically
    setInterval(() => {
      this.memoryManager.cleanExpired();
    }, 60000);
  }

  /**
   * Get resource status
   */
  getResourceStatus() {
    return {
      resourceUsage: this.resourceMonitor.checkResourceUsage(),
      connections: this.connectionPoolManager.getStats(),
      memory: this.memoryManager.getStats(),
      cpu: this.cpuThrottler.getStats()
    };
  }
}

// Example usage
function demonstrateResourceOptimization() {
  console.log('=== Resource Optimization ===\n');

  // Resource Monitor
  console.log('=== Resource Monitor ===\n');
  const monitor = new ResourceMonitor();
  monitor.startMonitoring(1000);
  
  setTimeout(() => {
    const status = monitor.checkResourceUsage();
    console.log('Resource Status:', status);
    console.log('Resource Stats:', monitor.getStats());
  }, 2000);

  // Connection Pool Manager
  console.log('\n=== Connection Pool Manager ===\n');
  const poolManager = new ConnectionPoolManager({ maxTotalConnections: 50 });
  
  poolManager.getPool('database', { minSize: 2, maxSize: 10 });
  poolManager.getPool('cache', { minSize: 1, maxSize: 5 });
  
  poolManager.allocate('database');
  poolManager.allocate('database');
  poolManager.allocate('cache');
  
  console.log('Pool Stats:', poolManager.getStats());

  // Memory Manager
  console.log('\n=== Memory Manager ===\n');
  const memoryManager = new MemoryManager();
  
  for (let i = 0; i < 10; i++) {
    memoryManager.set(`key${i}`, `value${i}`);
  }
  
  memoryManager.get('key1');
  memoryManager.get('key2');
  memoryManager.get('key99'); // Miss
  
  console.log('Memory Stats:', memoryManager.getStats());

  // CPU Throttler
  console.log('\n=== CPU Throttler ===\n');
  const throttler = new CPUThrottler({ maxConcurrent: 3 });
  
  const operations = [];
  for (let i = 0; i < 10; i++) {
    operations.push(
      throttler.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return i;
      })
    );
  }
  
  Promise.all(operations).then(() => {
    console.log('CPU Throttler Stats:', throttler.getStats());
  });

  // Resource Optimizer
  console.log('\n=== Resource Optimizer ===\n');
  const optimizer = new ResourceOptimizer();
  optimizer.startMonitoring();
  
  setTimeout(() => {
    const status = optimizer.getResourceStatus();
    console.log('Overall Resource Status:', JSON.stringify(status, null, 2));
  }, 3000);
}

if (require.main === module) {
  demonstrateResourceOptimization();
}

module.exports = {
  ResourceMonitor,
  ConnectionPoolManager,
  MemoryManager,
  CPUThrottler,
  ResourceOptimizer
};

