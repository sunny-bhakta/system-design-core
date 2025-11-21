/**
 * Distributed Cache (Redis, Memcached)
 * Design a distributed caching system for fast data access
 */

/**
 * Cache Node
 */
class CacheNode {
  constructor(id, config = {}) {
    this.id = id;
    this.data = new Map();
    this.maxSize = config.maxSize || 1000;
    this.evictionPolicy = config.evictionPolicy || 'LRU';
    this.accessOrder = [];
    this.accessCount = new Map();
    this.ttl = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Get value
   */
  get(key) {
    // Check TTL
    if (this.ttl.has(key) && Date.now() > this.ttl.get(key)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    if (this.data.has(key)) {
      this.stats.hits++;
      this.updateAccess(key);
      return this.data.get(key);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value
   */
  set(key, value, ttl = null) {
    // Evict if needed
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      this.evict();
    }

    this.data.set(key, value);
    this.stats.sets++;
    this.updateAccess(key);

    if (ttl) {
      this.ttl.set(key, Date.now() + ttl);
    }

    return true;
  }

  /**
   * Delete key
   */
  delete(key) {
    const deleted = this.data.delete(key);
    this.ttl.delete(key);
    this.removeFromAccess(key);
    return deleted;
  }

  /**
   * Update access tracking
   */
  updateAccess(key) {
    if (this.evictionPolicy === 'LRU') {
      this.removeFromAccess(key);
      this.accessOrder.push(key);
    } else if (this.evictionPolicy === 'LFU') {
      this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    }
  }

  removeFromAccess(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict based on policy
   */
  evict() {
    if (this.data.size === 0) return;

    let keyToEvict = null;

    if (this.evictionPolicy === 'LRU') {
      keyToEvict = this.accessOrder[0];
    } else if (this.evictionPolicy === 'LFU') {
      let minCount = Infinity;
      for (const [key, count] of this.accessCount.entries()) {
        if (count < minCount) {
          minCount = count;
          keyToEvict = key;
        }
      }
    } else if (this.evictionPolicy === 'FIFO') {
      keyToEvict = Array.from(this.data.keys())[0];
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      id: this.id,
      size: this.data.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%',
      evictions: this.stats.evictions,
      policy: this.evictionPolicy
    };
  }
}

/**
 * Consistent Hashing
 */
class ConsistentHashing {
  constructor(nodes, replicas = 3) {
    this.replicas = replicas;
    this.ring = new Map();
    this.sortedKeys = [];
    this.nodes = [];

    nodes.forEach(node => this.addNode(node));
  }

  /**
   * Hash function
   */
  hash(key) {
    let hash = 0;
    const keyStr = String(key);
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Add node
   */
  addNode(node) {
    this.nodes.push(node);

    for (let i = 0; i < this.replicas; i++) {
      const hash = this.hash(`${node.id}:${i}`);
      this.ring.set(hash, node);
      this.sortedKeys.push(hash);
    }

    this.sortedKeys.sort((a, b) => a - b);
  }

  /**
   * Remove node
   */
  removeNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;

    this.nodes = this.nodes.filter(n => n.id !== nodeId);

    for (let i = 0; i < this.replicas; i++) {
      const hash = this.hash(`${nodeId}:${i}`);
      this.ring.delete(hash);
      this.sortedKeys = this.sortedKeys.filter(k => k !== hash);
    }

    return true;
  }

  /**
   * Get node for key
   */
  getNode(key) {
    if (this.sortedKeys.length === 0) {
      return null;
    }

    const keyHash = this.hash(key);

    // Find first node with hash >= keyHash
    for (const ringHash of this.sortedKeys) {
      if (ringHash >= keyHash) {
        return this.ring.get(ringHash);
      }
    }

    // Wrap around to first node
    return this.ring.get(this.sortedKeys[0]);
  }
}

/**
 * Distributed Cache
 */
class DistributedCache {
  constructor(config = {}) {
    this.nodes = [];
    this.replicas = config.replicas || 3;
    this.consistentHashing = null;
    this.replicationFactor = config.replicationFactor || 2;
  }

  /**
   * Add cache node
   */
  addNode(nodeId, config = {}) {
    const node = new CacheNode(nodeId, config);
    this.nodes.push(node);
    
    // Rebuild consistent hashing
    this.consistentHashing = new ConsistentHashing(this.nodes, this.replicas);
    
    return node;
  }

  /**
   * Get value
   */
  async get(key) {
    const node = this.consistentHashing.getNode(key);
    if (!node) {
      return null;
    }

    const value = node.get(key);
    
    // If not found, try replica nodes
    if (value === null && this.replicationFactor > 1) {
      const replicaNodes = this.getReplicaNodes(key);
      for (const replicaNode of replicaNodes) {
        const replicaValue = replicaNode.get(key);
        if (replicaValue !== null) {
          // Update primary node
          node.set(key, replicaValue);
          return replicaValue;
        }
      }
    }

    return value;
  }

  /**
   * Set value
   */
  async set(key, value, ttl = null) {
    const node = this.consistentHashing.getNode(key);
    if (!node) {
      throw new Error('No cache node available');
    }

    // Set in primary node
    node.set(key, value, ttl);

    // Replicate to replica nodes
    if (this.replicationFactor > 1) {
      const replicaNodes = this.getReplicaNodes(key);
      for (const replicaNode of replicaNodes) {
        replicaNode.set(key, value, ttl);
      }
    }

    return true;
  }

  /**
   * Delete key
   */
  async delete(key) {
    const node = this.consistentHashing.getNode(key);
    if (!node) {
      return false;
    }

    const deleted = node.delete(key);

    // Delete from replicas
    if (this.replicationFactor > 1) {
      const replicaNodes = this.getReplicaNodes(key);
      for (const replicaNode of replicaNodes) {
        replicaNode.delete(key);
      }
    }

    return deleted;
  }

  /**
   * Get replica nodes for key
   */
  getReplicaNodes(key) {
    const primaryNode = this.consistentHashing.getNode(key);
    const replicas = [];
    const seen = new Set([primaryNode.id]);

    // Get next nodes in ring
    const keyHash = this.consistentHashing.hash(key);
    const sortedKeys = [...this.consistentHashing.sortedKeys].sort((a, b) => a - b);
    const startIndex = sortedKeys.findIndex(h => h >= keyHash);

    for (let i = 0; i < this.replicationFactor - 1 && replicas.length < this.replicationFactor - 1; i++) {
      const index = (startIndex + i + 1) % sortedKeys.length;
      const node = this.consistentHashing.ring.get(sortedKeys[index]);
      if (node && !seen.has(node.id)) {
        replicas.push(node);
        seen.add(node.id);
      }
    }

    return replicas;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalNodes: this.nodes.length,
      nodes: this.nodes.map(n => n.getStats()),
      overallHitRate: this.calculateOverallHitRate()
    };
  }

  calculateOverallHitRate() {
    const totalHits = this.nodes.reduce((sum, n) => sum + n.stats.hits, 0);
    const totalMisses = this.nodes.reduce((sum, n) => sum + n.stats.misses, 0);
    const total = totalHits + totalMisses;
    return total > 0 ? ((totalHits / total) * 100).toFixed(2) + '%' : '0%';
  }
}

// Example usage
async function demonstrateDistributedCache() {
  console.log('=== Distributed Cache ===\n');

  const cache = new DistributedCache({ replicas: 3, replicationFactor: 2 });

  // Add nodes
  cache.addNode('node1', { maxSize: 100, evictionPolicy: 'LRU' });
  cache.addNode('node2', { maxSize: 100, evictionPolicy: 'LRU' });
  cache.addNode('node3', { maxSize: 100, evictionPolicy: 'LRU' });

  // Set values
  console.log('=== Setting Values ===\n');
  await cache.set('key1', 'value1', 5000);
  await cache.set('key2', 'value2');
  await cache.set('key3', 'value3', 10000);

  // Get values
  console.log('=== Getting Values ===\n');
  const value1 = await cache.get('key1');
  console.log('Get key1:', value1);

  const value2 = await cache.get('key2');
  console.log('Get key2:', value2);

  // Test cache hit
  const value1Again = await cache.get('key1');
  console.log('Get key1 again (should be cached):', value1Again);

  // Statistics
  console.log('\n=== Cache Statistics ===\n');
  console.log(cache.getStats());
}

if (require.main === module) {
  demonstrateDistributedCache();
}

module.exports = {
  CacheNode,
  ConsistentHashing,
  DistributedCache
};

