/**
 * Distributed Cache (Redis, Memcached)
 * 
 * SYSTEM DESIGN OVERVIEW:
 * =======================
 * This service provides a distributed caching system for fast data access across multiple servers.
 * 
 * CAPACITY ESTIMATION:
 * - Cache size: 100GB per node, 10 nodes = 1TB total
 * - Read operations: 100K ops/sec per node = 1M ops/sec total
 * - Write operations: 10K ops/sec per node = 100K ops/sec total
 * - Cache hit rate: 80% (20% cache misses)
 * 
 * ARCHITECTURE:
 * Client → Load Balancer → Cache Nodes (with Consistent Hashing) → Replication
 * 
 * KEY FEATURES:
 * - Consistent hashing for distribution
 * - Multiple eviction policies (LRU, LFU, FIFO)
 * - TTL (Time-To-Live) support
 * - Replication for fault tolerance
 * - Sub-millisecond latency
 * - High throughput (millions of operations/second)
 */

/**
 * Cache Node
 * 
 * REPRESENTS A SINGLE CACHE NODE IN THE DISTRIBUTED SYSTEM
 * ========================================================
 * Each node maintains its own in-memory cache with:
 * - Key-value storage (Map)
 * - Eviction policy tracking
 * - TTL management
 * - Statistics tracking
 * 
 * DATA STRUCTURES:
 * - data: Map<key, value> - Main cache storage
 * - ttl: Map<key, timestamp> - TTL expiration timestamps
 * - accessOrder: Array<key> - For LRU eviction (most recent at end)
 * - accessCount: Map<key, count> - For LFU eviction (access frequency)
 * - stats: Object - Hit/miss/set/eviction statistics
 * 
 * EVICTION POLICIES:
 * - LRU (Least Recently Used): Evict least recently accessed items
 * - LFU (Least Frequently Used): Evict least frequently accessed items
 * - FIFO (First In First Out): Evict oldest items
 * 
 * PERFORMANCE:
 * - Get: O(1) average case (Map lookup)
 * - Set: O(1) average case (Map insert)
 * - Evict: O(n) for LFU, O(1) for LRU/FIFO
 */
class CacheNode {
  /**
   * Constructor
   * 
   * @param {string} id - Unique node identifier
   * @param {Object} config - Configuration options
   * @param {number} config.maxSize - Maximum number of keys (default: 1000)
   * @param {string} config.evictionPolicy - Eviction policy: 'LRU', 'LFU', or 'FIFO' (default: 'LRU')
   * 
   * MEMORY MANAGEMENT:
   * - maxSize: Limits number of keys to prevent memory exhaustion
   * - When limit reached, eviction policy removes least valuable keys
   * - In production: Would also limit by memory size (bytes)
   */
  constructor(id, config = {}) {
    this.id = id;
    
    /**
     * MAIN CACHE STORAGE
     * ==================
     * Map provides O(1) average case for get/set/delete operations.
     * In production, would use optimized hash table implementation.
     */
    this.data = new Map();
    
    /**
     * CONFIGURATION
     * =============
     * maxSize: Maximum number of keys before eviction
     * evictionPolicy: Algorithm for selecting keys to evict
     */
    this.maxSize = config.maxSize || 1000;
    this.evictionPolicy = config.evictionPolicy || 'LRU';
    
    /**
     * EVICTION TRACKING
     * =================
     * accessOrder: Array for LRU - tracks access order (oldest first)
     * accessCount: Map for LFU - tracks access frequency per key
     */
    this.accessOrder = [];
    this.accessCount = new Map();
    
    /**
     * TTL (TIME-TO-LIVE) MANAGEMENT
     * =============================
     * Maps each key to its expiration timestamp.
     * Keys are automatically deleted when TTL expires.
     */
    this.ttl = new Map();
    
    /**
     * STATISTICS TRACKING
     * ===================
     * Tracks cache performance metrics:
     * - hits: Successful cache lookups
     * - misses: Failed cache lookups (key not found)
     * - sets: Number of set operations
     * - evictions: Number of keys evicted due to size limit
     * 
     * USED FOR:
     * - Monitoring cache performance
     * - Calculating hit rate
     * - Capacity planning
     */
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Get value from cache
   * 
   * CACHE LOOKUP PROCESS:
   * =====================
   * 1. Check if key has TTL and if it's expired
   * 2. If expired: Delete key and return null (cache miss)
   * 3. If key exists: Update access tracking and return value (cache hit)
   * 4. If key doesn't exist: Return null (cache miss)
   * 
   * PERFORMANCE:
   * - Time Complexity: O(1) average case (Map lookup)
   * - Space Complexity: O(1)
   * 
   * TTL HANDLING:
   * - Automatic expiration check on every get
   * - Expired keys are deleted immediately
   * - In production: Background job could also clean expired keys
   * 
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    /**
     * STEP 1: CHECK TTL EXPIRATION
     * ============================
     * If key has TTL and current time > expiration time, key is expired.
     * Delete expired key and count as miss.
     */
    if (this.ttl.has(key) && Date.now() > this.ttl.get(key)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    /**
     * STEP 2: CHECK CACHE
     * ====================
     * If key exists in cache:
     * - Increment hit counter
     * - Update access tracking (for eviction policy)
     * - Return cached value
     */
    if (this.data.has(key)) {
      this.stats.hits++;
      this.updateAccess(key);
      return this.data.get(key);
    }

    /**
     * STEP 3: CACHE MISS
     * ==================
     * Key not found in cache.
     * In production, application would fetch from database/backend.
     */
    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache
   * 
   * CACHE WRITE PROCESS:
   * ===================
   * 1. Check if cache is full and key doesn't exist
   * 2. If full: Evict a key based on eviction policy
   * 3. Store key-value pair
   * 4. Update access tracking
   * 5. Set TTL if provided
   * 
   * EVICTION TRIGGER:
   * - Only evicts if cache is at maxSize AND key is new (not updating existing)
   * - Prevents unnecessary evictions on updates
   * 
   * TTL FORMAT:
   * - ttl: Time-to-live in milliseconds
   * - Example: 5000 = expires in 5 seconds
   * - null = no expiration (permanent until evicted)
   * 
   * PERFORMANCE:
   * - Time Complexity: O(1) average case (Map insert)
   * - Eviction: O(n) for LFU, O(1) for LRU/FIFO
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number|null} ttl - Time-to-live in milliseconds (optional)
   * @returns {boolean} True if successful
   */
  set(key, value, ttl = null) {
    /**
     * STEP 1: CHECK CAPACITY AND EVICT IF NEEDED
     * ============================================
     * Only evict if:
     * - Cache is at max capacity (size >= maxSize)
     * - Key doesn't already exist (new key, not update)
     * 
     * This prevents evicting when updating existing keys.
     */
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      this.evict();
    }

    /**
     * STEP 2: STORE KEY-VALUE PAIR
     * ============================
     * Map.set() provides O(1) average case insertion.
     */
    this.data.set(key, value);
    this.stats.sets++;
    
    /**
     * STEP 3: UPDATE ACCESS TRACKING
     * ===============================
     * Update eviction policy tracking (LRU access order, LFU frequency).
     */
    this.updateAccess(key);

    /**
     * STEP 4: SET TTL IF PROVIDED
     * ===========================
     * Store expiration timestamp = current time + TTL.
     * Key will be automatically deleted when accessed after expiration.
     */
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
 * 
 * CONSISTENT HASHING ALGORITHM
 * ============================
 * Distributes keys across cache nodes using a hash ring.
 * 
 * BENEFITS:
 * - Minimal data movement when nodes are added/removed
 * - Even distribution of keys across nodes
 * - Fault tolerance (handles node failures)
 * 
 * VIRTUAL NODES (REPLICAS):
 * - Each physical node has multiple virtual nodes on the ring
 * - Improves distribution (more even spread)
 * - Default: 3 replicas per physical node
 * - More replicas = better distribution but more memory
 * 
 * HASH RING:
 * - Ring size: 2^32 positions (0 to 4,294,967,295)
 * - Each node hashes to multiple positions on ring
 * - Keys hash to positions, assigned to next node clockwise
 * 
 * ALGORITHM:
 * 1. Hash key to get position on ring
 * 2. Find first node with hash >= key hash (clockwise)
 * 3. If no node found, wrap around to first node
 * 
 * PRODUCTION CONSIDERATIONS:
 * - Use MD5 or SHA-1 for hash function (better distribution)
 * - Monitor ring balance (ensure even distribution)
 * - Handle node failures gracefully
 */
class ConsistentHashing {
  /**
   * Constructor
   * 
   * @param {Array<CacheNode>} nodes - Array of cache nodes
   * @param {number} replicas - Number of virtual nodes per physical node (default: 3)
   * 
   * DATA STRUCTURES:
   * - ring: Map<hash, node> - Maps hash positions to nodes
   * - sortedKeys: Array<hash> - Sorted hash positions for binary search
   * - nodes: Array<CacheNode> - Physical cache nodes
   */
  constructor(nodes, replicas = 3) {
    this.replicas = replicas;
    this.ring = new Map(); // hash position -> node
    this.sortedKeys = []; // Sorted hash positions for efficient lookup
    this.nodes = []; // Physical cache nodes

    // Add all nodes to the hash ring
    nodes.forEach(node => this.addNode(node));
  }

  /**
   * Hash function
   * 
   * HASH FUNCTION
   * =============
   * Converts a key (string) into a numeric hash value.
   * 
   * ALGORITHM:
   * - Simple multiplicative hash (djb2-like)
   * - Uses bit shifting and addition
   * - Returns positive integer
   * 
   * PRODUCTION:
   * - Would use MD5 or SHA-1 for better distribution
   * - More uniform hash distribution
   * - Better collision resistance
   * 
   * @param {string} key - Key to hash
   * @returns {number} Hash value (0 to 2^32-1)
   */
  hash(key) {
    let hash = 0;
    const keyStr = String(key);
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      // Multiplicative hash: hash = hash * 31 + char
      hash = ((hash << 5) - hash) + char; // hash * 31 + char
      hash = hash & hash; // Convert to 32-bit integer
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
   * Get node for key using consistent hashing
   * 
   * NODE SELECTION ALGORITHM
   * ========================
   * 1. Hash the key to get position on ring
   * 2. Find first node with hash >= key hash (clockwise search)
   * 3. If no node found (key hash > all node hashes), wrap around to first node
   * 
   * PERFORMANCE:
   * - Time Complexity: O(n) linear search (could be O(log n) with binary search)
   * - In production: Use binary search on sortedKeys for O(log n)
   * 
   * DETERMINISTIC:
   * - Same key always maps to same node (unless nodes added/removed)
   * - Minimal data movement on node changes
   * 
   * @param {string} key - Cache key
   * @returns {CacheNode|null} Node responsible for this key, or null if no nodes
   */
  getNode(key) {
    if (this.sortedKeys.length === 0) {
      return null;
    }

    /**
     * STEP 1: HASH THE KEY
     * ====================
     * Convert key to hash position on ring.
     */
    const keyHash = this.hash(key);

    /**
     * STEP 2: FIND FIRST NODE CLOCKWISE
     * =================================
     * Search sorted hash positions for first node with hash >= key hash.
     * This implements the "clockwise" search on the hash ring.
     * 
     * OPTIMIZATION: In production, use binary search for O(log n) instead of O(n).
     */
    for (const ringHash of this.sortedKeys) {
      if (ringHash >= keyHash) {
        return this.ring.get(ringHash);
      }
    }

    /**
     * STEP 3: WRAP AROUND
     * ===================
     * If key hash > all node hashes, wrap around to first node.
     * This completes the circular hash ring.
     */
    return this.ring.get(this.sortedKeys[0]);
  }
}

/**
 * Distributed Cache
 * 
 * DISTRIBUTED CACHING SYSTEM
 * ==========================
 * Manages multiple cache nodes with consistent hashing and replication.
 * 
 * FEATURES:
 * - Consistent hashing for key distribution
 * - Replication for fault tolerance
 * - Automatic node management
 * - Statistics aggregation
 * 
 * REPLICATION:
 * - replicationFactor: Number of copies of each key (default: 2)
 * - Keys stored on primary node + replica nodes
 * - On primary miss, check replicas (read repair)
 * - On write, update all replicas
 * 
 * FAULT TOLERANCE:
 * - If primary node fails, read from replicas
 * - Automatic failover
 * - Data redundancy
 * 
 * SCALABILITY:
 * - Add/remove nodes dynamically
 * - Minimal data movement (consistent hashing)
 * - Horizontal scaling
 */
class DistributedCache {
  /**
   * Constructor
   * 
   * @param {Object} config - Configuration
   * @param {number} config.replicas - Virtual nodes per physical node (default: 3)
   * @param {number} config.replicationFactor - Number of copies per key (default: 2)
   * 
   * CONFIGURATION:
   * - replicas: More replicas = better distribution but more memory
   * - replicationFactor: More replicas = better fault tolerance but more storage
   */
  constructor(config = {}) {
    this.nodes = []; // Physical cache nodes
    this.replicas = config.replicas || 3; // Virtual nodes per physical node
    this.consistentHashing = null; // Consistent hashing ring
    this.replicationFactor = config.replicationFactor || 2; // Number of key copies
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
   * Get value from distributed cache
   * 
   * DISTRIBUTED LOOKUP PROCESS:
   * ==========================
   * 1. Use consistent hashing to find primary node for key
   * 2. Get value from primary node
   * 3. If not found and replication enabled, check replica nodes
   * 4. If found in replica, update primary (read repair)
   * 5. Return value or null
   * 
   * READ REPAIR:
   * - If primary has stale/missing data but replica has it
   * - Automatically update primary with replica data
   * - Ensures consistency across replicas
   * 
   * PERFORMANCE:
   * - Primary lookup: O(1) average case
   * - Replica lookup: O(r) where r = replicationFactor - 1
   * - Total: O(1) for cache hit, O(r) for cache miss with read repair
   * 
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null
   */
  async get(key) {
    /**
     * STEP 1: FIND PRIMARY NODE
     * =========================
     * Use consistent hashing to determine which node owns this key.
     */
    const node = this.consistentHashing.getNode(key);
    if (!node) {
      return null;
    }

    /**
     * STEP 2: GET FROM PRIMARY NODE
     * =============================
     * Try to get value from primary node first.
     */
    const value = node.get(key);
    
    /**
     * STEP 3: READ REPAIR (IF MISS AND REPLICATION ENABLED)
     * =====================================================
     * If primary node doesn't have the key but replication is enabled,
     * check replica nodes. If found in replica, update primary (read repair).
     * 
     * This handles cases where:
     * - Primary node lost data (crash, restart)
     * - Primary node has stale data
     * - Replication lag
     */
    if (value === null && this.replicationFactor > 1) {
      const replicaNodes = this.getReplicaNodes(key);
      for (const replicaNode of replicaNodes) {
        const replicaValue = replicaNode.get(key);
        if (replicaValue !== null) {
          // Read repair: Update primary with replica data
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

// Run demonstration if this file is executed directly
// ES module compatibility check
const isMainModule = typeof require !== 'undefined' && require.main === module;

if (isMainModule) {
  demonstrateDistributedCache();
}

module.exports = {
  CacheNode,
  ConsistentHashing,
  DistributedCache
};

