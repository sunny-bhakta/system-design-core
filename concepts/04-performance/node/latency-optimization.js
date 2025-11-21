/**
 * Latency Optimization
 * Demonstrates techniques to reduce response time and improve user experience
 */

/**
 * Caching Layer
 */
class LatencyCache {
  constructor(config = {}) {
    this.cache = new Map();
    this.ttl = config.ttl || 3600000; // 1 hour
    this.maxSize = config.maxSize || 1000;
  }

  /**
   * Get with caching
   */
  async get(key, fetchFunction) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    // Cache miss - fetch and cache
    const value = await fetchFunction();
    this.set(key, value);
    return value;
  }

  set(key, value) {
    // Evict if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
      lastAccessed: Date.now()
    });
  }

  evictLRU() {
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * Connection Pooling
 */
class ConnectionPool {
  constructor(config) {
    this.minSize = config.minSize || 2;
    this.maxSize = config.maxSize || 10;
    this.pool = [];
    this.active = new Set();
    this.waiting = [];
  }

  async initialize() {
    for (let i = 0; i < this.minSize; i++) {
      await this.createConnection();
    }
  }

  async createConnection() {
    const connection = {
      id: `conn-${Date.now()}-${Math.random()}`,
      createdAt: Date.now()
    };
    
    // Simulate connection creation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.pool.push(connection);
    return connection;
  }

  async acquire() {
    // Find available connection
    let connection = this.pool.find(conn => !this.active.has(conn.id));
    
    // Create new if pool not full
    if (!connection && this.pool.length < this.maxSize) {
      connection = await this.createConnection();
    }
    
    if (connection) {
      this.active.add(connection.id);
      return connection;
    }
    
    // Wait for available connection
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(connection) {
    this.active.delete(connection.id);
    
    // Notify waiting requests
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve(this.acquire());
    }
  }
}

/**
 * Async Processing
 */
class AsyncProcessor {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  /**
   * Add task to queue (non-blocking)
   */
  enqueue(task) {
    this.queue.push(task);
    this.processQueue();
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      
      try {
        await task();
      } catch (error) {
        console.error('Task failed:', error);
      }
    }

    this.processing = false;
  }
}

/**
 * Request Batching
 */
class RequestBatcher {
  constructor(config = {}) {
    this.batchSize = config.batchSize || 10;
    this.batchTimeout = config.batchTimeout || 100; // ms
    this.batch = [];
    this.processing = false;
  }

  /**
   * Add request to batch
   */
  async add(request) {
    return new Promise((resolve, reject) => {
      this.batch.push({ request, resolve, reject });

      if (this.batch.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.processing) {
        setTimeout(() => this.processBatch(), this.batchTimeout);
      }
    });
  }

  async processBatch() {
    if (this.processing || this.batch.length === 0) {
      return;
    }

    this.processing = true;
    const currentBatch = this.batch.splice(0, this.batchSize);

    try {
      // Process batch
      const results = await this.processBatchRequests(currentBatch.map(b => b.request));
      
      // Resolve promises
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises
      currentBatch.forEach(item => {
        item.reject(error);
      });
    }

    this.processing = false;

    // Process remaining if any
    if (this.batch.length > 0) {
      setTimeout(() => this.processBatch(), this.batchTimeout);
    }
  }

  async processBatchRequests(requests) {
    // Simulate batch processing
    await new Promise(resolve => setTimeout(resolve, 50));
    return requests.map((req, i) => ({ id: i, ...req, processed: true }));
  }
}

/**
 * CDN Simulation
 */
class CDN {
  constructor() {
    this.edgeLocations = new Map();
    this.origin = null;
  }

  setOrigin(origin) {
    this.origin = origin;
  }

  addEdgeLocation(location) {
    this.edgeLocations.set(location.name, {
      ...location,
      cache: new Map()
    });
  }

  /**
   * Get content from nearest edge
   */
  async getContent(key, userLocation) {
    // Find nearest edge
    const nearestEdge = this.findNearestEdge(userLocation);
    
    if (!nearestEdge) {
      return await this.origin.get(key);
    }

    // Check edge cache
    const cached = nearestEdge.cache.get(key);
    if (cached) {
      return cached;
    }

    // Fetch from origin and cache
    const content = await this.origin.get(key);
    nearestEdge.cache.set(key, content);
    
    return content;
  }

  findNearestEdge(userLocation) {
    let nearest = null;
    let minDistance = Infinity;

    for (const edge of this.edgeLocations.values()) {
      const distance = this.calculateDistance(userLocation, edge.location);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = edge;
      }
    }

    return nearest;
  }

  calculateDistance(loc1, loc2) {
    // Simple distance calculation
    return Math.abs(loc1.lat - loc2.lat) + Math.abs(loc1.lon - loc2.lon);
  }
}

/**
 * Database Query Optimization
 */
class QueryOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.indexes = new Map();
  }

  /**
   * Optimize query with indexes
   */
  optimizeQuery(query) {
    // Check if query can use index
    const indexKey = this.findIndex(query);
    
    if (indexKey) {
      return {
        ...query,
        useIndex: indexKey,
        optimized: true
      };
    }

    return { ...query, optimized: false };
  }

  findIndex(query) {
    // Simple index matching
    for (const [indexKey, index] of this.indexes.entries()) {
      if (query.filters && query.filters.some(f => f.field === index.field)) {
        return indexKey;
      }
    }
    return null;
  }

  createIndex(name, field) {
    this.indexes.set(name, { field, name });
  }

  /**
   * Cache query results
   */
  async executeWithCache(query, executeFunction) {
    const queryKey = JSON.stringify(query);
    const cached = this.queryCache.get(queryKey);
    
    if (cached) {
      return cached;
    }

    const result = await executeFunction();
    this.queryCache.set(queryKey, result);
    
    return result;
  }
}

/**
 * Latency Optimizer
 */
class LatencyOptimizer {
  constructor() {
    this.cache = new LatencyCache();
    this.connectionPool = new ConnectionPool({ minSize: 2, maxSize: 10 });
    this.asyncProcessor = new AsyncProcessor();
    this.batcher = new RequestBatcher({ batchSize: 10, batchTimeout: 100 });
    this.queryOptimizer = new QueryOptimizer();
  }

  /**
   * Optimize database query
   */
  async optimizeQuery(query, executeFunction) {
    // Use query optimizer
    const optimized = this.queryOptimizer.optimizeQuery(query);
    
    // Use cache
    return await this.queryOptimizer.executeWithCache(optimized, executeFunction);
  }

  /**
   * Optimize API request
   */
  async optimizeRequest(key, fetchFunction) {
    // Use cache
    return await this.cache.get(key, fetchFunction);
  }

  /**
   * Batch requests
   */
  async batchRequest(request) {
    return await this.batcher.add(request);
  }

  /**
   * Process async
   */
  processAsync(task) {
    this.asyncProcessor.enqueue(task);
  }
}

// Example usage
async function demonstrateLatencyOptimization() {
  console.log('=== Latency Optimization ===\n');

  // Caching
  console.log('=== Caching ===\n');
  const cache = new LatencyCache({ ttl: 5000 });

  let fetchCount = 0;
  const fetchData = async (key) => {
    fetchCount++;
    await new Promise(resolve => setTimeout(resolve, 100));
    return `data-${key}-${fetchCount}`;
  };

  const start1 = Date.now();
  const result1 = await cache.get('key1', () => fetchData('key1'));
  console.log(`First get: ${Date.now() - start1}ms, Fetches: ${fetchCount}`);

  const start2 = Date.now();
  const result2 = await cache.get('key1', () => fetchData('key1'));
  console.log(`Second get (cached): ${Date.now() - start2}ms, Fetches: ${fetchCount}`);

  // Connection Pooling
  console.log('\n=== Connection Pooling ===\n');
  const pool = new ConnectionPool({ minSize: 2, maxSize: 5 });
  await pool.initialize();

  const start3 = Date.now();
  const conn1 = await pool.acquire();
  const conn2 = await pool.acquire();
  console.log(`Acquired 2 connections: ${Date.now() - start3}ms`);

  pool.release(conn1);
  pool.release(conn2);

  // Request Batching
  console.log('\n=== Request Batching ===\n');
  const batcher = new RequestBatcher({ batchSize: 5, batchTimeout: 100 });

  const start4 = Date.now();
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(batcher.add({ id: i }));
  }
  await Promise.all(promises);
  console.log(`Batched 10 requests: ${Date.now() - start4}ms`);

  // Query Optimization
  console.log('\n=== Query Optimization ===\n');
  const optimizer = new LatencyOptimizer();
  optimizer.queryOptimizer.createIndex('user_email', 'email');

  const query = { filters: [{ field: 'email', value: 'test@example.com' }] };
  const optimized = optimizer.queryOptimizer.optimizeQuery(query);
  console.log('Optimized query:', optimized);
}

if (require.main === module) {
  demonstrateLatencyOptimization();
}

module.exports = {
  LatencyCache,
  ConnectionPool,
  AsyncProcessor,
  RequestBatcher,
  CDN,
  QueryOptimizer,
  LatencyOptimizer
};

