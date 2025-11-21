/**
 * Design for Scale
 * Demonstrates building systems that can scale horizontally and vertically
 */

/**
 * Stateless Service
 * Stateless services are easier to scale
 */
class StatelessService {
  constructor() {
    // No instance state - all data comes from requests
  }

  processRequest(request) {
    // Process request without relying on instance state
    return {
      result: `Processed: ${request.data}`,
      timestamp: Date.now(),
      // No state stored in instance
    };
  }

  // All state is passed as parameters
  calculate(data, operation) {
    switch (operation) {
      case 'add':
        return data.reduce((a, b) => a + b, 0);
      case 'multiply':
        return data.reduce((a, b) => a * b, 1);
      default:
        throw new Error('Unknown operation');
    }
  }
}

/**
 * Horizontal Scaling Support
 */
class ScalableService {
  constructor() {
    this.instances = [];
    this.loadBalancer = null;
  }

  /**
   * Add instance
   */
  addInstance(instanceId) {
    this.instances.push({
      id: instanceId,
      active: true,
      load: 0,
      createdAt: Date.now()
    });
    console.log(`Instance ${instanceId} added. Total: ${this.instances.length}`);
  }

  /**
   * Remove instance
   */
  removeInstance(instanceId) {
    const index = this.instances.findIndex(i => i.id === instanceId);
    if (index > -1) {
      this.instances.splice(index, 1);
      console.log(`Instance ${instanceId} removed. Total: ${this.instances.length}`);
    }
  }

  /**
   * Get instance with least load
   */
  getInstance() {
    if (this.instances.length === 0) {
      throw new Error('No instances available');
    }

    // Round-robin selection
    const instance = this.instances[0];
    instance.load++;
    return instance;
  }

  /**
   * Release instance
   */
  releaseInstance(instanceId) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) {
      instance.load = Math.max(0, instance.load - 1);
    }
  }

  getStatus() {
    return {
      totalInstances: this.instances.length,
      instances: this.instances.map(i => ({
        id: i.id,
        load: i.load,
        active: i.active
      }))
    };
  }
}

/**
 * Caching Layer for Scale
 */
class ScalableCache {
  constructor(config = {}) {
    this.maxSize = config.maxSize || 1000;
    this.ttl = config.ttl || 3600000; // 1 hour
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Get with cache
   */
  async get(key, fetchFunction) {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.updateAccessOrder(key);
      return cached.value;
    }

    // Cache miss - fetch and cache
    const value = await fetchFunction();
    this.set(key, value);
    return value;
  }

  /**
   * Set cache
   */
  set(key, value) {
    // Evict if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
      createdAt: Date.now()
    });
    this.updateAccessOrder(key);
  }

  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  evictLRU() {
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.cache.delete(lruKey);
      this.accessOrder.shift();
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 'N/A' // Would need to track hits/misses
    };
  }
}

/**
 * Database Connection Pooling for Scale
 */
class ScalableConnectionPool {
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
      createdAt: Date.now(),
      inUse: false
    };
    
    // Simulate connection creation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.pool.push(connection);
    return connection;
  }

  async acquire() {
    // Find available connection
    let connection = this.pool.find(conn => !conn.inUse);
    
    // Create new if pool not full
    if (!connection && this.pool.length < this.maxSize) {
      connection = await this.createConnection();
    }
    
    if (connection) {
      connection.inUse = true;
      this.active.add(connection.id);
      return connection;
    }
    
    // Wait for available connection
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(connection) {
    connection.inUse = false;
    this.active.delete(connection.id);
    
    // Notify waiting requests
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve(this.acquire());
    }
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeConnections: this.active.size,
      idleConnections: this.pool.length - this.active.size,
      waitingRequests: this.waiting.length,
      minSize: this.minSize,
      maxSize: this.maxSize
    };
  }
}

/**
 * Async Processing for Scale
 */
class AsyncProcessor {
  constructor(config = {}) {
    this.queue = [];
    this.workers = [];
    this.maxWorkers = config.maxWorkers || 5;
    this.processing = false;
  }

  /**
   * Add job to queue
   */
  addJob(job) {
    this.queue.push({
      ...job,
      id: `job-${Date.now()}-${Math.random()}`,
      createdAt: Date.now()
    });
    
    this.processQueue();
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.workers.length < this.maxWorkers) {
      const job = this.queue.shift();
      const worker = this.processJob(job);
      this.workers.push(worker);

      worker.finally(() => {
        const index = this.workers.indexOf(worker);
        if (index > -1) {
          this.workers.splice(index, 1);
        }
        this.processQueue();
      });
    }

    this.processing = false;
  }

  async processJob(job) {
    try {
      const result = await job.handler(job.data);
      if (job.onSuccess) {
        job.onSuccess(result);
      }
      return result;
    } catch (error) {
      if (job.onError) {
        job.onError(error);
      }
      throw error;
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.workers.length,
      maxWorkers: this.maxWorkers
    };
  }
}

/**
 * Sharding Support
 */
class ShardableService {
  constructor(numShards = 3) {
    this.numShards = numShards;
    this.shards = [];
    
    for (let i = 0; i < numShards; i++) {
      this.shards.push({
        id: i,
        data: new Map()
      });
    }
  }

  /**
   * Get shard for key
   */
  getShard(key) {
    const hash = this.simpleHash(key);
    return this.shards[hash % this.numShards];
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Set value
   */
  set(key, value) {
    const shard = this.getShard(key);
    shard.data.set(key, value);
    return { shard: shard.id, key, value };
  }

  /**
   * Get value
   */
  get(key) {
    const shard = this.getShard(key);
    return shard.data.get(key);
  }

  /**
   * Get shard statistics
   */
  getShardStats() {
    return this.shards.map(shard => ({
      id: shard.id,
      size: shard.data.size,
      keys: Array.from(shard.data.keys()).slice(0, 5) // Sample keys
    }));
  }
}

// Example usage
async function demonstrateDesignForScale() {
  console.log('=== Stateless Service ===\n');
  
  const statelessService = new StatelessService();
  console.log('Request 1:', statelessService.processRequest({ data: 'test1' }));
  console.log('Request 2:', statelessService.processRequest({ data: 'test2' }));
  console.log('Calculate:', statelessService.calculate([1, 2, 3, 4], 'add'));

  console.log('\n=== Scalable Service ===\n');
  
  const scalableService = new ScalableService();
  scalableService.addInstance('instance-1');
  scalableService.addInstance('instance-2');
  scalableService.addInstance('instance-3');
  
  const instance1 = scalableService.getInstance();
  console.log('Assigned to:', instance1.id);
  scalableService.releaseInstance(instance1.id);
  
  console.log('Status:', scalableService.getStatus());

  console.log('\n=== Scalable Cache ===\n');
  
  const cache = new ScalableCache({ maxSize: 5, ttl: 5000 });
  
  // Simulate cache with fetch function
  let fetchCount = 0;
  const fetchData = async (key) => {
    fetchCount++;
    return `data-${key}-${fetchCount}`;
  };
  
  const value1 = await cache.get('key1', () => fetchData('key1'));
  console.log('First get (cache miss):', value1, 'Fetches:', fetchCount);
  
  const value2 = await cache.get('key1', () => fetchData('key1'));
  console.log('Second get (cache hit):', value2, 'Fetches:', fetchCount);
  
  console.log('Cache stats:', cache.getStats());

  console.log('\n=== Connection Pooling ===\n');
  
  const pool = new ScalableConnectionPool({ minSize: 2, maxSize: 5 });
  await pool.initialize();
  
  const conn1 = await pool.acquire();
  const conn2 = await pool.acquire();
  console.log('Acquired connections:', conn1.id, conn2.id);
  console.log('Pool stats:', pool.getStats());
  
  pool.release(conn1);
  pool.release(conn2);

  console.log('\n=== Async Processing ===\n');
  
  const processor = new AsyncProcessor({ maxWorkers: 3 });
  
  for (let i = 0; i < 10; i++) {
    processor.addJob({
      data: { task: i },
      handler: async (data) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return `Processed task ${data.task}`;
      },
      onSuccess: (result) => console.log(result)
    });
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Processor stats:', processor.getStats());

  console.log('\n=== Sharding ===\n');
  
  const shardableService = new ShardableService(3);
  
  for (let i = 0; i < 10; i++) {
    shardableService.set(`key${i}`, `value${i}`);
  }
  
  console.log('Shard stats:', shardableService.getShardStats());
  console.log('Get key5:', shardableService.get('key5'));
}

if (require.main === module) {
  demonstrateDesignForScale();
}

module.exports = {
  StatelessService,
  ScalableService,
  ScalableCache,
  ScalableConnectionPool,
  AsyncProcessor,
  ShardableService
};

