/**
 * Caching Strategies Implementation
 * Demonstrates Cache-Aside, Write-Through, Write-Behind, and Refresh-Ahead
 */

class Cache {
  constructor(maxSize = 100, ttl = 3600000) {
    this.data = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl; // Time to live in milliseconds
    this.accessOrder = []; // For LRU
    this.accessCount = new Map(); // For LFU
  }

  get(key) {
    const item = this.data.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);

    return item.value;
  }

  set(key, value, customTTL = null) {
    const expiresAt = Date.now() + (customTTL || this.ttl);

    // Evict if at capacity
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      this.evictLRU();
    }

    this.data.set(key, { value, expiresAt, createdAt: Date.now() });
    this.updateAccessOrder(key);
  }

  delete(key) {
    this.data.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessCount.delete(key);
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
      this.delete(lruKey);
    }
  }

  clear() {
    this.data.clear();
    this.accessOrder = [];
    this.accessCount.clear();
  }

  size() {
    return this.data.size;
  }
}

/**
 * Cache-Aside (Lazy Loading) Strategy
 */
class CacheAside {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
  }

  async get(key) {
    // Try cache first
    let value = this.cache.get(key);
    if (value !== null) {
      console.log(`Cache hit for key: ${key}`);
      return value;
    }

    // Cache miss - fetch from database
    console.log(`Cache miss for key: ${key}, fetching from database`);
    value = await this.database.get(key);
    
    if (value !== null) {
      // Store in cache for future requests
      this.cache.set(key, value);
    }

    return value;
  }

  async set(key, value) {
    // Write to database
    await this.database.set(key, value);
    
    // Update cache
    this.cache.set(key, value);
    
    return value;
  }

  async delete(key) {
    await this.database.delete(key);
    this.cache.delete(key);
  }
}

/**
 * Write-Through Strategy
 */
class WriteThrough {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
  }

  async get(key) {
    // Try cache first
    let value = this.cache.get(key);
    if (value !== null) {
      return value;
    }

    // Cache miss - fetch from database
    value = await this.database.get(key);
    if (value !== null) {
      this.cache.set(key, value);
    }

    return value;
  }

  async set(key, value) {
    // Write to both cache and database simultaneously
    // Both must succeed
    try {
      await this.database.set(key, value);
      this.cache.set(key, value);
      return value;
    } catch (error) {
      // Rollback cache on database failure
      this.cache.delete(key);
      throw error;
    }
  }

  async delete(key) {
    await this.database.delete(key);
    this.cache.delete(key);
  }
}

/**
 * Write-Behind (Write-Back) Strategy
 */
class WriteBehind {
  constructor(cache, database) {
    this.cache = cache;
    this.database = database;
    this.writeQueue = [];
    this.flushInterval = 5000; // 5 seconds
    this.flushing = false;
    
    // Start background flush process
    this.startFlushProcess();
  }

  async get(key) {
    // Try cache first
    let value = this.cache.get(key);
    if (value !== null) {
      return value;
    }

    // Cache miss - fetch from database
    value = await this.database.get(key);
    if (value !== null) {
      this.cache.set(key, value);
    }

    return value;
  }

  async set(key, value) {
    // Write to cache immediately
    this.cache.set(key, value);
    
    // Queue for async database write
    this.writeQueue.push({ key, value, timestamp: Date.now() });
    
    return value;
  }

  async delete(key) {
    this.cache.delete(key);
    this.writeQueue.push({ key, value: null, delete: true, timestamp: Date.now() });
  }

  async flush() {
    if (this.flushing || this.writeQueue.length === 0) {
      return;
    }

    this.flushing = true;
    const writes = [...this.writeQueue];
    this.writeQueue = [];

    for (const write of writes) {
      try {
        if (write.delete) {
          await this.database.delete(write.key);
        } else {
          await this.database.set(write.key, write.value);
        }
      } catch (error) {
        console.error(`Failed to flush write for key ${write.key}:`, error);
        // Could re-queue failed writes
      }
    }

    this.flushing = false;
  }

  startFlushProcess() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  async shutdown() {
    // Flush remaining writes
    while (this.writeQueue.length > 0) {
      await this.flush();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Refresh-Ahead Strategy
 */
class RefreshAhead {
  constructor(cache, database, refreshThreshold = 0.8) {
    this.cache = cache;
    this.database = database;
    this.refreshThreshold = refreshThreshold; // Refresh when 80% of TTL elapsed
    this.refreshing = new Set();
  }

  async get(key) {
    const item = this.cache.data.get(key);
    
    if (!item) {
      // Cache miss - fetch from database
      return await this.fetchAndCache(key);
    }

    const age = Date.now() - item.createdAt;
    const ttl = item.expiresAt - item.createdAt;
    const ageRatio = age / ttl;

    // If close to expiration, refresh in background
    if (ageRatio >= this.refreshThreshold && !this.refreshing.has(key)) {
      this.refreshing.add(key);
      this.refreshInBackground(key);
    }

    // Return cached value (may be slightly stale)
    return item.value;
  }

  async fetchAndCache(key) {
    const value = await this.database.get(key);
    if (value !== null) {
      this.cache.set(key, value);
    }
    return value;
  }

  async refreshInBackground(key) {
    try {
      const value = await this.database.get(key);
      if (value !== null) {
        this.cache.set(key, value);
        console.log(`Refreshed cache for key: ${key}`);
      }
    } catch (error) {
      console.error(`Failed to refresh key ${key}:`, error);
    } finally {
      this.refreshing.delete(key);
    }
  }

  async set(key, value) {
    await this.database.set(key, value);
    this.cache.set(key, value);
    return value;
  }
}

// Mock Database
class MockDatabase {
  constructor() {
    this.data = new Map();
    this.latency = 100; // Simulate database latency
  }

  async get(key) {
    await this.simulateLatency();
    return this.data.get(key) || null;
  }

  async set(key, value) {
    await this.simulateLatency();
    this.data.set(key, value);
    return value;
  }

  async delete(key) {
    await this.simulateLatency();
    this.data.delete(key);
  }

  async simulateLatency() {
    return new Promise(resolve => setTimeout(resolve, this.latency));
  }
}

// Example usage
async function demonstrateCachingStrategies() {
  const database = new MockDatabase();
  const cache = new Cache(10, 10000); // 10 items, 10 second TTL

  console.log('=== Cache-Aside Strategy ===');
  const cacheAside = new CacheAside(cache, database);
  await cacheAside.set('user1', 'Alice');
  console.log('Get user1:', await cacheAside.get('user1'));
  console.log('Get user1 again (should be cache hit):', await cacheAside.get('user1'));

  console.log('\n=== Write-Through Strategy ===');
  const writeThrough = new WriteThrough(new Cache(), database);
  await writeThrough.set('user2', 'Bob');
  console.log('Get user2:', await writeThrough.get('user2'));

  console.log('\n=== Write-Behind Strategy ===');
  const writeBehind = new WriteBehind(new Cache(), database);
  await writeBehind.set('user3', 'Charlie');
  console.log('Get user3 (immediate):', await writeBehind.get('user3'));
  console.log('Waiting for flush...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  await writeBehind.shutdown();

  console.log('\n=== Refresh-Ahead Strategy ===');
  const refreshAhead = new RefreshAhead(new Cache(10, 5000), database, 0.8);
  await refreshAhead.set('user4', 'David');
  console.log('Get user4:', await refreshAhead.get('user4'));
  await new Promise(resolve => setTimeout(resolve, 4500)); // Wait for refresh threshold
  console.log('Get user4 again (should trigger refresh):', await refreshAhead.get('user4'));
  await new Promise(resolve => setTimeout(resolve, 1000));
}

if (require.main === module) {
  demonstrateCachingStrategies().catch(console.error);
}

module.exports = {
  Cache,
  CacheAside,
  WriteThrough,
  WriteBehind,
  RefreshAhead
};

