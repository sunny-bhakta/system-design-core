/**
 * Sharding Strategies Implementation
 * Demonstrates different sharding approaches
 */

/**
 * Range-Based Sharding
 */
class RangeBasedSharding {
  constructor(numShards) {
    this.numShards = numShards;
    this.shards = new Map();
    this.ranges = [];
    
    // Initialize shards
    for (let i = 0; i < numShards; i++) {
      this.shards.set(i, new Map());
    }
  }

  /**
   * Get shard for key based on range
   */
  getShard(key) {
    // Simple range-based: key % numShards
    const shardId = key % this.numShards;
    return shardId;
  }

  /**
   * Set value
   */
  set(key, value) {
    const shardId = this.getShard(key);
    this.shards.get(shardId).set(key, value);
    return { shardId, key, value };
  }

  /**
   * Get value
   */
  get(key) {
    const shardId = this.getShard(key);
    return this.shards.get(shardId).get(key);
  }

  /**
   * Get shard statistics
   */
  getStats() {
    const stats = {};
    for (let i = 0; i < this.numShards; i++) {
      stats[i] = {
        size: this.shards.get(i).size,
        keys: Array.from(this.shards.get(i).keys())
      };
    }
    return stats;
  }
}

/**
 * Hash-Based Sharding
 */
class HashBasedSharding {
  constructor(numShards) {
    this.numShards = numShards;
    this.shards = new Map();
    
    for (let i = 0; i < numShards; i++) {
      this.shards.set(i, new Map());
    }
  }

  /**
   * Simple hash function
   */
  hash(key) {
    let hash = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get shard for key based on hash
   */
  getShard(key) {
    const hashValue = this.hash(key);
    return hashValue % this.numShards;
  }

  /**
   * Set value
   */
  set(key, value) {
    const shardId = this.getShard(key);
    this.shards.get(shardId).set(key, value);
    return { shardId, key, value };
  }

  /**
   * Get value
   */
  get(key) {
    const shardId = this.getShard(key);
    return this.shards.get(shardId).get(key);
  }

  /**
   * Get shard statistics
   */
  getStats() {
    const stats = {};
    for (let i = 0; i < this.numShards; i++) {
      stats[i] = {
        size: this.shards.get(i).size
      };
    }
    return stats;
  }
}

/**
 * Directory-Based Sharding
 */
class DirectoryBasedSharding {
  constructor(numShards) {
    this.numShards = numShards;
    this.shards = new Map();
    this.directory = new Map(); // Key -> Shard mapping
    
    for (let i = 0; i < numShards; i++) {
      this.shards.set(i, new Map());
    }
  }

  /**
   * Get shard for key (with directory lookup)
   */
  getShard(key) {
    if (this.directory.has(key)) {
      return this.directory.get(key);
    }
    
    // Assign to shard (could be based on load, etc.)
    const shardId = Math.floor(Math.random() * this.numShards);
    this.directory.set(key, shardId);
    return shardId;
  }

  /**
   * Set value
   */
  set(key, value) {
    const shardId = this.getShard(key);
    this.shards.get(shardId).set(key, value);
    return { shardId, key, value };
  }

  /**
   * Get value
   */
  get(key) {
    const shardId = this.directory.get(key);
    if (shardId === undefined) {
      return undefined;
    }
    return this.shards.get(shardId).get(key);
  }

  /**
   * Rebalance: Move key to different shard
   */
  rebalance(key, newShardId) {
    const oldShardId = this.directory.get(key);
    if (oldShardId !== undefined) {
      const value = this.shards.get(oldShardId).get(key);
      this.shards.get(oldShardId).delete(key);
      this.shards.get(newShardId).set(key, value);
      this.directory.set(key, newShardId);
      return { key, oldShardId, newShardId };
    }
    return null;
  }

  /**
   * Get shard statistics
   */
  getStats() {
    const stats = {};
    for (let i = 0; i < this.numShards; i++) {
      stats[i] = {
        size: this.shards.get(i).size
      };
    }
    return stats;
  }
}

/**
 * Consistent Hashing
 */
class ConsistentHashing {
  constructor(numShards, virtualNodes = 3) {
    this.numShards = numShards;
    this.virtualNodes = virtualNodes;
    this.shards = new Map();
    this.ring = new Map(); // Hash value -> Shard ID
    this.sortedKeys = [];
    
    // Initialize shards
    for (let i = 0; i < numShards; i++) {
      this.shards.set(i, new Map());
    }
    
    // Create hash ring with virtual nodes
    this.buildRing();
  }

  /**
   * Hash function
   */
  hash(key) {
    let hash = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Build hash ring
   */
  buildRing() {
    this.ring.clear();
    this.sortedKeys = [];
    
    for (let shardId = 0; shardId < this.numShards; shardId++) {
      for (let v = 0; v < this.virtualNodes; v++) {
        const hashValue = this.hash(`${shardId}-${v}`);
        this.ring.set(hashValue, shardId);
        this.sortedKeys.push(hashValue);
      }
    }
    
    this.sortedKeys.sort((a, b) => a - b);
  }

  /**
   * Get shard for key using consistent hashing
   */
  getShard(key) {
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

  /**
   * Set value
   */
  set(key, value) {
    const shardId = this.getShard(key);
    this.shards.get(shardId).set(key, value);
    return { shardId, key, value };
  }

  /**
   * Get value
   */
  get(key) {
    const shardId = this.getShard(key);
    return this.shards.get(shardId).get(key);
  }

  /**
   * Add new shard
   */
  addShard() {
    const newShardId = this.numShards;
    this.numShards++;
    this.shards.set(newShardId, new Map());
    this.buildRing(); // Rebuild ring
    return newShardId;
  }

  /**
   * Remove shard
   */
  removeShard(shardId) {
    if (this.shards.has(shardId)) {
      // Move data to other shards (simplified)
      const data = this.shards.get(shardId);
      for (const [key, value] of data) {
        const newShardId = this.getShard(key);
        if (newShardId !== shardId) {
          this.shards.get(newShardId).set(key, value);
        }
      }
      
      this.shards.delete(shardId);
      this.buildRing(); // Rebuild ring
      this.numShards--;
    }
  }

  /**
   * Get shard statistics
   */
  getStats() {
    const stats = {};
    for (let i = 0; i < this.numShards; i++) {
      stats[i] = {
        size: this.shards.get(i).size
      };
    }
    return stats;
  }
}

// Example usage
function demonstrateSharding() {
  console.log('=== Range-Based Sharding ===\n');
  const rangeSharding = new RangeBasedSharding(3);
  for (let i = 1; i <= 10; i++) {
    rangeSharding.set(i, `value${i}`);
  }
  console.log('Stats:', rangeSharding.getStats());
  console.log('Get key 5:', rangeSharding.get(5));

  console.log('\n=== Hash-Based Sharding ===\n');
  const hashSharding = new HashBasedSharding(3);
  for (let i = 1; i <= 10; i++) {
    hashSharding.set(`user${i}`, `value${i}`);
  }
  console.log('Stats:', hashSharding.getStats());
  console.log('Get user5:', hashSharding.get('user5'));

  console.log('\n=== Directory-Based Sharding ===\n');
  const dirSharding = new DirectoryBasedSharding(3);
  for (let i = 1; i <= 10; i++) {
    dirSharding.set(`key${i}`, `value${i}`);
  }
  console.log('Stats:', dirSharding.getStats());
  dirSharding.rebalance('key5', 2);
  console.log('After rebalance:', dirSharding.getStats());

  console.log('\n=== Consistent Hashing ===\n');
  const consistentHashing = new ConsistentHashing(3, 3);
  for (let i = 1; i <= 10; i++) {
    consistentHashing.set(`key${i}`, `value${i}`);
  }
  console.log('Stats:', consistentHashing.getStats());
  console.log('Adding new shard...');
  consistentHashing.addShard();
  console.log('Stats after adding shard:', consistentHashing.getStats());
}

if (require.main === module) {
  demonstrateSharding();
}

module.exports = {
  RangeBasedSharding,
  HashBasedSharding,
  DirectoryBasedSharding,
  ConsistentHashing
};

